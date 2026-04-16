import { createContext, useContext } from "react";

export interface CodyContext {
  context_type: string | null;
  context_id: string | null;
  page_data: unknown;
  setContext: (next: {
    context_type: string | null;
    context_id?: string | null;
    page_data?: unknown;
  }) => void;
  clearContext: () => void;
}

export const CodyContextContext = createContext<CodyContext | null>(null);

/** Read the current Cody context from any component. */
export function useCodyContext(): CodyContext {
  const ctx = useContext(CodyContextContext);
  if (!ctx) {
    return {
      context_type: null,
      context_id: null,
      page_data: null,
      setContext: () => {},
      clearContext: () => {},
    };
  }
  return ctx;
}
