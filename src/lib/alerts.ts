import { supabase } from './supabase'
import type { AlertType, Ingredient } from '@/types/database'

interface AlertInput {
  restaurant_id: string
  type: AlertType
  title: string
  message: string
  data?: Record<string, unknown>
}

async function createAlert(input: AlertInput) {
  await supabase.from('alerts').insert({
    restaurant_id: input.restaurant_id,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data || {},
    is_read: false,
  })
}

/**
 * After invoice approval: check for price spikes (>10%) and resulting margin erosion (<65%).
 */
export async function checkPriceAlerts(
  restaurantId: string,
  ingredientId: string,
  ingredientName: string,
  newPrice: number,
  oldPrice: number,
) {
  if (oldPrice <= 0 || newPrice <= oldPrice) return

  const increase = ((newPrice - oldPrice) / oldPrice) * 100

  // Price spike alert if increase > 10%
  if (increase >= 10) {
    await createAlert({
      restaurant_id: restaurantId,
      type: 'price_spike',
      title: `Price spike: ${ingredientName}`,
      message: `${ingredientName} price increased by ${Math.round(increase)}% (${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)})`,
      data: { ingredient_id: ingredientId, old_price: oldPrice, new_price: newPrice, increase_pct: Math.round(increase) },
    })

    // Check if this price spike erodes any dish margins below 65%
    const { data: dishIngredients } = await supabase
      .from('dish_ingredients')
      .select('dish_id, quantity, ingredient:ingredients(avg_cost)')
      .eq('ingredient_id', ingredientId)

    if (dishIngredients && dishIngredients.length > 0) {
      const dishIds = [...new Set(dishIngredients.map((di: { dish_id: string }) => di.dish_id))]

      for (const dishId of dishIds) {
        const { data: dish } = await supabase
          .from('dishes')
          .select('*, dish_ingredients(quantity, ingredient:ingredients(avg_cost))')
          .eq('id', dishId)
          .single()

        if (!dish) continue

        const foodCost = (dish.dish_ingredients || []).reduce((sum: number, di: { quantity: number; ingredient?: { avg_cost: number } }) => {
          return sum + (di.quantity * (di.ingredient?.avg_cost || 0))
        }, 0)

        const margin = dish.selling_price > 0
          ? ((dish.selling_price - foodCost) / dish.selling_price) * 100
          : 0

        if (margin < 65) {
          await createAlert({
            restaurant_id: restaurantId,
            type: 'margin_erosion',
            title: `Low margin: ${dish.name}`,
            message: `${dish.name} margin dropped to ${Math.round(margin)}% (target: 65%). ${ingredientName} price increase is the cause.`,
            data: { dish_id: dishId, margin: Math.round(margin), ingredient_id: ingredientId },
          })
        }
      }
    }
  }
}

/**
 * After stock is decremented (waste or other): check if ingredient fell below par level.
 */
export async function checkLowStockAlert(restaurantId: string, ingredient: Ingredient) {
  if (ingredient.par_level <= 0) return
  if (ingredient.current_stock >= ingredient.par_level) return

  const isCritical = ingredient.current_stock < ingredient.par_level * 0.5

  await createAlert({
    restaurant_id: restaurantId,
    type: 'low_stock',
    title: `${isCritical ? 'Critical' : 'Low'} stock: ${ingredient.name}`,
    message: `${ingredient.name} is at ${ingredient.current_stock} ${ingredient.unit} (par: ${ingredient.par_level} ${ingredient.unit})`,
    data: { ingredient_id: ingredient.id, current_stock: ingredient.current_stock, par_level: ingredient.par_level, critical: isCritical },
  })
}

/**
 * After waste log: check if waste value for this ingredient is unusually high (>20% of stock value).
 */
export async function checkWasteSpikeAlert(
  restaurantId: string,
  ingredient: Ingredient,
  wastedQty: number,
) {
  if (ingredient.par_level <= 0) return

  const wastePct = (wastedQty / ingredient.par_level) * 100

  // Alert if a single waste entry is >20% of par level
  if (wastePct >= 20) {
    const wasteCost = wastedQty * ingredient.avg_cost

    await createAlert({
      restaurant_id: restaurantId,
      type: 'waste_spike',
      title: `High waste: ${ingredient.name}`,
      message: `${wastedQty} ${ingredient.unit} of ${ingredient.name} wasted (${Math.round(wastePct)}% of par level, ~${wasteCost.toFixed(2)} cost)`,
      data: { ingredient_id: ingredient.id, quantity: wastedQty, cost: wasteCost, pct_of_par: Math.round(wastePct) },
    })
  }
}
