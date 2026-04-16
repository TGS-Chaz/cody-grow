import { useState, useCallback, ReactNode } from "react";
import { CodyContextContext } from "@/hooks/useCodyContext";

export default function CodyContextProvider({ children }: { children: ReactNode }) {
  const [context_type, setType] = useState<string | null>(null);
  const [context_id, setId] = useState<string | null>(null);
  const [page_data, setPageData] = useState<unknown>(null);

  const setContext = useCallback(
    (next: { context_type: string | null; context_id?: string | null; page_data?: unknown }) => {
      setType(next.context_type);
      setId(next.context_id ?? null);
      setPageData(next.page_data ?? null);
    },
    [],
  );

  const clearContext = useCallback(() => {
    setType(null);
    setId(null);
    setPageData(null);
  }, []);

  return (
    <CodyContextContext.Provider value={{ context_type, context_id, page_data, setContext, clearContext }}>
      {children}
    </CodyContextContext.Provider>
  );
}
