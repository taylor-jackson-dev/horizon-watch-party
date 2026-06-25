import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://water-party-private-repo.vercel.app";

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
  metadataBase: new URL(APP_URL),
  applicationName: "Watch Party",
  title: {
    default: "Watch Party",
    template: "%s | Watch Party",
  },
  description:
    "Watch movies, shows, and videos together with friends and family — in real time.",
  keywords: ["watch party", "watch together", "movies", "streaming", "social viewing"],
  authors: [{ name: "Watch Party" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Watch Party",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under the notch / home indicator so the dim cinema bg is edge-to-edge
  // when installed; the dark theme color keeps the status bar on-brand.
  viewportFit: "cover",
  themeColor: "#0c0c0e",
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
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
