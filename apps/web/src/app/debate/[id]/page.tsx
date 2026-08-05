"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AI_PRACTICE_USER_ID,
  DebateMessagePayload,
  DebateStateSnapshot,
  FORMAT_PHASES,
  JudgeScorecard,
  ModeratorFlagPayload,
} from "@debate/shared";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { Timer } from "@/components/Timer";
import { DebateMessage } from "@/components/DebateMessage";
import { ModeratorLane } from "@/components/ModeratorLane";
import { ScoreCard } from "@/components/ScoreCard";

export default function DebateRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<DebateStateSnapshot | null>(null);
  const [messages, setMessages] = useState<DebateMessagePayload[]>([]);
  const [flags, setFlags] = useState<ModeratorFlagPayload[]>([]);
  const [scorecards, setScorecards] = useState<JudgeScorecard[] | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("debate:join", { debateId: id });

    socket.on("debate:state", setState);
    socket.on("debate:message", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("debate:moderatorFlag", (flag) => setFlags((prev) => [...prev, flag]));
    socket.on("debate:phaseChange", (payload) =>
      setState((prev) => (prev ? { ...prev, phase: payload.phase, phaseEndsAt: payload.phaseEndsAt } : prev)),
    );
    socket.on("debate:completed", (payload) => setScorecards(payload.scores));
    socket.on("error", (payload) => setNotice(payload.message));

    return () => {
      socket.off("debate:state", setState);
      socket.off("debate:message");
      socket.off("debate:moderatorFlag");
      socket.off("debate:phaseChange");
      socket.off("debate:completed");
      socket.off("error");
    };
  }, [id, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, flags]);

  if (!user) return <p className="text-ink-muted">Sign in to view this debate.</p>;
  if (!state) return <p className="text-ink-muted">Loading debate…</p>;

  const phaseDef = FORMAT_PHASES[state.format].find((p) => p.key === state.phase);
  const me = state.participants.find((p) => p.userId === user.id);
  const canSpeak = !!phaseDef && !!me && (phaseDef.speakingSide === "BOTH" || phaseDef.speakingSide === me.side);

  function send() {
    if (!token || !draft.trim()) return;
    getSocket(token).emit("debate:sendMessage", { debateId: id, body: draft.trim() });
    setDraft("");
  }

  if (scorecards) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl">Results</h1>
          <p className="text-ink-muted">{state.topic.title}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {scorecards.map((s) => {
            const participant = state.participants.find((p) => p.userId === s.userId);
            return <ScoreCard key={s.userId} scorecard={s} username={participant?.username ?? "?"} highlight={s.userId === user.id} />;
          })}
        </div>
        <button onClick={() => router.push("/")} className="rounded-md border border-rule px-4 py-2 text-sm hover:border-brass">
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div className="rounded-md border border-rule bg-surface p-4">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">{state.topic.category}</p>
          <h1 className="font-serif text-xl">{state.topic.title}</h1>
        </div>

        {notice && (
          <div className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger" onAnimationEnd={() => setNotice(null)}>
            {notice}
          </div>
        )}

        <div className="space-y-3 rounded-md border border-rule bg-surface p-4">
          {messages.map((m) => {
            const sender = state.participants.find((p) => p.userId === m.senderId);
            return <DebateMessage key={m.id} side={m.side} body={m.body} isMe={m.senderId === user.id} username={sender?.username ?? "?"} />;
          })}
          <ModeratorLane flags={flags} />
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!canSpeak}
            placeholder={canSpeak ? "Make your argument…" : "Waiting for your turn…"}
            rows={2}
            className="flex-1 rounded-md border border-rule bg-surface px-3 py-2 outline-none focus:border-brass disabled:opacity-50"
          />
          <button onClick={send} disabled={!canSpeak} className="rounded-md bg-brass px-4 py-2 text-white disabled:opacity-40">
            Send
          </button>
        </div>

        {state.format === "CASUAL" && (
          <button
            onClick={() => token && getSocket(token).emit("debate:end", { debateId: id })}
            className="text-sm text-ink-muted underline hover:text-danger"
          >
            End discussion &amp; get feedback
          </button>
        )}
      </div>

      <aside className="flex flex-col items-center gap-6 rounded-md border border-rule bg-surface p-4">
        <Timer phaseEndsAt={state.phaseEndsAt} label={phaseDef?.label ?? state.phase} />
        <div className="w-full space-y-2 font-mono text-xs">
          {state.participants.map((p) => (
            <div key={p.userId} className={`rounded px-2 py-1.5 ${p.side === "PROPOSITION" ? "bg-brass-soft text-brass" : "bg-teal-soft text-teal"}`}>
              {p.username} — {p.side}
              {p.userId === AI_PRACTICE_USER_ID && <span className="ml-1 opacity-70">(AI)</span>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
