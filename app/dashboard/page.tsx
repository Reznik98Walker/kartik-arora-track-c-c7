import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NewSessionButton from "./NewSessionButton";
import SignOutButton from "./SignOutButton";

type Session = {
  id: string;
  created_at: string;
  parent_session_id: string | null;
  diagnoses: { sentence: string }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("sessions")
    .select(`id, created_at, parent_session_id, diagnoses ( sentence )`)
    .order("created_at", { ascending: true });

  const sessions = (raw ?? []) as Session[];

  // Build tree: roots and their children (one level deep)
  const childrenMap = new Map<string, Session[]>();
  const roots: Session[] = [];

  for (const s of sessions) {
    if (!s.parent_session_id) {
      roots.push(s);
    } else {
      if (!childrenMap.has(s.parent_session_id)) {
        childrenMap.set(s.parent_session_id, []);
      }
      childrenMap.get(s.parent_session_id)!.push(s);
    }
  }

  // Most recent roots first
  roots.reverse();

  function SessionRow({ session, indent }: { session: Session; indent?: boolean }) {
    const diagnosis = session.diagnoses?.[0];
    const href = diagnosis ? `/result/${session.id}` : `/chat/${session.id}`;

    return (
      <li>
        <Link
          href={href}
          className={`block bg-gray-900 border border-gray-800 rounded px-4 py-3 hover:border-gray-600 transition-colors ${
            indent ? "ml-6 border-l-2 border-l-gray-700" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-gray-300 flex-1 leading-snug">
              {indent && <span className="text-gray-600 mr-2">↳</span>}
              {diagnosis ? (
                diagnosis.sentence
              ) : (
                <span className="text-gray-500 italic">In progress…</span>
              )}
            </p>
            <span className="text-xs text-gray-600 whitespace-nowrap mt-0.5">
              {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 sm:py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">AI Bottleneck Diagnostic</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-md">
            A 3–7 turn AI interview that names the real wall between you and AI progress — not the
            symptom, the actual bottleneck.
          </p>
          <p className="text-xs text-gray-600 mt-2">{user.email}</p>
        </div>
        <div className="flex gap-3 items-center">
          <SignOutButton />
          <NewSessionButton />
        </div>
      </div>

      {roots.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-gray-400 text-sm">No sessions yet.</p>
          <p className="text-gray-600 text-xs">
            Start a session and answer 3–7 questions honestly. The AI will name your bottleneck.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {roots.map((root) => {
            const children = childrenMap.get(root.id) ?? [];
            return (
              <>
                <SessionRow key={root.id} session={root} />
                {children.map((child) => (
                  <SessionRow key={child.id} session={child} indent />
                ))}
              </>
            );
          })}
        </ul>
      )}
    </div>
  );
}
