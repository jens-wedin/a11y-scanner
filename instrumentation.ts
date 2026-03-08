export async function register() {
  // Only run on the Node.js server (not in the Edge runtime or during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("./lib/scheduler");
    initScheduler();
  }
}
