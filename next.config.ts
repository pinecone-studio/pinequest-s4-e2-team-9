import type { NextConfig } from "next";

const appUrlHost = getAllowedAppHost();
const allowedAppOrigins = appUrlHost ? [appUrlHost] : [];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
      allowedOrigins: allowedAppOrigins,
    },
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.loca.lt",
    ...allowedAppOrigins,
  ],
};

export default nextConfig;

function getAllowedAppHost() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    return undefined;
  }

  try {
    return new URL(appUrl).hostname || undefined;
  } catch {
    return undefined;
  }
}
