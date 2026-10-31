import type { Concept, FileProblem } from "@arch-mind/rules/model";
import { useEffect, useState } from "react";
import { LayerView } from "./LayerView.tsx";

interface Loaded {
  concepts: Concept[];
  problems: FileProblem[];
}

export function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/concepts")
      .then((res) => (res.ok ? (res.json() as Promise<Loaded>) : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setData, (e: Error) => setError(e.message));
  }, []);

  const relations = data?.concepts.reduce((n, c) => n + c.relations.length, 0) ?? 0;

  return (
    <main className="mx-auto flex max-w-[1366px] flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-[15px] font-semibold tracking-tight">arch-mind</h1>
        <p className="text-[13px] text-ink-muted">
          {data ? `${data.concepts.length} concepts · ${relations} relations` : ""}
          {data && data.problems.length > 0 ? ` · ${data.problems.length} files could not be read` : ""}
        </p>
      </header>
      <section className="rounded-2xl border border-line bg-panel p-4">
        {error && <p role="alert">Could not load concepts: {error}</p>}
        {data && <LayerView concepts={data.concepts} />}
      </section>
    </main>
  );
}
