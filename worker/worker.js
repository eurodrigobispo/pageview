// ============================================================
// Pageview — Worker de previews (Cloudflare Workers + R2)
// Cole este arquivo inteiro no editor do Worker no painel.
// Requer: binding R2 com nome BUCKET + secret UPLOAD_SECRET
// ============================================================

const TYPES = {
  html: "text/html;charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  css: "text/css",
  js: "text/javascript",
  json: "application/json"
};

function contentType(key) {
  const ext = key.split(".").pop().toLowerCase();
  return TYPES[ext] || "application/octet-stream";
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    // preflight do navegador (o plugin do Figma roda com origem "null")
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const res = await handle(request, env);
    const headers = new Headers(res.headers);
    for (const k in CORS) headers.set(k, CORS[k]);
    return new Response(res.body, { status: res.status, headers });
  }
};

async function handle(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);

    // ---------- diagnóstico (abre no navegador) ----------
    if (request.method === "GET" && path === "/api/health") {
      return new Response(JSON.stringify({
        worker: "pageview",
        secretConfigured: !!env.UPLOAD_SECRET,
        bucketConfigured: !!env.BUCKET
      }, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    // ---------- upload (plugin) ----------
    if (request.method === "PUT" && path.startsWith("/api/upload/")) {
      const auth = request.headers.get("Authorization") || "";
      if (!env.UPLOAD_SECRET || auth !== "Bearer " + env.UPLOAD_SECRET) {
        return new Response("não autorizado", { status: 401 });
      }
      const key = path.slice("/api/upload/".length).replace(/^\/+/, "");
      if (!key || key.includes("..") || key.length > 300) {
        return new Response("caminho inválido", { status: 400 });
      }
      await env.BUCKET.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || contentType(key)
        }
      });
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ---------- listar previews no ar ----------
    if (request.method === "GET" && path === "/api/previews") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.UPLOAD_SECRET || auth !== "Bearer " + env.UPLOAD_SECRET) {
        return new Response("não autorizado", { status: 401 });
      }
      const previews = {};
      let cursor;
      do {
        const list = await env.BUCKET.list({ cursor, limit: 1000 });
        for (const o of list.objects) {
          const slug = o.key.split("/")[0];
          if (!slug) continue;
          const p = previews[slug] || (previews[slug] = { slug, files: 0, bytes: 0, updated: 0 });
          p.files++;
          p.bytes += o.size || 0;
          const t = o.uploaded ? new Date(o.uploaded).getTime() : 0;
          if (t > p.updated) p.updated = t;
        }
        cursor = list.truncated ? list.cursor : undefined;
      } while (cursor);
      const items = Object.values(previews).sort((a, b) => b.updated - a.updated);
      return new Response(JSON.stringify({ items }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ---------- remoção opcional de um preview inteiro ----------
    if (request.method === "DELETE" && path.startsWith("/api/preview/")) {
      const auth = request.headers.get("Authorization") || "";
      if (!env.UPLOAD_SECRET || auth !== "Bearer " + env.UPLOAD_SECRET) {
        return new Response("não autorizado", { status: 401 });
      }
      const slug = path.slice("/api/preview/".length).replace(/\/+$/, "");
      if (!slug || slug.includes("/")) return new Response("slug inválido", { status: 400 });
      let cursor;
      do {
        const list = await env.BUCKET.list({ prefix: slug + "/", cursor });
        await Promise.all(list.objects.map((o) => env.BUCKET.delete(o.key)));
        cursor = list.truncated ? list.cursor : undefined;
      } while (cursor);
      return new Response(JSON.stringify({ ok: true, removed: slug }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ---------- servir previews ----------
    if (request.method === "GET" || request.method === "HEAD") {
      const raw = path.replace(/^\/+/, "");
      if (!raw) {
        return new Response("Pageview · OND", {
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
      }
      if (raw.includes("..")) return new Response("caminho inválido", { status: 400 });

      // /slug sem barra final → redireciona pra /slug/
      // (sem isso o navegador resolve img/... a partir da raiz e a página fica em branco)
      if (!raw.includes("/")) {
        return new Response(null, {
          status: 301,
          headers: { "Location": "/" + raw + "/" }
        });
      }

      let key = raw.replace(/\/+$/, "");
      if (!key.includes("/")) key = key + "/index.html"; // veio de /slug/

      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response("preview não encontrado", { status: 404 });

      const isHtml = key.endsWith(".html");
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || contentType(key),
          // html sempre fresco; imagens cacheiam (o plugin troca ?v= a cada publicação)
          "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
          "X-Robots-Tag": "noindex, nofollow"
        }
      });
    }

    return new Response("método não suportado", { status: 405 });
}
