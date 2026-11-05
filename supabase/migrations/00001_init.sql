-- Standwerk POS — fase 1 datamodel
-- Geld: uitsluitend integer-kolommen met _cents-suffix, nooit numeric/float.
-- Btw: basispunten (2100 = 21,00%) om dezelfde reden.
-- Voorraad: products.stock is een afgeleide kolom, alleen aan te passen via de
-- trg_apply_stock_movement-trigger op stock_movements (zie onderaan).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Events, categorieën, kassa's
-- ---------------------------------------------------------------------------

create table events (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  low_stock_default     integer not null default 5,
  opening_float_cents   integer not null default 0 check (opening_float_cents >= 0),
  return_days           integer not null default 0 check (return_days >= 0),
  created_at            timestamptz not null default now()
);

create table categories (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  name                  text not null,
  default_vat_rate_bp   smallint not null check (default_vat_rate_bp >= 0),
  created_at            timestamptz not null default now(),
  unique (event_id, name)
);

create table registers (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  name                  text not null,
  code                  text not null,
  current_receipt_no    bigint not null default 0,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (event_id, name)
);

-- ---------------------------------------------------------------------------
-- Producten
-- ---------------------------------------------------------------------------

create table products (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  sku                   text not null,
  name                  text not null,                 -- gedeeld door varianten
  category_id           uuid not null references categories(id),
  variant               text not null default '',
  vat_rate_bp           smallint check (vat_rate_bp >= 0),  -- NULL = overerft categorie
  price_cents           integer not null check (price_cents >= 0),       -- incl. btw
  cost_cents            integer not null default 0 check (cost_cents >= 0), -- excl. btw
  stock                 integer not null default 0 check (stock >= 0),   -- afgeleid, zie trigger
  min_stock             integer check (min_stock >= 0),  -- NULL = standaard uit events
  barcode               text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index products_event_sku_ci on products (event_id, lower(sku));
create index products_event_category on products (event_id, category_id);
create index products_barcode on products (event_id, barcode) where barcode is not null;
create index products_event_name_category on products (event_id, name, category_id);

-- ---------------------------------------------------------------------------
-- Bonnen: gedeelde kop voor sales + refunds, garandeert één oplopende,
-- unieke reeks per kassa ongeacht het type boeking.
-- ---------------------------------------------------------------------------

create table receipts (
  id                    uuid primary key default gen_random_uuid(),
  register_id           uuid not null references registers(id),
  receipt_number        bigint not null,
  kind                  text not null check (kind in ('sale', 'refund')),
  created_at            timestamptz not null default now(),
  unique (register_id, receipt_number)
);

create table sales (
  id                    uuid primary key references receipts(id),
  method                text not null check (method in ('pin', 'cash', 'qr')),
  subtotal_cents        integer not null check (subtotal_cents >= 0),
  discount_cents        integer not null default 0 check (discount_cents >= 0),
  total_cents           integer not null check (total_cents >= 0),
  paid_cents            integer not null check (paid_cents >= 0),
  credit_cents          integer not null default 0 check (credit_cents >= 0),
  credit_ref_id         uuid,  -- fk naar refunds toegevoegd na create table refunds
  received_cents        integer check (received_cents >= paid_cents)
);

create table sale_items (
  id                    uuid primary key default gen_random_uuid(),
  sale_id               uuid not null references sales(id) on delete cascade,
  product_id            uuid not null references products(id),
  sku_snapshot          text not null,
  name_snapshot         text not null,
  variant_snapshot      text not null default '',
  category_snapshot     text not null,
  vat_rate_bp_snapshot  smallint not null,
  unit_price_cents      integer not null check (unit_price_cents >= 0),
  unit_cost_cents       integer not null default 0,
  qty                   integer not null check (qty > 0)
);
create index sale_items_sale on sale_items (sale_id);
create index sale_items_product on sale_items (product_id);

create table refunds (
  id                    uuid primary key references receipts(id),
  method                text not null check (method in ('pin', 'cash', 'qr', 'exchange')),
  reason                text not null check (reason in
                           ('wrong_size', 'defective', 'unhappy', 'mis_scanned', 'other')),
  restock               boolean not null default true,
  ref_sale_id           uuid references sales(id),      -- NULL = retour zonder bon
  subtotal_cents        integer not null check (subtotal_cents >= 0),
  discount_cents        integer not null default 0 check (discount_cents >= 0),
  total_cents           integer not null check (total_cents >= 0)
);
create index refunds_ref_sale on refunds (ref_sale_id);

alter table sales add constraint sales_credit_ref_fk foreign key (credit_ref_id) references refunds(id);

create table refund_items (
  id                        uuid primary key default gen_random_uuid(),
  refund_id                 uuid not null references refunds(id) on delete cascade,
  product_id                uuid not null references products(id),
  sku_snapshot              text not null,
  name_snapshot             text not null,
  variant_snapshot          text not null default '',
  category_snapshot         text not null,
  vat_rate_bp_snapshot      smallint not null,
  original_unit_price_cents integer not null,
  refunded_unit_cents       integer not null,   -- pro-rata na korting
  unit_cost_cents           integer not null default 0,
  qty                       integer not null check (qty > 0)
);
create index refund_items_refund on refund_items (refund_id);

-- ---------------------------------------------------------------------------
-- Voorraadmutaties: enige bron van waarheid voor products.stock
-- ---------------------------------------------------------------------------

create table import_batches (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  filename        text not null,
  mode            text not null check (mode in ('overwrite', 'add')),
  row_count       integer not null,
  created_at      timestamptz not null default now()
);

create table stock_movements (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  product_id        uuid not null references products(id),
  register_id       uuid references registers(id),       -- NULL bij import/telling buiten kassa
  sale_id           uuid references sales(id),
  refund_id         uuid references refunds(id),
  import_batch_id   uuid references import_batches(id),
  sku_snapshot      text not null,
  name_snapshot     text not null,
  variant_snapshot  text not null default '',
  delta             integer not null check (delta <> 0),
  balance_after     integer,   -- ingevuld door trg_apply_stock_movement
  reason            text not null check (reason in
                       ('sale', 'return', 'delivery', 'count', 'correction', 'import', 'manual')),
  ref               text,
  created_at        timestamptz not null default now()
);
create index stock_movements_product on stock_movements (product_id, created_at desc);
create index stock_movements_register on stock_movements (register_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Atomaire voorraadafboeking: enige schrijfpoort naar products.stock.
-- De UPDATE met WHERE stock + delta >= 0 neemt een row-lock op de productrij;
-- bij onvoldoende voorraad raakt de update geen rij en gooit de trigger een
-- exception, die de hele omliggende transactie (sale + items + movement)
-- terugdraait. Zo verkopen twee kassa's nooit tegelijk hetzelfde laatste stuk.
-- ---------------------------------------------------------------------------

-- set_config zet de guard hieronder lokaal "aan" voor de duur van deze ene
-- UPDATE-statement, zodat trg_guard_direct_stock_write deze schrijf wel toestaat.
create or replace function trg_apply_stock_movement() returns trigger
language plpgsql as $$
declare
  v_new_stock integer;
begin
  perform set_config('app.stock_write_allowed', 'on', true);

  update products
    set stock = stock + new.delta, updated_at = now()
    where id = new.product_id
      and stock + new.delta >= 0
    returning stock into v_new_stock;

  if not found then
    raise exception 'INSUFFICIENT_STOCK: onvoldoende voorraad voor product % (delta %)',
      new.product_id, new.delta using errcode = 'P0001';
  end if;

  new.balance_after := v_new_stock;
  return new;
end;
$$;

create trigger stock_movements_apply
  before insert on stock_movements
  for each row execute function trg_apply_stock_movement();

-- Blokkeert directe UPDATE products SET stock = ... buiten de mutatie-trigger om,
-- zodat een toekomstige bug of ad-hoc query de regel niet per ongeluk omzeilt.
create or replace function trg_guard_direct_stock_write() returns trigger
language plpgsql as $$
begin
  if new.stock <> old.stock and current_setting('app.stock_write_allowed', true) is distinct from 'on' then
    raise exception 'Direct schrijven naar products.stock is niet toegestaan; gebruik stock_movements';
  end if;
  return new;
end;
$$;

create trigger products_guard_stock
  before update on products
  for each row execute function trg_guard_direct_stock_write();

-- ---------------------------------------------------------------------------
-- Checkout: één transactie die voorraad afboekt, het bonnummer ophoogt en de
-- sale + sale_items wegschrijft. Faalt de voorraadafboeking (trigger-exception),
-- dan rolt alles terug en wordt er geen bonnummer "verbrand".
-- ---------------------------------------------------------------------------

create or replace function checkout_sale(
  p_register_id uuid,
  p_method text,
  p_items jsonb,            -- [{product_id, qty, unit_price_cents}]
  p_discount_cents integer default 0,
  p_received_cents integer default null,
  p_credit_cents integer default 0,
  p_credit_ref_id uuid default null
) returns table (sale_id uuid, receipt_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no bigint;
  v_item jsonb;
  v_subtotal integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'unit_price_cents')::int * (v_item->>'qty')::int;

    insert into stock_movements (event_id, product_id, register_id, sale_id,
                                  sku_snapshot, name_snapshot, variant_snapshot,
                                  delta, reason)
      select p.event_id, p.id, p_register_id, v_sale_id, p.sku, p.name, p.variant,
             -(v_item->>'qty')::int, 'sale'
      from products p where p.id = (v_item->>'product_id')::uuid;
  end loop;

  update registers set current_receipt_no = current_receipt_no + 1
    where id = p_register_id returning current_receipt_no into v_receipt_no;

  insert into receipts (id, register_id, receipt_number, kind)
    values (v_sale_id, p_register_id, v_receipt_no, 'sale');

  insert into sales (id, method, subtotal_cents, discount_cents, total_cents,
                      paid_cents, credit_cents, credit_ref_id, received_cents)
    values (v_sale_id, p_method, v_subtotal, p_discount_cents,
            v_subtotal - p_discount_cents, v_subtotal - p_discount_cents - p_credit_cents,
            p_credit_cents, p_credit_ref_id, p_received_cents);

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items (sale_id, product_id, sku_snapshot, name_snapshot,
                             variant_snapshot, category_snapshot, vat_rate_bp_snapshot,
                             unit_price_cents, unit_cost_cents, qty)
      select v_sale_id, p.id, p.sku, p.name, p.variant, c.name,
             coalesce(p.vat_rate_bp, c.default_vat_rate_bp),
             (v_item->>'unit_price_cents')::int, p.cost_cents, (v_item->>'qty')::int
      from products p join categories c on c.id = p.category_id
      where p.id = (v_item->>'product_id')::uuid;

    update stock_movements set ref = v_receipt_no::text
      where sale_id = v_sale_id and product_id = (v_item->>'product_id')::uuid;
  end loop;

  return query select v_sale_id, v_receipt_no;
end;
$$;

-- ---------------------------------------------------------------------------
-- Voorraadmutatie buiten een verkoop om (levering, telling, correctie, import,
-- handmatig). Dit is ook de enige weg voor Excel-import: nooit een directe
-- stock-overschrijving, altijd een insert hier.
-- ---------------------------------------------------------------------------

create or replace function apply_stock_movement(
  p_product_id uuid,
  p_delta integer,
  p_reason text,
  p_ref text default null,
  p_register_id uuid default null,
  p_import_batch_id uuid default null
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_movement stock_movements;
begin
  insert into stock_movements (event_id, product_id, register_id, import_batch_id,
                                sku_snapshot, name_snapshot, variant_snapshot,
                                delta, reason, ref)
    select p.event_id, p.id, p_register_id, p_import_batch_id, p.sku, p.name, p.variant,
           p_delta, p_reason, p_ref
    from products p where p.id = p_product_id
    returning * into v_movement;

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product-CRUD voor het voorraadscherm. Schrijft nooit naar stock (dat kolom
-- blijft op 0 bij create_product; voorraad komt er via een losse
-- apply_stock_movement-call met reason='manual' bij, zodat ook de allereerste
-- voorraadstand een mutatie-record krijgt).
-- ---------------------------------------------------------------------------

create or replace function create_product(
  p_event_id uuid,
  p_sku text,
  p_name text,
  p_category_id uuid,
  p_variant text,
  p_price_cents integer,
  p_cost_cents integer,
  p_min_stock integer default null,
  p_barcode text default null,
  p_vat_rate_bp smallint default null
) returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products;
begin
  insert into products (event_id, sku, name, category_id, variant, price_cents,
                         cost_cents, min_stock, barcode, vat_rate_bp)
    values (p_event_id, p_sku, p_name, p_category_id, coalesce(p_variant, ''), p_price_cents,
            p_cost_cents, p_min_stock, p_barcode, p_vat_rate_bp)
    returning * into v_product;

  return v_product;
end;
$$;

create or replace function update_product_details(
  p_product_id uuid,
  p_name text,
  p_category_id uuid,
  p_variant text,
  p_price_cents integer,
  p_cost_cents integer,
  p_min_stock integer,
  p_barcode text,
  p_vat_rate_bp smallint,
  p_active boolean
) returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products;
begin
  update products set
    name = p_name,
    category_id = p_category_id,
    variant = coalesce(p_variant, ''),
    price_cents = p_price_cents,
    cost_cents = p_cost_cents,
    min_stock = p_min_stock,
    barcode = p_barcode,
    vat_rate_bp = p_vat_rate_bp,
    active = p_active,
    updated_at = now()
  where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retour: pro-rata korting-verdeling via dezelfde bonnummerteller en dezelfde
-- stock_movements-poort (reason='return', alleen als restock=true).
-- ---------------------------------------------------------------------------

create or replace function create_refund(
  p_register_id uuid,
  p_method text,
  p_reason text,
  p_restock boolean,
  p_ref_sale_id uuid,       -- NULL bij retour zonder bon
  p_items jsonb             -- [{product_id, qty, original_unit_price_cents, refunded_unit_cents}]
) returns table (refund_id uuid, receipt_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_refund_id uuid := gen_random_uuid();
  v_receipt_no bigint;
  v_item jsonb;
  v_subtotal integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'refunded_unit_cents')::int * (v_item->>'qty')::int;

    if p_restock then
      insert into stock_movements (event_id, product_id, register_id, refund_id,
                                    sku_snapshot, name_snapshot, variant_snapshot,
                                    delta, reason)
        select p.event_id, p.id, p_register_id, v_refund_id, p.sku, p.name, p.variant,
               (v_item->>'qty')::int, 'return'
        from products p where p.id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  update registers set current_receipt_no = current_receipt_no + 1
    where id = p_register_id returning current_receipt_no into v_receipt_no;

  insert into receipts (id, register_id, receipt_number, kind)
    values (v_refund_id, p_register_id, v_receipt_no, 'refund');

  insert into refunds (id, method, reason, restock, ref_sale_id,
                        subtotal_cents, discount_cents, total_cents)
    values (v_refund_id, p_method, p_reason, p_restock, p_ref_sale_id,
            v_subtotal, 0, v_subtotal);

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into refund_items (refund_id, product_id, sku_snapshot, name_snapshot,
                               variant_snapshot, category_snapshot, vat_rate_bp_snapshot,
                               original_unit_price_cents, refunded_unit_cents, unit_cost_cents, qty)
      select v_refund_id, p.id, p.sku, p.name, p.variant, c.name,
             coalesce(p.vat_rate_bp, c.default_vat_rate_bp),
             (v_item->>'original_unit_price_cents')::int, (v_item->>'refunded_unit_cents')::int,
             p.cost_cents, (v_item->>'qty')::int
      from products p join categories c on c.id = p.category_id
      where p.id = (v_item->>'product_id')::uuid;
  end loop;

  return query select v_refund_id, v_receipt_no;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: aan op alle tabellen. Geen rollensysteem in fase 1 (komt in fase 3),
-- maar wel dicht voor willekeurige anonieme internetclients. Elk kassa-apparaat
-- doet signInAnonymously() bij opstarten. Alle schrijfacties lopen uitsluitend
-- via de SECURITY DEFINER functies hierboven.
-- ---------------------------------------------------------------------------

alter table events enable row level security;
alter table categories enable row level security;
alter table registers enable row level security;
alter table products enable row level security;
alter table receipts enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table refunds enable row level security;
alter table refund_items enable row level security;
alter table stock_movements enable row level security;
alter table import_batches enable row level security;

create policy select_authenticated_events on events for select to authenticated using (true);
create policy select_authenticated_categories on categories for select to authenticated using (true);
create policy select_authenticated_registers on registers for select to authenticated using (true);
create policy select_authenticated_products on products for select to authenticated using (true);
create policy select_authenticated_receipts on receipts for select to authenticated using (true);
create policy select_authenticated_sales on sales for select to authenticated using (true);
create policy select_authenticated_sale_items on sale_items for select to authenticated using (true);
create policy select_authenticated_refunds on refunds for select to authenticated using (true);
create policy select_authenticated_refund_items on refund_items for select to authenticated using (true);
create policy select_authenticated_stock_movements on stock_movements for select to authenticated using (true);
create policy select_authenticated_import_batches on import_batches for select to authenticated using (true);

revoke insert, update, delete on
  events, categories, registers, products, receipts, sales, sale_items,
  refunds, refund_items, stock_movements, import_batches
  from authenticated, anon;

grant execute on function
  checkout_sale, create_refund, apply_stock_movement, create_product, update_product_details
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: kassa's zien elkaars voorraad en nieuwe bonnen direct.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table products;
alter publication supabase_realtime add table stock_movements;
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table refunds;
