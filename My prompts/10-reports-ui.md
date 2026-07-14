Read AGENTS.md first and follow it strictly.

Implement the Reports screen. This screen is accessible to all roles but behaves differently per role.

For Employees:
- Show only the items they are personally assigned to (match by employeeId in assignedEmployeeIds)
- For each assigned item, show a text input to submit or edit their daily report
- Reports are editable until midnight of the day they were submitted. After midnight, show the report as read-only with a locked icon.
- A Submit button saves the report via reportStore

For Admins and Managers:
- Show a filter bar at the top with three filter options: by Date, by Employee name, and by Category
- Show all submitted reports in a scrollable list. Each report card shows the date, employee name, item name, category, and report content.
- Show two export buttons at the top right: Export PDF and Export XLSX. These should show a "Coming soon" toast for now — the actual export logic will be added later.
- Locked reports should show a lock icon.

If no reports exist for the current filters, show a friendly empty state.

Use data from reportStore and userStore. Do not change the tab navigation or any other screen.
