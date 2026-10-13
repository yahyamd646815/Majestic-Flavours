import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { colors } from "@/constants/theme";
import { isTaskReminderIdentifier, type ReminderSchedule } from "@/lib/taskReminders";

/** Local notifications are a native capability — there is nothing to schedule
 * on the web build, and calling into the module there throws rather than
 * no-opping. Every function below returns its "nothing happened" value
 * instead. */
const isSupported = Platform.OS !== "web";

/** Android requires a channel before anything can be posted to it. One
 * channel for the whole feature: every reminder is the same kind of thing,
 * and staff can mute them as a group from system settings. */
const ANDROID_CHANNEL_ID = "task-reminders";

/**
 * Without a handler, a notification that fires while the app is in the
 * foreground is delivered to JS but never shown — which is exactly the case
 * someone checks first ("set a reminder a few minutes out, leave the app
 * open"). Set once at module scope, as Expo requires: it has to be in place
 * before any notification can arrive, not on a component's first render.
 */
if (isSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Created at most once per app run — `setNotificationChannelAsync` is
 * idempotent, but there is no reason to re-await it before every schedule. */
let channelPromise: Promise<void> | null = null;

function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  channelPromise ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Task Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.gold,
  })
    .then(() => undefined)
    .catch((error: unknown) => {
      // Cleared so a later schedule retries rather than reusing a promise
      // that resolved to a channel which was never actually created.
      channelPromise = null;
      console.warn("[notifications] Could not create the reminder channel:", error);
    });
  return channelPromise;
}

/** Whether notifications are already allowed, without prompting. Used by
 * session-start reconciliation, which must never put a permission dialog in
 * front of someone who simply opened the app. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  } catch (error) {
    console.warn("[notifications] Could not read the notification permission:", error);
    return false;
  }
}

/**
 * How a permission request actually ended.
 *
 * A plain `false` cannot tell "they said no" apart from "the OS will not ask
 * again" apart from "this is the web build" — and those need completely
 * different things from the person. Push registration logs which one it hit,
 * because a null token with no explanation is exactly what made this
 * undiagnosable the first time round.
 */
export type PermissionOutcome = "granted" | "denied" | "blocked" | "unsupported" | "error";

async function resolveNotificationPermission(): Promise<PermissionOutcome> {
  if (!isSupported) return "unsupported";
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    // Already refused in a way the OS will not re-prompt for: Android stops
    // showing the dialog after a refusal, so a later call silently returns
    // the same "not granted" it did the first time.
    if (!current.canAskAgain) return "blocked";
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.granted) return "granted";
    return requested.canAskAgain ? "denied" : "blocked";
  } catch (error) {
    console.warn("[notifications] Could not request the notification permission:", error);
    return "error";
  }
}

/**
 * Allowed already, or allowed after asking. Requested lazily — the first time
 * somebody actually sets a reminder — so the prompt arrives with a reason
 * attached instead of on sign-in, and staff who never use reminders are never
 * asked at all.
 *
 * `false` covers a refusal and a permission that can no longer be asked for
 * (it has to be re-enabled in system settings). The reminder preference is
 * still saved either way; it starts firing on the first session after the
 * permission is granted, with no re-setting needed.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  return (await resolveNotificationPermission()) === "granted";
}

/** The EAS project this build belongs to, read from the embedded config
 * (`app.config.js` → `extra.eas.projectId`). `getExpoPushTokenAsync` can
 * often infer it, but not dependably outside Expo Go, so it is passed
 * explicitly whenever it is there to pass.
 *
 * Read through `unknown` on purpose: `expoConfig.extra` is typed as an `any`
 * index signature, and narrowing it here keeps that `any` from leaking. */
function readEasProjectId(): string | null {
  const eas: unknown = Constants.expoConfig?.extra?.eas;
  if (typeof eas !== "object" || eas === null) return null;
  const projectId = (eas as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : null;
}

/** An error's own `code`, where it has one — `expo-notifications` rejects with
 * coded errors (`E_REGISTRATION_FAILED` and friends) whose code is the part
 * worth reading in a build log. Read through `unknown` to keep `any` out. */
function describeTokenError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code: unknown = (error as { code?: unknown }).code;
  return typeof code === "string" ? `${code}: ${error.message}` : error.message;
}

