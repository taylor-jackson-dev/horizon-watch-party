import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const FALLBACK_APP_URL = "https://horizon-watch-party.vercel.app";

// Resolve metadataBase defensively. `new URL()` throws on malformed input, and an
// env var pasted without the https:// scheme (or with a stray space/newline) would
// otherwise crash the whole production build during page-data collection. Normalize
// a scheme-less value, and fall back to the canonical URL if it's still unparseable.
function resolveAppUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
  try {
    if (candidate) return new URL(candidate);
  } catch {
    /* fall through to the known-good default */
  }
  return new URL(FALLBACK_APP_URL);
}

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
  metadataBase: resolveAppUrl(),
  applicationName: "Horizon Watch Party",
  title: {
    default: "Horizon Watch Party",
    template: "%s | Horizon Watch Party",
  },
  description:
    "Watch movies, shows, and videos together with friends and family — in real time.",
  keywords: ["watch party", "watch together", "movies", "streaming", "social viewing"],
  authors: [{ name: "Horizon Watch Party" }],
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
    title: "Horizon Watch Party",
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
