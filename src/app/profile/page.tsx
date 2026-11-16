import { UserRound } from "lucide-react";
import { PlaceholderPage } from "@/components/mobile/PlaceholderPage";

export default function ProfilePage() {
  return (
    <PlaceholderPage
      icon={<UserRound size={28} strokeWidth={1.8} />}
      title="Profile"
      description="Your account, saved picks and preferences will appear here. Sign in to manage your profile."
    />
  );
}
