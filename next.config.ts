import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Prisma and yahoo-finance2 from being bundled into the deployment
  // output trace — they use dynamic requires that accidentally pull in the
  // entire project, making the output huge and causing "Deploying outputs..." to hang.
  serverExternalPackages: ["@prisma/client", "prisma", "yahoo-finance2"],
};

export default nextConfig;
