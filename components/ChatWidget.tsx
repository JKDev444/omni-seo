"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { sendChatMessage } from "@/lib/actions/chatActions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  function handleSend() {
    const question = input.trim();
    if (!question || isPending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");

    startTransition(async () => {
      const reply = await sendChatMessage(nextMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    });
  }

  return (
    <>
      <button className="chat-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close assistant" : "Open assistant"}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <strong>Ask Omni SEO</strong>
            <span className="chat-panel-subtitle">Grounded in your real audit data</span>
          </div>

          <div className="chat-panel-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="chat-empty-hint">
                Try: &quot;What should I work on today?&quot; or &quot;How many critical issues do I have?&quot;
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-message chat-message-${m.role}`}>
                {m.content}
              </div>
            ))}
            {isPending && <div className="chat-message chat-message-assistant chat-message-pending">Thinking…</div>}
          </div>

          <div className="chat-panel-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question…"
              rows={1}
              disabled={isPending}
            />
            <button onClick={handleSend} disabled={isPending || !input.trim()} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
