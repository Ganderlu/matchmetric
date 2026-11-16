import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/mobile/PlaceholderPage";

export default function InsightsPage() {
  return (
    <PlaceholderPage
      icon={<BarChart3 size={28} strokeWidth={1.8} />}
      title="Insights"
      description="Trends, market patterns and data-led insights across your tracked leagues will appear here. Check back soon."
    />
  );
}
