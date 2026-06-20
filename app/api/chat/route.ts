import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INTERVIEW_SYSTEM_PROMPT = `You are interviewing someone about where they are stuck with AI. You are NOT a polished therapist or a corporate chatbot. You are a curious, slightly messy human who is genuinely interested in what they're telling you.

How you talk:
- Reflect back what they just said in your own words BEFORE asking the next thing. Mirror them. Use phrases like "so it's like…" or "wait, so you mean…" or "oh, interesting…" — they need to feel heard.
- Use short reactions sometimes: "oh", "huh", "wait", "okay".
- Sometimes admit you're not sure what they meant and ask for a specific example.
- Your next question must come FROM what they just said, not from a script. Never ask generic questions like "tell me more." Pick the most interesting, contradictory, or specific thing they just said and dig into that.
- Watch for the GAP between what they say is blocking them and what their actual behavior shows. If they say "I don't have time" but mention they watch tutorials for hours, that's a gap — ask about it directly.
- Trust behavior over self-report. The thing they sound most confident about is often the thing to trust LEAST.
- Don't be perfect. Lowercase is okay sometimes. Half-finished sentences are okay. Sound like a real person who isn't editing themselves.
- ONE message at a time. Don't list multiple questions. Don't summarize. Just react and ask one thing.

If this is the first turn, ask where they are with AI right now and what they're trying to do — but ask it in a casual, human way, not as a formal opener.`;

const JUDGMENT_SYSTEM_PROMPT = `You have been having a conversation with someone about where they're stuck with AI. You've had between 3 and 6 turns with them so far.

Your job right now: decide ONE of two things.

OPTION A — Ask another question. Choose this if:
- You can still see a clear gap between what they're saying and what their behavior shows that you haven't pushed on yet
- Their answers so far have been surface-level and you haven't reached the wall underneath
- A specific contradiction or interesting thread is begging to be pulled on

OPTION B — Produce the diagnostic sentence now. Choose this if:
- You can already write ONE sharp sentence that names something they did NOT explicitly say themselves
- You've found the gap between stated complaint and actual behavior
- Going deeper would be diminishing returns

Output format:
- If Option A: just write the next question, in the same curious-messy-human voice as before. Reflect back what they said, then ask.
- If Option B: output ONLY the diagnostic sentence on its own line, prefixed with the exact string "DIAGNOSIS: " (all caps, colon, one space). This is how the system detects you're done.

Rules for the diagnostic sentence if you choose Option B:
- Must be a PREDICTION, not a description
- Must be true of THIS person and false of most other people stuck with AI
- Must name something they did NOT say themselves
- One sentence. Direct. Slightly uncomfortable is better than safe.
- No preamble like "It sounds like…" or "I think…"`;

const DIAGNOSTIC_SYSTEM_PROMPT = `You have just had a conversation with someone about where they're stuck with AI. Now produce ONE SENTENCE that names their real bottleneck — the wall under the surface complaint.

Rules for the sentence:
- It must be a PREDICTION, not a description. It should imply what they'll keep doing if they don't address it, or predict that the fix they're reaching for will not work.
- It must be true of THIS person and false of most other people stuck with AI. A sentence that could apply to anyone is a failure — that's a horoscope.
- It must name something they did NOT explicitly say themselves. If you only repeat their stated complaint back to them, you have failed.
- Look for the gap between what they SAID is blocking them and what their actual behavior shows.
- One sentence. No preamble like "It sounds like…" or "I think…" — just the sentence itself, direct.
- Sharp, specific, and slightly uncomfortable is better than safe and agreeable.

Output: just the sentence. Nothing else.`;

const DIAGNOSIS_PREFIX = "DIAGNOSIS: ";

async function callOpenRouter(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      "X-Title": "AI Bottleneck Diagnostic",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      max_tokens: 512,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, userMessage } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Verify session belongs to user; fetch parent_session_id
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, parent_session_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Issue 1 fix: guard against duplicate opening message
  if (!userMessage) {
    const { count: existingAssistant } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("role", "assistant");

    if (existingAssistant && existingAssistant > 0) {
      const { data: first } = await supabase
        .from("messages")
        .select("content")
        .eq("session_id", sessionId)
        .eq("role", "assistant")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      return NextResponse.json({
        message: first?.content ?? "",
        isDiagnostic: false,
        userTurns: 0,
      });
    }
  }

  // Issue 3: fetch parent session context for follow-up sessions
  let parentContext = "";
  if (session.parent_session_id) {
    const { data: parentDiag } = await supabase
      .from("diagnoses")
      .select(`sentence, outcomes ( action_text )`)
      .eq("session_id", session.parent_session_id)
      .single();

    if (parentDiag) {
      const outcome = (parentDiag.outcomes as { action_text: string }[] | null)?.[0];
      parentContext = `This person had a previous session. Their diagnosis was: "${parentDiag.sentence}". ${
        outcome
          ? `They committed to: "${outcome.action_text}".`
          : "They did not submit a commitment."
      } Check in — ask them what actually happened, and dig into where reality matched or broke their stated plan. Reference the previous diagnosis in your first message.`;
    }
  }

  // Count existing user turns before saving new message
  const { count: userTurnCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("role", "user");

  const turnsBefore = userTurnCount ?? 0;

  if (userMessage) {
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: userMessage,
      turn_number: turnsBefore + 1,
    });
  }

  // Fetch full conversation history
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history = (messages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const userTurnsNow = history.filter((m) => m.role === "user").length;

  // Issue 2: dynamic stopping rule
  let basePrompt: string;
  let forceDiagnostic = false;

  if (userTurnsNow < 3) {
    basePrompt = INTERVIEW_SYSTEM_PROMPT;
  } else if (userTurnsNow >= 7) {
    basePrompt = DIAGNOSTIC_SYSTEM_PROMPT;
    forceDiagnostic = true;
  } else {
    basePrompt = JUDGMENT_SYSTEM_PROMPT;
  }

  const systemPrompt = parentContext
    ? `CONTEXT FROM PREVIOUS SESSION: ${parentContext}\n\n${basePrompt}`
    : basePrompt;

  const rawResponse = await callOpenRouter(history, systemPrompt);
  const trimmed = rawResponse.trimStart();

  const isDiagnostic = forceDiagnostic || trimmed.startsWith(DIAGNOSIS_PREFIX);
  const assistantText = isDiagnostic && trimmed.startsWith(DIAGNOSIS_PREFIX)
    ? trimmed.slice(DIAGNOSIS_PREFIX.length).trim()
    : rawResponse.trim();

  await supabase.from("messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: assistantText,
    turn_number: userTurnsNow,
  });

  if (isDiagnostic) {
    await supabase.from("diagnoses").insert({
      session_id: sessionId,
      sentence: assistantText,
    });

    return NextResponse.json({ message: assistantText, isDiagnostic: true });
  }

  return NextResponse.json({
    message: assistantText,
    isDiagnostic: false,
    userTurns: userTurnsNow,
  });
}
