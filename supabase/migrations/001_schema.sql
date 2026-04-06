-- WastedFood MVP: Complete Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. Restaurants
-- ============================================================
create table public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users(id),
  address text,
  currency text not null default 'EUR',
  locale text not null default 'hr',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Restaurant Members (multi-user, role-based)
-- ============================================================
create table public.restaurant_members (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

-- ============================================================
-- 3. Suppliers
-- ============================================================
create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Ingredients
-- ============================================================
create table public.ingredients (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text default 'other',
  unit text not null default 'kg',
  current_stock numeric not null default 0,
  par_level numeric not null default 0,
  avg_cost numeric not null default 0,
  last_cost numeric not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Invoices
-- ============================================================
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  invoice_date date not null default current_date,
  total numeric not null default 0,
  image_url text,
  raw_ocr_text text,
  structured_data jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. Invoice Items
-- ============================================================
create table public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  unit_price numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. Waste Logs
-- ============================================================
create table public.waste_logs (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null,
  reason text not null default 'other' check (reason in ('spoilage','kitchen_error','overproduction','damage','expired','other')),
  notes text,
  logged_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 8. Dishes
-- ============================================================
create table public.dishes (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text,
  selling_price numeric not null default 0,
  food_cost numeric not null default 0,
  margin numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. Dish Ingredients (recipe)
-- ============================================================
create table public.dish_ingredients (
  id uuid primary key default uuid_generate_v4(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null default 0,
  unique (dish_id, ingredient_id)
);

-- ============================================================
-- 10. Price History
-- ============================================================
create table public.price_history (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  unit_price numeric not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- ============================================================
-- 11. Alerts
-- ============================================================
create table public.alerts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null check (type in ('price_spike','margin_erosion','low_stock','waste_spike')),
  message text not null,
  metadata jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 12. Consumption Periods
-- ============================================================
create table public.consumption_periods (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  consumption_data jsonb not null default '{}',
  suggested_order jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_members_user on public.restaurant_members(user_id);
create index idx_members_restaurant on public.restaurant_members(restaurant_id);
create index idx_ingredients_restaurant on public.ingredients(restaurant_id);
create index idx_suppliers_restaurant on public.suppliers(restaurant_id);
create index idx_invoices_restaurant on public.invoices(restaurant_id);
create index idx_invoice_items_invoice on public.invoice_items(invoice_id);
create index idx_waste_logs_restaurant on public.waste_logs(restaurant_id);
create index idx_waste_logs_created on public.waste_logs(created_at);
create index idx_dishes_restaurant on public.dishes(restaurant_id);
create index idx_dish_ingredients_dish on public.dish_ingredients(dish_id);
create index idx_price_history_ingredient on public.price_history(ingredient_id);
create index idx_alerts_restaurant on public.alerts(restaurant_id);
create index idx_alerts_read on public.alerts(read);
create index idx_consumption_restaurant on public.consumption_periods(restaurant_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.ingredients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.waste_logs enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.price_history enable row level security;
alter table public.alerts enable row level security;
alter table public.consumption_periods enable row level security;

-- Helper function: check restaurant membership
create or replace function public.is_member_of(rest_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rest_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Restaurants: members can view, owners can update
create policy "members can view restaurant"
  on public.restaurants for select
  using (public.is_member_of(id));

create policy "authenticated users can create restaurant"
  on public.restaurants for insert
  to authenticated
  with check (true);

create policy "owners can update restaurant"
  on public.restaurants for update
  using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_id = id and user_id = auth.uid() and role = 'owner'
    )
  );

-- Restaurant Members
create policy "members can view members"
  on public.restaurant_members for select
  using (public.is_member_of(restaurant_id));

create policy "users can insert own membership"
  on public.restaurant_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "admins can manage members"
  on public.restaurant_members for delete
  using (
    exists (
      select 1 from public.restaurant_members rm
      where rm.restaurant_id = restaurant_members.restaurant_id
        and rm.user_id = auth.uid()
        and rm.role in ('owner', 'admin')
    )
  );

-- Generic member-access policies for data tables
-- Suppliers
create policy "members full access" on public.suppliers for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Ingredients
create policy "members full access" on public.ingredients for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Invoices
create policy "members full access" on public.invoices for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Invoice Items (access via invoice)
create policy "members full access" on public.invoice_items for all
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and public.is_member_of(i.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and public.is_member_of(i.restaurant_id)
    )
  );

-- Waste Logs
create policy "members full access" on public.waste_logs for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Dishes
create policy "members full access" on public.dishes for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Dish Ingredients (access via dish)
create policy "members full access" on public.dish_ingredients for all
  using (
    exists (
      select 1 from public.dishes d
      where d.id = dish_ingredients.dish_id and public.is_member_of(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.dishes d
      where d.id = dish_ingredients.dish_id and public.is_member_of(d.restaurant_id)
    )
  );

-- Price History (access via ingredient)
create policy "members full access" on public.price_history for all
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = price_history.ingredient_id and public.is_member_of(i.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.ingredients i
      where i.id = price_history.ingredient_id and public.is_member_of(i.restaurant_id)
    )
  );

-- Alerts
create policy "members full access" on public.alerts for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- Consumption Periods
create policy "members full access" on public.consumption_periods for all using (public.is_member_of(restaurant_id)) with check (public.is_member_of(restaurant_id));

-- ============================================================
-- Storage bucket for invoice images
-- ============================================================
insert into storage.buckets (id, name, public) values ('invoice-images', 'invoice-images', true) on conflict do nothing;

create policy "authenticated users can upload invoice images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'invoice-images');

create policy "anyone can view invoice images"
  on storage.objects for select
  using (bucket_id = 'invoice-images');
