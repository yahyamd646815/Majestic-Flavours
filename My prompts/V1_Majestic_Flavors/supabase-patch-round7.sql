-- ============================================================
-- Majestic Flavours — patch (round 7)
-- Required for prompt 15 (report auto-delete) to work at all.
-- Run before testing 15.
-- ============================================================

-- No table currently has any DELETE policy on reports/report_item_entries/
-- report_item_snapshots. A DELETE on `reports` cascades to its children via
-- the FK, but a cascade delete still has to satisfy RLS on the child table
-- for each row it touches — without these, the cascade gets blocked and the
-- parent delete fails outright, even though nothing in this schema visibly
-- says "no deletes allowed" anywhere obvious.
--
-- Scoped two ways at once: only an admin, and only for reports already past
-- the 4-month retention window — this can never be used to delete anything
-- else, regardless of who calls it.

create policy "reports_delete_old" on reports for delete
  using (
    current_user_role() = 'admin'
    and date < (current_riyadh_date() - interval '4 months')::date
  );

create policy "report_item_entries_delete_old" on report_item_entries for delete
  using (
    current_user_role() = 'admin'
    and exists (
      select 1 from reports r
      where r.id = report_id
        and r.date < (current_riyadh_date() - interval '4 months')::date
    )
  );

create policy "report_item_snapshots_delete_old" on report_item_snapshots for delete
  using (
    current_user_role() = 'admin'
    and exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and r.date < (current_riyadh_date() - interval '4 months')::date
    )
  );
