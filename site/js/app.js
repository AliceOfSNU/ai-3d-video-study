// Study page renderer. Reads a LEVEL (content/*.js) and draws: header + progress, unit sidebar,
// step tabs, the step's blocks, prev/next. All participant state goes through store.js.
import { LEVEL, MODELS } from "../content/lv1.js";
import * as store from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TAG_NAMES = { person: "인물", place: "장소", style: "스타일", mood: "분위기", cmp: "모델 비교", upload: "올린 사진" };
const modelName = (id) => (MODELS.find((m) => m.id === id) || {}).name || id || "";
const DEFAULT_MODEL_KEY = `${LEVEL.id}:defaultModel`;      // chosen in unit 1-2's selection table

let API = { ok: false, mode: "offline", label: "" };
let route = { unit: null, step: 0 };

// ---- routing ---------------------------------------------------------------------------------------------
function unitById(id) { return LEVEL.units.find((u) => u.id === id); }
function firstOpenUnit() { return LEVEL.units.find((u) => !u.locked); }

function readRoute() {
  const m = location.hash.match(/^#\/(\w+)\/s(\d+)/);
  const u = m && unitById(m[1]);
  if (u && !u.locked) {
    route = { unit: u.id, step: Math.min(Math.max(+m[2] - 1, 0), u.steps.length - 1) };
  } else {
    const saved = store.get(`${LEVEL.id}:route`);
    const su = saved && unitById(saved.unit);
    route = su && !su.locked ? saved : { unit: firstOpenUnit().id, step: 0 };
  }
}

function go(unit, step) {
  route = { unit, step };
  store.set(`${LEVEL.id}:route`, route);
  const hash = `#/${unit}/s${step + 1}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const doneKey = (u, s) => `${LEVEL.id}:${u}:${s}:done`;
const isStepDone = (u, s) => !!store.get(doneKey(u, s));
const isUnitDone = (u) => !u.locked && u.steps.every((s) => isStepDone(u.id, s.id));

// ---- generation API --------------------------------------------------------------------------------------
// Absolute URL from location.origin: a page opened as http://id:pw@host/ has credentials in its base URL,
// and fetch() refuses relative URLs that resolve to one.
const api = (path) => new URL(path, location.origin).href;

async function loadConfig() {
  try {
    const r = await fetch(api("/api/config"));
    API = { ok: r.ok, ...(await r.json()) };
  } catch {
    API = { ok: false, mode: "offline", label: "생성 서버에 연결되지 않았어요. server.py로 띄웠는지 확인해 주세요." };
  }
}

// Generation takes 15-90 s, so the server answers at once with a job id and the page polls it. A phone drops
// a long-held request when the tab goes to the background ("Load failed"); a failed poll is simply retried.
const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate({ model, prompt, aspect, references }) {
  let r;
  try {
    r = await fetch(api("/api/images/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, aspect_ratio: aspect, references }),
    });
  } catch {
    throw new Error("생성 요청을 보내지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `생성에 실패했어요 (HTTP ${r.status})`);
  if (data.image) return data;                     // a server that answers synchronously
  if (!data.job) throw new Error("생성 서버 응답이 이상해요. 다시 시도해 주세요.");
  const t0 = Date.now();
  while (Date.now() - t0 < GIVE_UP_MS) {
    await sleep(POLL_MS);
    let s;
    try {
      const q = await fetch(api(`/api/images/jobs/${data.job}`), { cache: "no-store" });
      s = await q.json();
    } catch {
      continue;                                    // offline for a moment or tab in background: ask again
    }
    if (s.status === "done") return s;
    if (s.status === "error") throw new Error(s.error || "생성에 실패했어요.");
  }
  throw new Error("생성 결과를 받지 못했어요. 다시 시도해 주세요.");
}

// ---- shell -----------------------------------------------------------------------------------------------
function renderHeader() {
  const open = LEVEL.units.filter((u) => !u.locked);
  const done = LEVEL.units.filter(isUnitDone).length;
  const pct = Math.round((done / LEVEL.units.length) * 100);
  $("#hdr").innerHTML = `
    <div class="badge">${LEVEL.no}</div>
    <div class="hdr-text">
      <div class="hdr-title">${esc(LEVEL.title)}</div>
      <div class="hdr-prog"><div class="bar"><i style="width:${pct}%"></i></div><span>${done} / ${LEVEL.units.length}유닛</span></div>
    </div>
    <div class="hdr-sp"></div>
    <button class="btn ghost" id="openGallery">내 이미지함 <span class="count" id="galCount"></span></button>`;
  $("#openGallery").onclick = openGallery;
  store.listImages().then((all) => { $("#galCount").textContent = all.length || ""; });
  void open;
}

function renderSidebar() {
  $("#side").innerHTML = LEVEL.units.map((u) => {
    const cur = u.id === route.unit;
    const done = isUnitDone(u);
    return `<button class="unit ${cur ? "cur" : ""} ${u.locked ? "locked" : ""}" data-unit="${u.id}" ${u.locked ? "disabled" : ""}>
      <span class="dot ${done ? "done" : ""}">${done ? "✓" : ""}</span>
      <span class="ut"><b>${u.code}</b> ${esc(u.title)}</span>
      ${cur ? '<span class="now">지금</span>' : u.locked ? '<span class="soon">준비 중</span>' : ""}
    </button>`;
  }).join("");
  $("#side").querySelectorAll(".unit:not(.locked)").forEach((b) => (b.onclick = () => {
    const u = unitById(b.dataset.unit);
    const firstTodo = u.steps.findIndex((s) => !isStepDone(u.id, s.id));
    go(u.id, firstTodo < 0 ? 0 : firstTodo);
  }));
}

function renderMain() {
  const unit = unitById(route.unit);
  const step = unit.steps[route.step];
  const banners = [];
  if (store.PREVIEW) {
    banners.push(`<div class="banner"><b>운영진 미리보기</b> 크루 화면을 그대로 눌러 볼 수 있어요. 적은 내용과 체크는 저장되지 않아요.
      <a href="#" id="resetUnit">이 유닛 처음부터</a></div>`);
  }
  if (API.mode !== "live") {
    banners.push(`<div class="banner dev"><b>${API.ok ? "개발 모드" : "연결 안 됨"}</b> ${esc(API.label || "")}</div>`);
  }
  const tabs = unit.steps.map((s, i) => {
    const done = isStepDone(unit.id, s.id);
    const cur = i === route.step;
    return `<button class="tab ${cur ? "cur" : ""} ${done && !cur ? "done" : ""}" data-i="${i}">
      <span class="tn">${done && !cur ? "✓" : i + 1}</span>${esc(s.tab)}</button>`;
  }).join("");
  const last = route.step === unit.steps.length - 1;
  $("#main").innerHTML = `
    ${banners.join("")}
    <div class="unit-head">
      <div class="kicker">${unit.steps.length}개 스텝 중 ${route.step + 1}번째</div>
      <h1><span class="code">${unit.code}</span> ${esc(unit.title)}</h1>
      <div class="goal">유닛 목표 · ${esc(unit.goal)} <span class="muted">· 약 ${unit.minutes}분</span></div>
    </div>
    <nav class="tabs">${tabs}</nav>
    <section class="step">
      <h2>${esc(step.title)} <span class="mins">약 ${step.minutes}분</span></h2>
      ${step.goal ? `<p class="step-goal">${esc(step.goal)}</p>` : ""}
      <div id="blocks"></div>
    </section>
    <div class="pager">
      ${route.step > 0 ? '<button class="btn ghost" id="prev">← 이전 스텝</button>' : "<span></span>"}
      <button class="btn primary" id="next">${last ? "유닛 완료하기" : "이 스텝 완료하고 다음으로 →"}</button>
    </div>`;
  $("#main").querySelectorAll(".tab").forEach((t) => (t.onclick = () => go(unit.id, +t.dataset.i)));
  if ($("#prev")) $("#prev").onclick = () => go(unit.id, route.step - 1);
  $("#next").onclick = () => {
    store.set(doneKey(unit.id, step.id), true);
    if (!last) return go(unit.id, route.step + 1);
    const next = LEVEL.units[LEVEL.units.indexOf(unit) + 1];
    if (next && !next.locked) { toast(`${unit.code}을 마쳤어요. ${next.code}로 넘어가요.`); go(next.id, 0); }
    else { renderHeader(); renderSidebar(); renderMain(); toast(`${unit.code}을 마쳤어요. 다음 유닛은 준비 중이에요.`); }
  };
  if ($("#resetUnit")) $("#resetUnit").onclick = (e) => { e.preventDefault(); store.clearPrefix(`${LEVEL.id}:${unit.id}`); go(unit.id, 0); };
  const host = $("#blocks");
  step.blocks.forEach((b) => host.appendChild(BLOCKS[b.type](b, { unit, step })));
}

function render() { renderHeader(); renderSidebar(); renderMain(); }

// ---- blocks ----------------------------------------------------------------------------------------------
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
const k = (ctx, ...parts) => [LEVEL.id, ctx.unit.id, ...parts].join(":");

const ICONS = {
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
  place: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M10 20v-5h4v5"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="5" height="14" rx="1"/><rect x="9.5" y="5" width="5" height="14" rx="1"/><rect x="16" y="5" width="5" height="14" rx="1"/></svg>',
  table: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/></svg>',
};

const BLOCKS = {
  lead: (b) => el(`<p class="lead">${b.text}</p>`),

  make: (b) => el(`<div class="card make"><h3>${esc(b.title)}</h3><div class="make-grid">${b.items.map((it) => `
      <div class="make-item"><div class="mi-icon">${ICONS[it.icon] || ""}</div><div><b>${esc(it.title)}</b><p>${esc(it.desc)}</p></div></div>`).join("")}
    </div></div>`),

  flow: (b) => el(`<div class="card"><h3>${esc(b.title)}</h3><ol class="flow">${b.items.map((t, i) => `<li><span>${i + 1}</span>${esc(t)}</li>`).join("")}</ol></div>`),

  guide: (b) => el(`<div class="card guide"><h3>${esc(b.title)}</h3><ul>${b.items.map((t) => `<li>${t}</li>`).join("")}</ul></div>`),

  anatomy: (b) => el(`<div class="card anatomy"><h3>${esc(b.title)}</h3>
      <div class="parts">${b.parts.map((p) => `<div class="part c-${p.color}"><small>${esc(p.label)}</small><span>${esc(p.text)}</span></div>`).join("")}</div>
      <p class="joined"><small>합치면</small>${b.parts.map((p) => `<span class="c-${p.color}">${esc(p.text)}</span>`).join(". ")}.</p>
    </div>`),

  tip: (b) => el(`<div class="tip"><b>${esc(b.title)}</b><p>${esc(b.text)}</p></div>`),

  check: (b, ctx) => {
    const key = k(ctx, "check", b.id);
    const state = store.get(key, {});
    const node = el(`<div class="card check"><h3>${esc(b.title)}</h3>
      ${b.items.map((t, i) => `<label class="ck ${state[i] ? "on" : ""}"><input type="checkbox" ${state[i] ? "checked" : ""} data-i="${i}"><span class="box"></span>${esc(t)}</label>`).join("")}
      ${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}</div>`);
    node.querySelectorAll("input").forEach((inp) => (inp.onchange = () => {
      const s = store.get(key, {}); s[inp.dataset.i] = inp.checked; store.set(key, s);
      inp.closest(".ck").classList.toggle("on", inp.checked);
    }));
    return node;
  },

  table: (b) => el(`<div class="card"><h3>${esc(b.title)}</h3><div class="tbl-wrap"><table class="tbl">
      <thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join("")}</tr>`).join("")}</tbody>
    </table></div>${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}</div>`),

  generator: (b, ctx) => generatorBlock(b, ctx),
  ab: (b, ctx) => abBlock(b, ctx),
  pick: (b, ctx) => pickBlock(b, ctx),
  compare: (b, ctx) => compareBlock(b, ctx),
  stats: (b, ctx) => statsBlock(b, ctx),
  summary: (b, ctx) => summaryBlock(b, ctx),
};

