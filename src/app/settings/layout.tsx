import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = (await cookies()).get("__session")?.value;
  if (!session) redirect("/login?next=%2Fsettings");

  try {
    await verifySessionCookie(session);
  } catch {
    redirect("/login?next=%2Fsettings");
  }

  return children;
}
