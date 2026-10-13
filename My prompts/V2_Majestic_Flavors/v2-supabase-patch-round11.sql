-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round11
-- Push token storage for v2-03-e2 (remote push). One token per user —
-- the most recent device to register wins, matching how staff are
-- expected to use one device each; a person switching devices simply
-- re-registers on next sign-in.
-- ============================================================

alter table app_users add column expo_push_token text;
