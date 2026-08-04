"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEBATE_FORMATS, DebateFormat, TOPIC_CATEGORIES, TopicCategory } from "@debate/shared";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";
import { TopicCard } from "@/components/TopicCard";

interface Topic {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  popularity: number;
  controversy: number;
}

export default function QueuePage() {
  return (
    <Suspense fallback={null}>
      <QueueContent />
    </Suspense>
  );
}

function QueueContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get("mode") as "CASUAL" | "RANKED") ?? "CASUAL";
  const initialFormat = (params.get("format") as DebateFormat) ?? "BLITZ";

  const [category, setCategory] = useState<TopicCategory>("TECHNOLOGY");
  const [format, setFormat] = useState<DebateFormat>(initialFormat);
  const [topicId, setTopicId] = useState<string | undefined>(undefined);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [searching, setSearching] = useState(false);
  const [waitedSec, setWaitedSec] = useState(0);

  useEffect(() => {
    apiFetch<Topic[]>(`/topics?category=${category}`).then(setTopics).catch(() => setTopics([]));
  }, [category]);

  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => setWaitedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  useEffect(() => {
    if (!token || !searching) return;
    const socket = getSocket(token);
    socket.emit("queue:join", { category, format, language: "en", mode, topicId });
    const onMatched = (payload: { debateId: string }) => router.push(`/debate/${payload.debateId}`);
    socket.on("queue:matched", onMatched);
    return () => {
      socket.off("queue:matched", onMatched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching]);

  const formats = useMemo(() => (format === "CASUAL" ? DEBATE_FORMATS : DEBATE_FORMATS.filter((f) => f !== "CASUAL")), [format]);

  function startSearching() {
    setWaitedSec(0);
    setSearching(true);
  }

  function cancelSearching() {
    if (token) getSocket(token).emit("queue:leave");
    setSearching(false);
  }

  if (!user) {
    return <p className="text-ink-muted">Sign in to find a debate.</p>;
  }

  if (searching) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <div className="mb-4 font-mono text-5xl font-variant-tabular text-brass">
          {Math.floor(waitedSec / 60)}:{String(waitedSec % 60).padStart(2, "0")}
        </div>
        <p className="mb-1 font-serif text-lg">Finding an opponent…</p>
        <p className="mb-6 text-sm text-ink-muted">
          {category} · {format} · {mode}
        </p>
        <button onClick={cancelSearching} className="rounded-md border border-rule px-4 py-2 text-sm hover:border-danger hover:text-danger">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">{mode === "RANKED" ? "Ranked Debate" : "Quick Debate"}</h1>
        <p className="text-sm text-ink-muted">Pick a category and format, then find an opponent.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPIC_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
              category === c ? "border-brass bg-brass-soft text-brass" : "border-rule text-ink-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {formats.map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
              format === f ? "border-teal bg-teal-soft text-teal" : "border-rule text-ink-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-muted">Pick a topic (optional — we'll choose one otherwise)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topics.slice(0, 6).map((topic) => (
            <TopicCard key={topic.id} topic={topic} selected={topicId === topic.id} onSelect={(id) => setTopicId(id === topicId ? undefined : id)} />
          ))}
        </div>
      </div>

      <button onClick={startSearching} className="w-full rounded-md bg-brass px-4 py-3 font-medium text-white sm:w-auto">
        Find opponent
      </button>
    </div>
  );
}
