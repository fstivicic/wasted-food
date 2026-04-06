import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, Upload, Loader2, Check, X, ScanLine } from 'lucide-react'
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

  const [step, setStep] = useState<'capture' | 'ocr' | 'ai' | 'review'>('capture')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [supplierName, setSupplierName] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [confidence, setConfidence] = useState(0)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [supRes, ingRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id),
    ])
    setSuppliers(supRes.data || [])
    setIngredients(ingRes.data || [])
  }, [restaurant])

  async function handleFile(file: File) {
    setError(null)
    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    await loadData()

    // Step 1: OCR
    setStep('ocr')
    try {
      const worker = await createWorker('hrv+eng')
      const { data } = await worker.recognize(file)
      setOcrText(data.text)
      await worker.terminate()
    } catch {
      setError('OCR failed. Please try again with a clearer image.')
      setStep('capture')
      return
    }
  }

  // After OCR, trigger AI structuring
  async function processWithAI() {
    setStep('ai')
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-invoice', {
        body: { ocr_text: ocrText }
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
      setStep('review')
    } catch {
      // Fallback: parse OCR text manually
      setError('AI structuring unavailable. You can manually add items.')
      setExtractedItems([{ product_name: '', quantity: 1, unit: 'kg', unit_price: 0, total: 0, ingredient_id: null, create_new: true }])
      setStep('review')
    }
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
      // Upload image
      let uploadedUrl: string | null = null
      if (imageFile) {
        const path = `invoices/${restaurant.id}/${Date.now()}_${imageFile.name}`
        const { error: uploadErr } = await supabase.storage.from('invoice-images').upload(path, imageFile)
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('invoice-images').getPublicUrl(path)
          uploadedUrl = urlData.publicUrl
        }
      }

      // Create invoice
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

      // Create invoice items and update inventory
      for (const item of extractedItems) {
        let ingredientId = item.ingredient_id

        // Create new ingredient if needed
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

        // Create invoice item
        await supabase.from('invoice_items').insert({
          invoice_id: invoice.id,
          ingredient_id: ingredientId,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: item.unit || 'kg',
          unit_price: item.unit_price,
          total: item.total,
        })

        // Update ingredient stock
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

            // Record price history
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

      // Reset
      setStep('capture')
      setImageUrl(null)
      setImageFile(null)
      setOcrText('')
      setExtractedItems([])
      setError(null)
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('scan.title')}</h1>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {/* Step: Capture */}
      {step === 'capture' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <ScanLine className="w-16 h-16 text-brand-400" />
          <p className="text-slate-400 text-center max-w-sm">Take a photo of your supplier invoice or upload an image. AI will extract items, quantities, and prices.</p>
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors"
            >
              <Camera className="w-5 h-5" />
              {t('scan.capture')}
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
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Step: OCR Processing */}
      {step === 'ocr' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
          <p className="text-slate-300 font-medium">{t('scan.ocr_running')}</p>
          {imageUrl && <img src={imageUrl} alt="Invoice" className="max-w-xs rounded-xl border border-slate-700" />}
          {ocrText && (
            <div className="w-full max-w-lg">
              <p className="text-xs text-slate-500 mb-1">Raw OCR text:</p>
              <pre className="text-xs text-slate-400 bg-slate-900 p-3 rounded-xl max-h-40 overflow-y-auto whitespace-pre-wrap">{ocrText}</pre>
              <button onClick={processWithAI} className="mt-3 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
                {t('scan.ai_running')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: AI Processing */}
      {step === 'ai' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
          <p className="text-slate-300 font-medium">{t('scan.ai_running')}</p>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t('scan.review')}</h2>
            {confidence > 0 && (
              <span className="text-xs text-slate-400">{t('scan.confidence')}: {(confidence * 100).toFixed(0)}%</span>
            )}
          </div>

          {/* Supplier & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('scan.supplier')}</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— {supplierName || 'Select'} —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('scan.invoice_date')}</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left py-2 px-2 font-medium">{t('scan.product')}</th>
                  <th className="text-right py-2 px-2 font-medium">{t('scan.quantity')}</th>
                  <th className="text-right py-2 px-2 font-medium">{t('scan.unit_price')}</th>
                  <th className="text-right py-2 px-2 font-medium">{t('scan.total')}</th>
                  <th className="text-left py-2 px-2 font-medium">{t('scan.match_ingredient')}</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {extractedItems.map((item, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-2 px-2">
                      <input type="text" value={item.product_name} onChange={e => updateItem(i, { product_name: e.target.value })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" step="0.01" value={item.quantity} onChange={e => { const q = +e.target.value; updateItem(i, { quantity: q, total: q * item.unit_price }) }} className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-right" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" step="0.01" value={item.unit_price} onChange={e => { const p = +e.target.value; updateItem(i, { unit_price: p, total: item.quantity * p }) }} className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-right" />
                    </td>
                    <td className="py-2 px-2 text-right text-white">{formatCurrency(item.total)}</td>
                    <td className="py-2 px-2">
                      <select value={item.ingredient_id || '__new__'} onChange={e => updateItem(i, { ingredient_id: e.target.value === '__new__' ? null : e.target.value, create_new: e.target.value === '__new__' })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                        <option value="__new__">{t('scan.create_new')}</option>
                        {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addItem} className="text-sm text-brand-400 hover:text-brand-300">+ Add item</button>

          {/* Totals & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <p className="text-sm text-slate-400">
              Total: <span className="text-white font-medium">{formatCurrency(extractedItems.reduce((s, i) => s + i.total, 0))}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setStep('capture'); setError(null) }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
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
