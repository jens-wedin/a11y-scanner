export async function register() {
  // Only run on the Node.js server (not in the Edge runtime or during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportEnvironment } = await import("./lib/env-check");
    reportEnvironment();

    // A rejected promise that nobody awaited terminates the function with exit
    // status 128. That happened in production: a transient Neon disconnect
    // discarded a crawl that had already completed successfully. Log it loudly
    // and keep serving rather than taking the whole invocation down.
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
  }
}
