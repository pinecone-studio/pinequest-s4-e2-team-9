import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  allowedDevOrigins: ["eager-paws-spend.loca.lt"],
};

export default nextConfig;