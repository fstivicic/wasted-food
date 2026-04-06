import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, Upload, Loader2, Check, X, ScanLine, Video, VideoOff } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Ingredient, Supplier, InvoiceStructuredData } from '@/types/database'
import { createWorker } from 'tesseract.js'

interface ExtractedItem {
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  ingredient_id: string | null
  create_new: boolean
}

export default function ScanPage() {
  const { t } = useTranslation()
  const { restaurant, user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [step, setStep] = useState<'capture' | 'camera' | 'ocr' | 'review'>('capture')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [supplierName, setSupplierName] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [confidence, setConfidence] = useState(0)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [supRes, ingRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id),
    ])
    setSuppliers(supRes.data || [])
    setIngredients(ingRes.data || [])
  }, [restaurant])

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  async function startCamera() {
    setCameraError(null)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      setStep('camera')
      await loadData()
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 50)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setCameraError(t('scan.camera_denied'))
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError(t('scan.no_camera'))
      } else {
        setCameraError(t('scan.camera_error'))
      }
    }
  }

  function captureFromCamera() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    stopCamera()

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `invoice-${Date.now()}.jpg`, { type: 'image/jpeg' })
      await processImage(file)
    }, 'image/jpeg', 0.92)
  }

  async function handleFileUpload(file: File) {
    await loadData()
    await processImage(file)
  }

  async function processImage(file: File) {
    setError(null)
    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    setStep('ocr')
    setOcrProgress(0)

    try {
      const worker = await createWorker('hrv+eng', undefined, {
        logger: (m: any) => {
          if (m.progress) setOcrProgress(Math.round(m.progress * 100))
        }
      })
      const { data } = await worker.recognize(file)
      setOcrText(data.text)
      await worker.terminate()

      // auto-process with AI immediately
      await structureWithAI(data.text)
    } catch {
      setError(t('scan.ocr_failed'))
      setStep('capture')
    }
  }

  async function structureWithAI(text: string) {
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-invoice', {
        body: { ocr_text: text }
      })
      if (fnError) throw fnError

      const structured = data as InvoiceStructuredData
      setSupplierName(structured.supplier_name || '')
      if (structured.invoice_date) setInvoiceDate(structured.invoice_date)
      setConfidence(structured.confidence || 0)

      setExtractedItems((structured.line_items || []).map(item => ({
        ...item,
        unit: item.unit || 'kom',
        ingredient_id: findMatchingIngredient(item.product_name),
        create_new: false,
      })))
    } catch {
      setError(t('scan.ai_unavailable'))
      setExtractedItems([{ product_name: '', quantity: 1, unit: 'kg', unit_price: 0, total: 0, ingredient_id: null, create_new: true }])
    }
    setStep('review')
  }

  function findMatchingIngredient(name: string): string | null {
    const lower = name.toLowerCase()
    const match = ingredients.find(i => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()))
    return match?.id || null
  }

  async function handleApprove() {
    if (!restaurant || !user) return
    setSubmitting(true)

    try {
      let uploadedUrl: string | null = null
      if (imageFile) {
        const path = `invoices/${restaurant.id}/${Date.now()}_${imageFile.name}`
        const { error: uploadErr } = await supabase.storage.from('invoice-images').upload(path, imageFile)
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('invoice-images').getPublicUrl(path)
          uploadedUrl = urlData.publicUrl
        }
      }

      const { data: invoice, error: invError } = await supabase.from('invoices').insert({
        restaurant_id: restaurant.id,
        supplier_id: selectedSupplier || null,
        invoice_number: null,
        invoice_date: invoiceDate,
        total: extractedItems.reduce((s, i) => s + i.total, 0),
        image_url: uploadedUrl,
        raw_ocr_text: ocrText,
        structured_data: { supplier_name: supplierName, invoice_date: invoiceDate, line_items: extractedItems, confidence } as InvoiceStructuredData,
        status: 'approved',
        created_by: user.id,
      }).select().single()

      if (invError) throw invError

      for (const item of extractedItems) {
        let ingredientId = item.ingredient_id

        if (!ingredientId && item.create_new && item.product_name) {
          const { data: newIng } = await supabase.from('ingredients').insert({
            restaurant_id: restaurant.id,
            name: item.product_name,
            category: 'other',
            unit: item.unit || 'kg',
            current_stock: 0,
            par_level: 0,
            avg_cost: item.unit_price,
            last_cost: item.unit_price,
          }).select().single()
          ingredientId = newIng?.id || null
        }

        await supabase.from('invoice_items').insert({
          invoice_id: invoice.id,
          ingredient_id: ingredientId,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: item.unit || 'kg',
          unit_price: item.unit_price,
          total: item.total,
        })

        if (ingredientId) {
          const { data: ing } = await supabase.from('ingredients').select('*').eq('id', ingredientId).single()
          if (ing) {
            const newStock = ing.current_stock + item.quantity
            const newAvgCost = ing.current_stock > 0
              ? ((ing.avg_cost * ing.current_stock) + (item.unit_price * item.quantity)) / newStock
              : item.unit_price
            await supabase.from('ingredients').update({
              current_stock: newStock,
              avg_cost: Math.round(newAvgCost * 100) / 100,
              last_cost: item.unit_price,
            }).eq('id', ingredientId)

            if (item.unit_price !== ing.last_cost) {
              await supabase.from('price_history').insert({
                ingredient_id: ingredientId,
                unit_price: item.unit_price,
                supplier_id: selectedSupplier || null,
                recorded_at: new Date().toISOString(),
              })
            }
          }
        }
      }

      resetAll()
      alert(t('common.success'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function updateItem(index: number, changes: Partial<ExtractedItem>) {
    setExtractedItems(items => items.map((item, i) => i === index ? { ...item, ...changes } : item))
  }

  function removeItem(index: number) {
    setExtractedItems(items => items.filter((_, i) => i !== index))
  }

  function addItem() {
    setExtractedItems(items => [...items, { product_name: '', quantity: 1, unit: 'kg', unit_price: 0, total: 0, ingredient_id: null, create_new: true }])
  }

  function resetAll() {
    stopCamera()
    setStep('capture')
    setImageUrl(null)
    setImageFile(null)
    setOcrText('')
    setOcrProgress(0)
    setExtractedItems([])
    setError(null)
    setCameraError(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('scan.title')}</h1>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}
      {cameraError && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">{cameraError}</div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Step: Capture */}
      {step === 'capture' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-20 h-20 rounded-2xl bg-brand-600/15 flex items-center justify-center">
            <ScanLine className="w-10 h-10 text-brand-400" />
          </div>
          <p className="text-slate-400 text-center max-w-sm text-sm">{t('scan.description')}</p>
          <div className="flex gap-3">
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors"
            >
              <Camera className="w-5 h-5" />
              {t('scan.open_camera')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors"
            >
              <Upload className="w-5 h-5" />
              {t('scan.upload')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = '' }}
          />
        </div>
      )}

      {/* Step: Live Camera */}
      {step === 'camera' && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full max-w-lg rounded-xl overflow-hidden border border-slate-700 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-brand-400 rounded-tl" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-brand-400 rounded-tr" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-brand-400 rounded-bl" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-brand-400 rounded-br" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={captureFromCamera} className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors">
              <Video className="w-5 h-5" />
              {t('scan.take_photo')}
            </button>
            <button onClick={() => { stopCamera(); setStep('capture') }} className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors">
              <VideoOff className="w-5 h-5" />
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Step: OCR Processing (auto-proceeds to review) */}
      {step === 'ocr' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
          <p className="text-slate-300 font-medium">{t('scan.processing')}</p>
          <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
          </div>
          <p className="text-xs text-slate-500">{ocrProgress < 100 ? t('scan.ocr_running') : t('scan.ai_running')}</p>
          {imageUrl && <img src={imageUrl} alt="Invoice" className="max-w-xs rounded-xl border border-slate-700 mt-2" />}
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t('scan.review')}</h2>
            <div className="flex items-center gap-2">
              {confidence > 0 && (
                <span className="text-xs text-slate-400">{t('scan.confidence')}: {(confidence * 100).toFixed(0)}%</span>
              )}
              <button onClick={resetAll} className="text-xs text-slate-500 hover:text-white">{t('scan.start_over')}</button>
            </div>
          </div>

          {imageUrl && (
            <div className="flex gap-4">
              <img src={imageUrl} alt="Invoice" className="w-24 h-24 object-cover rounded-lg border border-slate-700 flex-shrink-0" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('scan.supplier')}</label>
                  <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">— {supplierName || 'Select'} —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('scan.invoice_date')}</label>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {extractedItems.map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap">
                <input type="text" value={item.product_name} onChange={e => updateItem(i, { product_name: e.target.value })} placeholder={t('scan.product')} className="flex-1 min-w-[140px] px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
                <input type="number" step="0.01" value={item.quantity} onChange={e => { const q = +e.target.value; updateItem(i, { quantity: q, total: q * item.unit_price }) }} className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-right" placeholder={t('scan.quantity')} />
                <span className="text-xs text-slate-500">&times;</span>
                <input type="number" step="0.01" value={item.unit_price} onChange={e => { const p = +e.target.value; updateItem(i, { unit_price: p, total: item.quantity * p }) }} className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-right" placeholder={t('scan.unit_price')} />
                <span className="text-xs text-slate-400 w-16 text-right">{formatCurrency(item.total)}</span>
                <select value={item.ingredient_id || '__new__'} onChange={e => updateItem(i, { ingredient_id: e.target.value === '__new__' ? null : e.target.value, create_new: e.target.value === '__new__' })} className="w-32 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                  <option value="__new__">{t('scan.create_new')}</option>
                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                </select>
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-1"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          <button onClick={addItem} className="text-sm text-brand-400 hover:text-brand-300">+ {t('scan.add_item')}</button>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <p className="text-sm text-slate-400">
              Total: <span className="text-white font-medium">{formatCurrency(extractedItems.reduce((s, i) => s + i.total, 0))}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={resetAll} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
                {t('scan.reject')}
              </button>
              <button onClick={handleApprove} disabled={submitting || extractedItems.length === 0} className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('scan.approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
