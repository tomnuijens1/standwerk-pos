-- Op enig moment is er buiten deze migraties om een "lidmaatschap"-gebaseerd
-- RLS-schema toegevoegd (een event_members-tabel, een private.is_event_member()
-- functie, en op praktisch elke tabel een *_read_member/*_insert_member/
-- *_update_member policy) — vermoedelijk via een AI-suggestie/"fix" in het
-- Supabase-dashboard. Omdat de app niets in event_members registreert, gaf
-- is_event_member() altijd false terug en blokkeerde dat alle leestoegang voor
-- de live (Vercel) omgeving, terwijl de Table Editor (postgres-rol, omzeilt
-- RLS) gewoon data liet zien — vandaar dat het probleem onzichtbaar was totdat
-- de site live stond.
--
-- Fase 1 heeft nog geen rollen-/lidmaatschapssysteem (dat komt in fase 3), dus
-- deze migratie verwijdert dat ongewenste schema en herstelt de oorspronkelijke,
-- eenvoudige regel: elk ingelogd (anoniem) kassa-apparaat mag alles lezen.

drop policy if exists categories_read_member on categories;
drop policy if exists categories_insert_member on categories;
drop policy if exists categories_update_member on categories;
drop policy if exists closings_read_member on closings;
drop policy if exists closings_insert_member on closings;
drop policy if exists events_read_member on events;
drop policy if exists events_update_member on events;
drop policy if exists import_batches_read_member on import_batches;
drop policy if exists products_read_member on products;
drop policy if exists receipts_read_member on receipts;
drop policy if exists refund_items_read_member on refund_items;
drop policy if exists refunds_read_member on refunds;
drop policy if exists registers_read_member on registers;
drop policy if exists registers_insert_member on registers;
drop policy if exists registers_update_member on registers;
drop policy if exists sale_items_read_member on sale_items;
drop policy if exists sales_read_member on sales;
drop policy if exists stock_movements_read_member on stock_movements;

drop policy if exists event_members_read_self on event_members;
drop table if exists event_members;
drop function if exists private.is_event_member(uuid);

create policy select_authenticated_categories on categories for select to authenticated using (true);
create policy select_authenticated_closings on closings for select to authenticated using (true);
create policy insert_authenticated_closings on closings for insert to authenticated with check (true);
create policy select_authenticated_events on events for select to authenticated using (true);
create policy select_authenticated_import_batches on import_batches for select to authenticated using (true);
create policy select_authenticated_products on products for select to authenticated using (true);
create policy select_authenticated_receipts on receipts for select to authenticated using (true);
create policy select_authenticated_refund_items on refund_items for select to authenticated using (true);
create policy select_authenticated_refunds on refunds for select to authenticated using (true);
create policy select_authenticated_registers on registers for select to authenticated using (true);
create policy select_authenticated_sale_items on sale_items for select to authenticated using (true);
create policy select_authenticated_sales on sales for select to authenticated using (true);
create policy select_authenticated_stock_movements on stock_movements for select to authenticated using (true);
