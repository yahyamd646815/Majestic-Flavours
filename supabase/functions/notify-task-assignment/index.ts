/**
 * notify-task-assignment — Supabase Edge Function (Deno runtime).
 *
 * Sends one "you've been assigned a task" push notification: given a task id
 * and an employee's Clerk id, it looks up that employee's registered Expo
 * push token and the task's title, and hands them to Expo's push service.
 *
 * Called by the `task_assignments` AFTER INSERT trigger installed in
 * `My prompts/V2_Majestic_Flavors/v2-supabase-patch-round12.sql`, as amended
 * by `v2-supabase-patch-coderabbit-fixes-3.sql`. The policy of *when* to push
 * lives there, not here — in particular, generated recurrence occurrences are
 * filtered out at the trigger, so this function never needs to know that
 * recurrence exists. Keeping that rule in one place is the point; do not
 * mirror it here.
 *
 * Only the trigger may call this. The service-role bearer token the trigger
 * sends proves nothing about *who* is calling — every signed-in member of
 * staff holds a JWT this endpoint would also accept — so the caller must also
 * present the shared secret below. Without it, anyone with an app account
 * could push arbitrary text to any colleague's phone.
 *
 * This file is Deno, not React Native. It is excluded from the app's
 * `tsconfig.json` and from `eslint.config.js` for that reason — `npm run
 * typecheck` and `npm run lint` do not cover it, and cannot.
 *
 * Deploy:  supabase functions deploy notify-task-assignment
 * (or paste this file into Dashboard → Edge Functions → new function).
 *
 * Needs one secret set on the function itself, Dashboard → Edge Functions →
 * Secrets (or `supabase secrets set`), holding the same value as the
 * `task_assignment_push_secret` Vault secret the trigger reads:
 *
 *   TASK_ASSIGNMENT_PUSH_SECRET=<the same long random string>
 *
 * It cannot live in Vault on this side: Edge Functions have no direct read of
 * `vault.decrypted_secrets`, and reaching it through an RPC would mean a
 * database round-trip *before* the caller has been authenticated, which is
 * exactly what this check exists to avoid. The name may not start with
 * `SUPABASE_`, `SB_` or `DENO_` — those prefixes are reserved by the platform.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Set by the trigger's net.http_post call. */
const SHARED_SECRET_HEADER = "x-task-assignment-secret";

type AssignmentPayload = {
  taskId: string;
  employeeClerkId: string;
};

/** The trigger's body, validated rather than trusted. Snake_case on the wire
 * to match the column names it is built from. */
function parsePayload(value: unknown): AssignmentPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const { task_id: taskId, employee_clerk_id: employeeClerkId } = value as Record<
    string,
    unknown
  >;
  if (typeof taskId !== "string" || taskId.length === 0) return null;
  if (typeof employeeClerkId !== "string" || employeeClerkId.length === 0) return null;
  return { taskId, employeeClerkId };
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * One answer for every way the lookup can come up empty: unknown task,
 * unknown employee, or an employee with no device registered. They are
 * deliberately indistinguishable from outside — telling them apart would let
 * a caller use this endpoint to probe which task and employee ids exist. The
 * real reason is written to the function's own logs instead.
 */
const NOTHING_SENT: Record<string, unknown> = { sent: false };

/**
 * Compares two secrets in time that does not depend on how much of them
 * matches. A plain `===` returns as soon as it finds a differing character, so
 * how long it takes leaks how long a shared prefix was — enough, over many
 * attempts, to recover the secret one character at a time.
 *
 * Both sides are hashed first so the loop always runs over 32 bytes, which
 * keeps the length of the guess out of the timing too. Web Crypto is built
 * into Deno; this needs no dependency.
 */
async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const a = new Uint8Array(providedDigest);
  const b = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Before anything else, and before the body is even read: nothing below
  // this point should run for a caller that is not the trigger.
  const expectedSecret = Deno.env.get("TASK_ASSIGNMENT_PUSH_SECRET");
  if (!expectedSecret) {
    // Fail closed. An unconfigured function that accepted every caller would
    // be precisely the hole this check was added to close.
    console.error("[notify-task-assignment] TASK_ASSIGNMENT_PUSH_SECRET is not set.");
    return json({ error: "Function is not configured" }, 500);
  }

  const providedSecret = req.headers.get(SHARED_SECRET_HEADER) ?? "";
  if (!(await secretsMatch(providedSecret, expectedSecret))) {
    console.warn("[notify-task-assignment] Rejected a call without the shared secret.");
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: AssignmentPayload | null = null;
  try {
    payload = parsePayload(await req.json());
  } catch {
    payload = null;
  }
  if (!payload) {
    return json({ error: "Expected a JSON body of { task_id, employee_clerk_id }" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[notify-task-assignment] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
    return json({ error: "Function is not configured" }, 500);
  }

  // Both tables read below are behind RLS written for a signed-in member of
  // staff, and this function runs as nobody — so it needs the service role.
  // The key is injected by the platform into this runtime only; it is not
  // configured anywhere in this repo and never reaches a client.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("title")
    .eq("id", payload.taskId)
    .maybeSingle<{ title: string }>();

  if (taskError) {
    console.error("[notify-task-assignment] Could not read the task:", taskError.message);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!task) {
    // Deleted between the insert and this call. Nothing to announce.
    console.log(`[notify-task-assignment] No such task: ${payload.taskId}`);
    return json(NOTHING_SENT);
  }

  const { data: assignee, error: assigneeError } = await admin
    .from("app_users")
    .select("expo_push_token")
    .eq("clerk_user_id", payload.employeeClerkId)
    .maybeSingle<{ expo_push_token: string | null }>();

  if (assigneeError) {
    console.error("[notify-task-assignment] Could not read the assignee:", assigneeError.message);
    return json({ error: "Lookup failed" }, 500);
  }

  const pushToken = assignee?.expo_push_token ?? null;
  if (!pushToken) {
    // The expected quiet case: never asked, declined, or signed in only on a
    // device that cannot receive push. Not an error, and nothing to retry —
    // the assignment itself already succeeded. Indistinguishable on the wire
    // from an employee id that does not exist at all; the log tells them
    // apart for whoever is debugging.
    console.log(
      assignee
        ? `[notify-task-assignment] No device registered for ${payload.employeeClerkId}.`
        : `[notify-task-assignment] No such employee: ${payload.employeeClerkId}`,
    );
    return json(NOTHING_SENT);
  }

  const message = {
    to: pushToken,
    title: "New task assigned",
    body: task.title,
    sound: "default",
    // Read by the app when someone taps the notification, should that ever
    // be wired up — harmless to include now.
    data: { taskId: payload.taskId },
  };

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(message),
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(
      `[notify-task-assignment] Expo refused the push (${response.status}):`,
      JSON.stringify(result),
    );
    return json({ sent: false, reason: "expo_rejected", status: response.status }, 502);
  }

  // Logged in full on purpose: Expo answers 200 even when the individual
  // ticket carries an error (DeviceNotRegistered, after an uninstall, being
  // the common one). The ticket is the only place that shows up.
  console.log(
    `[notify-task-assignment] Expo accepted the push for task ${payload.taskId}:`,
    JSON.stringify(result),
  );
  return json({ sent: true });
});
