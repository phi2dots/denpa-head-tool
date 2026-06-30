import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(root, "dist");
const port = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleJsonWrite(request, response, fileName) {
  try {
    const data = JSON.parse(await readBody(request));
    if (!Array.isArray(data)) throw new Error(`${fileName} must be an array`);
    const filePath = path.join(root, "data", fileName);
    if (fs.existsSync(filePath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(filePath, path.join(root, "data", `${fileName}.${stamp}.bak`));
    }
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/head-shapes") {
    void handleJsonWrite(request, response, "head-shapes.json");
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/evolution-rules") {
    void handleJsonWrite(request, response, "evolution-rules.json");
    return;
  }

  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const servesProjectFile = pathname.startsWith("/data/") || pathname.startsWith("/assets/head-shapes/");
  const staticRoot = servesProjectFile || !fs.existsSync(distRoot) ? root : distRoot;
  const initialPath = path.normalize(path.join(staticRoot, pathname));
  const filePath = initialPath.startsWith(staticRoot) && fs.existsSync(initialPath) ? initialPath : path.join(staticRoot, "index.html");

  if (!filePath.startsWith(staticRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Denpa Head Tool: http://127.0.0.1:${port}/`);
});
