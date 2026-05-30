// Next.js configuration — API proxy rewrites, image domains, and experimental features
import type { NextConfig } from "next";

const API_PREFIX = "/api/v1";
const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8000";
const normalize = (value: string) => value.replace(/\/+$/, "");
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;

const usesApiProxy = (raw: string | undefined): boolean => {
  if (raw === undefined) return process.env.NODE_ENV === "development";
  const t = raw.trim().toLowerCase();
  return t === "" || t === "proxy" || t === "same-origin";
};

const rewriteTargetOrigin = (raw: string | undefined): string => {
  const fallback = normalize(
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || DEFAULT_BACKEND_ORIGIN
  );
  if (usesApiProxy(raw)) return fallback;
  if (!raw) return fallback;
  const candidate = normalize(raw.trim());
  if (!candidate || candidate.startsWith("/")) return fallback;
  if (candidate.endsWith(API_PREFIX)) {
    const stripped = candidate.slice(0, -API_PREFIX.length);
    return stripped || fallback;
  }
  return candidate;
};

const apiOrigin = rewriteTargetOrigin(rawApiUrl);
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
