import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Watch Party",
    template: "%s | Watch Party",
  },
  description:
    "Watch movies, shows, and videos together with friends and family — in real time.",
  keywords: ["watch party", "watch together", "movies", "streaming", "social viewing"],
  authors: [{ name: "Watch Party" }],
  // PWA manifest — added in a later phase
  // manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
