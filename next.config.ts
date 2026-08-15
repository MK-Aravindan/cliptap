import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/media/info": ["./bin/**"],
    "/api/media/download": ["./bin/**", "./node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
