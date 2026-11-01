import { Badge } from "@/components/ui/badge";
import type { ReviewState } from "@/lib/data/admin-reviews";

const STATE_BADGE: Record<ReviewState, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
  approved: { label: "Approved", className: "bg-emerald-600 text-white hover:bg-emerald-700" },
  hidden: { label: "Hidden", className: "" },
};

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  const badge = STATE_BADGE[state];
  return (
    <Badge variant={state === "hidden" ? "secondary" : "default"} className={badge.className}>
      {badge.label}
    </Badge>
  );
}
