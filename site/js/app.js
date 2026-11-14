// Study page renderer. Reads a LEVEL (content/*.js) and draws: header + progress, unit sidebar,
// step tabs, the step's blocks, prev/next. All participant state goes through store.js.
import { LEVEL, MODELS } from "../content/lv1.js";
import * as store from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TAG_NAMES = { person: "인물", place: "장소", style: "스타일", mood: "분위기", upload: "올린 사진" };
const modelName = (id) => (MODELS.find((m) => m.id === id) || {}).name || id || "";

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
    if (last) { renderHeader(); renderSidebar(); renderMain(); toast("유닛 1을 마쳤어요. 다음 유닛은 준비 중이에요."); }
    else go(unit.id, route.step + 1);
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

  generator: (b, ctx) => generatorBlock(b, ctx),
  ab: (b, ctx) => abBlock(b, ctx),
  pick: (b, ctx) => pickBlock(b, ctx),
};

// model + aspect controls shared by generator and ab
function modelPicker(key) {
  const cur = store.get(key, MODELS[0].id);
  const node = el(`<div class="models">${MODELS.map((m) => `
      <label class="model ${m.id === cur ? "on" : ""}"><input type="radio" name="${key}" value="${m.id}" ${m.id === cur ? "checked" : ""}>
        <b>${esc(m.name)}</b><small>${esc(m.maker)} · ${esc(m.note)}</small></label>`).join("")}</div>`);
  node.querySelectorAll("input").forEach((r) => (r.onchange = () => {
    store.set(key, r.value);
    node.querySelectorAll(".model").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
  }));
  return { node, value: () => store.get(key, MODELS[0].id) };
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

// reference image row: default = newest image whose tag is in ref.from
function refPicker(b, ctx, key) {
  const node = el(`<div class="refrow"><div class="ref-thumb"></div><div class="ref-meta"><b>${esc(b.ref.label)}</b>
      <small class="ref-sub"></small><div class="ref-btns"><button class="btn sm ghost pickRef">다른 사진 고르기</button>
      <label class="btn sm ghost">직접 올리기<input type="file" accept="image/*" hidden></label></div></div></div>`);
  let current = null;
  async function show() {
    const id = store.get(key);
    let img = id && (await store.getImage(id));
    if (!img) img = (await store.listImages((x) => b.ref.from.includes(x.tag)))[0] || null;
    current = img;
    node.querySelector(".ref-thumb").innerHTML = img ? `<img src="${img.dataUrl}" alt="">` : '<div class="ref-empty">없음</div>';
    node.querySelector(".ref-sub").textContent = img
      ? `${TAG_NAMES[img.tag] || ""} · ${modelName(img.model) || "직접 올린 사진"}`
      : "앞 스텝에서 사진을 먼저 만들어 주세요.";
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
        model: model.value(), prompt, aspect: aspect.value(), note: out.note || "" });
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
          step: ctx.step.id, model: m, prompt: jobs[i].prompt, aspect: b.aspect, note: o.value.note || "" });
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

// ---- images: cards, picker, gallery, lightbox ---------------------------------------------------------------
function fileName(img, stem) {
  const ext = (img.dataUrl.match(/^data:image\/(\w+)/) || [, "png"])[1].replace("jpeg", "jpg");
  return `${stem}_${modelName(img.model).replace(/\s+/g, "") || "upload"}.${ext}`;
}

function imageCard(img, { big = false, label = "", onDelete } = {}) {
  const t = new Date(img.createdAt);
  const node = el(`<figure class="imgcard ${big ? "big" : ""}">${label ? `<span class="abl on-img">${label}</span>` : ""}
    <img src="${img.dataUrl}" alt="" loading="lazy">
    <figcaption><span>${esc(modelName(img.model) || "직접 올린 사진")}${img.note && img.note.startsWith("dev") ? ' <em class="devtag">개발용 대체</em>' : ""}</span>
      <span class="muted">${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}</span></figcaption>
    <div class="ic-btns"><button class="ic zoom" title="크게 보기">⤢</button><a class="ic" title="내려받기" href="${img.dataUrl}" download="${esc(fileName(img, TAG_NAMES[img.tag] || "image"))}">↓</a>
      ${img.prompt ? '<button class="ic info" title="프롬프트 보기">i</button>' : ""}<button class="ic del" title="지우기">×</button></div></figure>`);
  node.querySelector(".zoom").onclick = () => lightbox(img);
  node.querySelector("img").onclick = () => lightbox(img);
  if (node.querySelector(".info")) node.querySelector(".info").onclick = () => lightbox(img, true);
  node.querySelector(".del").onclick = async () => { if (confirm("이 이미지를 지울까요?")) { await store.deleteImage(img.id); onDelete && onDelete(); refreshGalleryCount(); } };
  return node;
}

function modal(html) {
  const m = el(`<div class="modal"><div class="modal-box">${html}</div></div>`);
  m.onclick = (e) => { if (e.target === m || e.target.closest(".mclose")) m.remove(); };
  document.body.appendChild(m);
  return m;
}

function lightbox(img, withPrompt = false) {
  modal(`<button class="mclose">×</button><img class="lb-img" src="${img.dataUrl}" alt="">
    ${withPrompt || img.prompt ? `<div class="lb-meta"><b>${esc(modelName(img.model) || "직접 올린 사진")}</b>${img.prompt ? `<pre>${esc(img.prompt)}</pre>` : ""}</div>` : ""}`).classList.add("lb");
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
  const groups = ["person", "place", "style", "mood", "upload"].map((t) => ({ t, items: imgs.filter((x) => x.tag === t) })).filter((g) => g.items.length);
  const m = modal(`<button class="mclose">×</button><h3>내 이미지함 <small class="muted">${imgs.length}장</small></h3>
    ${groups.length ? groups.map((g) => `<h4>${TAG_NAMES[g.t]}</h4><div class="gal-grid" data-t="${g.t}"></div>`).join("") : '<p class="empty">아직 만든 이미지가 없어요.</p>'}`);
  m.querySelector(".modal-box").classList.add("wide");
  groups.forEach((g) => {
    const grid = m.querySelector(`.gal-grid[data-t="${g.t}"]`);
    g.items.forEach((img) => grid.appendChild(imageCard(img, { onDelete: () => { m.remove(); openGallery(); render(); } })));
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
