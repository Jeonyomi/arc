"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OverviewView from "@/components/overview-view";
import WindowPicker from "@/components/window-picker";

export default function UsdcPage() {
  return (
    <Suspense fallback={<div className="panel text-sm text-[var(--muted)]">Loading…</div>}>
      <UsdcInner />
    </Suspense>
  );
}

function UsdcInner() {
  const params = useSearchParams();
  const window = params.get("window") ?? "24h";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">USDC Flows</h1>
        <WindowPicker current={window} />
      </div>
      <p className="text-sm text-[var(--muted)]">
        Native USDC movements indexed from the EIP-7708 system emitter — every explicit transfer,
        mint, and burn at 18-decimal precision. Separate from the 6-decimal ERC-20 interface stream.
      </p>
      <OverviewView window={window} />
    </div>
  );
}
