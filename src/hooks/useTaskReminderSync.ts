import { useAuth, useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";

import { useTaskReminderStore } from "@/store/taskReminderStore";
import { useTaskStore } from "@/store/taskStore";

/**
 * Re-derives every scheduled task reminder from the stored preferences, once
 * per signed-in session.
 *
 * The preference in `task_reminders` survives restarts and reinstalls; the
 * OS-level scheduled notification does not, and there is no way to ask
 * whether the one still pending was scheduled against the due date the task
 * currently has. So it is never assumed to exist or to be correct — it is
 * rebuilt from the rows every time the app starts, which also prunes
 * reminders that stopped applying while this device was closed (deleted from
 * another phone, a task somebody else deleted, an assignment taken away).
 *
 * Keyed on Clerk's `sessionId` via a ref, exactly like
 * `useTaskOccurrenceGeneration` and the cleanup hooks: at most one pass per
 * distinct session, however many times the inputs around it change.
 */
export function useTaskReminderSync(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const currentUserClerkId = user?.id;

  const tasks = useTaskStore((state) => state.tasks);
  const isLoadingTasks = useTaskStore((state) => state.isLoading);
  const tasksError = useTaskStore((state) => state.error);
  const isLoadingReminders = useTaskReminderStore((state) => state.isLoading);
  const remindersError = useTaskReminderStore((state) => state.error);
  const reconcile = useTaskReminderStore((state) => state.reconcile);

  const lastRunSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !sessionId || !currentUserClerkId) return;
    // Both halves are needed at once: the reminders say what should fire, the
    // tasks say when. Running against a half-seeded pair would cancel real
    // reminders as "no matching task".
    if (isLoadingTasks || isLoadingReminders) return;
    // And a failed load looks exactly like an empty one from here. Skipping
    // the pass entirely leaves whatever is already scheduled alone, which is
    // the safe direction — a stale reminder is noise, a cancelled one is a
    // silent miss.
    if (tasksError !== null || remindersError !== null) return;
    if (lastRunSessionId.current === sessionId) return;
    lastRunSessionId.current = sessionId;

    void reconcile(tasks, currentUserClerkId, Date.now()).then((scheduled) => {
      console.log(`[useTaskReminderSync] ${scheduled} reminder(s) scheduled for this session.`);
    });
  }, [
    isSignedIn,
    sessionId,
    currentUserClerkId,
    isLoadingTasks,
    isLoadingReminders,
    tasksError,
    remindersError,
    tasks,
    reconcile,
  ]);
}
