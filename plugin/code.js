// ============================================================
// Pageview — publica frames do Figma como preview no ar
// Backend: seu Worker na Cloudflare (worker.js) + R2
// ============================================================

figma.showUI(__html__, { width: 380, height: 680, themeColors: true });

// ---------- util ----------

function slugify(name) {
  return name
    .replace(/[-–—]\s*(desktop|mobile|tablet|web|final|aprovad\w*|alterad\w*).*/i, "")
    .replace(/\[.*?\]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "preview";
}

// sanitização leve pro slug digitado: respeita o que o usuário escreveu
function cleanSlug(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// UTF-8 encode sem depender de TextEncoder (sandbox do Figma)
function utf8Encode(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.codePointAt(i);
    if (c > 0xffff) i++; // surrogate pair
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

function progress(msg) { figma.ui.postMessage({ type: "progress", msg: msg }); }

function normalizeBase(u) {
  u = (u || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// ---------- seleção / seções ----------

function getSelectedFrame() {
  var sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  var node = sel[0];
  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "SECTION") return node;
  return null;
}

function getSections(frame) {
  if (!("children" in frame)) return [frame];
  var kids = frame.children.filter(function (n) {
    return n.visible && "width" in n && n.width >= frame.width * 0.9;
  });
  if (kids.length < 2) return [frame];
  return kids.slice().sort(function (a, b) { return a.y - b.y; });
}

function notifySelection() {
  var frame = getSelectedFrame();
  if (!frame) {
    figma.ui.postMessage({ type: "selection", ok: false });
    return;
  }
  var sections = getSections(frame);
  figma.ui.postMessage({
    type: "selection",
    ok: true,
    name: frame.name,
    slug: slugify(frame.name),
    width: Math.round(frame.width),
    height: Math.round(frame.height),
    sections: sections.length === 1 ? 0 : sections.length
  });
}

figma.on("selectionchange", notifySelection);

// ---------- export (slices: renderiza com o fundo do frame pai) ----------

function scaleFor(w, h) {
  return (h * 2 > 16000 || w * 2 > 8000) ? 1 : 2;
}

async function exportImages(frame) {
  var sections = getSections(frame);
  var whole = (sections.length === 1 && sections[0] === frame) || frame.rotation !== 0;
  var files = [];

  if (whole) {
    progress("Exportando p\u00e1gina inteira\u2026");
    var bytes = await frame.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: scaleFor(frame.width, frame.height) }
    });
    files.push({ path: "img/sec-01.png", bytes: bytes });
    return files;
  }

  var cuts = sections.map(function (s) { return Math.max(0, Math.round(s.y)); })
    .sort(function (a, b) { return a - b; });
  if (cuts[0] !== 0) cuts.unshift(0);
  cuts.push(Math.round(frame.height));

  var bands = [];
  for (var i = 0; i < cuts.length - 1; i++) {
    if (cuts[i + 1] - cuts[i] >= 2) bands.push([cuts[i], cuts[i + 1]]);
  }

  var box = frame.absoluteBoundingBox;
  for (i = 0; i < bands.length; i++) {
    progress("Exportando se\u00e7\u00e3o " + (i + 1) + "/" + bands.length + "\u2026");
    var slice = figma.createSlice();
    figma.currentPage.appendChild(slice);
    slice.x = box.x;
    slice.y = box.y + bands[i][0];
    slice.resize(frame.width, bands[i][1] - bands[i][0]);
    try {
      var b = await slice.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: scaleFor(frame.width, bands[i][1] - bands[i][0]) }
      });
      files.push({ path: "img/sec-" + String(i + 1).padStart(2, "0") + ".png", bytes: b });
    } finally {
      slice.remove();
    }
  }
  return files;
}

function frameBgCss(frame) {
  try {
    var fills = frame.fills;
    if (Array.isArray(fills)) {
      for (var i = fills.length - 1; i >= 0; i--) {
        var f = fills[i];
        if (f.type === "SOLID" && f.visible !== false) {
          var a = f.opacity == null ? 1 : f.opacity;
          var c = f.color;
          return "rgba(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," +
            Math.round(c.b * 255) + "," + a + ")";
        }
      }
    }
  } catch (e) { /* fills pode ser figma.mixed */ }
  return "#0a0a0a";
}

// ---------- html ----------

