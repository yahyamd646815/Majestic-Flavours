Read AGENTS.md first and follow it strictly.

Integrate the inventory app state using Zustand with AsyncStorage persistence.

Create the following stores in store/:

store/inventoryStore.ts
- items: InventoryItem array (loaded from sampleInventory.ts initially)
- categories: Category array
- selectedCategory: string or null (for the category filter)
- setSelectedCategory(category): updates the filter
- getLowStockItems(): returns items where currentQuantity is at or below minThreshold

store/userStore.ts
- currentUser: AppUser or null
- setCurrentUser(user): sets the logged-in user
- clearUser(): clears on sign out
- Persist with AsyncStorage

store/reportStore.ts
- reports: Report array
- addReport(report): adds a new report
- updateReport(id, content): updates an existing report only if it is not locked
- getReportsForItem(itemId): returns all reports for a given item
- getReportsForEmployee(employeeId): returns all reports submitted by a given employee

Use the types from types/inventory.ts. Persist inventoryStore and reportStore with AsyncStorage where appropriate.

Preserve the existing UI exactly. Do not add any visible UI changes in this step.

Add a hidden debug button on the home route to clear AsyncStorage for testing purposes.
