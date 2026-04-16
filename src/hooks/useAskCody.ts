import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCodyContext } from "./useCodyContext";

export interface CodyMessage {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface AskCodyResult {
  reply: string;
  conversation_id: string;
  tokens_used?: number;
  model?: string;
}

interface UseAskCodyOptions {
  /** Page key used to scope the persisted conversation_id in localStorage. */
  pageKey: string;
}

const STORAGE_PREFIX = "cody-grow-conversation:";

export function useAskCody({ pageKey }: UseAskCodyOptions) {
  const { context_type, context_id, page_data } = useCodyContext();
  const [messages, setMessages] = useState<CodyMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Restore conversation id on mount / when page changes
  useEffect(() => {
    conversationIdRef.current = localStorage.getItem(STORAGE_PREFIX + pageKey);
    setMessages([]);
  }, [pageKey]);

  const send = useCallback(
    async (userMessage: string) => {
      const trimmed = userMessage.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "", pending: true },
      ]);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Not authenticated");

        const { data, error: invokeError } = await supabase.functions.invoke<AskCodyResult>(
          "ask-cody",
          {
            body: {
              product: "grow",
              context_type,
              context_id,
              page_data,
              user_message: trimmed,
              conversation_id: conversationIdRef.current,
            },
          },
        );

        if (invokeError) throw new Error(invokeError.message);
        if (!data) throw new Error("No response from Cody");

        conversationIdRef.current = data.conversation_id;
        localStorage.setItem(STORAGE_PREFIX + pageKey, data.conversation_id);

        setMessages((prev) => {
          const next = [...prev];
          // Replace the pending placeholder with the real reply
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.pending) {
            next[lastIdx] = { role: "assistant", content: data.reply };
          }
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.pending) {
            next[lastIdx] = {
              role: "assistant",
              content: `Sorry, something went wrong: ${msg}`,
            };
          }
          return next;
        });
      } finally {
        setSending(false);
      }
    },
    [context_type, context_id, page_data, pageKey, sending],
  );

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    localStorage.removeItem(STORAGE_PREFIX + pageKey);
    setMessages([]);
    setError(null);
  }, [pageKey]);

  return { messages, sending, error, send, reset };
}
