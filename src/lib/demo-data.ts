/**
 * Realistic demo data for a Croatian restaurant "Konoba Maslina".
 * Seeded into localStorage on first load when in demo mode.
 */

const STORAGE_PREFIX = 'wf_demo_'
const SEED_KEY = STORAGE_PREFIX + 'seeded'

const RESTAURANT_ID = '00000000-0000-0000-0000-r00000000001'
const USER_ID = '00000000-0000-0000-0000-000000000001'

function set(table: string, data: unknown[]) {
  localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data))
}

// Deterministic IDs for foreign key references
const SUP = {
  metro: 's-0001', plodine: 's-0002', ribola: 's-0003',
}

const ING = {
  tomato: 'i-0001', olive_oil: 'i-0002', mozzarella: 'i-0003',
  flour: 'i-0004', basil: 'i-0005', garlic: 'i-0006',
  chicken: 'i-0007', salmon: 'i-0008', pasta: 'i-0009',
  onion: 'i-0010', pepper: 'i-0011', cream: 'i-0012',
  parmesan: 'i-0013', prosciutto: 'i-0014', wine_white: 'i-0015',
  lemon: 'i-0016', butter: 'i-0017', mushroom: 'i-0018',
}

const DISH = {
  margherita: 'd-0001', carbonara: 'd-0002', grilled_chicken: 'd-0003',
  salmon_fillet: 'd-0004', bruschetta: 'd-0005', mushroom_risotto: 'd-0006',
}