// model + aspect controls shared by generator and ab
function modelPicker(key) {
  const def = store.get(DEFAULT_MODEL_KEY, MODELS[0].id);
  const cur = store.get(key, def);
  const node = el(`<div class="models">${MODELS.map((m) => `
      <label class="model ${m.id === cur ? "on" : ""}"><input type="radio" name="${key}" value="${m.id}" ${m.id === cur ? "checked" : ""}>
        <b>${esc(m.name)}</b><small>${esc(m.maker)} · ${esc(m.note)}</small></label>`).join("")}</div>`);
  node.querySelectorAll("input").forEach((r) => (r.onchange = () => {
    store.set(key, r.value);
    node.querySelectorAll(".model").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
  }));
  return { node, value: () => store.get(key, def) };
}

function aspectPicker(key, options, def) {
  if (!options || options.length < 2) return { node: el("<span></span>"), value: () => def };
  const cur = store.get(key, def);
  const node = el(`<div class="aspects"><small>화면 비율</small>${options.map((a) => `<button class="chip ${a === cur ? "on" : ""}" data-a="${a}">${a}</button>`).join("")}</div>`);
  node.querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
    store.set(key, c.dataset.a);
    node.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
  }));
  return { node, value: () => store.get(key, def) };
}

// sample images (site/assets) for participants who skipped the unit that makes the reference
const sampleCache = new Map();
async function sampleImage(path) {
  if (!sampleCache.has(path)) {
    sampleCache.set(path, (async () => {
      const blob = await (await fetch(new URL(path, location.href).href)).blob();
      return { id: `sample:${path}`, dataUrl: await fileToDataUrl(blob), tag: "sample", sample: true };
    })().catch(() => null));
  }
  return sampleCache.get(path);
}

