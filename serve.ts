import { readFileSync } from "fs";
import { join, extname } from "path";

const ASSETS_DIR = join(import.meta.dir, "dist", "client", "assets");

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Polyfill Cloudflare-specific globals that may be referenced in the worker bundle
if (!globalThis.caches) {
  (globalThis as any).caches = {
    open: async () => ({
      match: async () => undefined,
      put: async () => {},
      delete: async () => false,
    }),
    default: {
      match: async () => undefined,
      put: async () => {},
      delete: async () => false,
    },
  };
}

const { default: worker } = await import("./dist/server/index.js");

const ctx = {
  waitUntil: (_p: Promise<unknown>) => {},
  passThroughOnException: () => {},
};

Bun.serve({
  port: 3000,
  hostname: "0.0.0.0",
  async fetch(req) {
    const { pathname } = new URL(req.url);

    // Serve static client assets directly (faster + avoids going through the worker)
    if (pathname.startsWith("/assets/")) {
      const filename = pathname.slice(8);
      try {
        const content = readFileSync(join(ASSETS_DIR, filename));
        const ext = extname(filename);
        return new Response(content, {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }

    // All other requests go through the Cloudflare Worker for SSR
    return await worker.fetch(req, {}, ctx);
  },
});

console.log("Server running on http://0.0.0.0:3000");
