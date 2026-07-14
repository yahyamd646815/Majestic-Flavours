Read AGENTS.md first and follow it strictly.

Implement the Settings screen. This screen is visible to Admins only.

Organize it into three clearly labeled sections:

1. Units
   - Show the current list of unit options from units.ts (kg, lbs, liters, count, etc.)
   - Allow the Admin to add a new custom unit via a text input and Add button
   - Allow the Admin to delete a unit with a single confirmation popup (no double confirmation needed here since units are not destructive data)

2. Categories
   - Show the current list of item categories from categories.ts
   - Allow the Admin to add a new custom category via a text input and Add button
   - Allow the Admin to delete a category. If any inventory items still use that category, show a warning: "Some items are still assigned to this category. Remove them first."

3. Report Retention
   - Show a read-only info card explaining: "Daily reports are automatically deleted after 4 months."
   - No toggle or edit needed here for now.

Save any changes to Zustand stores. Do not change the tab navigation or any other screen.
