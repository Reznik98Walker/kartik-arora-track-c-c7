"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReset() {
    const pwd = password.trim();
    if (!pwd || pwd.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-green-400 text-sm">Password updated. Redirecting…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-500 text-sm">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-gray-100">Set new password</h1>
        <input
          type="password"
          placeholder="New password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReset()}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
        {error && <p className="text-sm text-amber-400">{error}</p>}
        <button
          onClick={handleReset}
          disabled={loading || !password.trim()}
          className="w-full bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}
