Read AGENTS.md first and follow it strictly.

Implement the Dashboard screen UI. This is the first screen Admins and Managers see after signing in.

The Dashboard should show:

1. A header with a greeting using the logged-in user's name from userStore and the current date.

2. A summary row with three stat cards:
   - Total Items (count of all inventory items)
   - Low Stock (count of items at or below their minThreshold, shown in amber)
   - Out of Stock (count of items with currentQuantity of 0, shown in red)

3. A Low Stock Alerts section below the stat cards. Show a card for each low-stock item displaying:
   - Item name and category
   - Current quantity and unit
   - A colored stock badge (amber for low, red for out of stock)
   - The names of the 2 to 3 assigned employees

4. If there are no low-stock alerts, show a friendly empty state: a checkmark icon and the text "All items are well stocked."

Use data from inventoryStore. Use the design tokens from global.css. Keep the layout clean, card-based, and easy to scan quickly on a phone.

Do not change the tab navigation or any other screen.