// reference image row. Default: the image chosen here before, else ref.prefer (an id stored by an earlier
// unit, e.g. its final pick), else the newest image whose tag is in ref.from, else ref.sample.
function refPicker(b, ctx, key, onChange) {
  const node = el(`<div class="refrow"><div class="ref-thumb"></div><div class="ref-meta"><b>${esc(b.ref.label)}</b>
      <small class="ref-sub"></small><div class="ref-btns"><button class="btn sm ghost pickRef">다른 사진 고르기</button>
      <label class="btn sm ghost">직접 올리기<input type="file" accept="image/*" hidden></label></div></div></div>`);
  let current = null;
  async function show() {
    let img = null;
    for (const id of [store.get(key), b.ref.prefer && store.get(b.ref.prefer)]) {
      if (!img && id) img = await store.getImage(id);
    }
    if (!img) img = (await store.listImages((x) => b.ref.from.includes(x.tag)))[0] || null;
    if (!img && b.ref.sample) img = await sampleImage(b.ref.sample);
    const changed = (current && current.id) !== (img && img.id);
    current = img;
    node.querySelector(".ref-thumb").innerHTML = img ? `<img src="${img.dataUrl}" alt="">` : '<div class="ref-empty">없음</div>';
    node.querySelector(".ref-sub").textContent = !img ? "앞 스텝에서 사진을 먼저 만들어 주세요."
      : img.sample ? "예시 사진 (앞 유닛을 건너뛴 경우). 내 사진이 있으면 '다른 사진 고르기'로 바꿔 주세요."
      : `${TAG_NAMES[img.tag] || ""} · ${modelName(img.model) || "직접 올린 사진"}`;
    if (changed && onChange) onChange(img);
  }
  node.querySelector(".pickRef").onclick = () => pickImage(b.ref.from.concat("upload"), async (img) => { store.set(key, img.id); await show(); });
  node.querySelector("input[type=file]").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = await store.saveImage({ dataUrl: await fileToDataUrl(f), tag: "upload", level: LEVEL.id, unit: ctx.unit.id, note: f.name });
    store.set(key, img.id); await show(); refreshGalleryCount();
  };
  show();
  return { node, current: async () => { await show(); return current; } };
}

function genStatus(node) {
  let t0 = 0, timer = null;
  return {
    start(text) {
      t0 = Date.now(); node.className = "status busy";
      const tick = () => { node.innerHTML = `<span class="spin"></span>${text} ${Math.round((Date.now() - t0) / 1000)}초`; };
      tick(); timer = setInterval(tick, 500);
    },
    done(text) { clearInterval(timer); node.className = "status ok"; node.textContent = text; },
    fail(text) { clearInterval(timer); node.className = "status err"; node.textContent = text; },
  };
}

function generatorBlock(b, ctx) {
  const pkey = k(ctx, "gen", b.id, "prompt");
  const exkey = `${LEVEL.id}:ex:${b.id}`;          // which example the participant started from (read by later steps)
  let recommended = null;
  if (b.pairFrom) {
    const pex = store.get(`${LEVEL.id}:ex:${b.pairFrom}`);
    recommended = pex && pex.pair;
  }
  const node = el(`<div class="card gen"><h3>${esc(b.title)}</h3>${b.hint ? `<p class="hint">${esc(b.hint)}</p>` : ""}
    <div class="exs">${b.examples.map((ex, i) => `<button class="ex ${recommended && ex.key === recommended ? "rec" : ""}" data-i="${i}">
        ${esc(ex.label)}${ex.pairLabel ? `<small>→ ${esc(ex.pairLabel)}</small>` : ""}${recommended && ex.key === recommended ? "<em>내 인물과 어울려요</em>" : ""}</button>`).join("")}</div>
    <div class="slot-ref"></div>
    <textarea class="prompt" rows="5" placeholder="예시를 누르거나 직접 써 보세요"></textarea>
    <div class="row"><div class="slot-models"></div></div>
    <div class="row between"><div class="slot-aspect"></div>
      <div class="gobox"><span class="status"></span><button class="btn primary go">이미지 만들기</button></div></div>
    <div class="results"></div></div>`);
  const ta = node.querySelector(".prompt");
  let saved = store.get(pkey, "");
  if (!saved && recommended) {
    const rec = b.examples.find((ex) => ex.key === recommended);
    if (rec) { saved = rec.prompt; store.set(pkey, saved); }
  }
  ta.value = saved;
  ta.oninput = () => store.set(pkey, ta.value);
  node.querySelectorAll(".ex").forEach((btn) => (btn.onclick = () => {
    const ex = b.examples[+btn.dataset.i];
    ta.value = ex.prompt; store.set(pkey, ex.prompt);
    store.set(exkey, { label: ex.label, pair: ex.pair || ex.key || null });
    node.querySelectorAll(".ex").forEach((x) => x.classList.toggle("on", x === btn));
  }));
  const ref = b.ref ? refPicker(b, ctx, k(ctx, "gen", b.id, "ref")) : null;
  if (ref) node.querySelector(".slot-ref").appendChild(ref.node);
  const model = modelPicker(k(ctx, "gen", b.id, "model"));
  node.querySelector(".slot-models").appendChild(model.node);
  const aspect = aspectPicker(k(ctx, "gen", b.id, "aspect"), b.aspects, b.aspect);
  node.querySelector(".slot-aspect").appendChild(aspect.node);
  const results = node.querySelector(".results");
  const status = genStatus(node.querySelector(".status"));
  const showResults = async () => {
    const imgs = await store.listImages((x) => x.unit === ctx.unit.id && x.gen === b.id);
    results.innerHTML = imgs.length ? "" : '<p class="empty">아직 만든 이미지가 없어요.</p>';
    imgs.forEach((img, i) => results.appendChild(imageCard(img, { big: i === 0, onDelete: showResults })));
  };
  node.querySelector(".go").onclick = async (e) => {
    const btn = e.currentTarget;                 // read before any await: currentTarget is null afterwards
    const prompt = ta.value.trim();
    if (!prompt) return toast("프롬프트를 먼저 써 주세요.");
    const refs = [];
    if (ref) {
      const r = await ref.current();
      if (!r && b.ref.required) return toast("참고 이미지가 없어요. 앞 스텝에서 먼저 만들어 주세요.");
      if (r) refs.push(r.dataUrl);
    }
    btn.disabled = true;
    status.start("만드는 중");
    try {
      const out = await generate({ model: model.value(), prompt, aspect: aspect.value(), references: refs });
      await store.saveImage({ dataUrl: out.image, tag: b.tag, gen: b.id, level: LEVEL.id, unit: ctx.unit.id, step: ctx.step.id,
        model: model.value(), prompt, aspect: aspect.value(), note: out.note || "", ms: out.ms });
      status.done(`완성 · ${Math.round(out.ms / 1000)}초`);
      await showResults(); refreshGalleryCount();
    } catch (err) {
      status.fail(err.message);
    } finally { btn.disabled = false; }
  };
  showResults();
  return node;
}

