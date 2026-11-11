-- Fase 4: koppeling met een fysieke betaalterminal per kassa.
--
-- terminal_id is Adyen's POIID: "[model]-[serienummer]", bijv.
-- "S1F2-000158225400001". Leeg laten betekent: deze kassa heeft geen terminal,
-- en valt terug op handmatig bevestigen van de pinbetaling (ManualProvider).
alter table registers add column terminal_id text;
