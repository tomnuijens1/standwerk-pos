-- Supabase kent nieuwe tabellen standaard rechten toe aan anon/authenticated.
-- Voor pincode_attempts is dat ongewenst: wie daar rijen kan verwijderen, kan
-- zijn mislukte pogingen wissen en de limiet van 10 pogingen per 15 minuten
-- omzeilen.
--
-- RLS staat al aan zonder policies, dus toegang is feitelijk al geblokkeerd.
-- Deze migratie haalt ook de onderliggende rechten weg, zodat er geen gat
-- ontstaat als er later per ongeluk een policy bij komt.
revoke all on pincode_attempts from anon, authenticated;

-- De bijbehorende sequence (van de bigserial-kolom) om dezelfde reden.
revoke all on sequence pincode_attempts_id_seq from anon, authenticated;
