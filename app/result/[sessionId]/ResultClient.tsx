"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = { role: string; content: string };
type Diagnosis = { id: string; sentence: string };
type Outcome = { action_text: string } | null;

export default function ResultClient({
  sessionId,
  diagnosis,
  outcome: initialOutcome,
  messages,
}: {
  sessionId: string;
  diagnosis: Diagnosis;
  outcome: Outcome;
  messages: Message[];
}) {
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [actionText, setActionText] = useState(initialOutcome?.action_text ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [startingFollowUp, setStartingFollowUp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmitOutcome() {
    const text = actionText.trim();
    if (!text || submitting) return;
    setSubmitting(true);

    const { error } = await supabase.from("outcomes").insert({
      diagnosis_id: diagnosis.id,
      action_text: text,
    });

    if (!error) setOutcome({ action_text: text });
    setSubmitting(false);
  }

  async function handleFollowUp() {
    setStartingFollowUp(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: newSession, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, parent_session_id: sessionId })
      .select()
      .single();

    if (error || !newSession) {
      setStartingFollowUp(false);
      return;
    }

    router.push(`/chat/${newSession.id}`);
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 sm:py-10 space-y-8">
      <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">
        ← Dashboard
      </Link>

      <div className="space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Your bottleneck</p>
        <p className="text-xl sm:text-2xl font-semibold text-gray-100 leading-snug">
          {diagnosis.sentence}
        </p>
      </div>

      <div className="border-t border-gray-800 pt-6 space-y-3">
        {outcome ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">What you committed to</p>
              <p className="text-gray-300 text-sm">{outcome.action_text}</p>
            </div>
            <button
              onClick={handleFollowUp}
              disabled={startingFollowUp}
              className="text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
            >
              {startingFollowUp ? "Starting…" : "Start follow-up session"}
            </button>
          </div>
        ) : (
          <>
            <label className="block text-sm text-gray-300">
              What will you actually do in the next 24 hours because of this?
            </label>
            <textarea
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 text-sm resize-none"
              placeholder="Be specific. One concrete action."
            />
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSubmitOutcome}
                disabled={submitting || !actionText.trim()}
                className="bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-40 text-sm"
              >
                {submitting ? "Saving…" : "Submit"}
              </button>
              <button
                onClick={handleFollowUp}
                disabled={startingFollowUp}
                className="text-sm bg-gray-800 border border-gray-700 text-gray-400 rounded px-4 py-2 hover:bg-gray-700 disabled:opacity-50"
              >
                {startingFollowUp ? "Starting…" : "Skip & start follow-up"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <button
          onClick={() => setShowTranscript((s) => !s)}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          {showTranscript ? "Hide transcript" : "Show full transcript"}
        </button>

        {showTranscript && (
          <div className="mt-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gray-700 text-gray-100"
                      : "bg-gray-900 text-gray-200 border border-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
