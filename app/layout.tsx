import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

// Body voice — Inter. Display voice — Oswald (condensed marquee feel).
// Exposed as CSS variables so the theming engine can swap typefaces later.
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const fontDisplay = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

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
    <html
      lang="en"
      data-theme="cinema"
      data-lighting="dim"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