function abBlock(b, ctx) {
  const node = el(`<div class="card gen ab"><h3>${esc(b.title)}</h3>
    <div class="slot-ref"></div>
    <label class="lbl">기본 문장 <small>A와 B에 똑같이 들어가요</small></label>
    <textarea class="prompt base" rows="2"></textarea>
    <div class="abgrid">${b.slots.map((s) => `
      <div class="abslot" data-s="${s.label}"><div class="ab-h"><span class="abl">${s.label}</span>바꿀 한 줄</div>
        <div class="presets">${s.presets.map((p, i) => `<button class="chip" data-i="${i}">${p.group ? `<small>${esc(p.group)}</small>` : ""}${esc(p.label)}</button>`).join("")}</div>
        <textarea class="prompt line" rows="3"></textarea></div>`).join("")}</div>
    <div class="row"><div class="slot-models"></div></div>
    <div class="row between"><span class="muted small">화면 비율 ${esc(b.aspect)}</span>
      <div class="gobox"><span class="status"></span><button class="btn primary go">A · B 함께 만들기</button></div></div>
    <div class="results ab-results"></div></div>`);
  const baseKey = k(ctx, "ab", b.id, "base");
  const baseTa = node.querySelector(".base");
  baseTa.value = store.get(baseKey, b.base);
  baseTa.oninput = () => store.set(baseKey, baseTa.value);
  b.slots.forEach((s) => {
    const box = node.querySelector(`.abslot[data-s="${s.label}"]`);
    const ta = box.querySelector(".line");
    const key = k(ctx, "ab", b.id, s.label);
    ta.value = store.get(key, s.presets[s.default || 0].text);
    ta.oninput = () => store.set(key, ta.value);
    const mark = () => box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", s.presets[+c.dataset.i].text === ta.value));
    box.querySelectorAll(".chip").forEach((c) => (c.onclick = () => { ta.value = s.presets[+c.dataset.i].text; store.set(key, ta.value); mark(); }));
    mark();
  });
  const ref = refPicker(b, ctx, k(ctx, "ab", b.id, "ref"));
  node.querySelector(".slot-ref").appendChild(ref.node);
  const model = modelPicker(k(ctx, "ab", b.id, "model"));
  node.querySelector(".slot-models").appendChild(model.node);
  const results = node.querySelector(".ab-results");
  const status = genStatus(node.querySelector(".status"));
  const showResults = async () => {
    const imgs = await store.listImages((x) => x.unit === ctx.unit.id && x.gen === b.id);
    const batches = [];
    imgs.forEach((x) => { let g = batches.find((bb) => bb.id === x.batch); if (!g) batches.push((g = { id: x.batch, items: [] })); g.items.push(x); });
    results.innerHTML = batches.length ? "" : '<p class="empty">아직 만든 비교가 없어요.</p>';
    batches.forEach((g, bi) => {
      const row = el(`<div class="abpair ${bi === 0 ? "latest" : ""}"></div>`);
      b.slots.forEach((s) => {
        const img = g.items.find((x) => x.slot === s.label);
        row.appendChild(img ? imageCard(img, { big: bi === 0, label: s.label, onDelete: showResults }) : el(`<div class="imgcard missing"><span>${s.label} 없음</span></div>`));
      });
      results.appendChild(row);
    });
  };
  node.querySelector(".go").onclick = async (e) => {
    const btn = e.currentTarget;                 // read before any await: currentTarget is null afterwards
    const r = await ref.current();
    if (!r) return toast("참고 이미지가 없어요. 앞 스텝에서 먼저 만들어 주세요.");
    const base = baseTa.value.trim();
    const lines = b.slots.map((s) => node.querySelector(`.abslot[data-s="${s.label}"] .line`).value.trim());
    if (lines.some((l) => !l)) return toast("A와 B의 바꿀 한 줄을 모두 채워 주세요.");
    const jobs = b.slots.map((s, i) => ({ slot: s.label, prompt: `${base}\n${lines[i]}` }));
    btn.disabled = true;
    status.start("A와 B를 함께 만드는 중");
    const batch = store.uid();
    const m = model.value();
    const outs = await Promise.allSettled(jobs.map((j) => generate({ model: m, prompt: j.prompt, aspect: b.aspect, references: [r.dataUrl] })));
    let ok = 0, err = "";
    for (let i = 0; i < jobs.length; i++) {
      const o = outs[i];
      if (o.status === "fulfilled") {
        ok++;
        await store.saveImage({ dataUrl: o.value.image, tag: b.tag, gen: b.id, batch, slot: jobs[i].slot, level: LEVEL.id, unit: ctx.unit.id,
          step: ctx.step.id, model: m, prompt: jobs[i].prompt, aspect: b.aspect, note: o.value.note || "", ms: o.value.ms });
      } else err = o.reason.message;
    }
    if (ok === jobs.length) status.done("A와 B 완성");
    else status.fail(ok ? `하나만 완성됐어요: ${err}` : err);
    btn.disabled = false;
    await showResults(); refreshGalleryCount();
  };
  showResults();
  return node;
}

function pickBlock(b, ctx) {
  const node = el(`<div class="card pick"><h3>내 결과물</h3><div class="pick-grid">${b.slots.map((s) => `
      <div class="pslot" data-k="${s.key}"><div class="ps-h"><b>${esc(s.label)}</b><span class="ps-state"></span></div>
        <div class="ps-img"></div>
        <div class="ps-btns"><button class="btn sm ghost choose">이미지함에서 고르기</button>
          <label class="btn sm ghost">직접 올리기<input type="file" accept="image/*" hidden></label>
          <a class="btn sm primary dl" hidden>내려받기</a></div></div>`).join("")}</div></div>`);
  b.slots.forEach((s) => {
    const box = node.querySelector(`.pslot[data-k="${s.key}"]`);
    const key = k(ctx, "pick", b.id, s.key);
    const show = async () => {
      const img = await store.getImage(store.get(key));
      box.querySelector(".ps-img").innerHTML = img ? `<img src="${img.dataUrl}" alt="">` : `<div class="ps-empty">아직 고르지 않았어요</div>`;
      box.querySelector(".ps-state").textContent = img ? "저장됨" : "";
      const dl = box.querySelector(".dl");
      dl.hidden = !img;
      if (img) { dl.href = img.dataUrl; dl.download = fileName(img, `${ctx.unit.code}_${s.label}`); }
    };
    box.querySelector(".choose").onclick = () => pickImage(s.from.concat("upload"), async (img) => { store.set(key, img.id); await show(); });
    box.querySelector("input[type=file]").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const img = await store.saveImage({ dataUrl: await fileToDataUrl(f), tag: "upload", level: LEVEL.id, unit: ctx.unit.id, note: f.name });
      store.set(key, img.id); await show(); refreshGalleryCount();
    };
    show();
  });
  return node;
}

// ---- unit 1-2: blind comparison of the three models -------------------------------------------------------
// One prompt goes to all three models at once. Results are shown as A·B·C in a shuffled order with the model
// names hidden; the participant picks one with a reason, then the names are revealed. The pick is stored at
// lv1:<unit>:pick:<compare id> = {batch, letter, model, image, reason} and read by the stats and summary blocks.
const LETTERS = ["A", "B", "C"];
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pickKeyOf = (unitId, cmpId) => `${LEVEL.id}:${unitId}:pick:${cmpId}`;
const openKeyOf = (unitId, cmpId) => `${LEVEL.id}:${unitId}:cmp:${cmpId}:open`;   // newest batch while still blind

