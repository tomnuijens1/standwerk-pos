-- Beveiligingsherstel na review.
--
-- Kern van het probleem: de app gebruikt anonieme Supabase-sessies, dus
-- IEDEREEN die de app (of de APK) heeft, krijgt automatisch de rol
-- "authenticated". Schrijfacties stonden daar rechtstreeks voor open:
--   * checkout_sale/create_refund/apply_stock_movement accepteerden een lege
--     p_employee_id en vielen dan stilzwijgend terug op rol 'cashier';
--   * events/registers/categories waren direct beschrijfbaar via de tabel;
--   * de retourtermijn werd alleen in de browser gecontroleerd;
--   * pincodes waren onbeperkt te raden.
--
-- Deze migratie verplaatst al die controles naar de database, waar ze niet te
-- omzeilen zijn door de client aan te passen of de API rechtstreeks aan te
-- roepen.

-- ---------------------------------------------------------------------------
-- 1. Pincode-pogingen begrenzen
-- ---------------------------------------------------------------------------

create table if not exists pincode_attempts (
  id          bigserial primary key,
  event_id    uuid not null references events(id) on delete cascade,
  succeeded   boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists pincode_attempts_recent on pincode_attempts (event_id, attempted_at desc);

alter table pincode_attempts enable row level security;
-- Geen policies: alleen de SECURITY DEFINER-functie hieronder mag erbij.

-- Maximaal 10 mislukte pogingen per 15 minuten per event. Ruim genoeg voor
-- vertypen aan de kassa, maar maakt het aflopen van 10.000 pincodes onhaalbaar.
create or replace function verify_employee_pincode(
  p_event_id uuid,
  p_pincode text
) returns table (id uuid, name text, role text)
language plpgsql security definer set search_path = public as $$
declare
  v_recent_failures integer;
  v_employee_id uuid;
  v_name text;
  v_role text;
begin
  select count(*) into v_recent_failures
    from pincode_attempts a
    where a.event_id = p_event_id
      and a.succeeded = false
      and a.attempted_at > now() - interval '15 minutes';

  if v_recent_failures >= 10 then
    raise exception 'TOO_MANY_ATTEMPTS: te veel mislukte pogingen, probeer het over 15 minuten opnieuw'
      using errcode = 'P0001';
  end if;

  select e.id, e.name, e.role into v_employee_id, v_name, v_role
    from employees e
    where e.event_id = p_event_id
      and e.active = true
      and e.pincode_hash = crypt(p_pincode, e.pincode_hash)
    limit 1;

  insert into pincode_attempts (event_id, succeeded) values (p_event_id, v_employee_id is not null);

  if v_employee_id is null then
    return;
  end if;

  return query select v_employee_id, v_name, v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Elke schrijfactie vereist een geldige, actieve medewerker
-- ---------------------------------------------------------------------------

-- Haalt de rol op en weigert als de medewerker niet bestaat of inactief is.
-- Vervangt het eerdere "coalesce(v_role, 'cashier')", dat een ontbrekende of
-- verzonnen employee-id stilzwijgend als kassamedewerker behandelde.
create or replace function require_employee_role(p_employee_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if p_employee_id is null then
    raise exception 'AUTH_REQUIRED: log eerst in met een pincode' using errcode = 'P0001';
  end if;

  select role into v_role from employees where id = p_employee_id and active = true;

  if v_role is null then
    raise exception 'AUTH_REQUIRED: onbekende of inactieve medewerker' using errcode = 'P0001';
  end if;

  return v_role;
end;
$$;

drop function if exists checkout_sale(uuid, text, jsonb, integer, integer, integer, uuid, uuid);
drop function if exists create_refund(uuid, text, text, boolean, uuid, jsonb, uuid);
drop function if exists apply_stock_movement(uuid, integer, text, text, uuid, uuid, uuid);

create or replace function checkout_sale(
  p_register_id uuid,
  p_method text,
  p_items jsonb,
  p_employee_id uuid,
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
  v_role text;
  v_max_pct smallint;
  v_expected_price integer;
begin
  v_role := require_employee_role(p_employee_id);

  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_SALE: een bon moet minstens één regel hebben' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'qty')::int <= 0 then
      raise exception 'INVALID_QTY: aantal moet groter dan nul zijn' using errcode = 'P0001';
    end if;

    -- Prijs uit de database halen in plaats van de meegegeven waarde
    -- vertrouwen: anders kan een aangepaste client zichzelf korting geven
    -- door een lagere unit_price_cents mee te sturen.
    select price_cents into v_expected_price from products where id = (v_item->>'product_id')::uuid;
    if v_expected_price is null then
      raise exception 'UNKNOWN_PRODUCT: product bestaat niet' using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + v_expected_price * (v_item->>'qty')::int;

    insert into stock_movements (event_id, product_id, register_id, sale_id,
                                  sku_snapshot, name_snapshot, variant_snapshot,
                                  delta, reason)
      select p.event_id, p.id, p_register_id, v_sale_id, p.sku, p.name, p.variant,
             -(v_item->>'qty')::int, 'sale'
      from products p where p.id = (v_item->>'product_id')::uuid;
  end loop;

  if p_discount_cents < 0 or p_discount_cents > v_subtotal then
    raise exception 'INVALID_DISCOUNT: korting moet tussen 0 en het subtotaal liggen' using errcode = 'P0001';
  end if;

  select e.max_discount_percent_without_manager into v_max_pct
    from registers r join events e on e.id = r.event_id where r.id = p_register_id;

  if v_subtotal > 0 and p_discount_cents > 0 and v_role <> 'manager'
     and (p_discount_cents::numeric / v_subtotal * 100) > v_max_pct then
    raise exception 'PERMISSION_DENIED: korting boven % procent vereist een manager', v_max_pct using errcode = 'P0001';
  end if;

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
             p.price_cents, p.cost_cents, (v_item->>'qty')::int
      from products p join categories c on c.id = p.category_id
      where p.id = (v_item->>'product_id')::uuid;

    update stock_movements set ref = v_receipt_no::text
      where sale_id = v_sale_id and product_id = (v_item->>'product_id')::uuid;
  end loop;

  return query select v_sale_id, v_receipt_no;
end;
$$;

create or replace function create_refund(
  p_register_id uuid,
  p_method text,
  p_reason text,
  p_restock boolean,
  p_ref_sale_id uuid,
  p_items jsonb,
  p_employee_id uuid
) returns table (refund_id uuid, receipt_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_refund_id uuid := gen_random_uuid();
  v_receipt_no bigint;
  v_item jsonb;
  v_subtotal integer := 0;
  v_role text;
  v_return_days integer;
  v_sale_date timestamptz;
  v_original_subtotal integer;
  v_original_total integer;
  v_expected_unit integer;
  v_already_returned integer;
  v_purchased integer;
begin
  v_role := require_employee_role(p_employee_id);

  if v_role <> 'manager' then
    raise exception 'PERMISSION_DENIED: retouren mogen alleen door een manager geboekt worden' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_REFUND: een retour moet minstens één regel hebben' using errcode = 'P0001';
  end if;

  -- Retourtermijn hier controleren in plaats van in de browser: de
  -- client-side check was te omzeilen door de app aan te passen.
  if p_ref_sale_id is not null then
    select rc.created_at, ev.return_days, s.subtotal_cents, s.total_cents
      into v_sale_date, v_return_days, v_original_subtotal, v_original_total
      from sales s
      join receipts rc on rc.id = s.id
      join registers r on r.id = rc.register_id
      join events ev on ev.id = r.event_id
      where s.id = p_ref_sale_id;

    if v_sale_date is null then
      raise exception 'UNKNOWN_SALE: originele bon niet gevonden' using errcode = 'P0001';
    end if;

    if v_return_days > 0 and v_sale_date < now() - (v_return_days || ' days')::interval then
      raise exception 'RETURN_WINDOW_EXPIRED: deze bon valt buiten de retourtermijn van % dagen', v_return_days
        using errcode = 'P0001';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'qty')::int <= 0 then
      raise exception 'INVALID_QTY: aantal moet groter dan nul zijn' using errcode = 'P0001';
    end if;

    if p_ref_sale_id is not null then
      -- Niet meer teruggeven dan gekocht, en het bedrag zelf herberekenen
      -- (pro rata bij korting) in plaats van de client te vertrouwen.
      select si.qty, si.unit_price_cents into v_purchased, v_expected_unit
        from sale_items si
        where si.sale_id = p_ref_sale_id and si.product_id = (v_item->>'product_id')::uuid;

      if v_purchased is null then
        raise exception 'NOT_ON_SALE: dit product staat niet op de originele bon' using errcode = 'P0001';
      end if;

      select coalesce(sum(ri.qty), 0) into v_already_returned
        from refund_items ri
        join refunds rf on rf.id = ri.refund_id
        where rf.ref_sale_id = p_ref_sale_id and ri.product_id = (v_item->>'product_id')::uuid;

      if (v_item->>'qty')::int > v_purchased - v_already_returned then
        raise exception 'TOO_MANY_RETURNED: meer teruggegeven dan gekocht' using errcode = 'P0001';
      end if;

      if v_original_subtotal > 0 then
        v_expected_unit := round(v_expected_unit::numeric * v_original_total / v_original_subtotal);
      end if;
    else
      -- Retour zonder bon: huidige verkoopprijs, nooit een door de client
      -- opgegeven bedrag.
      select price_cents into v_expected_unit from products where id = (v_item->>'product_id')::uuid;
      if v_expected_unit is null then
        raise exception 'UNKNOWN_PRODUCT: product bestaat niet' using errcode = 'P0001';
      end if;
    end if;

    v_subtotal := v_subtotal + v_expected_unit * (v_item->>'qty')::int;

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
    if p_ref_sale_id is not null then
      select si.unit_price_cents into v_expected_unit
        from sale_items si
        where si.sale_id = p_ref_sale_id and si.product_id = (v_item->>'product_id')::uuid;
      if v_original_subtotal > 0 then
        v_expected_unit := round(v_expected_unit::numeric * v_original_total / v_original_subtotal);
      end if;
    else
      select price_cents into v_expected_unit from products where id = (v_item->>'product_id')::uuid;
    end if;

    insert into refund_items (refund_id, product_id, sku_snapshot, name_snapshot,
                               variant_snapshot, category_snapshot, vat_rate_bp_snapshot,
                               original_unit_price_cents, refunded_unit_cents, unit_cost_cents, qty)
      select v_refund_id, p.id, p.sku, p.name, p.variant, c.name,
             coalesce(p.vat_rate_bp, c.default_vat_rate_bp),
             p.price_cents, v_expected_unit, p.cost_cents, (v_item->>'qty')::int
      from products p join categories c on c.id = p.category_id
      where p.id = (v_item->>'product_id')::uuid;
  end loop;

  return query select v_refund_id, v_receipt_no;
end;
$$;

create or replace function apply_stock_movement(
  p_product_id uuid,
  p_delta integer,
  p_reason text,
  p_employee_id uuid,
  p_ref text default null,
  p_register_id uuid default null,
  p_import_batch_id uuid default null
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_movement stock_movements;
  v_role text;
begin
  v_role := require_employee_role(p_employee_id);

  if p_reason = 'correction' and v_role <> 'manager' then
    raise exception 'PERMISSION_DENIED: voorraadcorrecties mogen alleen door een manager gedaan worden' using errcode = 'P0001';
  end if;

  -- 'sale' en 'return' horen bij een bon en mogen niet los geboekt worden.
  if p_reason not in ('delivery', 'count', 'correction', 'import', 'manual') then
    raise exception 'INVALID_REASON: ongeldige reden voor een losse voorraadmutatie' using errcode = 'P0001';
  end if;

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
-- 3. Instellingen alleen door een manager
-- ---------------------------------------------------------------------------

-- Directe tabeltoegang weer intrekken: alles loopt voortaan via de
-- functies hieronder, die de rol controleren.
revoke insert, update, delete on events, registers, categories from authenticated, anon;

drop policy if exists update_authenticated_events on events;
drop policy if exists insert_authenticated_registers on registers;
drop policy if exists update_authenticated_registers on registers;
drop policy if exists insert_authenticated_categories on categories;
drop policy if exists update_authenticated_categories on categories;

create or replace function update_event_settings(
  p_event_id uuid,
  p_employee_id uuid,
  p_name text default null,
  p_low_stock_default integer default null,
  p_opening_float_cents integer default null,
  p_return_days integer default null,
  p_max_discount_percent smallint default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag instellingen wijzigen' using errcode = 'P0001';
  end if;

  update events set
    name = coalesce(p_name, name),
    low_stock_default = coalesce(p_low_stock_default, low_stock_default),
    opening_float_cents = coalesce(p_opening_float_cents, opening_float_cents),
    return_days = coalesce(p_return_days, return_days),
    max_discount_percent_without_manager = coalesce(p_max_discount_percent, max_discount_percent_without_manager)
  where id = p_event_id;
end;
$$;

create or replace function upsert_register(
  p_event_id uuid,
  p_employee_id uuid,
  p_register_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_terminal_id text default null
) returns registers
language plpgsql security definer set search_path = public as $$
declare
  v_register registers;
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag kassa-instellingen wijzigen' using errcode = 'P0001';
  end if;

  if p_register_id is null then
    insert into registers (event_id, name, code, terminal_id)
      values (p_event_id, p_name, p_code, p_terminal_id)
      returning * into v_register;
  else
    update registers set
      name = coalesce(p_name, name),
      code = coalesce(p_code, code),
      terminal_id = p_terminal_id
    where id = p_register_id
    returning * into v_register;
  end if;

  return v_register;
end;
$$;

create or replace function update_category_vat(
  p_category_id uuid,
  p_employee_id uuid,
  p_vat_rate_bp smallint
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag btw-tarieven wijzigen' using errcode = 'P0001';
  end if;

  if p_vat_rate_bp < 0 or p_vat_rate_bp > 10000 then
    raise exception 'INVALID_VAT: btw-tarief moet tussen 0 en 100%% liggen' using errcode = 'P0001';
  end if;

  update categories set default_vat_rate_bp = p_vat_rate_bp where id = p_category_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Medewerkersbeheer alleen door een manager
-- ---------------------------------------------------------------------------

-- Oude signaturen zonder rolcontrole weghalen; anders blijven ze als extra
-- overload bestaan en kan de beveiliging eromheen aangeroepen worden.
drop function if exists create_employee(uuid, text, text, text);
drop function if exists deactivate_employee(uuid);

-- De allereerste manager kan nog zonder bestaande manager aangemaakt worden
-- (anders kom je er nooit in); daarna is een manager-pincode vereist.
create or replace function create_employee(
  p_event_id uuid,
  p_name text,
  p_pincode text,
  p_role text,
  p_employee_id uuid default null
) returns table (id uuid, name text, role text, active boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_existing_count integer;
begin
  select count(*) into v_existing_count from employees where event_id = p_event_id and active = true;

  if v_existing_count > 0 then
    if require_employee_role(p_employee_id) <> 'manager' then
      raise exception 'PERMISSION_DENIED: alleen een manager mag medewerkers toevoegen' using errcode = 'P0001';
    end if;
  end if;

  if p_pincode !~ '^[0-9]{4,6}$' then
    raise exception 'Pincode moet 4 tot 6 cijfers zijn';
  end if;

  if p_role not in ('cashier', 'manager') then
    raise exception 'INVALID_ROLE: rol moet cashier of manager zijn' using errcode = 'P0001';
  end if;

  insert into employees (event_id, name, pincode_hash, role)
    values (p_event_id, p_name, crypt(p_pincode, gen_salt('bf')), p_role)
    returning employees.id into v_id;

  return query select employees.id, employees.name, employees.role, employees.active
    from employees where employees.id = v_id;
end;
$$;

create or replace function deactivate_employee(
  p_employee_id uuid,
  p_acting_employee_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if require_employee_role(p_acting_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag medewerkers deactiveren' using errcode = 'P0001';
  end if;

  update employees set active = false where id = p_employee_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Dagafsluitingen alleen door een manager
-- ---------------------------------------------------------------------------

revoke insert on closings from authenticated, anon;
drop policy if exists insert_authenticated_closings on closings;

create or replace function save_closing(
  p_event_id uuid,
  p_employee_id uuid,
  p_register_id uuid,
  p_date date,
  p_opening_float_cents integer,
  p_expected_cents integer,
  p_counted_cents integer,
  p_diff_cents integer,
  p_tx_count integer,
  p_net_cents integer,
  p_gross_cents integer,
  p_refunds_cents integer,
  p_discount_cents integer,
  p_vat_cents integer,
  p_items_count integer,
  p_methods jsonb,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag een dagafsluiting opslaan' using errcode = 'P0001';
  end if;

  insert into closings (event_id, register_id, date, opening_float_cents, expected_cents,
                        counted_cents, diff_cents, tx_count, net_cents, gross_cents,
                        refunds_cents, discount_cents, vat_cents, items_count, methods, note)
    values (p_event_id, p_register_id, p_date, p_opening_float_cents, p_expected_cents,
            p_counted_cents, p_diff_cents, p_tx_count, p_net_cents, p_gross_cents,
            p_refunds_cents, p_discount_cents, p_vat_cents, p_items_count, p_methods, p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Productbeheer alleen door een manager
-- ---------------------------------------------------------------------------

drop function if exists create_product(uuid, text, text, uuid, text, integer, integer, integer, text, smallint);
drop function if exists update_product_details(uuid, text, uuid, text, integer, integer, integer, text, smallint, boolean);

create or replace function create_product(
  p_event_id uuid,
  p_sku text,
  p_name text,
  p_category_id uuid,
  p_variant text,
  p_price_cents integer,
  p_cost_cents integer,
  p_employee_id uuid,
  p_min_stock integer default null,
  p_barcode text default null,
  p_vat_rate_bp smallint default null
) returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products;
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag producten toevoegen' using errcode = 'P0001';
  end if;

  if p_price_cents < 0 or p_cost_cents < 0 then
    raise exception 'INVALID_PRICE: bedragen mogen niet negatief zijn' using errcode = 'P0001';
  end if;

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
  p_active boolean,
  p_employee_id uuid
) returns products
language plpgsql security definer set search_path = public as $$
declare
  v_product products;
begin
  if require_employee_role(p_employee_id) <> 'manager' then
    raise exception 'PERMISSION_DENIED: alleen een manager mag producten wijzigen' using errcode = 'P0001';
  end if;

  if p_price_cents < 0 or p_cost_cents < 0 then
    raise exception 'INVALID_PRICE: bedragen mogen niet negatief zijn' using errcode = 'P0001';
  end if;

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
-- 7. Rechten opnieuw toekennen
-- ---------------------------------------------------------------------------

-- require_employee_role is een interne hulpfunctie: niet rechtstreeks
-- aanroepbaar maken vanuit de client.
revoke all on function require_employee_role(uuid) from authenticated, anon, public;

grant execute on function
  checkout_sale, create_refund, apply_stock_movement,
  create_product, update_product_details,
  create_employee, deactivate_employee, verify_employee_pincode,
  update_event_settings, upsert_register, update_category_vat, save_closing
  to authenticated;
