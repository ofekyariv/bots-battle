import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Bots Battle — pirate ship strategy game */
  output: "standalone",
  serverExternalPackages: ["isolated-vm"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