export function seedDemoData() {
  if (localStorage.getItem(SEED_KEY)) return
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

  // --- Restaurants ---
  set('restaurants', [{
    id: RESTAURANT_ID,
    name: 'Konoba Maslina',
    owner_id: USER_ID,
    address: 'Obala kneza Branimira 8, Split',
    currency: 'EUR',
    locale: 'hr',
    created_at: daysAgo(90),
  }])

  // --- Members ---
  set('restaurant_members', [{
    id: 'm-0001',
    restaurant_id: RESTAURANT_ID,
    user_id: USER_ID,
    role: 'owner',
    joined_at: daysAgo(90),
  }])

  // --- Suppliers ---
  set('suppliers', [
    { id: SUP.metro, restaurant_id: RESTAURANT_ID, name: 'Metro Cash & Carry', contact_email: 'narudzbe@metro.hr', contact_phone: '+385 21 123 456', created_at: daysAgo(80) },
    { id: SUP.plodine, restaurant_id: RESTAURANT_ID, name: 'Plodine d.o.o.', contact_email: 'veleprodaja@plodine.hr', contact_phone: '+385 21 234 567', created_at: daysAgo(75) },
    { id: SUP.ribola, restaurant_id: RESTAURANT_ID, name: 'Ribola — Fresh Fish', contact_email: 'info@ribola.hr', contact_phone: '+385 21 345 678', created_at: daysAgo(70) },
  ])

  // --- Ingredients ---
  set('ingredients', [
    { id: ING.tomato, restaurant_id: RESTAURANT_ID, name: 'Rajčice (San Marzano)', category: 'vegetables', unit: 'kg', current_stock: 12, par_level: 8, avg_cost: 2.80, last_cost: 3.00, updated_at: daysAgo(1) },
    { id: ING.olive_oil, restaurant_id: RESTAURANT_ID, name: 'Maslinovo ulje extra djevičansko', category: 'oils', unit: 'l', current_stock: 5, par_level: 3, avg_cost: 9.50, last_cost: 10.00, updated_at: daysAgo(2) },
    { id: ING.mozzarella, restaurant_id: RESTAURANT_ID, name: 'Mozzarella di Bufala', category: 'dairy', unit: 'kg', current_stock: 3, par_level: 4, avg_cost: 14.00, last_cost: 14.50, updated_at: daysAgo(1) },
    { id: ING.flour, restaurant_id: RESTAURANT_ID, name: 'Brašno tipo 00', category: 'dry goods', unit: 'kg', current_stock: 25, par_level: 10, avg_cost: 1.20, last_cost: 1.20, updated_at: daysAgo(5) },
    { id: ING.basil, restaurant_id: RESTAURANT_ID, name: 'Bosiljak svježi', category: 'herbs', unit: 'kg', current_stock: 0.3, par_level: 0.5, avg_cost: 18.00, last_cost: 18.00, updated_at: daysAgo(1) },
    { id: ING.garlic, restaurant_id: RESTAURANT_ID, name: 'Češnjak domaći', category: 'vegetables', unit: 'kg', current_stock: 2, par_level: 1, avg_cost: 6.00, last_cost: 6.00, updated_at: daysAgo(3) },
    { id: ING.chicken, restaurant_id: RESTAURANT_ID, name: 'Piletina (prsa)', category: 'meat', unit: 'kg', current_stock: 8, par_level: 5, avg_cost: 7.50, last_cost: 7.80, updated_at: daysAgo(1) },
    { id: ING.salmon, restaurant_id: RESTAURANT_ID, name: 'Losos filet svježi', category: 'fish', unit: 'kg', current_stock: 2, par_level: 3, avg_cost: 22.00, last_cost: 23.00, updated_at: daysAgo(1) },
    { id: ING.pasta, restaurant_id: RESTAURANT_ID, name: 'Spaghetti De Cecco', category: 'dry goods', unit: 'kg', current_stock: 10, par_level: 5, avg_cost: 3.50, last_cost: 3.50, updated_at: daysAgo(7) },
    { id: ING.onion, restaurant_id: RESTAURANT_ID, name: 'Luk crveni', category: 'vegetables', unit: 'kg', current_stock: 5, par_level: 3, avg_cost: 1.50, last_cost: 1.50, updated_at: daysAgo(4) },
    { id: ING.pepper, restaurant_id: RESTAURANT_ID, name: 'Paprika crvena', category: 'vegetables', unit: 'kg', current_stock: 3, par_level: 2, avg_cost: 3.20, last_cost: 3.50, updated_at: daysAgo(2) },
    { id: ING.cream, restaurant_id: RESTAURANT_ID, name: 'Vrhnje za kuhanje 20%', category: 'dairy', unit: 'l', current_stock: 4, par_level: 3, avg_cost: 2.80, last_cost: 2.80, updated_at: daysAgo(2) },
    { id: ING.parmesan, restaurant_id: RESTAURANT_ID, name: 'Parmigiano Reggiano', category: 'dairy', unit: 'kg', current_stock: 1.5, par_level: 2, avg_cost: 28.00, last_cost: 29.00, updated_at: daysAgo(3) },
    { id: ING.prosciutto, restaurant_id: RESTAURANT_ID, name: 'Pršut dalmatinski', category: 'meat', unit: 'kg', current_stock: 2, par_level: 1.5, avg_cost: 45.00, last_cost: 45.00, updated_at: daysAgo(5) },
    { id: ING.wine_white, restaurant_id: RESTAURANT_ID, name: 'Bijelo vino za kuhanje', category: 'beverages', unit: 'l', current_stock: 3, par_level: 2, avg_cost: 4.00, last_cost: 4.00, updated_at: daysAgo(10) },
    { id: ING.lemon, restaurant_id: RESTAURANT_ID, name: 'Limun', category: 'fruits', unit: 'kg', current_stock: 2, par_level: 1, avg_cost: 2.50, last_cost: 2.50, updated_at: daysAgo(3) },
    { id: ING.butter, restaurant_id: RESTAURANT_ID, name: 'Maslac 82%', category: 'dairy', unit: 'kg', current_stock: 2, par_level: 1.5, avg_cost: 8.00, last_cost: 8.50, updated_at: daysAgo(2) },
    { id: ING.mushroom, restaurant_id: RESTAURANT_ID, name: 'Gljive šampinjoni', category: 'vegetables', unit: 'kg', current_stock: 1, par_level: 2, avg_cost: 5.50, last_cost: 6.00, updated_at: daysAgo(1) },
  ])

  // --- Dishes ---
  set('dishes', [
    { id: DISH.margherita, restaurant_id: RESTAURANT_ID, name: 'Pizza Margherita', category: 'pizza', selling_price: 10.00, food_cost: 2.80, margin: 72.0, created_at: daysAgo(60) },
    { id: DISH.carbonara, restaurant_id: RESTAURANT_ID, name: 'Spaghetti Carbonara', category: 'pasta', selling_price: 14.00, food_cost: 4.20, margin: 70.0, created_at: daysAgo(60) },
    { id: DISH.grilled_chicken, restaurant_id: RESTAURANT_ID, name: 'Piletina na žaru', category: 'main', selling_price: 16.00, food_cost: 5.50, margin: 65.6, created_at: daysAgo(55) },
    { id: DISH.salmon_fillet, restaurant_id: RESTAURANT_ID, name: 'Losos na maslacu', category: 'fish', selling_price: 22.00, food_cost: 9.00, margin: 59.1, created_at: daysAgo(55) },
    { id: DISH.bruschetta, restaurant_id: RESTAURANT_ID, name: 'Bruschetta Classica', category: 'starter', selling_price: 8.00, food_cost: 1.80, margin: 77.5, created_at: daysAgo(50) },
    { id: DISH.mushroom_risotto, restaurant_id: RESTAURANT_ID, name: 'Rižoto s gljivama', category: 'risotto', selling_price: 15.00, food_cost: 4.00, margin: 73.3, created_at: daysAgo(45) },
  ])

  // --- Dish Ingredients ---
  set('dish_ingredients', [
    // Margherita
    { id: 'di-001', dish_id: DISH.margherita, ingredient_id: ING.flour, quantity: 0.25 },
    { id: 'di-002', dish_id: DISH.margherita, ingredient_id: ING.tomato, quantity: 0.15 },
    { id: 'di-003', dish_id: DISH.margherita, ingredient_id: ING.mozzarella, quantity: 0.12 },
    { id: 'di-004', dish_id: DISH.margherita, ingredient_id: ING.basil, quantity: 0.01 },
    { id: 'di-005', dish_id: DISH.margherita, ingredient_id: ING.olive_oil, quantity: 0.02 },
    // Carbonara
    { id: 'di-006', dish_id: DISH.carbonara, ingredient_id: ING.pasta, quantity: 0.15 },
    { id: 'di-007', dish_id: DISH.carbonara, ingredient_id: ING.cream, quantity: 0.10 },
    { id: 'di-008', dish_id: DISH.carbonara, ingredient_id: ING.parmesan, quantity: 0.04 },
    { id: 'di-009', dish_id: DISH.carbonara, ingredient_id: ING.prosciutto, quantity: 0.05 },
    // Grilled Chicken
    { id: 'di-010', dish_id: DISH.grilled_chicken, ingredient_id: ING.chicken, quantity: 0.25 },
    { id: 'di-011', dish_id: DISH.grilled_chicken, ingredient_id: ING.olive_oil, quantity: 0.03 },
    { id: 'di-012', dish_id: DISH.grilled_chicken, ingredient_id: ING.garlic, quantity: 0.02 },
    { id: 'di-013', dish_id: DISH.grilled_chicken, ingredient_id: ING.lemon, quantity: 0.05 },
    // Salmon
    { id: 'di-014', dish_id: DISH.salmon_fillet, ingredient_id: ING.salmon, quantity: 0.20 },
    { id: 'di-015', dish_id: DISH.salmon_fillet, ingredient_id: ING.butter, quantity: 0.04 },
    { id: 'di-016', dish_id: DISH.salmon_fillet, ingredient_id: ING.lemon, quantity: 0.03 },
    { id: 'di-017', dish_id: DISH.salmon_fillet, ingredient_id: ING.wine_white, quantity: 0.05 },
    // Bruschetta
    { id: 'di-018', dish_id: DISH.bruschetta, ingredient_id: ING.tomato, quantity: 0.10 },
    { id: 'di-019', dish_id: DISH.bruschetta, ingredient_id: ING.garlic, quantity: 0.01 },
    { id: 'di-020', dish_id: DISH.bruschetta, ingredient_id: ING.basil, quantity: 0.005 },
    { id: 'di-021', dish_id: DISH.bruschetta, ingredient_id: ING.olive_oil, quantity: 0.03 },
    // Mushroom Risotto
    { id: 'di-022', dish_id: DISH.mushroom_risotto, ingredient_id: ING.mushroom, quantity: 0.15 },
    { id: 'di-023', dish_id: DISH.mushroom_risotto, ingredient_id: ING.butter, quantity: 0.04 },
    { id: 'di-024', dish_id: DISH.mushroom_risotto, ingredient_id: ING.parmesan, quantity: 0.03 },
    { id: 'di-025', dish_id: DISH.mushroom_risotto, ingredient_id: ING.onion, quantity: 0.05 },
    { id: 'di-026', dish_id: DISH.mushroom_risotto, ingredient_id: ING.wine_white, quantity: 0.04 },
  ])

  // --- Waste Logs (last 10 days) ---
  set('waste_logs', [
    { id: 'w-001', restaurant_id: RESTAURANT_ID, ingredient_id: ING.tomato, quantity: 1.5, reason: 'spoilage', notes: 'Soft spots, past prime', logged_by: USER_ID, created_at: daysAgo(1) },
    { id: 'w-002', restaurant_id: RESTAURANT_ID, ingredient_id: ING.basil, quantity: 0.1, reason: 'spoilage', notes: 'Wilted', logged_by: USER_ID, created_at: daysAgo(1) },
    { id: 'w-003', restaurant_id: RESTAURANT_ID, ingredient_id: ING.cream, quantity: 0.5, reason: 'expired', notes: 'Past expiry date', logged_by: USER_ID, created_at: daysAgo(2) },
    { id: 'w-004', restaurant_id: RESTAURANT_ID, ingredient_id: ING.chicken, quantity: 0.8, reason: 'kitchen_error', notes: 'Overcooked batch', logged_by: USER_ID, created_at: daysAgo(3) },
    { id: 'w-005', restaurant_id: RESTAURANT_ID, ingredient_id: ING.mozzarella, quantity: 0.3, reason: 'expired', notes: null, logged_by: USER_ID, created_at: daysAgo(3) },
    { id: 'w-006', restaurant_id: RESTAURANT_ID, ingredient_id: ING.salmon, quantity: 0.5, reason: 'spoilage', notes: 'Didn\'t sell in time', logged_by: USER_ID, created_at: daysAgo(4) },
    { id: 'w-007', restaurant_id: RESTAURANT_ID, ingredient_id: ING.mushroom, quantity: 0.4, reason: 'spoilage', notes: 'Slimy', logged_by: USER_ID, created_at: daysAgo(5) },
    { id: 'w-008', restaurant_id: RESTAURANT_ID, ingredient_id: ING.tomato, quantity: 0.8, reason: 'overproduction', notes: 'Extra sauce prep', logged_by: USER_ID, created_at: daysAgo(5) },
    { id: 'w-009', restaurant_id: RESTAURANT_ID, ingredient_id: ING.pepper, quantity: 0.5, reason: 'damage', notes: 'Dropped crate', logged_by: USER_ID, created_at: daysAgo(6) },
    { id: 'w-010', restaurant_id: RESTAURANT_ID, ingredient_id: ING.onion, quantity: 0.3, reason: 'spoilage', notes: null, logged_by: USER_ID, created_at: daysAgo(7) },
  ])

  // --- Alerts ---
  set('alerts', [
    { id: 'a-001', restaurant_id: RESTAURANT_ID, type: 'low_stock', message: 'Bosiljak svježi is below par level (0.3 / 0.5 kg)', metadata: null, read: false, created_at: daysAgo(0) },
    { id: 'a-002', restaurant_id: RESTAURANT_ID, type: 'low_stock', message: 'Gljive šampinjoni stock critical (1.0 / 2.0 kg)', metadata: null, read: false, created_at: daysAgo(0) },
    { id: 'a-003', restaurant_id: RESTAURANT_ID, type: 'price_spike', message: 'Losos filet price increased 4.5% (€22.00 → €23.00)', metadata: { amount: 23.00 }, read: false, created_at: daysAgo(1) },
    { id: 'a-004', restaurant_id: RESTAURANT_ID, type: 'waste_spike', message: 'Tomato waste up 40% this week vs last week', metadata: null, read: false, created_at: daysAgo(2) },
    { id: 'a-005', restaurant_id: RESTAURANT_ID, type: 'margin_erosion', message: 'Losos na maslacu margin dropped below 60% target', metadata: { amount: 59.1 }, read: true, created_at: daysAgo(5) },
    { id: 'a-006', restaurant_id: RESTAURANT_ID, type: 'price_spike', message: 'Maslac 82% price up 6.25% (€8.00 → €8.50)', metadata: { amount: 8.50 }, read: true, created_at: daysAgo(8) },
  ])

  // --- Invoices (a couple of recent ones) ---
  set('invoices', [
    { id: 'inv-001', restaurant_id: RESTAURANT_ID, supplier_id: SUP.metro, invoice_number: 'MET-2026-04-01', invoice_date: daysAgo(3).split('T')[0], total: 185.50, image_url: null, raw_ocr_text: null, structured_data: null, status: 'approved', created_by: USER_ID, created_at: daysAgo(3) },
    { id: 'inv-002', restaurant_id: RESTAURANT_ID, supplier_id: SUP.ribola, invoice_number: 'RIB-0412', invoice_date: daysAgo(1).split('T')[0], total: 92.00, image_url: null, raw_ocr_text: null, structured_data: null, status: 'approved', created_by: USER_ID, created_at: daysAgo(1) },
  ])

  // --- Invoice Items ---
  set('invoice_items', [
    { id: 'ii-001', invoice_id: 'inv-001', ingredient_id: ING.tomato, product_name: 'Rajčice San Marzano', quantity: 10, unit: 'kg', unit_price: 3.00, total: 30.00, created_at: daysAgo(3) },
    { id: 'ii-002', invoice_id: 'inv-001', ingredient_id: ING.flour, product_name: 'Brašno tipo 00', quantity: 25, unit: 'kg', unit_price: 1.20, total: 30.00, created_at: daysAgo(3) },
    { id: 'ii-003', invoice_id: 'inv-001', ingredient_id: ING.olive_oil, product_name: 'Maslinovo ulje EVD', quantity: 5, unit: 'l', unit_price: 10.00, total: 50.00, created_at: daysAgo(3) },
    { id: 'ii-004', invoice_id: 'inv-001', ingredient_id: ING.mozzarella, product_name: 'Mozzarella di Bufala', quantity: 3, unit: 'kg', unit_price: 14.50, total: 43.50, created_at: daysAgo(3) },
    { id: 'ii-005', invoice_id: 'inv-001', ingredient_id: ING.parmesan, product_name: 'Parmigiano Reggiano 24m', quantity: 1, unit: 'kg', unit_price: 29.00, total: 29.00, created_at: daysAgo(3) },
    { id: 'ii-006', invoice_id: 'inv-002', ingredient_id: ING.salmon, product_name: 'Losos filet svježi', quantity: 4, unit: 'kg', unit_price: 23.00, total: 92.00, created_at: daysAgo(1) },
  ])

  // --- Price History ---
  set('price_history', [
    { id: 'ph-001', ingredient_id: ING.salmon, unit_price: 22.00, supplier_id: SUP.ribola, recorded_at: daysAgo(15) },
    { id: 'ph-002', ingredient_id: ING.salmon, unit_price: 23.00, supplier_id: SUP.ribola, recorded_at: daysAgo(1) },
    { id: 'ph-003', ingredient_id: ING.butter, unit_price: 8.00, supplier_id: SUP.metro, recorded_at: daysAgo(20) },
    { id: 'ph-004', ingredient_id: ING.butter, unit_price: 8.50, supplier_id: SUP.metro, recorded_at: daysAgo(3) },
    { id: 'ph-005', ingredient_id: ING.tomato, unit_price: 2.50, supplier_id: SUP.plodine, recorded_at: daysAgo(30) },
    { id: 'ph-006', ingredient_id: ING.tomato, unit_price: 3.00, supplier_id: SUP.metro, recorded_at: daysAgo(3) },
  ])

  // --- Consumption Periods (empty, user generates them) ---
  set('consumption_periods', [])

  localStorage.setItem(SEED_KEY, 'true')
}

/** Reset demo data to factory state */
export function resetDemoData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
  seedDemoData()
}
