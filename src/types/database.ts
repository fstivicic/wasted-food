export type Role = 'owner' | 'manager' | 'staff'
export type InvoiceStatus = 'pending' | 'approved' | 'rejected'
export type WasteReason = 'spoilage' | 'kitchen_error' | 'overproduction' | 'damage' | 'expired' | 'other'
export type AlertType = 'price_spike' | 'margin_erosion' | 'low_stock' | 'waste_spike'
export type StockStatus = 'ok' | 'low' | 'critical'

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant
        Insert: Omit<Restaurant, 'id' | 'created_at'>
        Update: Partial<Omit<Restaurant, 'id'>>
      }
      restaurant_members: {
        Row: RestaurantMember
        Insert: Omit<RestaurantMember, 'id' | 'joined_at'>
        Update: Partial<Omit<RestaurantMember, 'id'>>
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at'>
        Update: Partial<Omit<Supplier, 'id'>>
      }
      ingredients: {
        Row: Ingredient
        Insert: Omit<Ingredient, 'id' | 'updated_at'>
        Update: Partial<Omit<Ingredient, 'id'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at'>
        Update: Partial<Omit<Invoice, 'id'>>
      }
      invoice_items: {
        Row: InvoiceItem
        Insert: Omit<InvoiceItem, 'id' | 'created_at'>
        Update: Partial<Omit<InvoiceItem, 'id'>>
      }
      waste_logs: {
        Row: WasteLog
        Insert: Omit<WasteLog, 'id' | 'created_at'>
        Update: Partial<Omit<WasteLog, 'id'>>
      }
      dishes: {
        Row: Dish
        Insert: Omit<Dish, 'id' | 'created_at'>
        Update: Partial<Omit<Dish, 'id'>>
      }
      dish_ingredients: {
        Row: DishIngredient
        Insert: Omit<DishIngredient, 'id'>
        Update: Partial<Omit<DishIngredient, 'id'>>
      }
      price_history: {
        Row: PriceHistory
        Insert: Omit<PriceHistory, 'id'>
        Update: Partial<Omit<PriceHistory, 'id'>>
      }
      alerts: {
        Row: Alert
        Insert: Omit<Alert, 'id' | 'created_at'>
        Update: Partial<Omit<Alert, 'id'>>
      }
      consumption_periods: {
        Row: ConsumptionPeriod
        Insert: Omit<ConsumptionPeriod, 'id'>
        Update: Partial<Omit<ConsumptionPeriod, 'id'>>
      }
    }
  }
}

export interface Restaurant {
  id: string
  name: string
  owner_id: string
  address: string | null
  currency: string
  locale: string
  created_at: string
}

export interface RestaurantMember {
  id: string
  restaurant_id: string
  user_id: string
  role: Role
  joined_at: string
}

export interface Supplier {
  id: string
  restaurant_id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export interface Ingredient {
  id: string
  restaurant_id: string
  name: string
  category: string
  unit: string
  current_stock: number
  par_level: number
  avg_cost: number
  last_cost: number
  updated_at: string
}

export interface Invoice {
  id: string
  restaurant_id: string
  supplier_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  image_url: string | null
  raw_ocr_text: string | null
  structured_data: InvoiceStructuredData | null
  status: InvoiceStatus
  created_by: string
  created_at: string
}

export interface InvoiceStructuredData {
  supplier_name?: string
  invoice_date?: string
  line_items: {
    product_name: string
    quantity: number
    unit?: string
    unit_price: number
    total: number
  }[]
  subtotal?: number
  tax?: number
  total?: number
  confidence?: number
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  ingredient_id: string | null
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  created_at: string
}

export interface WasteLog {
  id: string
  restaurant_id: string
  ingredient_id: string
  quantity: number
  reason: WasteReason
  notes: string | null
  logged_by: string
  created_at: string
  // joined fields
  ingredient?: Ingredient
}

export interface Dish {
  id: string
  restaurant_id: string
  name: string
  category: string | null
  selling_price: number
  food_cost: number
  margin: number
  created_at: string
  // computed
  total_cost?: number
  margin_percent?: number
  dish_ingredients?: DishIngredient[]
}

export interface DishIngredient {
  id: string
  dish_id: string
  ingredient_id: string
  quantity: number
  // joined
  ingredient?: Ingredient
}

export interface PriceHistory {
  id: string
  ingredient_id: string
  unit_price: number
  supplier_id: string | null
  recorded_at: string
}

export interface Alert {
  id: string
  restaurant_id: string
  type: AlertType
  message: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export interface ConsumptionPeriod {
  id: string
  restaurant_id: string
  period_start: string
  period_end: string
  consumption_data: Record<string, unknown>
  suggested_order: Record<string, unknown>
  created_at?: string
}
