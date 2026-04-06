# WastedFood — Restaurant Food Waste & Inventory MVP

## Vision
Free, progressive web app for restaurants to automate inventory via AI invoice scanning, track food waste with categorization, get profit margin alerts, and optimize ordering based on consumption data.

**Target**: SMB restaurants (1-5 locations) in Croatia/EU, price-sensitive, underserved by expensive enterprise tools.

---

## Tech Stack (100% Free / Open Source)

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Free |
| Styling | Tailwind CSS 4 + shadcn/ui | Free |
| Backend/DB | Supabase (Auth, Postgres, Storage, Edge Functions, Realtime) | Free tier |
| Hosting | Vercel | Free tier |
| OCR | Tesseract.js v5 (WASM, runs in-browser) | Free |
| AI Structuring | Google Gemini API (free tier: 15 RPM, 1M tokens/day) | Free |
| PWA | vite-plugin-pwa (Workbox) | Free |
| i18n | i18next + react-i18next | Free |
| Charts | Recharts | Free |
| Router | React Router v7 | Free |

---

## Core Features (MVP)

### 1. AI Invoice Scanner
- Camera capture on mobile (or file upload)
- Tesseract.js OCR runs in-browser (WASM) → extracts raw text
- Text sent to Supabase Edge Function → Gemini API structures it into JSON (supplier, date, line items with product/qty/unit_price)
- User reviews extracted data in editable table → matches items to existing ingredients or creates new
- On approve: invoice stored, inventory auto-updated, price history recorded
- Invoice image stored in Supabase Storage for audit trail

### 2. Waste Log + Categorization & Trends
- Quick-entry form: pick ingredient, enter quantity, select reason, optional notes
- Reason categories: Spoilage, Kitchen Error, Overproduction, Damage, Expired, Other
- Stock auto-decremented via DB trigger
- Waste history table with date/reason/ingredient filters
- Trend charts: waste by reason over time, waste by ingredient, waste cost over time
- Dashboard weekly waste summary widget

### 3. Profit Alerts
- Daily check (Supabase scheduled function): compare latest ingredient price vs. previous
- If increase > 10%, recalculate affected dish costs
- If dish margin drops below threshold (e.g., 65%), create profit_margin alert
- Also generates: low_stock alerts (below par level), waste_trend alerts
- Web Push notifications via service worker for critical alerts
- Alert badge in navigation

### 4. Consumption Tracking & Auto-Order Suggestions
- Weekly/monthly aggregation: total purchased (from invoices) - total wasted (from waste logs) = consumed
- Calculate avg daily consumption per ingredient
- Suggested order qty = (avg_daily × lead_days) + par_level - current_stock
- "Generate Order" button creates a purchase list for all items below par
- Trend sparklines per ingredient

### 5. Recipe Costing Dashboard (Research-Driven Addition)
- Add dishes with recipe ingredients (qty per serving)
- Auto-calculate: total ingredient cost per dish
- Compare vs. menu price → show margin % with color indicators
- Sort by margin to quickly find problematic dishes
- Industry data: 28-35% of restaurant revenue is COGS; per-dish cost visibility is the #1 requested feature

### 6. Inventory Management
- Full ingredient CRUD with categories, units, par levels
- Color-coded stock badges: green (OK), yellow (low), red (critical)
- Search and filter by name, category, stock status
- Stock auto-updated via invoice approval and waste logging triggers

---

## Additional Features

### Authentication & Multi-User
- Supabase Auth (email/password + magic link)
- Multi-user with roles: Owner, Manager, Staff
- Owner: full CRUD on all tables
- Manager: everything except delete restaurant
- Staff: log waste, view inventory, scan invoices

### Multi-Language (i18n)
- Croatian (HR) and English (EN)
- Language switcher in settings
- All UI strings externalized via i18next

### Progressive Web App
- Installable on Android + iOS
- Offline waste logging (IndexedDB queue → sync on reconnect)
- Service worker with Workbox (cache-first static, network-first API)
- Push notifications for critical alerts

### Suppliers
- CRUD for supplier management
- Contact info (email, phone)
- Purchase history per supplier

### Settings
- Restaurant info management
- Team management (invite/remove members, assign roles)
- Language and currency preferences

---

## Database Schema (Supabase Postgres)

### Tables

