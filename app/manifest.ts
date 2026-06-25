import type { MetadataRoute } from "next";

// Served by Next at /manifest.webmanifest. The matching <link rel="manifest">
// is wired in app/layout.tsx via metadata.manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watch Party",
    short_name: "Watch Party",
    description:
      "Watch movies, shows, and videos together with friends and family — in real time.",
    // Installed app opens straight into the lobby (redirects to sign-in if needed).
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    categories: ["entertainment", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