function aspectOfImage(dataUrl, options = ["16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16"]) {
  const ratio = (a) => { const [w, h] = a.split(":").map(Number); return w / h; };
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const r = im.naturalWidth / im.naturalHeight;
      resolve(options.reduce((best, a) => (Math.abs(Math.log(ratio(a) / r)) < Math.abs(Math.log(ratio(best) / r)) ? a : best)));
    };
    im.onerror = () => resolve("16:9");
    im.src = dataUrl;
  });
}

async function refById(id) {
  if (!id) return null;
  return id.startsWith("sample:") ? sampleImage(id.slice(7)) : store.getImage(id);
}

function compareBlock(b, ctx) {
  const pkey = k(ctx, "cmp", b.id, "prompt");
  const akey = k(ctx, "cmp", b.id, "aspect");
  const metaKey = (batch) => k(ctx, "cmp", b.id, "batch", batch);   // {order, prompt, aspect, ref, fails}
  const pickKey = pickKeyOf(ctx.unit.id, b.id);
  const openKey = openKeyOf(ctx.unit.id, b.id);
  let recommended = null;
  if (b.pairFrom) {
    const pex = store.get(`${LEVEL.id}:ex:${b.pairFrom}`);
    recommended = pex && pex.pair;
  }
  const node = el(`<div class="card gen cmp"><h3>${esc(b.title)}</h3>${b.hint ? `<p class="hint">${esc(b.hint)}</p>` : ""}
    <div class="exs">${b.examples.map((ex, i) => `<button class="ex ${recommended && ex.key === recommended ? "rec" : ""}" data-i="${i}">
        ${esc(ex.label)}${b.pairFrom && ex.pairLabel ? `<small>${esc(ex.pairLabel)}</small>` : ex.aspect ? `<small>${esc(ex.aspect)}</small>` : ""}${recommended && ex.key === recommended ? "<em>내 인물과 짝</em>" : ""}</button>`).join("")}</div>
    <div class="slot-ref"></div>
    <textarea class="prompt" rows="4" placeholder="예시를 누르거나 직접 써 보세요"></textarea>
    <div class="row between"><span class="muted small aspect-note"></span>
      <div class="gobox"><span class="status"></span><button class="btn primary go">세 모델로 함께 만들기</button></div></div>
    <div class="cmp-out"></div></div>`);

  // prompt: saved > earlier unit's prompt > recommended pair > first example (when there is no earlier prompt)
  const ta = node.querySelector(".prompt");
  let saved = store.get(pkey, "") || (b.promptFrom ? store.get(b.promptFrom, "") : "");
  if (!saved) {
    const ex = (recommended && b.examples.find((e) => e.key === recommended)) || (!b.promptFrom && b.examples[0]);
    if (ex) { saved = ex.prompt; if (ex.aspect) store.set(akey, ex.aspect); }
  }
  ta.value = saved;
  if (saved) store.set(pkey, saved);
  const markEx = () => node.querySelectorAll(".ex").forEach((x) => x.classList.toggle("on", b.examples[+x.dataset.i].prompt === ta.value));
  ta.oninput = () => { store.set(pkey, ta.value); markEx(); };
  markEx();

  const aspectNote = node.querySelector(".aspect-note");
  const curAspect = () => store.get(akey, b.aspect);
  const showAspect = (a) => { aspectNote.textContent = b.aspect === "ref" ? `화면 비율: 원본에 맞춤${a ? ` (${a})` : ""}` : `화면 비율 ${a}`; };
  if (b.aspect !== "ref") showAspect(curAspect()); else showAspect("");
  node.querySelectorAll(".ex").forEach((btn) => (btn.onclick = () => {
    const ex = b.examples[+btn.dataset.i];
    ta.value = ex.prompt; store.set(pkey, ex.prompt);
    if (ex.aspect) { store.set(akey, ex.aspect); showAspect(ex.aspect); }
    markEx();
  }));

  const ref = b.ref ? refPicker(b, ctx, k(ctx, "cmp", b.id, "ref"), (img) => {
    if (b.aspect === "ref" && img) aspectOfImage(img.dataUrl).then(showAspect);
  }) : null;
  if (ref) node.querySelector(".slot-ref").appendChild(ref.node);

  const status = genStatus(node.querySelector(".status"));
  const out = node.querySelector(".cmp-out");
  const running = new Set();       // letters of the newest batch still generating
  let selected = null, reason = null;

  async function runOne(batch, L, model, r) {
    const meta = store.get(metaKey(batch));
    delete meta.fails[L]; store.set(metaKey(batch), meta);
    running.add(L);
    await renderOut();
    try {
      const res = await generate({ model, prompt: meta.prompt, aspect: meta.aspect, references: r ? [r.dataUrl] : [] });
      await store.saveImage({ dataUrl: res.image, tag: "cmp", gen: b.id, batch, slot: L, level: LEVEL.id, unit: ctx.unit.id,
        step: ctx.step.id, model, prompt: meta.prompt, aspect: meta.aspect, note: res.note || "", ms: res.ms });
    } catch (err) {
      const m2 = store.get(metaKey(batch)); m2.fails[L] = err.message; store.set(metaKey(batch), m2);
    }
    running.delete(L);
    await renderOut(); refreshGalleryCount();
  }

  node.querySelector(".go").onclick = async (e) => {
    const btn = e.currentTarget;                 // read before any await: currentTarget is null afterwards
    const prompt = ta.value.trim();
    if (!prompt) return toast("프롬프트를 먼저 써 주세요.");
    if (running.size) return toast("지금 만드는 비교가 끝난 뒤에 다시 눌러 주세요.");
    let r = null;
    if (ref) {
      r = await ref.current();
      if (!r && b.ref.required) return toast("참고 이미지가 없어요. 앞 유닛에서 먼저 만들어 주세요.");
    }
    const aspect = b.aspect === "ref" ? (r ? await aspectOfImage(r.dataUrl) : "16:9") : curAspect();
    const batch = store.uid();
    const order = shuffle(MODELS.map((m) => m.id));        // letter i -> order[i]
    store.set(metaKey(batch), { order, prompt, aspect, ref: r ? r.id : null, fails: {} });
    store.set(openKey, batch);
    selected = null; reason = null;
    btn.disabled = true;
    status.start("세 모델이 함께 만드는 중");
    await Promise.all(LETTERS.map((L, i) => runOne(batch, L, order[i], r)));
    btn.disabled = false;
    const nf = Object.keys(store.get(metaKey(batch)).fails).length;
    if (!nf) status.done("세 장 완성 · 마음에 드는 한 장을 골라 주세요");
    else status.fail(`${LETTERS.length - nf}장 완성, ${nf}장 실패. 실패한 칸의 '다시 시도'를 눌러 주세요.`);
  };

  async function renderOut() {
    const imgs = await store.listImages((x) => x.unit === ctx.unit.id && x.gen === b.id);
    const batches = [];
    imgs.forEach((x) => { let g = batches.find((bb) => bb.id === x.batch); if (!g) batches.push((g = { id: x.batch, items: [] })); g.items.push(x); });
    const open = store.get(openKey);                 // the newest batch may have no image yet (running or failed)
    if (open && store.get(metaKey(open))) {
      const i = batches.findIndex((g) => g.id === open);
      batches.unshift(i < 0 ? { id: open, items: [] } : batches.splice(i, 1)[0]);
    }
    const frag = document.createDocumentFragment();
    if (!batches.length) frag.appendChild(el('<p class="empty">아직 만든 비교가 없어요.</p>'));
    else {
      frag.appendChild(await latestView(batches[0]));
      if (batches.length > 1) frag.appendChild(olderView(batches.slice(1)));
    }
    out.replaceChildren(frag);
  }

  async function latestView(g) {
    const meta = store.get(metaKey(g.id)) || { order: [], fails: {} };
    const pick = store.get(pickKey);
    const blind = store.get(openKey) === g.id;
    const picked = pick && pick.batch === g.id ? pick : null;
    const refImg = (b.showRef || b.toggleRef) ? await refById(meta.ref) : null;
    const wrap = el(`<div class="cmp-latest"><div class="cmp-grid ${b.showRef && refImg ? "with-ref" : ""}"></div><div class="cmp-panel"></div></div>`);
    const grid = wrap.querySelector(".cmp-grid");
    if (b.showRef && refImg) {
      grid.appendChild(el(`<div class="cmp-cell"><figure class="imgcard orig"><span class="abl on-img wide">원본</span>
        <img src="${refImg.dataUrl}" alt=""><figcaption><span class="muted">참고 이미지</span></figcaption></figure></div>`));
    }
    LETTERS.forEach((L, i) => {
      const img = g.items.find((x) => x.slot === L);
      const model = meta.order[i] || (img && img.model);
      const cell = el(`<div class="cmp-cell" data-l="${L}"></div>`);
      if (img) {
        const mine = picked && picked.letter === L;
        cell.appendChild(imageCard(img, { label: L, blind, onDelete: renderOut,
          cls: `${mine ? "picked" : ""} ${blind && selected === L ? "sel" : ""}` }));
        const btns = el('<div class="cell-btns"></div>');
        if (b.toggleRef && refImg) {
          const t = el('<button class="btn sm ghost toggle-orig">원본과 번갈아 보기</button>');
          t.onclick = () => {
            const im = cell.querySelector("img");
            const showingOrig = t.classList.toggle("on");
            im.src = showingOrig ? refImg.dataUrl : img.dataUrl;
            t.textContent = showingOrig ? "원본 보는 중 · 다시 누르면 결과" : "원본과 번갈아 보기";
          };
          btns.appendChild(t);
        }
        if (!picked) {
          const p = el(`<button class="btn sm ${selected === L ? "primary" : "ghost"} choose">${selected === L ? "고른 카드" : "이걸로 고르기"}</button>`);
          p.onclick = () => { selected = L; renderPanel(wrap, g, meta, blind, picked); markSel(wrap); };
          btns.appendChild(p);
        }
        if (btns.children.length) cell.appendChild(btns);
      } else if (running.has(L)) {
        cell.appendChild(el(`<div class="imgcard pending"><span class="abl on-img">${L}</span><span class="spin"></span><small>만드는 중</small></div>`));
      } else {
        const msg = meta.fails && meta.fails[L];
        const f = el(`<div class="imgcard failed"><span class="abl on-img">${L}</span><b>${msg ? "만들지 못했어요" : "결과가 없어요"}</b>
          <small>${esc(msg || "만드는 도중에 페이지를 떠났을 수 있어요.")}</small><button class="btn sm ghost retry">다시 시도</button></div>`);
        f.querySelector(".retry").onclick = async () => { if (!model) return toast("이 비교는 다시 만들 수 없어요. 새로 만들어 주세요."); runOne(g.id, L, model, await refById(meta.ref)); };
        cell.appendChild(f);
      }
      grid.appendChild(cell);
    });
    renderPanel(wrap, g, meta, blind, picked);
    return wrap;
  }

  function markSel(wrap) {
    wrap.querySelectorAll(".cmp-cell[data-l]").forEach((c) => {
      const on = c.dataset.l === selected;
      const card = c.querySelector(".imgcard"); if (card) card.classList.toggle("sel", on);
      const btn = c.querySelector(".choose");
      if (btn) { btn.className = `btn sm ${on ? "primary" : "ghost"} choose`; btn.textContent = on ? "고른 카드" : "이걸로 고르기"; }
    });
  }

  function renderPanel(wrap, g, meta, blind, picked) {
    const panel = wrap.querySelector(".cmp-panel");
    const has = g.items.length > 0;
    const mapping = `<div class="cmp-map">${LETTERS.map((L, i) => `<span><span class="abl">${L}</span> ${esc(modelName(meta.order[i] || (g.items.find((x) => x.slot === L) || {}).model))}</span>`).join("")}</div>`;
    if (picked) {
      panel.className = "cmp-panel done";
      panel.innerHTML = `<b>내 선택: ${picked.letter} · ${esc(modelName(picked.model))}</b> <span class="muted">· 이유: ${esc(picked.reason)}</span>${mapping}
        <button class="btn sm ghost repick">고른 것 바꾸기</button>`;
      panel.querySelector(".repick").onclick = () => { store.set(pickKey, null); selected = null; reason = null; renderOut(); };
      return;
    }
    if (!has || running.size) { panel.className = "cmp-panel"; panel.innerHTML = ""; return; }
    panel.className = "cmp-panel ask";
    panel.innerHTML = `<b>가장 마음에 드는 한 장은?</b> <span class="muted">카드 아래 '이걸로 고르기'를 누르고, 고른 이유를 하나 골라요.</span>
      <div class="reasons">${b.reasons.map((r) => `<button class="chip ${r === reason ? "on" : ""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      <button class="btn primary reveal" ${selected && reason ? "" : "disabled"}>${blind ? "고르고 이름 공개하기" : "이걸로 고르기"}</button>
      ${blind ? "" : mapping}`;
    panel.querySelectorAll(".chip").forEach((c) => (c.onclick = () => { reason = c.dataset.r; renderPanel(wrap, g, meta, blind, picked); }));
    panel.querySelector(".reveal").onclick = async () => {
      const L = selected, img = g.items.find((x) => x.slot === L);
      if (!img) return toast("카드를 먼저 골라 주세요.");
      store.set(pickKey, { batch: g.id, letter: L, model: img.model, image: img.id, reason, at: Date.now() });
      store.set(openKey, null);
      toast(`${L}는 ${modelName(img.model)}였어요.`);
      selected = null; reason = null;
      await renderOut();
    };
  }

  function olderView(batches) {
    const d = el(`<details class="older"><summary>이전 비교 ${batches.length}개</summary></details>`);
    batches.forEach((g) => {
      const row = el('<div class="older-row"></div>');
      LETTERS.forEach((L) => {
        const img = g.items.find((x) => x.slot === L);
        row.appendChild(img ? imageCard(img, { label: L, onDelete: renderOut }) : el(`<div class="imgcard missing"><span>${L} 없음</span></div>`));
      });
      d.appendChild(row);
    });
    return d;
  }

  if (b.example) node.appendChild(exampleView(b.example));
  renderOut();
  return node;
}

// pre-made comparison by the organisers (names shown), collapsed so it doesn't bias the participant's own pick
function exampleView(ex) {
  const d = el(`<details class="example"><summary>미리 뽑아 둔 예시 비교 보기 <small>${esc(ex.label)}</small></summary>
    <p class="note">운영진이 같은 조건으로 세 모델에서 미리 만든 결과예요. 내 비교에서 먼저 고른 뒤에 열어 보면 좋아요.</p>
    <div class="cmp-grid ${ex.ref ? "with-ref" : ""}">
      ${ex.ref ? `<figure class="imgcard orig"><span class="abl on-img wide">원본</span><img src="${esc(ex.ref)}" alt="" loading="lazy">
        <figcaption><span class="muted">참고 이미지</span></figcaption></figure>` : ""}
      ${MODELS.map((m) => `<figure class="imgcard" data-m="${m.id}"><img src="${esc(ex.images[m.id])}" alt="" loading="lazy">
        <figcaption><span>${esc(m.name)}</span><span class="muted">${ex.seconds && ex.seconds[m.id] ? `${ex.seconds[m.id]}초` : ""}</span></figcaption></figure>`).join("")}
    </div></details>`);
  d.querySelectorAll(".imgcard img").forEach((im) => (im.onclick = () => {
    const m = im.closest(".imgcard").dataset.m;
    lightbox({ dataUrl: im.src, model: m || null }, false);
  }));
  return d;
}

function statsBlock(b, ctx) {
  const node = el(`<div class="card"><h3>모델별 기록</h3><div class="tbl-wrap"><table class="tbl stats">
      <thead><tr><th></th>${MODELS.map((m) => `<th>${esc(m.name)}</th>`).join("")}</tr></thead><tbody></tbody></table></div>
    <p class="note"></p></div>`);
  (async () => {
    const imgs = await store.listImages((x) => x.model && x.ms);
    const real = imgs.filter((x) => !(x.note || "").startsWith("dev"));     // dev stand-ins would skew the times
    const picks = b.picks.map((id) => store.get(pickKeyOf(ctx.unit.id, id))).filter(Boolean);
    const cells = (fn) => MODELS.map((m) => fn(m.id));
    const pickN = (id) => picks.filter((p) => p.model === id).length;
    const top = Math.max(0, ...MODELS.map((m) => pickN(m.id)));
    const rows = [
      ["평균 생성 시간", cells((id) => {
        const xs = real.filter((x) => x.model === id).map((x) => x.ms);
        return xs.length ? `<td>${Math.round(xs.reduce((a, c) => a + c, 0) / xs.length / 1000)}초 <small>(${xs.length}장)</small></td>` : '<td class="muted">—</td>';
      })],
      ["내가 고른 횟수", cells((id) => `<td class="${top && pickN(id) === top ? "top" : ""}">${pickN(id)}번</td>`)],
      ["힉스필드 크레딧 (장당)", cells((id) => (b.credits[id] == null ? '<td class="muted">확인 예정</td>' : `<td>${esc(b.credits[id])}크레딧</td>`))],
    ];
    node.querySelector("tbody").innerHTML = rows.map(([h, tds]) => `<tr><th>${h}</th>${tds.join("")}</tr>`).join("");
    const notes = [];
    if (imgs.length > real.length) notes.push("개발용 대체로 만든 이미지는 시간 계산에서 뺐어요.");
    notes.push(b.checked ? `크레딧은 ${b.checked}에 힉스필드 화면에서 확인한 값이에요.` : "크레딧은 힉스필드 화면에서 확인해 채울 예정이에요.");
    node.querySelector(".note").textContent = notes.join(" ");
  })();
  return node;
}

function summaryBlock(b, ctx) {
  const node = el(`<div class="card summary"><h3>나만의 모델 선택표</h3><div class="sum-rows"></div>
    <div class="sum-default"><b>다음 유닛부터 쓸 기본 모델</b> <span class="muted small rec-note"></span><div class="slot-def"></div>
      <p class="note">고른 모델이 앞으로 이미지를 만들 때 처음부터 선택돼 있어요. 만들 때마다 바꿀 수도 있어요.</p></div>
    <div class="row"><button class="btn primary dl">선택표 이미지로 내려받기</button></div></div>`);
  const stepOf = (cmpId) => ctx.unit.steps.findIndex((s) => s.blocks.some((x) => x.type === "compare" && x.id === cmpId));
  let rows = [];
  (async () => {
    rows = await Promise.all(b.rows.map(async (r) => {
      const p = store.get(pickKeyOf(ctx.unit.id, r.id));
      return { ...r, p, img: p ? await store.getImage(p.image) : null };
    }));
    const host = node.querySelector(".sum-rows");
    rows.forEach((r) => {
      const row = el(`<div class="sum-row"><b>${esc(r.label)}</b>
        <div class="sum-thumb">${r.img ? `<img src="${r.img.dataUrl}" alt="">` : ""}</div>
        <div>${r.p ? `<b>${esc(modelName(r.p.model))}</b><div class="muted small">이유: ${esc(r.p.reason)}</div>`
          : `<span class="muted">아직 고르지 않았어요</span> <button class="btn sm ghost goto">스텝 ${stepOf(r.id) + 1}로 가기</button>`}</div></div>`);
      const goto = row.querySelector(".goto");
      if (goto) goto.onclick = () => go(ctx.unit.id, stepOf(r.id));
      host.appendChild(row);
    });
    const count = (id) => rows.filter((r) => r.p && r.p.model === id).length;
    const best = MODELS.slice().sort((a, c) => count(c.id) - count(a.id))[0];
    if (count(best.id)) node.querySelector(".rec-note").textContent = `· 가장 많이 고른 모델: ${best.name} (${count(best.id)}번)`;
    const cur = store.get(DEFAULT_MODEL_KEY);
    const def = el(`<div class="models">${MODELS.map((m) => `
      <label class="model ${m.id === cur ? "on" : ""}"><input type="radio" name="defmodel" value="${m.id}" ${m.id === cur ? "checked" : ""}>
        <b>${esc(m.name)}</b><small>${esc(m.maker)} · 고른 횟수 ${count(m.id)}번</small></label>`).join("")}</div>`);
    def.querySelectorAll("input").forEach((inp) => (inp.onchange = () => {
      store.set(DEFAULT_MODEL_KEY, inp.value);
      def.querySelectorAll(".model").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
      toast(`기본 모델을 ${modelName(inp.value)}로 정했어요.`);
    }));
    node.querySelector(".slot-def").appendChild(def);
  })();
  node.querySelector(".dl").onclick = async () => {
    const url = await summaryPng(rows, store.get(DEFAULT_MODEL_KEY));
    const a = document.createElement("a");
    a.href = url; a.download = `${ctx.unit.code}_모델선택표.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  return node;
}

function loadImg(src) {
  return new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
}

// the selection table as a PNG the participant keeps
async function summaryPng(rows, defModel) {
  try { await document.fonts.ready; } catch { /* ignore */ }
  const F = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const W = 1200, rowH = 190, top = 170, H = top + rows.length * rowH + 110;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const box = (x, y, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); };
  box(0, 0, W, H, 0, "#f6f7f6");
  g.fillStyle = "#2f7d3a"; g.font = `700 22px ${F}`; g.fillText("AI로 나만의 3D 영상 · Lv.1 · 1-2 이미지 모델 비교하기", 48, 64);
  g.fillStyle = "#1b1f1b"; g.font = `800 46px ${F}`; g.fillText("나만의 모델 선택표", 48, 124);
  const d = new Date();
  g.fillStyle = "#6c736c"; g.font = `500 20px ${F}`; g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, W - 160, 124);
  for (const [i, r] of rows.entries()) {
    const y = top + i * rowH;
    box(40, y, W - 80, rowH - 20, 18, "#ffffff");
    g.fillStyle = "#1b1f1b"; g.font = `800 30px ${F}`; g.fillText(r.label, 76, y + 96);
    const im = r.img && (await loadImg(r.img.dataUrl));
    if (im) {
      const s = 140, k2 = Math.max(s / im.width, s / im.height), sw = s / k2, sh = s / k2;
      g.save(); g.beginPath(); g.roundRect ? g.roundRect(290, y + 15, s, s, 12) : g.rect(290, y + 15, s, s); g.clip();
      g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 290, y + 15, s, s); g.restore();
    }
    g.fillStyle = r.p ? "#23602c" : "#a3a8a3"; g.font = `800 34px ${F}`;
    g.fillText(r.p ? modelName(r.p.model) : "아직 고르지 않음", 470, y + 80);
    if (r.p) { g.fillStyle = "#6c736c"; g.font = `500 24px ${F}`; g.fillText(`이유: ${r.p.reason}`, 470, y + 122); }
  }
  g.fillStyle = "#1b1f1b"; g.font = `700 28px ${F}`;
  g.fillText(`기본 모델: ${defModel ? modelName(defModel) : "아직 정하지 않음"}`, 48, H - 48);
  return c.toDataURL("image/png");
}