1. **restaurants** — id, name, owner_id, currency, locale, created_at
2. **restaurant_members** — id, restaurant_id, user_id, role, joined_at, UNIQUE(restaurant_id, user_id)
3. **suppliers** — id, restaurant_id, name, contact_email, contact_phone, created_at
4. **ingredients** — id, restaurant_id, name, category, unit, current_stock, par_level, avg_cost, last_cost, updated_at
5. **invoices** — id, restaurant_id, supplier_id, invoice_number, invoice_date, total, image_url, raw_ocr_text, structured_data (jsonb), status, created_by, created_at
6. **invoice_items** — id, invoice_id, ingredient_id, product_name, quantity, unit, unit_price, total, created_at
7. **waste_logs** — id, restaurant_id, ingredient_id, quantity, reason, notes, logged_by, created_at
8. **dishes** — id, restaurant_id, name, menu_price, category, is_active, created_at
9. **dish_ingredients** — id, dish_id, ingredient_id, quantity_per_serving, unit
10. **price_history** — id, ingredient_id, unit_price, supplier_id, recorded_at
11. **alerts** — id, restaurant_id, type, title, message, data (jsonb), is_read, created_at
12. **consumption_periods** — id, restaurant_id, ingredient_id, period_start, period_end, total_purchased, total_wasted, total_consumed, avg_daily_consumption, suggested_order_qty

### Row Level Security (RLS)
All tables filtered by restaurant_id via restaurant_members membership check.

### Key DB Functions & Triggers
- `fn_update_stock_on_invoice_approve()` — increment stock + update weighted avg cost
- `fn_decrement_stock_on_waste()` — decrement stock on waste log insert
- `fn_record_price_history()` — log price changes from invoices
- `fn_calculate_dish_cost(dish_id)` — sum ingredient costs for recipe costing

---

## App Routes

| Route | Page | Description |
|---|---|---|
| `/auth` | Auth | Login / Register |
| `/` | Dashboard | Overview: stock health, waste this week, top dishes by margin, alerts, quick actions |
| `/scan` | Invoice Scanner | Camera → OCR → AI structure → review → approve |
| `/inventory` | Inventory | Ingredients list, stock levels, par indicators |
| `/waste` | Waste Log | Log waste + history + trend charts |
| `/dishes` | Dishes | Recipe ingredients, cost breakdown, margin analysis |
| `/alerts` | Alerts | All notifications: profit margin, low stock, waste trends |
| `/consumption` | Consumption | Monthly usage, auto-order suggestions |
| `/suppliers` | Suppliers | Supplier CRUD + purchase history |
| `/settings` | Settings | Restaurant, team, language, currency |

---

## Supabase Edge Functions

1. **process-invoice** — Receives OCR text → calls Gemini API → returns structured JSON
2. **calculate-alerts** — Daily cron: price spike detection → margin check → generate alerts
3. **calculate-consumption** — Weekly cron: aggregate usage → calculate optimal order quantities

---

## Environment Variables Needed

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Google Gemini (free tier — for invoice AI structuring)
GEMINI_API_KEY=AIza...   # Used in Supabase Edge Function only, not exposed to client

# VAPID Keys (for Web Push notifications — generate with web-push library)
VITE_VAPID_PUBLIC_KEY=BN...
```

---

## Research-Backed Market Context

- **EU**: 58M tonnes food waste/year (€132B); restaurants account for 11%
- **Financial**: 5-15% of kitchen purchases go to waste; 2-6% food cost reduction achievable
- **Regulatory**: EU Food Waste Reduction Directive mandates 50% reduction by 2030
- **Competitors**: Winnow ($5k+/mo, hardware-dependent), MarketMan (no active waste tracking), Leanpath (enterprise only)
- **Gap**: No free tool combines invoice OCR + waste tracking + margin alerts + auto-ordering
- **Validation**: Winnow/Leanpath prove 50% waste reduction from just making waste *visible*

---

## Excluded from MVP (V2 Roadmap)

- POS integration (Lightspeed, Toast)
- Expiry date / FIFO automation
- Actual vs. theoretical variance reports
- Email invoice auto-parsing
- Multi-location benchmarking
- AI demand forecasting (weather/seasonality)
- ESG compliance reporting
- Barcode scanning for inventory counts
- Hardware integration (scales, cameras)
