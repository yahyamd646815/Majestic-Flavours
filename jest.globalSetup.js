// Snapshot timestamps are rendered with `toLocaleTimeString`, which reads the
// process timezone, so tests would otherwise assert different clock times on
// different machines. The app is Riyadh-only (see `getTodayIsoDate` in
// src/lib/reports.ts), so the test run pins that same timezone.
//
// This has to be `globalSetup` rather than `setupFiles`: Jest's test
// environment hands tests a *copy* of `process`, so assigning `process.env.TZ`
// there never reaches Node's real environment and the timezone does not change.
module.exports = async () => {
  process.env.TZ = "Asia/Riyadh";
};