function buildHtml(opts) {
  var imgs = opts.images.map(function (f) {
    return '  <img src="' + f.path + '?v=' + opts.version + '" alt="" loading="lazy" decoding="async">';
  }).join("\n");

  var banner = opts.banner
    ? '<div class="pv-banner">Visualiza\u00e7\u00e3o da vers\u00e3o desktop \u00b7 Pageview</div>\n'
    : "";

  return '<!doctype html>\n<html lang="pt-BR">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=' + opts.width + '">\n' +
    '<meta name="robots" content="noindex, nofollow">\n' +
    '<title>' + opts.title + ' \u2014 Preview</title>\n' +
    '<style>\n' +
    '  html,body{margin:0;padding:0;background:' + opts.bg + '}\n' +
    '  img{display:block;width:100%;height:auto;border:0}\n' +
    '  .pv-banner{position:sticky;top:0;z-index:9;background:#050505;color:#7b7b78;\n' +
    '    font:500 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;\n' +
    '    letter-spacing:.02em;padding:10px 16px;border-bottom:1px solid #1d1d1d}\n' +
    '</style>\n</head>\n<body>\n' + banner + imgs + '\n</body>\n</html>\n';
}

// ---------- upload pro worker ----------

async function uploadAll(base, secret, slug, files) {
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    progress("Enviando " + (i + 1) + "/" + files.length +
      " (" + Math.round(f.bytes.length / 1024) + " KB)\u2026");
    var res = await fetch(base + "/api/upload/" + slug + "/" + f.path, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + secret,
        "Content-Type": f.path.endsWith(".html") ? "text/html;charset=utf-8" : "image/png"
      },
      body: f.bytes
    });
    if (res.status === 401) throw new Error("Token recusado pelo Worker. Confere o UPLOAD_SECRET.");
    if (!res.ok) throw new Error("Falha no upload de " + f.path + " (" + res.status + ")");
  }
}

// ---------- fluxo principal ----------

async function publish(msg) {
  var frame = getSelectedFrame();
  if (!frame) throw new Error("Seleciona o frame da p\u00e1gina antes de publicar.");

  var base = normalizeBase(msg.workerUrl);
  var secret = (msg.secret || "").trim();
  if (!base) throw new Error("Cola a URL do seu Worker primeiro.");
  if (!secret) throw new Error("Cola o token (UPLOAD_SECRET) primeiro.");

  await figma.clientStorage.setAsync("pv_worker_url", base);
  await figma.clientStorage.setAsync("pv_secret", secret);

  var slug = cleanSlug(msg.slug) || slugify(frame.name);
  var images = await exportImages(frame);

  var html = buildHtml({
    title: frame.name.replace(/\s*[-–—]\s*desktop.*/i, ""),
    width: Math.round(frame.width),
    banner: !!msg.banner,
    bg: frameBgCss(frame),
    version: Date.now().toString(36),
    images: images
  });

  var files = images.concat([{ path: "index.html", bytes: utf8Encode(html) }]);

  await uploadAll(base, secret, slug, files);

  var url = base + "/" + slug;
  figma.ui.postMessage({ type: "done", url: url });
  figma.notify("Preview no ar: " + url);
}

// ---------- lista / remoção de previews ----------

async function listPreviews(base, secret) {
  var res = await fetch(base + "/api/previews", {
    headers: { "Authorization": "Bearer " + secret }
  });
  if (res.status === 401) throw new Error("Token recusado pelo Worker.");
  if (!res.ok) throw new Error("Falha ao listar previews (" + res.status + ")");
  var data = JSON.parse(await res.text());
  figma.ui.postMessage({ type: "previews", items: data.items || [], base: base });
}

async function removePreview(base, secret, slug) {
  var res = await fetch(base + "/api/preview/" + slug, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + secret }
  });
  if (!res.ok) throw new Error("Falha ao remover " + slug + " (" + res.status + ")");
  figma.notify("Preview removido: " + slug);
  await listPreviews(base, secret);
}

figma.ui.onmessage = async function (msg) {
  try {
    if (msg.type === "init") {
      figma.ui.postMessage({
        type: "settings",
        workerUrl: (await figma.clientStorage.getAsync("pv_worker_url")) || "",
        secret: (await figma.clientStorage.getAsync("pv_secret")) || ""
      });
      notifySelection();
    }
    if (msg.type === "publish") {
      await publish(msg);
      var b = normalizeBase(msg.workerUrl);
      if (b && msg.secret) await listPreviews(b, msg.secret.trim());
    }
    if (msg.type === "list") {
      var base = normalizeBase(msg.workerUrl);
      var secret = (msg.secret || "").trim();
      if (base && secret) {
        await figma.clientStorage.setAsync("pv_worker_url", base);
        await figma.clientStorage.setAsync("pv_secret", secret);
        await listPreviews(base, secret);
      }
    }
    if (msg.type === "remove") {
      await removePreview(normalizeBase(msg.workerUrl), (msg.secret || "").trim(), msg.slug);
    }
  } catch (err) {
    figma.ui.postMessage({ type: "error", msg: (err && err.message) || String(err) });
  }
};
