/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow avatars from common OAuth providers and Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com", // Discord OAuth avatars
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub OAuth avatars
      },
      {
        protocol: "https",
        hostname: "*.supabase.co", // Supabase Storage (avatars, uploads)
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
