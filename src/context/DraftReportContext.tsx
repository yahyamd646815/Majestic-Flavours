import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DraftReportContextValue = {
  draftQuantities: Record<string, number>; // itemId -> draft quantity
  draftNotes: Record<string, string>; // itemId -> draft note
  hasUnsavedChanges: boolean;
  setDraftQuantity: (itemId: string, quantity: number) => void;
  setDraftNote: (itemId: string, note: string) => void;
  clearDrafts: () => void;
};

const DraftReportContext = createContext<DraftReportContextValue | undefined>(undefined);

/**
 * Quantity and note edits made while filling out a report, before it is
 * submitted. Nothing here reaches `inventoryStore` or `reportStore` until the
 * Report button is pressed (AGENTS.md → Report Rules).
 *
 * Session-only on purpose — no AsyncStorage. Losing unsubmitted drafts on a
 * crash or restart is an accepted trade-off now that nothing is written to
 * shared inventory until submit time.
 *
 * Lives above the tabs because two screens need it: Reports writes drafts,
 * Settings reads them to decide whether to warn before signing out.
 */
export function DraftReportProvider({ children }: { children: ReactNode }) {
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const setDraftQuantity = useCallback((itemId: string, quantity: number) => {
    setDraftQuantities((current) => ({ ...current, [itemId]: quantity }));
  }, []);

  const setDraftNote = useCallback((itemId: string, note: string) => {
    setDraftNotes((current) => ({ ...current, [itemId]: note }));
  }, []);

  const clearDrafts = useCallback(() => {
    setDraftQuantities({});
    setDraftNotes({});
  }, []);

  const value = useMemo<DraftReportContextValue>(
    () => ({
      draftQuantities,
      draftNotes,
      // Deliberately not netted out against the original values: this only
      // answers "has anything been touched since the last submit or clear".
      // Whether a change is real is worked out at submit time.
      hasUnsavedChanges:
        Object.keys(draftQuantities).length > 0 || Object.keys(draftNotes).length > 0,
      setDraftQuantity,
      setDraftNote,
      clearDrafts,
    }),
    [draftQuantities, draftNotes, setDraftQuantity, setDraftNote, clearDrafts],
  );

  return <DraftReportContext.Provider value={value}>{children}</DraftReportContext.Provider>;
}

export function useDraftReport(): DraftReportContextValue {
  const context = useContext(DraftReportContext);
  if (!context) {
    throw new Error("useDraftReport must be used inside a DraftReportProvider");
  }
  return context;
}
