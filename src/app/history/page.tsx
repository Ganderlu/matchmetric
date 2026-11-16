import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/mobile/PlaceholderPage";

export default function HistoryPage() {
  return (
    <PlaceholderPage
      icon={<Clock size={28} strokeWidth={1.8} />}
      title="History"
      description="Your past predictions, finished match reviews and performance history will appear here. Sign in to track your history."
    />
  );
}
