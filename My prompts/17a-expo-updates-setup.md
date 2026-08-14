Read AGENTS.md first and follow it strictly.

## Context

This is being set up now, pulled forward from the v2 backlog — triggered by a real incident: `sampleUsers.ts` changes (new employee roster entries) don't reach the `preview` build until a full rebuild + reinstall, since `preview` builds bake the JS bundle in at build time. `expo-updates` lets JS-only changes (roster edits, most bug fixes, most feature work) reach staff devices without a new APK. **Anything that adds or changes a native module still needs a full rebuild regardless — this doesn't remove that requirement, it only removes it for the JS-only case, which is most day-to-day changes.**

Confirmed from the installed package's own source before writing this: `expo-updates` ships real native code (Android/iOS, not JS-only) and its own config plugin — so this setup requires one more native rebuild of both `development` and `preview`, same as every other native package added so far. After that one rebuild, day-to-day roster/JS changes stop needing rebuilds at all.

## Division of labor

Same split as every EAS-related task so far: **you (Yahya) run the terminal/EAS CLI commands**, Claude Code writes the actual in-app code and reviews what the commands changed.

### 1. You run, in order:

```
npx expo install expo-updates
eas update:configure
```

The first installs the package. The second is the official EAS command that writes the correct `updates` config (URL, runtime version policy) into your app config and sets up channel mappings — let it generate these values rather than hand-typing them, since they're specific to your actual linked EAS project and guessing them wrong would silently break update delivery.

### 2. Claude Code: verify and complete the config

`eas update:configure` may or may not fully handle everything depending on the installed CLI version — verify each of these rather than assume, using the same care as the `expo-file-system` plugin gap from before:

- **`app.config.js` plugins array** — confirm `"expo-updates"` is present. If `eas update:configure` didn't add it, add it manually.
- **`eas.json` channels** — each build profile should map to its own update channel, so a `preview` build only ever receives updates published to the `preview` channel, never accidentally receiving something meant for `production` or `development`:
  ```json
  "development": { "channel": "development", ... },
  "preview": { "channel": "preview", ... },
  "production": { "channel": "production", ... }
  ```
  (merge into the existing keys already there — `developmentClient`, `distribution`, `env`, `autoIncrement` — don't replace them)

### 3. Claude Code: add a manual "Check for Updates" control in Settings

Default behavior only checks for updates on a cold app launch. For a 24-hour restaurant where staff phones may stay open across an entire shift without restarting, that's not enough — this is a genuine functional requirement given how this app is actually used, not a nice-to-have. Add this to the Settings screen, Admin and Manager only (matches who'd actually think to use it):

```tsx
import * as Updates from "expo-updates";

function CheckForUpdatesRow() {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isUpdatePending) {
      void Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  async function handleCheck() {
    setIsChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        // reloadAsync() fires automatically above once isUpdatePending flips true
      } else {
        Alert.alert("Up to date", "You already have the latest version.");
      }
    } catch {
      Alert.alert("Couldn't check for updates", "Check your connection and try again.");
    } finally {
      setIsChecking(false);
    }
  }

  // render a row/button calling handleCheck(), disabled while isChecking,
  // styled to match the rest of the Settings screen
}
```

This exact pattern (`useUpdates()` + `checkForUpdateAsync()` + `fetchUpdateAsync()` + `reloadAsync()` once `isUpdatePending` flips) is taken directly from `expo-updates`' own shipped documentation example, not invented — verified against the installed package's actual type definitions before writing this.

## Constraints

- Don't touch anything about how `useSupabaseSync`, `useReportCleanup`, or `useAnalyticsIdentify` work — this is unrelated to those.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing.

## After Claude Code finishes: one more rebuild, then the new workflow

```
eas build --profile development --platform android
eas build --profile preview --platform android
```

Both are needed since this added new native code, same as `expo-print`/`expo-application`/`expo-device` before. Install both.

**From that point on, for JS-only changes** (roster edits, most bug fixes) — publish instead of rebuilding:
```
eas update --branch preview --message "Add Ismail and Wasit to roster"
```
Staff devices pick it up automatically next launch, or immediately if they tap "Check for Updates" while the app's already open. Reserve full `eas build` for whenever a change actually touches native dependencies again.
