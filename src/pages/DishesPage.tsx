import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { UtensilsCrossed, Plus, X, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Ingredient } from '@/types/database'

interface DishWithIngredients {
  id: string
  restaurant_id: string
  name: string
  category: string | null
  selling_price: number
  food_cost: number
  margin: number
  created_at: string
  dish_ingredients?: {
    id: string
    ingredient_id: string
    quantity: number
    ingredient?: { name: string; unit: string; avg_cost: number }
  }[]
}

export default function DishesPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const [dishes, setDishes] = useState<DishWithIngredients[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingDish, setEditingDish] = useState<DishWithIngredients | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [sellingPrice, setSellingPrice] = useState(0)
  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredient_id: string; quantity: number }[]>([])
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    if (!restaurant) return
    const [dishRes, ingRes] = await Promise.all([
      supabase.from('dishes').select('*, dish_ingredients(id, ingredient_id, quantity, ingredient:ingredients(name, unit, avg_cost))').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('ingredients').select('*').eq('restaurant_id', restaurant.id).order('name'),
    ])
    setDishes(dishRes.data || [])
    setIngredients(ingRes.data || [])
  }, [restaurant])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditingDish(null)
    setName('')
    setCategory('')
    setSellingPrice(0)
    setRecipeIngredients([])
    setShowForm(true)
  }

  function openEdit(dish: DishWithIngredients) {
    setEditingDish(dish)
    setName(dish.name)
    setCategory(dish.category || '')
    setSellingPrice(dish.selling_price)
    setRecipeIngredients((dish.dish_ingredients || []).map(di => ({ ingredient_id: di.ingredient_id, quantity: di.quantity })))
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    setSubmitting(true)

    // Calculate food cost
    const foodCost = recipeIngredients.reduce((sum, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredient_id)
      return sum + (ing?.avg_cost || 0) * ri.quantity
    }, 0)
    const margin = sellingPrice > 0 ? ((sellingPrice - foodCost) / sellingPrice) * 100 : 0

    if (editingDish) {
      await supabase.from('dishes').update({ name, category: category || null, selling_price: sellingPrice, food_cost: Math.round(foodCost * 100) / 100, margin: Math.round(margin * 10) / 10 }).eq('id', editingDish.id)
      // Replace recipe ingredients
      await supabase.from('dish_ingredients').delete().eq('dish_id', editingDish.id)
      if (recipeIngredients.length > 0) {
        await supabase.from('dish_ingredients').insert(recipeIngredients.map(ri => ({ dish_id: editingDish.id, ingredient_id: ri.ingredient_id, quantity: ri.quantity })))
      }
    } else {
      const { data: newDish } = await supabase.from('dishes').insert({ restaurant_id: restaurant.id, name, category: category || null, selling_price: sellingPrice, food_cost: Math.round(foodCost * 100) / 100, margin: Math.round(margin * 10) / 10 }).select().single()
      if (newDish && recipeIngredients.length > 0) {
        await supabase.from('dish_ingredients').insert(recipeIngredients.map(ri => ({ dish_id: newDish.id, ingredient_id: ri.ingredient_id, quantity: ri.quantity })))
      }
    }

    setShowForm(false)
    setSubmitting(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common.confirm_delete'))) return
    await supabase.from('dish_ingredients').delete().eq('dish_id', id)
    await supabase.from('dishes').delete().eq('id', id)
    loadData()
  }

  function addRecipeIngredient() {
    setRecipeIngredients(prev => [...prev, { ingredient_id: '', quantity: 0 }])
  }

  function updateRecipeIngredient(idx: number, changes: Partial<{ ingredient_id: string; quantity: number }>) {
    setRecipeIngredients(prev => prev.map((ri, i) => i === idx ? { ...ri, ...changes } : ri))
  }

  function removeRecipeIngredient(idx: number) {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('dishes.title')}</h1>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> {t('dishes.add')}
        </button>
      </div>

      {/* Dishes Grid */}
      {dishes.length === 0 ? (
        <div className="text-center py-12">
          <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{t('dishes.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dishes.map(dish => (
            <div key={dish.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors cursor-pointer" onClick={() => openEdit(dish)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{dish.name}</h3>
                  {dish.category && <p className="text-xs text-slate-500 mt-0.5">{dish.category}</p>}
                </div>
                <button onClick={e => { e.stopPropagation(); handleDelete(dish.id) }} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-slate-500">{t('dishes.selling_price')}</p>
                  <p className="text-sm font-medium text-white">{formatCurrency(dish.selling_price)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('dishes.cost')}</p>
                  <p className="text-sm font-medium text-red-400">{formatCurrency(dish.food_cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('dishes.margin')}</p>
                  <p className={`text-sm font-medium ${dish.margin >= 65 ? 'text-green-400' : dish.margin >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{dish.margin.toFixed(1)}%</p>
                </div>
              </div>
              {/* Recipe ingredients count */}
              {dish.dish_ingredients && dish.dish_ingredients.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">{dish.dish_ingredients.length} ingredients</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingDish ? t('common.edit') : t('dishes.add')}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t('dishes.name')}</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('dishes.category')}</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. main, dessert" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t('dishes.selling_price')}</label>
                  <input type="number" step="0.01" required value={sellingPrice || ''} onChange={e => setSellingPrice(+e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              {/* Recipe builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">{t('dishes.ingredients')}</label>
                  <button type="button" onClick={addRecipeIngredient} className="text-xs text-brand-400 hover:text-brand-300">+ Add</button>
                </div>
                {recipeIngredients.map((ri, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select value={ri.ingredient_id} onChange={e => updateRecipeIngredient(idx, { ingredient_id: e.target.value })} className="flex-1 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
                      <option value="">— Ingredient —</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                    </select>
                    <input type="number" step="0.001" placeholder="Qty" value={ri.quantity || ''} onChange={e => updateRecipeIngredient(idx, { quantity: +e.target.value })} className="w-24 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-right" />
                    <button type="button" onClick={() => removeRecipeIngredient(idx)} className="text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {recipeIngredients.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Est. food cost: {formatCurrency(recipeIngredients.reduce((s, ri) => { const ing = ingredients.find(i => i.id === ri.ingredient_id); return s + (ing?.avg_cost || 0) * ri.quantity }, 0))}
                    {sellingPrice > 0 && ` | Margin: ${(((sellingPrice - recipeIngredients.reduce((s, ri) => { const ing = ingredients.find(i => i.id === ri.ingredient_id); return s + (ing?.avg_cost || 0) * ri.quantity }, 0)) / sellingPrice) * 100).toFixed(1)}%`}
                  </p>
                )}
              </div>

              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                {t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
