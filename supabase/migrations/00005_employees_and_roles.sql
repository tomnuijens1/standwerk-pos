-- Fase 3: medewerkers met pincode-login en rollen.
-- Pincode is géén volwaardige authenticatie (het blijft één gedeeld
-- kassa-apparaat met één Supabase-sessie) maar een manier om te registreren
-- wie een bon/retour/correctie heeft gedaan, en om rechten te scheiden
-- (korting-limiet, retouren, voorraadcorrecties) binnen die ene sessie.

alter table events add column max_discount_percent_without_manager smallint not null default 20;

create table employees (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  name            text not null,
  pincode_hash    text not null,
  role            text not null check (role in ('cashier', 'manager')),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index employees_event on employees (event_id) where active = true;

alter table employees enable row level security;

-- Geen policy die pincode_hash blootstelt aan select *; de app selecteert
-- expliciet alleen id/name/role/active, nooit pincode_hash.
create policy select_authenticated_employees on employees for select to authenticated using (true);

revoke insert, update, delete on employees from authenticated, anon;

create or replace function create_employee(
  p_event_id uuid,
  p_name text,
  p_pincode text,
  p_role text
) returns table (id uuid, name text, role text, active boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_pincode !~ '^[0-9]{4,6}$' then
    raise exception 'Pincode moet 4 tot 6 cijfers zijn';
  end if;

  insert into employees (event_id, name, pincode_hash, role)
    values (p_event_id, p_name, crypt(p_pincode, gen_salt('bf')), p_role)
    returning employees.id into v_id;

  return query select employees.id, employees.name, employees.role, employees.active
    from employees where employees.id = v_id;
end;
$$;

create or replace function deactivate_employee(p_employee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update employees set active = false where id = p_employee_id;
end;
$$;

-- Zoekt de medewerker die bij deze pincode hoort (of geeft niets terug als er
-- geen match is). pincode_hash verlaat de database nooit via deze functie.
create or replace function verify_employee_pincode(
  p_event_id uuid,
  p_pincode text
) returns table (id uuid, name text, role text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select e.id, e.name, e.role
    from employees e
    where e.event_id = p_event_id
      and e.active = true
      and e.pincode_hash = crypt(p_pincode, e.pincode_hash)
    limit 1;
end;
$$;

grant execute on function create_employee, deactivate_employee, verify_employee_pincode to authenticated;

-- ---------------------------------------------------------------------------
-- Rechten in de bestaande RPC's: p_employee_id is een nieuw, optioneel laatste
-- argument (bestaande aanroepen blijven werken). Ontbreekt het, of hoort het
-- bij geen geldige medewerker, dan wordt voorzichtigheidshalve 'cashier'
-- aangenomen — de meest beperkte rol, nooit stilzwijgend toegestaan.
-- ---------------------------------------------------------------------------

-- Expliciet de oude signatures droppen: anders ontstaat er door het extra
-- argument een verwarrende tweede overload naast de oorspronkelijke functie,
-- in plaats van een vervanging.
drop function if exists checkout_sale(uuid, text, jsonb, integer, integer, integer, uuid);
drop function if exists create_refund(uuid, text, text, boolean, uuid, jsonb);
drop function if exists apply_stock_movement(uuid, integer, text, text, uuid, uuid);

create or replace function checkout_sale(
  p_register_id uuid,
  p_method text,
  p_items jsonb,
  p_discount_cents integer default 0,
  p_received_cents integer default null,
  p_credit_cents integer default 0,
  p_credit_ref_id uuid default null,
  p_employee_id uuid default null
) returns table (sale_id uuid, receipt_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no bigint;
  v_item jsonb;
  v_subtotal integer := 0;
  v_role text;
  v_max_pct smallint;
begin
  select role into v_role from employees where id = p_employee_id and active = true;
  v_role := coalesce(v_role, 'cashier');

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'unit_price_cents')::int * (v_item->>'qty')::int;

    insert into stock_movements (event_id, product_id, register_id, sale_id,
                                  sku_snapshot, name_snapshot, variant_snapshot,
                                  delta, reason)
      select p.event_id, p.id, p_register_id, v_sale_id, p.sku, p.name, p.variant,
             -(v_item->>'qty')::int, 'sale'
      from products p where p.id = (v_item->>'product_id')::uuid;
  end loop;

  select e.max_discount_percent_without_manager into v_max_pct
    from registers r join events e on e.id = r.event_id where r.id = p_register_id;

  if v_subtotal > 0 and p_discount_cents > 0 and v_role <> 'manager'
     and (p_discount_cents::numeric / v_subtotal * 100) > v_max_pct then
    raise exception 'PERMISSION_DENIED: korting boven %% vereist een manager', v_max_pct using errcode = 'P0001';
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
             (v_item->>'unit_price_cents')::int, p.cost_cents, (v_item->>'qty')::int
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
  p_employee_id uuid default null
) returns table (refund_id uuid, receipt_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_refund_id uuid := gen_random_uuid();
  v_receipt_no bigint;
  v_item jsonb;
  v_subtotal integer := 0;
  v_role text;
begin
  select role into v_role from employees where id = p_employee_id and active = true;
  v_role := coalesce(v_role, 'cashier');

  if v_role <> 'manager' then
    raise exception 'PERMISSION_DENIED: retouren mogen alleen door een manager geboekt worden' using errcode = 'P0001';
  end if;

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

create or replace function apply_stock_movement(
  p_product_id uuid,
  p_delta integer,
  p_reason text,
  p_ref text default null,
  p_register_id uuid default null,
  p_import_batch_id uuid default null,
  p_employee_id uuid default null
) returns stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_movement stock_movements;
  v_role text;
begin
  select role into v_role from employees where id = p_employee_id and active = true;
  v_role := coalesce(v_role, 'cashier');

  if p_reason = 'correction' and v_role <> 'manager' then
    raise exception 'PERMISSION_DENIED: voorraadcorrecties mogen alleen door een manager gedaan worden' using errcode = 'P0001';
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

-- DROP FUNCTION hierboven verwijdert ook de eerder verleende rechten op deze
-- functienamen; opnieuw toekennen aan de vernieuwde versies.
grant execute on function checkout_sale, create_refund, apply_stock_movement to authenticated;
