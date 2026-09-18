import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@axe-core/playwright",
  ],

  // `playwright install` writes the browser into
  // node_modules/playwright-core/.local-browsers at build time, but nothing
  // imports a binary, so Next's file tracing drops it and the function fails
  // with "Executable doesn't exist". Pull the directory in explicitly.
  // Only the headless shell — we never launch headed. The full chromium build
  // also ships a macOS .app bundle whose nested structure breaks the tracer.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/playwright-core/.local-browsers/chromium_headless_shell-*/**/*",
    ],
  },
};

export default nextConfig;
