"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLandingEvents } from "./landing-analytics";

// The landing assistant — a floating helper on the marketing pages. It is
// labeled as an automated assistant (honesty rules: nothing pretends to be
// a human), answers from /api/assistant, and always has a working path
// forward: quick-reply chips, free text, and the free-scan CTA. On mobile
// the launcher sits above the sticky CTA bar; the panel is a bottom sheet.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi — I'm SubZero's automated assistant. Ask me anything about the scan, privacy, pricing, or cancelling subscriptions.",
};

const CHIPS = [
  "How does it work?",
  "Is my email safe?",
  "What does it cost?",
  "How does cancelling work?",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const { trackOnce, track } = useLandingEvents();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    track("assistant_message");
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The greeting is UI, not conversation — the server only needs the
        // exchange itself, capped to the last 10 turns.
        body: JSON.stringify({ messages: next.slice(1).slice(-10) }),
      });
      const data = (await response.json().catch(() => null)) as { reply?: string } | null;
      const reply =
        data?.reply ??
        "Something went wrong on our side — not yours. Try again in a moment, or email support@subzero.o2c.one.";
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I couldn't reach the server — that's on us. Try again in a moment, or email support@subzero.o2c.one.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const showChips = messages.length === 1;

  return (
    <>
      {/* Launcher. bottom-24 on mobile clears the sticky CTA bar. */}
      <button
        onClick={() => {
          setOpen((value) => !value);
          if (!open) trackOnce("assistant_opened");
        }}
        aria-expanded={open}
        aria-label={open ? "Close the SubZero assistant" : "Chat with the SubZero assistant"}
        className="fixed bottom-24 right-4 z-30 flex size-14 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 lg:bottom-6 lg:right-6"
        style={{
          background: "var(--lp-primary)",
          color: "#04111f",
          boxShadow: "var(--lp-shadow-card)",
          outlineColor: "var(--lp-primary-bright)",
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 018.5-8.5 8.38 8.38 0 018.5 8.5z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        role="dialog"
        aria-label="SubZero assistant"
        aria-hidden={!open}
        inert={!open}
        className="fixed inset-x-3 bottom-[168px] z-30 flex max-h-[62vh] flex-col overflow-hidden transition-all duration-200 sm:inset-x-auto sm:right-6 sm:w-[380px] lg:bottom-24 lg:max-h-[560px]"
        style={{
          borderRadius: "var(--lp-radius-card)",
          background: "var(--lp-surface)",
          border: "1px solid var(--lp-hairline)",
          boxShadow: "var(--lp-shadow-card)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(12px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--lp-hairline)" }}>
          <span
            className="flex size-9 items-center justify-center rounded-full"
            style={{ background: "rgba(46,158,255,0.14)" }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-primary-bright)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M4 5l16 14M20 5L4 19" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold" style={{ color: "var(--lp-text)" }}>
              SubZero Assistant
            </div>
            <div className="text-[11px]" style={{ color: "var(--lp-text-muted)" }}>
              Automated assistant — answers about SubZero only
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
          <div className="flex flex-col gap-2.5">
            {messages.map((message, index) => (
              <div
                key={index}
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                style={
                  message.role === "user"
                    ? {
                        alignSelf: "flex-end",
                        background: "var(--lp-primary)",
                        color: "#04111f",
                        borderBottomRightRadius: 6,
                      }
                    : {
                        alignSelf: "flex-start",
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--lp-text)",
                        borderBottomLeftRadius: 6,
                      }
                }
              >
                {message.content}
              </div>
            ))}
            {pending && (
              <div
                className="self-start rounded-2xl px-3.5 py-2.5 text-sm"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--lp-text-muted)", borderBottomLeftRadius: 6 }}
              >
                <span className="inline-flex gap-1" aria-label="The assistant is typing">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
                </span>
              </div>
            )}
            {showChips && (
              <div className="mt-1 flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => void send(chip)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      border: "1px solid rgba(104,196,255,0.4)",
                      color: "var(--lp-primary-bright)",
                      outlineColor: "var(--lp-primary-bright)",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 px-3 py-3"
          style={{ borderTop: "1px solid var(--lp-hairline)" }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={500}
            placeholder="Ask about SubZero…"
            aria-label="Message the SubZero assistant"
            className="min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm focus-visible:outline-2"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--lp-hairline)",
              color: "var(--lp-text)",
              outlineColor: "var(--lp-primary-bright)",
            }}
          />
          <button
            type="submit"
            disabled={pending || input.trim().length === 0}
            aria-label="Send"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--lp-primary)", color: "#04111f", outlineColor: "var(--lp-primary-bright)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>

        <div className="px-3 pb-3">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              border: "1px solid rgba(104,196,255,0.4)",
              color: "var(--lp-primary-bright)",
              outlineColor: "var(--lp-primary-bright)",
            }}
          >
            Start the free scan →
          </Link>
        </div>
      </div>
    </>
  );
}
