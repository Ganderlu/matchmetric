import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { SlipProvider } from "@/context/SlipContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchMetric | Football Intelligence",
  description:
    "Explore football fixtures, market previews and responsible, data-led match analysis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SlipProvider>{children}</SlipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
