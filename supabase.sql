-- ============================================================
-- SchoolSys – cloudová synchronizace (Supabase)
-- Celá škola se ukládá jako JEDEN řádek tabulky school_state
-- (sloupec payload = celý JSON databáze aplikace).
--
-- JAK POUŽÍT:  Supabase dashboard → SQL Editor → vložte celý
-- tento skript → Run. Skript je bezpečné spustit i vícekrát
-- (CREATE TABLE IF NOT EXISTS nic nerozbije).
-- ============================================================

create table if not exists public.school_state (
  id         text primary key,          -- řádek 'main'
  payload    jsonb not null,            -- celá databáze aplikace
  updated_at timestamptz not null default now()
);

-- Povolíme Row Level Security (Supabase vyžaduje u veřejných tabulek).
alter table public.school_state enable row level security;

-- Povolíme čtení i zápis pro anonymní klíč (publishable key).
-- POZOR: toto je režim pro TEST/ROZBĚH – přístup chrání jen klíč,
-- který je ve frontendu veřejný. Před ostrými daty skutečných žáků
-- se musí přepnout na přihlašování uživatelů (Supabase Auth) a
-- užší pravidla RLS – viz DATABAZE.md.
drop policy if exists "school_state_anon_all" on public.school_state;
create policy "school_state_anon_all"
  on public.school_state
  for all
  to anon, authenticated
  using (true)
  with check (true);
