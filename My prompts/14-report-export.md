Read AGENTS.md first and follow it strictly.

Implement the PDF and XLSX report export functionality on the Reports screen for Admins and Managers.

The Export PDF button should generate a PDF containing all currently filtered reports. Each report entry in the PDF should show: date, employee name, item name, category, and report content. Add a header with the restaurant name, the export date, and the active filters applied.

The Export XLSX button should generate an Excel file with the same data laid out in columns: Date, Employee Name, Item Name, Category, Report Content. The first row should be a bold header row.

Both exports should work on mobile and trigger a native share sheet so the user can save or send the file.

Use react-native-share or expo-sharing with expo-file-system to handle the file and share flow. Ask before installing any new library. Do not change any existing UI outside the export buttons.
