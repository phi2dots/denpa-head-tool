import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonWriterPlugin(): Plugin {
  return {
    name: "denpa-json-writer",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST") return next();
        const targets: Record<string, string> = {
          "/api/head-shapes": "head-shapes.json",
          "/api/evolution-rules": "evolution-rules.json",
        };
        const fileName = targets[req.url ?? ""];
        if (!fileName) return next();
        try {
          const data = JSON.parse(await readBody(req));
          if (!Array.isArray(data)) throw new Error(`${fileName} must be an array`);
          fs.writeFileSync(path.join(process.cwd(), "data", fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), jsonWriterPlugin()],
});
