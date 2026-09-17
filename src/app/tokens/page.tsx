import TokensView from "@/components/tokens-view";

export default function TokensPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Token Registry</h1>
      <TokensView />
    </div>
  );
}
