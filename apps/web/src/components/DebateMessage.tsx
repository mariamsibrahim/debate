import { DebateSide } from "@debate/shared";

export function DebateMessage({ side, body, isMe, username }: { side: DebateSide; body: string; isMe: boolean; username: string }) {
  const isProposition = side === "PROPOSITION";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-md border px-4 py-2.5 ${
          isProposition ? "border-brass/40 bg-brass-soft" : "border-teal/40 bg-teal-soft"
        }`}
      >
        <div className={`mb-1 font-mono text-[10px] uppercase tracking-wide ${isProposition ? "text-brass" : "text-teal"}`}>
          {username} · {side}
        </div>
        <p className="text-[15px] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
