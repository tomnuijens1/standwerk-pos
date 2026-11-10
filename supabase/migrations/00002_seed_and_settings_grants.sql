-- Fase 1 heeft nog geen rollensysteem (komt in fase 3), dus event/kassa/categorie-
-- instellingen mogen door elk kassa-apparaat gelezen én bewerkt worden. Dit is
-- bewust losser dan de RPC-only aanpak voor products/sales/stock_movements,
-- omdat hier geen atomaire invariant (voorraad, bonnummer) te bewaken is.

grant update on events to authenticated;
grant insert, update on registers to authenticated;
grant insert, update on categories to authenticated;

create policy update_authenticated_events on events for update to authenticated using (true) with check (true);
create policy insert_authenticated_registers on registers for insert to authenticated with check (true);
create policy update_authenticated_registers on registers for update to authenticated using (true) with check (true);
create policy insert_authenticated_categories on categories for insert to authenticated with check (true);
create policy update_authenticated_categories on categories for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed: één event met categorieën, kassa's en het voorbeeldassortiment
-- (zelfde data als voorbeelden/voorbeeld-assortiment.xlsx), zodat de app meteen
-- iets te tonen heeft.
-- ---------------------------------------------------------------------------

do $$
declare
  v_event_id uuid;
  v_cat_tshirts uuid;
  v_cat_hoodies uuid;
  v_cat_accessoires uuid;
  v_cat_muziek uuid;
  v_cat_print uuid;
begin
  insert into events (name, low_stock_default, opening_float_cents, return_days)
    values ('Zomertour 2026', 5, 15000, 30)
    returning id into v_event_id;

  insert into categories (event_id, name, default_vat_rate_bp)
    values (v_event_id, 'T-shirts', 2100) returning id into v_cat_tshirts;
  insert into categories (event_id, name, default_vat_rate_bp)
    values (v_event_id, 'Hoodies', 2100) returning id into v_cat_hoodies;
  insert into categories (event_id, name, default_vat_rate_bp)
    values (v_event_id, 'Accessoires', 2100) returning id into v_cat_accessoires;
  insert into categories (event_id, name, default_vat_rate_bp)
    values (v_event_id, 'Muziek', 2100) returning id into v_cat_muziek;
  insert into categories (event_id, name, default_vat_rate_bp)
    values (v_event_id, 'Print', 2100) returning id into v_cat_print;

  insert into registers (event_id, name, code) values
    (v_event_id, 'Hoofdpodium', 'HOO'),
    (v_event_id, 'Ingang Noord', 'ING');

  insert into products (event_id, sku, name, category_id, variant, price_cents, cost_cents, min_stock, barcode) values
    (v_event_id, 'TOUTEEZWA-S', 'Tour Tee Zwart', v_cat_tshirts, 'S', 3500, 950, 20, '8712345100000'),
    (v_event_id, 'TOUTEEZWA-M', 'Tour Tee Zwart', v_cat_tshirts, 'M', 3500, 950, 20, '8712345100001'),
    (v_event_id, 'TOUTEEZWA-L', 'Tour Tee Zwart', v_cat_tshirts, 'L', 3500, 950, 20, '8712345100002'),
    (v_event_id, 'TOUTEEZWA-XL', 'Tour Tee Zwart', v_cat_tshirts, 'XL', 3500, 950, 20, '8712345100003'),
    (v_event_id, 'HOOGRI-M', 'Tour Hoodie Grijs', v_cat_hoodies, 'M', 5500, 1800, 10, null),
    (v_event_id, 'HOOGRI-L', 'Tour Hoodie Grijs', v_cat_hoodies, 'L', 5500, 1800, 10, null),
    (v_event_id, 'LOGCAP', 'Logo Cap', v_cat_accessoires, '', 2800, 600, 10, '8712345100020'),
    (v_event_id, 'VINLP', 'Vinyl LP', v_cat_muziek, '', 3200, 1400, 10, '8712345100025'),
    (v_event_id, 'STI', 'Stickerpack', v_cat_print, '', 600, 80, 10, '8712345100028'),
    (v_event_id, 'TOURBOEK', 'Tourboek', v_cat_print, '', 2000, 700, 10, null);

  -- Een tourboek valt onder het verlaagde btw-tarief voor boeken, afwijkend van de
  -- Print-categorie (21%) — dit is het product-niveau-override uit CLAUDE.md.
  update products set vat_rate_bp = 900 where event_id = v_event_id and sku = 'TOURBOEK';

  -- Beginvoorraad als mutatie (reason='manual'), nooit als losse kolom-overschrijving.
  insert into stock_movements (event_id, product_id, sku_snapshot, name_snapshot, variant_snapshot, delta, reason, ref)
    select v_event_id, p.id, p.sku, p.name, p.variant, v.initial_stock, 'manual', 'Beginvoorraad'
    from products p
    join (values
      ('TOUTEEZWA-S', 12), ('TOUTEEZWA-M', 8), ('TOUTEEZWA-L', 0), ('TOUTEEZWA-XL', 5),
      ('HOOGRI-M', 6), ('HOOGRI-L', 3), ('LOGCAP', 18), ('VINLP', 9), ('STI', 40), ('TOURBOEK', 15)
    ) as v(sku, initial_stock) on v.sku = p.sku
    where p.event_id = v_event_id and v.initial_stock <> 0;
end $$;
