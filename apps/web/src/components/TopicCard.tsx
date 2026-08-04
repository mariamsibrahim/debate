interface Topic {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  popularity: number;
  controversy: number;
}

export function TopicCard({ topic, onSelect, selected }: { topic: Topic; onSelect?: (id: string) => void; selected?: boolean }) {
  return (
    <button
      onClick={() => onSelect?.(topic.id)}
      className={`w-full rounded-md border p-4 text-left transition-colors ${
        selected ? "border-brass bg-brass-soft" : "border-rule bg-surface hover:border-brass"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        <span>{topic.category}</span>
        {topic.subcategory && <span>· {topic.subcategory}</span>}
      </div>
      <p className="font-serif text-lg leading-snug">{topic.title}</p>
      <div className="mt-3 flex gap-4 font-mono text-[11px] text-ink-muted">
        <span>Popularity {topic.popularity}</span>
        <span>Controversy {topic.controversy}</span>
      </div>
    </button>
  );
}