/**
 * The outcome of asking this device for a push token — the token itself, or
 * which of the several ordinary "no push here" cases it ran into.
 *
 * Deliberately not `string | null`: every one of these ends the same way for
 * the person (no push), but they mean entirely different things to whoever is
 * debugging it. A missing `google-services.json` (Android push runs over FCM,
 * so without it `getExpoPushTokenAsync` throws before it reaches Expo's
 * servers at all) looks identical to a refused permission if both collapse to
 * null — and that is precisely the confusion this feature shipped with.
 */
export type PushTokenResult =
  | { status: "ok"; token: string }
  | { status: "unsupported" }
  | { status: "no-permission"; permission: PermissionOutcome }
  | { status: "failed"; reason: string };

/**
 * This device's Expo push token, or why there isn't one.
 *
 * Unlike the local reminders above, the permission is requested at sign-in
 * rather than lazily: being told somebody handed you a task matters to every
 * member of staff, and the moment worth attaching the ask to — the assigning
 * — happens on somebody else's device entirely. The permission check
 * short-circuits when it has already been granted, so asking here as well as
 * there costs nothing.
 */
export async function getExpoPushToken(): Promise<PushTokenResult> {
  if (!isSupported) return { status: "unsupported" };

  const permission = await resolveNotificationPermission();
  if (permission !== "granted") return { status: "no-permission", permission };

  // Outside Expo Go this cannot be inferred dependably, and without it the
  // call cannot succeed — so treat its absence as the failure it is rather
  // than passing `undefined` and getting a vaguer error one step later.
  const projectId = readEasProjectId();
  if (!projectId) {
    return {
      status: "failed",
      reason: "No EAS projectId in the embedded config (app.config.js → extra.eas.projectId).",
    };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: "ok", token: data };
  } catch (error) {
    return { status: "failed", reason: describeTokenError(error) };
  }
}

/** Cancelling an identifier that is not scheduled is a no-op, which is what
 * makes it safe to call unconditionally on every delete and reschedule. */
export async function cancelReminderNotification(identifier: string): Promise<void> {
  if (!isSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.warn(`[notifications] Could not cancel ${identifier}:`, error);
  }
}

/**
 * Schedules one reminder under its deterministic identifier, replacing
 * whatever was scheduled under it before.
 *
 * The explicit cancel first is not redundant: it makes "replaces, never
 * duplicates" true by construction rather than by trusting each platform's
 * own same-identifier behaviour, which is the difference between one
 * notification and two after a few app restarts.
 */
export async function scheduleReminderNotification(
  schedule: ReminderSchedule,
): Promise<boolean> {
  if (!isSupported) return false;
  await ensureAndroidChannel();
  await cancelReminderNotification(schedule.identifier);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: schedule.identifier,
      content: { title: schedule.title, body: schedule.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(schedule.triggerMs),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    return true;
  } catch (error) {
    console.warn(`[notifications] Could not schedule ${schedule.identifier}:`, error);
    return false;
  }
}

/**
 * Cancels every still-pending reminder notification whose identifier is not
 * in `keep` — the pruning half of reconciliation.
 *
 * This is what removes reminders that stopped applying while this device was
 * closed: one deleted from another phone, a task somebody else deleted, an
 * assignment taken away. Only identifiers this feature owns are touched.
 */
export async function cancelStaleReminderNotifications(keep: Set<string>): Promise<number> {
  if (!isSupported) return 0;

  let scheduled: Notifications.NotificationRequest[];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn("[notifications] Could not read scheduled notifications:", error);
    return 0;
  }

  const stale = scheduled.filter(
    (request) => isTaskReminderIdentifier(request.identifier) && !keep.has(request.identifier),
  );
  for (const request of stale) {
    await cancelReminderNotification(request.identifier);
  }
  return stale.length;
}
