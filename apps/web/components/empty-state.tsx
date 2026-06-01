import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <CircleAlert aria-hidden="true" size={18} />
      <p>{children}</p>
    </div>
  );
}
