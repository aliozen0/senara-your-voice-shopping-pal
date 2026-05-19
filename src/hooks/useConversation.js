import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../config/index.js";

export function useConversation() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.conversation);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.conversation, JSON.stringify(messages));
    } catch { /* noop */ }
  }, [messages]);

  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text, timestamp: Date.now() }]);
  }, []);

  const clearHistory = useCallback(() => setMessages([]), []);

  return { messages, addMessage, clearHistory };
}
