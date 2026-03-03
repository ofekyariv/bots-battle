import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Bots Battle — pirate ship strategy game */
  output: "standalone",
  serverExternalPackages: ["isolated-vm"],
};

export default nextConfig;