// ---- images: cards, picker, gallery, lightbox ---------------------------------------------------------------
function fileName(img, stem) {
  const ext = (img.dataUrl.match(/^data:image\/(\w+)/) || [, "png"])[1].replace("jpeg", "jpg");
  return `${stem}_${modelName(img.model).replace(/\s+/g, "") || "upload"}.${ext}`;
}

// blind: model name hidden everywhere (caption, zoom, download file name) until the participant picks
function imageCard(img, { big = false, label = "", onDelete, blind = false, extra = "", cls = "" } = {}) {
  const t = new Date(img.createdAt);
  const who = blind ? '<span class="muted">모델은 고른 뒤에 공개돼요</span>'
    : `${esc(modelName(img.model) || "직접 올린 사진")}${img.note && img.note.startsWith("dev") ? ' <em class="devtag">개발용 대체</em>' : ""}`;
  const dlName = blind ? `${TAG_NAMES[img.tag] || "image"}_${label || "x"}.${(img.dataUrl.match(/^data:image\/(\w+)/) || [, "png"])[1].replace("jpeg", "jpg")}`
    : fileName(img, TAG_NAMES[img.tag] || "image");
  const node = el(`<figure class="imgcard ${big ? "big" : ""} ${cls}">${label ? `<span class="abl on-img">${label}</span>` : ""}
    <img src="${img.dataUrl}" alt="" loading="lazy">
    <figcaption><span>${who}${extra}</span>
      <span class="muted">${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}</span></figcaption>
    <div class="ic-btns"><button class="ic zoom" title="크게 보기">⤢</button><a class="ic" title="내려받기" href="${img.dataUrl}" download="${esc(dlName)}">↓</a>
      ${img.prompt ? '<button class="ic info" title="프롬프트 보기">i</button>' : ""}<button class="ic del" title="지우기">×</button></div></figure>`);
  node.querySelector(".zoom").onclick = () => lightbox(img, false, blind);
  node.querySelector("img").onclick = () => lightbox(img, false, blind);
  if (node.querySelector(".info")) node.querySelector(".info").onclick = () => lightbox(img, true, blind);
  node.querySelector(".del").onclick = async () => { if (confirm("이 이미지를 지울까요?")) { await store.deleteImage(img.id); onDelete && onDelete(); refreshGalleryCount(); } };
  return node;
}

