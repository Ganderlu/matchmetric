import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = (await cookies()).get("__session")?.value;
  if (!session) redirect("/login");

  try {
    await verifySessionCookie(session);
  } catch {
    redirect("/login");
  }

  return children;
}
