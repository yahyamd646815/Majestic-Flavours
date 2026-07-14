Read AGENTS.md first and follow it strictly.

Implement the Inventory screen UI exactly as described. This screen is accessible to Admins and Managers.

At the top, show a horizontal scrollable row of category filter chips: All, Dairy, Meat, Vegetables, Dry Goods, Beverages, Cleaning Supplies. The selected category chip should be highlighted with the primary green color. Tapping a chip filters the list below using selectedCategory from inventoryStore.

Below the filters, show a scrollable list of inventory item cards. Each card displays:
- Item name and category
- Current quantity and unit (e.g. "12 kg")
- A stock status badge: green for healthy, amber for low stock, red for out of stock
- The names of the 2 to 3 assigned employees shown as small avatar-style name chips

For Admins only, show an Edit button and a Delete button on each card. The Delete button must trigger the two-step DELETE confirmation flow as defined in AGENTS.md. Do not skip or simplify this.

At the bottom right, show a floating action button with a plus icon. For Admins, tapping it opens an Add Item form. For Managers, tapping it also opens an Add Item form but without the delete controls on existing cards.

If no items match the selected category filter, show a friendly empty state.

Use data from inventoryStore. Do not change the tab navigation or any other screen.
