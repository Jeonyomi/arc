"use client";

import { useRouter, useSearchParams } from "next/navigation";

const WINDOWS = ["1h", "6h", "24h"] as const;

export default function WindowPicker({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
      {WINDOWS.map((w) => (
        <button
          key={w}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("window", w);
            router.replace(`?${next.toString()}`);
          }}
          className={`rounded px-3 py-1 text-xs font-medium ${
            w === current ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
