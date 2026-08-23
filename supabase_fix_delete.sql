-- ============================================================================
--  Fix: "deleting a chat doesn't delete"
--  Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
--
--  Why the bug happens:
--   * Block / Archive / Mute work because they are UPDATEs and you have an
--     UPDATE row-level-security (RLS) policy on `conversations`.
--   * Delete does nothing because there is NO DELETE policy, so RLS silently
--     blocks it (Postgres returns "0 rows deleted" with no error). The row
--     disappears from the screen for a moment, then reloads.
--   * If `messages` has no ON DELETE CASCADE, deleting a conversation that has
--     messages would also fail on the foreign key.
--
--  This script fixes both. It is safe to run more than once.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 (optional) — See what you have now.
-- Run just this block first if you want to inspect before changing anything.
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('conversations', 'messages')
order by tablename, cmd;


-- ----------------------------------------------------------------------------
-- STEP 2 — Make messages delete automatically with their conversation.
-- (Recreates the foreign key with ON DELETE CASCADE. The default constraint
--  name in Supabase is <table>_<column>_fkey.)
-- ----------------------------------------------------------------------------
alter table public.messages
  drop constraint if exists messages_conversation_id_fkey;

alter table public.messages
  add constraint messages_conversation_id_fkey
  foreign key (conversation_id)
  references public.conversations (id)
  on delete cascade;


-- ----------------------------------------------------------------------------
-- STEP 3 — Add the missing DELETE policy on `conversations`.
--
-- RECOMMENDED: copy the exact permission rule from your existing UPDATE policy
-- so DELETE is allowed for exactly the same people who can already block/archive
-- (this automatically includes your super-admin access, however it's written).
-- ----------------------------------------------------------------------------
do $$
declare
  v_qual text;
begin
  select pg_get_expr(p.polqual, p.polrelid)
    into v_qual
  from pg_policy p
  where p.polrelid = 'public.conversations'::regclass
    and p.polcmd = 'w'          -- 'w' = UPDATE
  limit 1;

  if v_qual is null then
    raise exception
      'No UPDATE policy found on public.conversations. Use the explicit policy in STEP 3b instead.';
  end if;

  execute 'drop policy if exists "members delete conversations" on public.conversations';
  execute format(
    'create policy "members delete conversations" on public.conversations '
    || 'for delete to authenticated using (%s)',
    v_qual
  );

  raise notice 'DELETE policy created, mirroring the UPDATE rule: %', v_qual;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 3b — Explicit fallback (use ONLY if STEP 3 raised the exception above).
-- Uncomment and run this instead. It allows any active member of the company,
-- plus platform super-admins, to delete. To make delete admin-only, add
--   and m.role = 'admin'
-- to the membership check.
-- ----------------------------------------------------------------------------
-- drop policy if exists "members delete conversations" on public.conversations;
-- create policy "members delete conversations"
--   on public.conversations
--   for delete
--   to authenticated
--   using (
--     exists (
--       select 1 from public.memberships m
--       where m.company_id = conversations.company_id
--         and m.user_id = auth.uid()
--         and coalesce(m.disabled, false) = false
--     )
--     or auth.uid() in (select public.platform_admin_user_ids())
--   );


-- ----------------------------------------------------------------------------
-- STEP 4 — Verify. You should now see a row with cmd = 'DELETE'.
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'conversations'
order by cmd;
