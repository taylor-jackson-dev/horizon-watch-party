/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Only hosts the app actually shows images from. /_next/image will fetch
    // any URL on these hosts for anyone who asks, so each entry is open to the
    // whole internet: add an exact hostname (never a wildcard) when a feature
    // needs one, e.g. this project's own Supabase Storage host for uploads.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
      {
        protocol: "https",
        hostname: "img.youtube.com", // YouTube video thumbnails
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com", // YouTube image CDN
      },
    ],
  },
};

export default nextConfig;
