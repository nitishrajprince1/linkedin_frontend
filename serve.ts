import { readdirSync, readFileSync } from "fs";
import { join, extname } from "path";

const ASSETS_DIR = join(import.meta.dir, "dist", "client", "assets");

const assetFiles = readdirSync(ASSETS_DIR);
const jsFiles = assetFiles.filter((f) => f.endsWith(".js"));
const cssFiles = assetFiles.filter((f) => f.endsWith(".css"));

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

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LinkedIn Scraper</title>
${cssFiles.map((f) => `  <link rel="stylesheet" href="/assets/${f}" />`).join("\n")}
</head>
<body>
  <div id="root"></div>
${jsFiles.map((f) => `  <script type="module" src="/assets/${f}"></script>`).join("\n")}
</body>
</html>`;

Bun.serve({
  port: 3000,
  hostname: "0.0.0.0",
  fetch(req) {
    const { pathname } = new URL(req.url);

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

    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

console.log("Server running on http://0.0.0.0:3000");
