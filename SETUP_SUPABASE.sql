
-- Aggiungi questo se non l'hai ancora fatto (necessario per sync Google Sheets)
-- Permette l'upsert su cantina + vino
ALTER TABLE public.vini ADD CONSTRAINT vini_cantina_vino_unique UNIQUE (cantina, vino);
