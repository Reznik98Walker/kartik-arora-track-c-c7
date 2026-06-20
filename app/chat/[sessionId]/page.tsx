import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "./ChatInterface";

export default async function ChatPage({
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

  // Verify session belongs to user
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) redirect("/dashboard");

  // Check if diagnosis already exists — redirect if so
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("session_id", sessionId)
    .single();

  if (diagnosis) redirect(`/result/${sessionId}`);

  // Load existing messages
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, turn_number")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <ChatInterface
      sessionId={sessionId}
      initialMessages={messages ?? []}
    />
  );
}
