import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@axe-core/playwright",
    "@sparticuz/chromium",
  ],

  // @sparticuz/chromium ships its browser as brotli blobs under bin/, which
  // nothing imports, so file tracing would drop them and executablePath()
  // would resolve to a missing file.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
