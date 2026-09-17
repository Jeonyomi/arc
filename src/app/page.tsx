"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OverviewView from "@/components/overview-view";
import WindowPicker from "@/components/window-picker";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="panel text-sm text-[var(--muted)]">Loading…</div>}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const params = useSearchParams();
  const window = params.get("window") ?? "24h";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Chain Pulse</h1>
        <WindowPicker current={window} />
      </div>
      <OverviewView window={window} />
    </div>
  );
}
