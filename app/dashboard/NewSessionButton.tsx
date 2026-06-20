"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NewSessionButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleStart() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error || !session) {
      setLoading(false);
      return;
    }

    router.push(`/chat/${session.id}`);
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="bg-gray-100 text-gray-900 rounded px-4 py-2 font-medium hover:bg-white disabled:opacity-50 text-sm"
    >
      {loading ? "Starting…" : "Start new session"}
    </button>
  );
}
