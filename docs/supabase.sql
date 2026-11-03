-- =====================================================================
-- NexusLife — schema Supabase per la sincronizzazione cifrata (CLAUDE.md §8)
-- =====================================================================
--
-- COME ESEGUIRLO (una volta sola; rieseguirlo non fa danni: è idempotente)
--
--  1. Apri https://supabase.com/dashboard e scegli il progetto NexusLife.
--  2. Nel menu a sinistra apri "SQL Editor".
--  3. Premi "+ New query" (oppure "New SQL snippet").
--  4. Copia TUTTO questo file e incollalo nell'editor.
--  5. Premi "Run" (o Cmd+Invio). In basso deve comparire "Success. No rows returned".
--  6. Controllo facoltativo: in "Table Editor" ci sono le tabelle `records` e `vault`,
--     entrambe con l'etichetta "RLS enabled".
--
-- Poi:
--  - Authentication → Users → "Add user" → "Create new user": email e password,
--    con "Auto Confirm User" attivo.
--  - Authentication → Sign In / Providers → "Allow new users to sign up": off.
--
-- Cosa vede Supabase: solo entity, id, updated_at e deleted in chiaro. Il contenuto di ogni
-- record (payload) è cifrato con AES-GCM sul dispositivo, con una chiave che non lascia mai
-- il dispositivo. Il vault contiene solo il salt e un testo di verifica cifrato.
-- =====================================================================

-- ---------- Tabella dei record cifrati ----------
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  entity     text        not null,
  id         text        not null,
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  iv         text        not null,
  payload    text        not null,
  server_ts  timestamptz not null default now(),
  primary key (user_id, entity, id)
);

create index if not exists records_user_server_ts_idx on public.records (user_id, server_ts);

-- server_ts segna il momento in cui il server ha ricevuto la versione: serve alla lettura
-- incrementale. clock_timestamp() (non now()) dà istanti diversi alle righe dello stesso lotto.
create or replace function public.records_touch_server_ts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_ts := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch_server_ts on public.records;
create trigger records_touch_server_ts
  before insert or update on public.records
  for each row execute function public.records_touch_server_ts();

-- ---------- Vault: salt e verifica della passphrase ----------
create table if not exists public.vault (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  salt       text        not null,
  verifier   text        not null,
  iterations integer     not null check (iterations >= 100000),
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security: ognuno vede solo le proprie righe ----------
alter table public.records enable row level security;
alter table public.vault   enable row level security;

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy records_insert on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy records_update on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy records_delete on public.records for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists vault_select on public.vault;
drop policy if exists vault_insert on public.vault;
drop policy if exists vault_update on public.vault;
drop policy if exists vault_delete on public.vault;
create policy vault_select on public.vault for select to authenticated using ((select auth.uid()) = user_id);
create policy vault_insert on public.vault for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vault_update on public.vault for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy vault_delete on public.vault for delete to authenticated using ((select auth.uid()) = user_id);

-- Solo gli utenti autenticati toccano le tabelle; la chiave pubblica da sola non basta.
revoke all on public.records from anon;
revoke all on public.vault   from anon;
grant select, insert, update, delete on public.records to authenticated;
grant select, insert, update, delete on public.vault   to authenticated;

-- ---------- RPC: scrittura a lotti, last-writer-wins per record ----------
-- rows = [{ "entity", "id", "updated_at", "deleted", "iv", "payload" }, ...]
-- Una riga esistente viene sostituita solo se updated_at in arrivo è più recente.
-- SECURITY INVOKER: valgono le policy RLS di chi chiama. Restituisce le righe scritte.
create or replace function public.upsert_records(rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  written integer;
begin
  if auth.uid() is null then
    raise exception 'non autenticato' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'rows deve essere un array' using errcode = '22023';
  end if;

  insert into public.records as r (user_id, entity, id, updated_at, deleted, iv, payload)
  select auth.uid(), x.entity, x.id, x.updated_at, coalesce(x.deleted, false), x.iv, x.payload
  from jsonb_to_recordset(rows) as x(entity text, id text, updated_at timestamptz, deleted boolean, iv text, payload text)
  on conflict (user_id, entity, id) do update
    set updated_at = excluded.updated_at,
        deleted    = excluded.deleted,
        iv         = excluded.iv,
        payload    = excluded.payload
    where excluded.updated_at > r.updated_at;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.upsert_records(jsonb) from public, anon;
grant execute on function public.upsert_records(jsonb) to authenticated;

-- ---------- Keepalive ----------
-- Chiamata due volte a settimana da .github/workflows/keepalive.yml, così il progetto
-- gratuito non viene messo in pausa per inattività. Non legge né scrive dati.
create or replace function public.ping()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select 'pong'::text $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
