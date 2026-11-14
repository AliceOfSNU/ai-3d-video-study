// Participant state. Texts, checks, step completion and picks live in localStorage; generated or
// uploaded images live in IndexedDB (they are too big for localStorage). In preview mode (?preview=1)
// everything stays in memory, so an organiser can click through without saving anything.

const PREFIX = "aistudy:";
export const PREVIEW = new URLSearchParams(location.search).has("preview");

// crypto.randomUUID exists only in secure contexts (https, localhost); the study server is plain http.
// getRandomValues works everywhere.
export function uid() {
  if (globalThis.crypto?.randomUUID) {
    try { return crypto.randomUUID(); } catch {}
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const mem = new Map();

export function get(key, fallback = null) {
  if (PREVIEW) return mem.has(key) ? mem.get(key) : fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  if (PREVIEW) { mem.set(key, value); return; }
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function clearPrefix(prefix) {
  if (PREVIEW) { for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k); return; }
  for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
}

// ---- images ------------------------------------------------------------------------------------------
const memImages = new Map();
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open("aistudy", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("images", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("images", mode);
    const out = fn(t.objectStore("images"));
    t.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function saveImage(img) {
  // img: {dataUrl, tag, level, unit, step, model, prompt, note}
  const rec = { id: uid(), createdAt: Date.now(), ...img };
  if (PREVIEW) { memImages.set(rec.id, rec); return rec; }
  try { await tx("readwrite", (s) => s.put(rec)); } catch { memImages.set(rec.id, rec); }
  return rec;
}

export async function listImages(filter = () => true) {
  let all = [...memImages.values()];
  if (!PREVIEW) {
    try {
      const rows = await tx("readonly", (s) => s.getAll());
      all = all.concat(rows || []);
    } catch { /* IndexedDB unavailable: memory only */ }
  }
  return all.filter(filter).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getImage(id) {
  if (!id) return null;
  if (memImages.has(id)) return memImages.get(id);
  if (PREVIEW) return null;
  try { return await tx("readonly", (s) => s.get(id)); } catch { return null; }
}

export async function deleteImage(id) {
  memImages.delete(id);
  if (PREVIEW) return;
  try { await tx("readwrite", (s) => s.delete(id)); } catch { /* ignore */ }
}
