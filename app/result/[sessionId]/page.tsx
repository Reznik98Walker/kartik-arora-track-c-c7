import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ResultClient from "./ResultClient";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) redirect("/dashboard");

  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("id, sentence")
    .eq("session_id", sessionId)
    .single();

  if (!diagnosis) redirect(`/chat/${sessionId}`);

  const { data: outcome } = await supabase
    .from("outcomes")
    .select("action_text")
    .eq("diagnosis_id", diagnosis.id)
    .single();

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <ResultClient
      sessionId={sessionId}
      diagnosis={diagnosis}
      outcome={outcome ?? null}
      messages={messages ?? []}
    />
  );
}
