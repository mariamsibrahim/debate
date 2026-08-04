"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { RatingBadge } from "@/components/RatingBadge";

interface TrustScore {
  civility: number;
  accuracy: number;
  evidence: number;
  openMinded: number;
}

interface Profile {
  username: string;
  bio: string | null;
  country: string | null;
  interests: string[];
  globalElo: number;
  globalTier: string;
  ratings: { category: string; elo: number; tier: string; gamesPlayed: number }[];
  trustScore: TrustScore | null;
  record: { total: number; wins: number; losses: number; draws: number };
  followerCount: number;
  followingCount: number;
}

const TRUST_LABELS: [keyof TrustScore, string][] = [
  ["civility", "Civility"],
  ["accuracy", "Accuracy"],
  ["evidence", "Evidence"],
  ["openMinded", "Open-Minded"],
];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<Profile>(`/users/${username}`)
      .then(setProfile)
      .catch(() => setError(true));
  }, [username]);

  if (error) return <p className="text-ink-muted">No debater found with that username.</p>;
  if (!profile) return <p className="text-ink-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl">{profile.username}</h1>
          {profile.bio && <p className="mt-1 max-w-md text-ink-muted">{profile.bio}</p>}
          <div className="mt-2 flex gap-4 font-mono text-xs text-ink-muted">
            <span>{profile.followerCount} followers</span>
            <span>{profile.followingCount} following</span>
            {profile.country && <span>{profile.country}</span>}
          </div>
        </div>
        <RatingBadge elo={profile.globalElo} />
      </div>

      {/*
        Civility/Accuracy/Evidence/Open-Mindedness sit right under the
        headline, same visual weight as win/loss — the blueprint's explicit
        ruling against letting the profile silently become "argue to win".
      */}
      {profile.trustScore && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRUST_LABELS.map(([key, label]) => (
            <div key={key} className="rounded-md border border-rule bg-surface p-3 text-center">
              <div className="font-mono text-2xl font-variant-tabular text-teal">{profile.trustScore![key]}</div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 rounded-md border border-rule bg-surface p-4 text-center font-mono">
        <Stat label="Debates" value={profile.record.total} />
        <Stat label="Wins" value={profile.record.wins} />
        <Stat label="Losses" value={profile.record.losses} />
        <Stat label="Draws" value={profile.record.draws} />
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-muted">Category Ratings</h2>
        <div className="flex flex-wrap gap-2">
          {profile.ratings.map((r) => (
            <RatingBadge key={r.category} elo={r.elo} category={r.category} />
          ))}
        </div>
      </div>

      {profile.interests.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-muted">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span key={interest} className="rounded-full border border-rule px-3 py-1 text-sm">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xl font-variant-tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
