// ============================================================
// Pageview — ponte Figma <-> UI (v2)
// A UI (ui.html) cuida de rede, conversão WebP e montagem do HTML.
// Este arquivo só fala com a API do Figma.
// ============================================================

figma.showUI(__html__, { width: 400, height: 640, themeColors: true });

// ---------- util ----------

function slugify(name) {
  return name
    .replace(/[-–—]\s*(desktop|mobile|tablet|web|final|aprovad\w*|alterad\w*).*/i, "")
    .replace(/\[.*?\]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "preview";
}

function progress(msg) { figma.ui.postMessage({ type: "progress", msg: msg }); }

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

// ---------- export (escala dependente da qualidade) ----------

function scaleForQuality(w, h, quality) {
  var target = quality === "light" ? 1.5 : 2;
  if (h * target > 16000 || w * target > 8000) return 1;
  return target;
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

async function exportImages(frame, quality) {
  var sections = getSections(frame);
  var whole = (sections.length === 1 && sections[0] === frame) || frame.rotation !== 0;
  var files = [];

  if (whole) {
    progress("Exportando página inteira…");
    var bytes = await frame.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: scaleForQuality(frame.width, frame.height, quality) }
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
    progress("Exportando seção " + (i + 1) + "/" + bands.length + "…");
    var slice = figma.createSlice();
    figma.currentPage.appendChild(slice);
    slice.x = box.x;
    slice.y = box.y + bands[i][0];
    slice.resize(frame.width, bands[i][1] - bands[i][0]);
    try {
      var b = await slice.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: scaleForQuality(frame.width, bands[i][1] - bands[i][0], quality) }
      });
      files.push({ path: "img/sec-" + String(i + 1).padStart(2, "0") + ".png", bytes: b });
    } finally {
      slice.remove();
    }
  }
  return files;
}

// ---------- roteamento de mensagens ----------

figma.ui.onmessage = async function (msg) {
  try {
    if (msg.type === "init") {
      figma.ui.postMessage({
        type: "settings",
        workerUrl: (await figma.clientStorage.getAsync("pv_worker_url")) || "",
        secret: (await figma.clientStorage.getAsync("pv_secret")) || ""
      });
      figma.ui.postMessage({
        type: "removed",
        items: (await figma.clientStorage.getAsync("pv_removed")) || []
      });
      notifySelection();
    }
    if (msg.type === "save-settings") {
      if (msg.workerUrl != null) await figma.clientStorage.setAsync("pv_worker_url", msg.workerUrl);
      if (msg.secret != null) await figma.clientStorage.setAsync("pv_secret", msg.secret);
    }
    if (msg.type === "save-removed") {
      await figma.clientStorage.setAsync("pv_removed", msg.items || []);
    }
    if (msg.type === "export") {
      var frame = getSelectedFrame();
      if (!frame) {
        figma.ui.postMessage({ type: "export-error", msg: "Seleciona o frame da página antes de publicar." });
        return;
      }
      var images = await exportImages(frame, msg.quality);
      figma.ui.postMessage({
        type: "exported",
        images: images,
        meta: {
          title: frame.name.replace(/\s*[-–—]\s*desktop.*/i, ""),
          width: Math.round(frame.width),
          bg: frameBgCss(frame),
          slugDefault: slugify(frame.name)
        }
      });
    }
    if (msg.type === "notify") {
      figma.notify(msg.msg);
    }
  } catch (err) {
    figma.ui.postMessage({ type: "export-error", msg: (err && err.message) || String(err) });
  }
};
