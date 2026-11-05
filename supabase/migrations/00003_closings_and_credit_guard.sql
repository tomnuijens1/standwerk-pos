-- Fase 2: dagafsluiting + waarborg dat omruiltegoed maar één keer verzilverd wordt.

-- Een refund met method='exchange' mag door precies één volgende verkoop als
-- tegoed gebruikt worden; deze unieke index voorkomt dat twee verkopen
-- tegelijk naar hetzelfde tegoed verwijzen (en dus "dubbel" tegoed verzilveren).
create unique index sales_credit_ref_id_unique on sales (credit_ref_id) where credit_ref_id is not null;

-- ---------------------------------------------------------------------------
-- Dagafsluitingen: een opgeslagen momentopname per kassa (of "alle kassa's")
-- per dag. Geen atomaire invariant zoals bij voorraad/bonnummers, dus net als
-- events/registers/categories gewoon met directe insert/update i.p.v. een RPC.
-- ---------------------------------------------------------------------------

create table closings (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  register_id       uuid references registers(id),  -- NULL = "alle kassa's"
  date              date not null,
  opening_float_cents integer not null,
  expected_cents    integer not null,
  counted_cents     integer not null,
  diff_cents        integer not null,
  tx_count          integer not null,
  net_cents         integer not null,
  gross_cents       integer not null,
  refunds_cents     integer not null,
  discount_cents    integer not null,
  vat_cents         integer not null,
  items_count       integer not null,
  methods           jsonb not null,  -- { pin: {in, out, n}, cash: {...}, qr: {...} }
  note              text,
  created_at        timestamptz not null default now()
);
create index closings_event_date on closings (event_id, date desc);

alter table closings enable row level security;
create policy select_authenticated_closings on closings for select to authenticated using (true);
create policy insert_authenticated_closings on closings for insert to authenticated with check (true);

alter publication supabase_realtime add table closings;
