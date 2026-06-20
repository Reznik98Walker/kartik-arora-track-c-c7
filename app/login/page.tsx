"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Mode = "auth" | "forgot" | "forgot-sent";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("auth");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Email confirmation is disabled — signed in immediately
      router.push("/dashboard");
      router.refresh();
    } else {
      // Email confirmation is enabled — guide them to sign in
      setInfo("Account created! Sign in below (check email if login fails).");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address above first.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMode("forgot-sent");
    }
  }

  if (mode === "forgot" || mode === "forgot-sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Reset password</h1>
            <p className="text-sm text-gray-400 mt-1">
              {mode === "forgot-sent"
                ? "Check your inbox for a reset link."
                : "We'll email you a reset link."}
            </p>
          </div>

          {mode === "forgot" && (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
              />
              {error && <p className="text-sm text-amber-400">{error}</p>}
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}

          <button
            onClick={() => { setMode("auth"); setError(null); }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">AI Bottleneck Diagnostic</h1>
          <p className="text-sm text-gray-400 mt-1">
            A short AI interview that names the real wall between you and progress.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
        </div>

        {error && <p className="text-sm text-amber-400">{error}</p>}
        {info && <p className="text-sm text-green-400">{info}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex-1 bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-gray-800 text-gray-100 border border-gray-700 rounded px-4 py-2 font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            Sign up
          </button>
        </div>

        <button
          onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
          className="text-xs text-gray-600 hover:text-gray-400"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
