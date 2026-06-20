"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [userTurns, setUserTurns] = useState(
    initialMessages.filter((m) => m.role === "user").length
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Issue 1 fix: prevent double-fire from React StrictMode in dev
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initialMessages.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      sendMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(userText: string | null) {
    setLoading(true);

    if (userText) {
      setMessages((prev) => [...prev, { role: "user", content: userText }]);
      setInput("");
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userMessage: userText }),
      });

      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      }

      if (data.isDiagnostic) {
        setLocked(true);
        setTimeout(() => router.push(`/result/${sessionId}`), 1800);
        return;
      }

      if (typeof data.userTurns === "number") {
        setUserTurns(data.userTurns);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || loading || locked) return;
    sendMessage(text);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">
          ← Dashboard
        </Link>
        <span className="text-xs text-gray-600">
          {locked
            ? "Generating diagnosis…"
            : userTurns > 0
            ? `Turn ${userTurns}`
            : ""}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gray-700 text-gray-100"
                  : "bg-gray-900 text-gray-200 border border-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-lg text-sm text-gray-500 italic">
              thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={locked || loading}
          placeholder={locked ? "Session complete" : "Type your reply…"}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 disabled:opacity-40"
        />
        <button
          onClick={handleSubmit}
          disabled={locked || loading || !input.trim()}
          className="bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-40 text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}
