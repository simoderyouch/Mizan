// Next.js configuration — API proxy rewrites, image domains, and experimental features
import type { NextConfig } from "next";

const API_PREFIX = "/api/v1";
const DEFAULT_API_ORIGIN = "http://localhost:8000";
const normalize = (value: string) => value.replace(/\/+$/, "");
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;

const toApiOrigin = (raw: string | undefined): string => {
  const fallback = normalize(DEFAULT_API_ORIGIN);
  const candidate = raw ? normalize(raw.trim()) : fallback;

  if (!candidate) return fallback;
  if (candidate.startsWith("/")) return fallback;
  if (candidate.endsWith(API_PREFIX)) {
    const stripped = candidate.slice(0, -API_PREFIX.length);
    return stripped || fallback;
  }
  return candidate;
};

const apiOrigin = toApiOrigin(rawApiUrl);
const apiBaseUrl = `${apiOrigin}${API_PREFIX}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
