-- ============================================================
-- Majestic Flavours — patch (round 8)
-- Adds manual stock-status override ("ping") support.
-- Run before starting prompt 17c.
-- ============================================================

begin;

-- The live, current override on each item. NULL means "purely quantity-
-- derived, same as today." Non-null wins over quantity everywhere status is
-- displayed, until either quantity changes or a different status is pinged.
alter table inventory_items
  add column status_override text
  check (status_override is null or status_override in ('out_of_stock', 'low_stock', 'in_stock'));

-- What was actually pinged as part of a specific day's report entry, for
-- history/export. Deliberately a single value, not a timestamped array like
-- quantity snapshots — unlike quantity, there's no operationally useful
-- "status at 9am vs 2pm" history to preserve, only the current value matters.
alter table report_item_entries
  add column status_ping text
  check (status_ping is null or status_ping in ('out_of_stock', 'low_stock', 'in_stock'));

commit;

-- ------------------------------------------------------------
-- Not expected to need new RLS policies: both tables already have row-level
-- policies covering UPDATE/INSERT (items: admin/manager write; report
-- entries: the reporter's own row) with no column-level restrictions
-- anywhere in this schema. Worth a quick confirmation after running this —
-- try a ping from the app and confirm it writes — rather than assuming.
-- ------------------------------------------------------------
