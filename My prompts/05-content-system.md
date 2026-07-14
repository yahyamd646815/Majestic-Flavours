Read AGENTS.md first and follow it strictly.

Create the inventory content system using hardcoded TypeScript data as the starting foundation before Supabase is connected.

Add the following files:

types/inventory.ts — Define types for:
- InventoryItem: id, name, category, currentQuantity, unit, minThreshold, assignedEmployeeIds (array of 2-3 strings), createdAt
- Category: id, name (e.g. Dairy, Meat, Vegetables, Dry Goods, Beverages, Cleaning)
- Unit: id, label (e.g. kg, lbs, liters, count, bags, boxes, bottles)
- Report: id, itemId, employeeId, content, date, isLocked
- UserRole: 'Admin' | 'Manager' | 'Employee'
- AppUser: id, name, email, role

data/categories.ts — Hardcode the default restaurant categories: Dairy, Meat, Vegetables, Dry Goods, Beverages, Cleaning Supplies.

data/units.ts — Hardcode the default unit options: kg, lbs, liters, count, bags, boxes, bottles, crates.

data/sampleInventory.ts — Create 10 to 12 sample inventory items spread across the categories. Each item must have realistic restaurant values for name, category, currentQuantity, unit, and minThreshold. Assign 2 sample employee IDs to each item.

data/sampleUsers.ts — Create 5 to 6 sample users: 1 Admin, 2 Managers, and 3 Employees. Include realistic names, emails, and roles.

Keep everything strictly typed, simple, and easy to extend later when Supabase is connected.
