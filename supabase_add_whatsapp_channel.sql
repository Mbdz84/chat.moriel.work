-- ============================================================================
--  Add WhatsApp support: a `channel` column so SMS and WhatsApp threads stay
--  separate and replies go back out over the channel the message came in on.
--  Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
--  Safe to run more than once.
-- ============================================================================

-- 1) channel column on both tables. Existing rows are all SMS, so default 'sms'.
alter table public.conversations
  add column if not exists channel text not null default 'sms';
alter table public.messages
  add column if not exists channel text not null default 'sms';

-- 2) Only allow the two values we support.
do $$ begin
  alter table public.conversations
    add constraint conversations_channel_chk check (channel in ('sms','whatsapp'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.messages
    add constraint messages_channel_chk check (channel in ('sms','whatsapp'));
exception when duplicate_object then null; end $$;

-- 3) The old uniqueness was (company_id, our_number, contact_number). We need
--    channel in the key so the same contact on SMS vs WhatsApp is two threads.
--    Drop the existing natural-key UNIQUE constraint(s) on conversations, then
--    recreate including channel. (id stays the PRIMARY KEY and is untouched.)
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'conversations'
      and con.contype = 'u'
  loop
    execute format('alter table public.conversations drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.conversations
  add constraint conversations_company_our_contact_channel_key
  unique (company_id, our_number, contact_number, channel);

-- 4) Verify.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('conversations','messages')
  and column_name = 'channel';
