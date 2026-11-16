import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/components/mobile/PlaceholderPage";

export default function OpenGamesPage() {
  return (
    <PlaceholderPage
      icon={<Layers size={28} strokeWidth={1.8} />}
      title="Open Games"
      description="Open, in-progress matches and live match centres will appear here. Check back soon."
    />
  );
}