function modal(html) {
  const m = el(`<div class="modal"><div class="modal-box">${html}</div></div>`);
  m.onclick = (e) => { if (e.target === m || e.target.closest(".mclose")) m.remove(); };
  document.body.appendChild(m);
  return m;
}

function lightbox(img, withPrompt = false, blind = false) {
  const who = blind ? "모델은 고른 뒤에 공개돼요" : modelName(img.model) || "직접 올린 사진";
  modal(`<button class="mclose">×</button><img class="lb-img" src="${img.dataUrl}" alt="">
    ${withPrompt || img.prompt ? `<div class="lb-meta"><b>${esc(who)}</b>${img.prompt ? `<pre>${esc(img.prompt)}</pre>` : ""}</div>` : ""}`).classList.add("lb");
}

async function pickImage(tags, onPick) {
  const imgs = await store.listImages((x) => tags.includes(x.tag));
  const m = modal(`<button class="mclose">×</button><h3>사진 고르기</h3>
    ${imgs.length ? `<div class="pick-list">${imgs.map((x) => `<button class="pk" data-id="${x.id}"><img src="${x.dataUrl}" alt=""><small>${esc(TAG_NAMES[x.tag] || "")} · ${esc(modelName(x.model) || "올린 사진")}</small></button>`).join("")}</div>`
      : '<p class="empty">고를 수 있는 사진이 아직 없어요.</p>'}`);
  m.querySelectorAll(".pk").forEach((p) => (p.onclick = () => { onPick(imgs.find((x) => x.id === p.dataset.id)); m.remove(); }));
}

