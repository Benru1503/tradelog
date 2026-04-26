import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SharedPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shared feed</h1>
        <p className="text-sm text-fg-muted mt-1">
          Trades your friends have chosen to share.
        </p>
      </div>
      <EmptyState
        icon={<Users size={32} />}
        title="Coming in Phase 3"
        description="The shared feed lights up once social features ship. For now, mark trades as shared on the trade form to get them ready."
      />
    </div>
  );
}
