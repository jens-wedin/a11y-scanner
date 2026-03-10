import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-extra",
    "playwright-core",
    "puppeteer-extra-plugin-stealth",
    "@axe-core/playwright",
  ],
};

export default nextConfig;
