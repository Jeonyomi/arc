import HealthView from "@/components/health-view";

export default function HealthPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Source Health</h1>
      <HealthView />
    </div>
  );
}
