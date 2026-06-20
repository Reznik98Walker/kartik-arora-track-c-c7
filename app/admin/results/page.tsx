import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

type DbMessage = { role: string; content: string; created_at: string };
type DbOutcome = { action_text: string };
type DbDiagnosis = { sentence: string; outcomes: DbOutcome[] };
type DbSession = {
  id: string;
  created_at: string;
  user_id: string;
  parent_session_id: string | null;
  messages: DbMessage[];
  diagnoses: DbDiagnosis[];
};

export default async function AdminResultsPage() {
  // Auth check via regular SSR client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Access denied.</p>
      </div>
    );
  }

  // Fetch everything via service role (bypasses RLS)
  const admin = createAdminClient();

  const [{ data: { users } }, { data: sessions }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("sessions")
      .select(`
        id, created_at, user_id, parent_session_id,
        messages ( role, content, created_at ),
        diagnoses ( sentence, outcomes ( action_text ) )
      `)
      .order("created_at", { ascending: false }),
  ]);

  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? u.id]));

  const typedSessions = (sessions ?? []) as unknown as DbSession[];

  // Sort messages within each session
  for (const s of typedSessions) {
    s.messages?.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Admin — All Results</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {typedSessions.length} session{typedSessions.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {typedSessions.map((session) => {
        const diagnosis = session.diagnoses?.[0];
        const outcome = diagnosis?.outcomes?.[0];
        const email = userEmailMap.get(session.user_id) ?? session.user_id;

        return (
          <div
            key={session.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-sm text-gray-300 font-medium">{email}</p>
                <p className="text-xs text-gray-600">
                  {new Date(session.created_at).toLocaleString()}
                  {session.parent_session_id && (
                    <span className="ml-2 text-gray-700">↳ follow-up</span>
                  )}
                </p>
              </div>
              {diagnosis && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Diagnosis</p>
                  <p className="text-sm text-amber-300 leading-snug">{diagnosis.sentence}</p>
                </div>
              )}
            </div>

            {outcome && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Committed to</p>
                <p className="text-sm text-gray-300">{outcome.action_text}</p>
              </div>
            )}

            {session.messages && session.messages.length > 0 && (
              <details className="group">
                <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer select-none">
                  Show transcript ({session.messages.length} messages)
                </summary>
                <div className="mt-3 space-y-2 pl-2 border-l border-gray-800">
                  {session.messages.map((m, i) => (
                    <div key={i} className="text-xs">
                      <span
                        className={`font-medium mr-2 ${
                          m.role === "user" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {m.role === "user" ? "User" : "AI"}
                      </span>
                      <span className="text-gray-400">{m.content}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      })}

      {typedSessions.length === 0 && (
        <p className="text-gray-600 text-sm">No sessions yet.</p>
      )}
    </div>
  );
}
