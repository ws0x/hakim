import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { AuthService } from "./services/auth.js";
import { IngestionService } from "./services/ingestion.js";
import { parseMyClippings, parseKindleHtmlExport } from "@hakim/kindle-import";

export interface ServerOptions {
  port?: number;
  host?: string;
  db: DatabaseSync;
}

export function createEngineServer(options: ServerOptions) {
  const host = options.host || "127.0.0.1";
  const port = options.port || 4242;
  const db = options.db;

  const auth = new AuthService(db);
  const ingestion = new IngestionService(db);

  function readJsonBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          reject(new Error("Invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }

  function readTextBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end(JSON.stringify(data));
  }

  const server = createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      // 1. Health check (No auth required, reveals no secrets)
      if (req.method === "GET" && pathname === "/api/v1/health") {
        const bookCount = (db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number }).count;
        const annotCount = (db.prepare("SELECT COUNT(*) as count FROM annotations").get() as { count: number }).count;

        return sendJson(res, 200, {
          status: "healthy",
          version: "1.0.0",
          node: process.version,
          library: {
            books: bookCount,
            annotations: annotCount,
          },
        });
      }

      // 2. Pairing verification
      if (req.method === "POST" && pathname === "/api/v1/pair") {
        const body = (await readJsonBody(req)) as { token?: string };
        if (!body.token || !auth.validateToken(body.token)) {
          return sendJson(res, 401, { error: "Invalid pairing token" });
        }
        return sendJson(res, 200, { success: true, message: "Paired successfully with Hakim Engine" });
      }

      // Authentication guard for remaining endpoints
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!auth.validateToken(token)) {
        return sendJson(res, 401, { error: "Unauthorized. Valid pairing token required." });
      }

      // 3. Ingest Import Envelope
      if (req.method === "POST" && pathname === "/api/v1/import") {
        const envelope = await readJsonBody(req);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const report = ingestion.ingestEnvelope(envelope as any);
        return sendJson(res, 200, { success: true, report });
      }

      // 4. Import My Clippings.txt
      if (req.method === "POST" && pathname === "/api/v1/import/clippings") {
        const rawText = await readTextBody(req);
        const envelope = parseMyClippings(rawText);
        const report = ingestion.ingestEnvelope(envelope);
        return sendJson(res, 200, { success: true, report });
      }

      // 5. Import Kindle HTML
      if (req.method === "POST" && pathname === "/api/v1/import/html") {
        const rawHtml = await readTextBody(req);
        const envelope = parseKindleHtmlExport(rawHtml);
        const report = ingestion.ingestEnvelope(envelope);
        return sendJson(res, 200, { success: true, report });
      }

      // 6. List Books & Highlights
      if (req.method === "GET" && pathname === "/api/v1/books") {
        const books = db.prepare("SELECT * FROM books ORDER BY display_title ASC").all();
        return sendJson(res, 200, { books });
      }

      // 7. Full Library Snapshot for Web Client & Visual Intelligence
      if (req.method === "GET" && (pathname === "/api/v1/library" || pathname === "/api/v1/highlights")) {
        const rawBooks = db.prepare("SELECT * FROM books ORDER BY display_title ASC").all() as Array<{
          id: string;
          display_title: string;
          author: string;
          asin?: string;
          cover_url?: string;
        }>;

        const rawAnnotations = db.prepare(`
          SELECT a.*, b.display_title as book_title, s.importance, s.personal_interpretation, s.user_tags
          FROM annotations a
          JOIN books b ON a.book_id = b.id
          LEFT JOIN annotation_user_states s ON a.id = s.annotation_id
          WHERE a.source_state = 'active'
          ORDER BY a.location_start ASC
        `).all() as Array<{
          id: string;
          book_id: string;
          book_title: string;
          raw_text: string;
          source_note?: string;
          location_start?: number;
          chapter?: string;
          color: string;
          importance?: string;
          personal_interpretation?: string;
          user_tags?: string;
        }>;

        const books = rawBooks.map((b) => ({
          id: b.id,
          title: b.display_title,
          author: b.author,
          asin: b.asin,
          coverUrl: b.cover_url,
          highlightsCount: rawAnnotations.filter((a) => a.book_id === b.id).length,
          status: "reading" as const,
        }));

        const highlights = rawAnnotations.map((a) => {
          let tags: string[] = [];
          try {
            if (a.user_tags) tags = JSON.parse(a.user_tags);
          } catch {
            tags = [];
          }

          return {
            id: a.id,
            bookId: a.book_id,
            bookTitle: a.book_title,
            rawText: a.raw_text,
            sourceNote: a.source_note || undefined,
            location: a.location_start || undefined,
            chapter: a.chapter || undefined,
            color: (a.color || "yellow").toLowerCase() as "yellow" | "blue" | "pink" | "orange",
            importance: a.importance ? (a.importance.charAt(0).toUpperCase() + a.importance.slice(1)) as any : undefined,
            interpretation: a.personal_interpretation || undefined,
            tags,
          };
        });

        return sendJson(res, 200, { books, highlights });
      }

      return sendJson(res, 404, { error: "Not found" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return sendJson(res, 500, { error: message });
    }
  });

  return {
    server,
    auth,
    ingestion,
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(port, host, () => {
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