async function openGallery() {
  const imgs = await store.listImages();
  const groups = ["person", "place", "style", "mood", "cmp", "upload"].map((t) => ({ t, items: imgs.filter((x) => x.tag === t) })).filter((g) => g.items.length);
  const m = modal(`<button class="mclose">×</button><h3>내 이미지함 <small class="muted">${imgs.length}장</small></h3>
    ${groups.length ? groups.map((g) => `<h4>${TAG_NAMES[g.t]}</h4><div class="gal-grid" data-t="${g.t}"></div>`).join("") : '<p class="empty">아직 만든 이미지가 없어요.</p>'}`);
  m.querySelector(".modal-box").classList.add("wide");
  groups.forEach((g) => {
    const grid = m.querySelector(`.gal-grid[data-t="${g.t}"]`);
    g.items.forEach((img) => grid.appendChild(imageCard(img, {
      blind: img.tag === "cmp" && store.get(openKeyOf(img.unit, img.gen)) === img.batch,   // not picked yet: no peeking
      label: img.tag === "cmp" ? img.slot : "",
      onDelete: () => { m.remove(); openGallery(); render(); } })));
  });
}

function refreshGalleryCount() { store.listImages().then((all) => { const c = $("#galCount"); if (c) c.textContent = all.length || ""; }); }

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
}

function toast(text) {
  const t = el(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3200);
}

// ---- boot ------------------------------------------------------------------------------------------------
window.addEventListener("hashchange", () => { readRoute(); render(); });
await loadConfig();
readRoute();
render();
