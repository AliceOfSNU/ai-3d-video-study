"""Local dev server for the study pages: static files + the image-generation API the pages call.

    python server.py [PORT]          -> http://localhost:8010/

API (the contract CoworkCrew implements with its own keys when this is ported):
    GET  /api/config                 -> {"mode": "live"|"dev-openai"|"mock", "label": "..."}
    POST /api/images/generate        {"model": "seedream_5_5"|"gpt_image_2_6"|"nano_banana_2_1",
                                      "prompt": str, "aspect_ratio": "2:3"|"16:9"|..., "references": [dataURL, ...]}
                                     -> 202 {"job": id, "status": "running"}   (returns at once)
    GET  /api/images/jobs/<id>       -> {"status": "running"}
                                      | {"status": "done", "image": dataURL, "model", "provider", "note", "ms"}
                                      | {"status": "error", "error": "참가자에게 보여줄 메시지"}
    Generation takes 15-90 s. Holding one request open that long fails on phones (Safari drops the connection
    when the tab goes to the background, then the finished image is lost), so the page polls a job instead.

Before CoworkCrew's keys are connected, each model goes to the provider we have a key for (STUDY_IMAGE_PROVIDER):
    openai (default when OPENAI_API_KEY is set):
           GPT Image 2.6   -> OpenAI gpt-image-2.6-sunburst (real)
           Nano Banana 2.1 -> Gemini gemini-nano-banana-2.1 (real, when GEMINI_API_KEY is set)
           Seedream 5.5    -> BytePlus ModelArk dola-seedream-5-5-261028 (real, when ARK_API_KEY is set and the model
                              is activated in the Ark console). Higgsfield's public REST API has no Seedream route.
           A provider that refuses for account reasons (not activated, quota) is skipped for 10 min and the model
           is stood in by GPT Image 2.6; the response says so (note "dev: ..."), so the page shows a "dev substitute" tag;
    mock:  no network, returns a placeholder SVG after a short delay (free UI testing).
Keys are read from the environment / dance/.env and never printed or sent to the browser.
"""
import base64
import hmac
import http.server
import threading
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
# env file: $STUDY_ENV_FILE, else <site>/../.env (server: /opt/aistudy/.env), else dance/.env (local checkout)
ENV = Path(os.environ["STUDY_ENV_FILE"]) if os.environ.get("STUDY_ENV_FILE") else next(
    (p for p in (HERE.parent / ".env", HERE.parents[1] / ".env") if p.exists()), HERE.parents[1] / ".env")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
MODELS = {"seedream_5_5": "Seedream 5.5", "gpt_image_2_6": "GPT Image 2.6", "nano_banana_2_1": "Nano Banana 2.1"}
# GPT Image 2.6 (Sunburst = the variant Higgsfield lists as gpt_image_2_6). It is the real model for "gpt_image_2_6"
# and the local stand-in for the two models we have no key for.
OPENAI_MODEL = os.environ.get("STUDY_OPENAI_MODEL", "gpt-image-2.6-sunburst")
REAL_ON_OPENAI = {"gpt_image_2_6"}
GEMINI_MODEL = os.environ.get("STUDY_GEMINI_MODEL", "gemini-nano-banana-2.1")   # Nano Banana 2.1
SEEDREAM_MODEL = os.environ.get("STUDY_SEEDREAM_MODEL", "dola-seedream-5-5-261028")      # Seedream 5.5 (ModelArk)
ARK_BASE = os.environ.get("STUDY_ARK_BASE", "https://ark.ap-southeast.bytepluses.com/api/v3")
GEMINI_ASPECTS = {"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"}


def load_env():
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


load_env()
PROVIDER = os.environ.get("STUDY_IMAGE_PROVIDER") or ("openai" if os.environ.get("OPENAI_API_KEY") else "mock")
HOST = os.environ.get("STUDY_HOST", "127.0.0.1")              # 0.0.0.0 on the server
BASIC_AUTH = os.environ.get("STUDY_BASIC_AUTH", "")            # "id:password" -> whole site behind HTTP Basic auth
PER_IP_HOUR = int(os.environ.get("STUDY_GEN_PER_IP_HOUR", "60"))
PER_DAY = int(os.environ.get("STUDY_GEN_PER_DAY", "500"))
_gen_log, _gen_lock = [], threading.Lock()                     # (time, ip) of accepted generations
JOB_TTL = 1800                                                 # finished jobs are kept 30 min for polling
_jobs, _jobs_lock = {}, threading.Lock()                       # id -> {"status", "t", ...result}


def rate_limited(ip):
    """Cap generations per IP per hour and overall per day, so a public URL cannot drain the API key."""
    now = time.time()
    with _gen_lock:
        _gen_log[:] = [(t, i) for t, i in _gen_log if now - t < 86400]
        if len(_gen_log) >= PER_DAY:
            return "오늘 생성 한도에 도달했어요. 운영진에게 알려주세요."
        if sum(1 for t, i in _gen_log if i == ip and now - t < 3600) >= PER_IP_HOUR:
            return "한 시간 생성 한도에 도달했어요. 잠시 후 다시 시도해 주세요."
        _gen_log.append((now, ip))
    return None


def openai_size(aspect):
    try:
        w, h = (float(x) for x in aspect.split(":"))
    except Exception:
        return "1024x1024"
    if abs(w - h) < 1e-6:
        return "1024x1024"
    return "1536x1024" if w > h else "1024x1536"


def multipart(fields, files):
    boundary = uuid.uuid4().hex
    out = b""
    for name, value in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, filename, ctype, data in files:
        out += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n").encode() + data + b"\r\n"
    return out + f"--{boundary}--\r\n".encode(), boundary


def data_url_bytes(url):
    m = re.match(r"data:([\w/+.-]+);base64,(.*)$", url, re.S)
    if not m:
        raise ValueError("reference is not a base64 data URL")
    return m.group(1), base64.b64decode(m.group(2))


def gen_openai(model, prompt, aspect, refs):
    key = os.environ["OPENAI_API_KEY"]
    fields = {"model": OPENAI_MODEL, "prompt": prompt, "size": openai_size(aspect), "quality": "medium", "n": "1"}
    if refs:
        files = []
        for i, r in enumerate(refs[:4]):
            ctype, data = data_url_bytes(r)
            ext = {"image/jpeg": "jpg", "image/webp": "webp"}.get(ctype, "png")
            files.append(("image[]", f"ref{i}.{ext}", ctype, data))
        body, boundary = multipart(fields, files)
        req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}",
                                              "Content-Type": f"multipart/form-data; boundary={boundary}"})
    else:
        fields["n"] = 1
        req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(fields).encode(),
                                     method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        res = json.loads(r.read())
    b64 = res["data"][0]["b64_json"]
    note = "" if model in REAL_ON_OPENAI else f"dev: {MODELS[model]} 대신 GPT Image 2.6로 생성"
    return f"data:image/png;base64,{b64}", note


def gen_gemini(model, prompt, aspect, refs):
    """Nano Banana 2.1 through the Gemini API: reference images go in as inline parts before the text."""
    parts = []
    for r in refs[:4]:
        ctype, data = data_url_bytes(r)
        parts.append({"inline_data": {"mime_type": ctype, "data": base64.b64encode(data).decode()}})
    parts.append({"text": prompt})
    cfg = {"responseModalities": ["IMAGE"], "imageConfig": {"imageSize": "1K"}}
    if aspect in GEMINI_ASPECTS:
        cfg["imageConfig"]["aspectRatio"] = aspect
    body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": cfg}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        res = json.loads(r.read())
    cand = (res.get("candidates") or [{}])[0]
    for part in (cand.get("content") or {}).get("parts", []):
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            return f"data:{inline.get('mimeType') or inline.get('mime_type') or 'image/png'};base64,{inline['data']}", ""
    # no image: blocked by safety or the model answered in text
    reason = cand.get("finishReason") or (res.get("promptFeedback") or {}).get("blockReason") or "no image"
    raise RuntimeError(f"Nano Banana가 이미지를 돌려주지 않았어요 ({reason}). 프롬프트를 조금 바꿔 다시 시도해 주세요.")


def seedream_size(aspect):
    """WxH of about 1.57 MP (like the others' 1024x1536), inside Seedream 5.5's cheapest tier (0.92-2.6 MP)."""
    try:
        w, h = (float(x) for x in aspect.split(":"))
    except Exception:
        w, h = 1.0, 1.0
    W = (1536 * 1024 * w / h) ** 0.5
    return f"{int(round(W / 16) * 16)}x{int(round(W * h / w / 16) * 16)}"


def gen_seedream(model, prompt, aspect, refs):
    """Seedream 5.5 through BytePlus ModelArk (OpenAI-style /images/generations); references go in `image`."""
    # 5.5 rejects the 4.x option `sequential_image_generation` (400), so it is not sent
    body = {"model": SEEDREAM_MODEL, "prompt": prompt, "size": seedream_size(aspect), "response_format": "b64_json",
            "watermark": False}
    if refs:
        body["image"] = refs[0] if len(refs) == 1 else refs[:10]
    req = urllib.request.Request(f"{ARK_BASE}/images/generations", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {os.environ['ARK_API_KEY']}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        res = json.loads(r.read())
    item = (res.get("data") or [{}])[0]
    if item.get("b64_json"):
        b64 = item["b64_json"]
        mime = "image/png" if b64.startswith("iVBOR") else "image/jpeg" if b64.startswith("/9j/") else "image/webp"
        return f"data:{mime};base64,{b64}", ""
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=120) as r:
            data, mime = r.read(), r.headers.get_content_type()
        return f"data:{mime};base64,{base64.b64encode(data).decode()}", ""
    raise RuntimeError(f"Seedream이 이미지를 돌려주지 않았어요 ({(item.get('error') or {}).get('message', 'no image')}).")


# Providers that refuse for account reasons (model not activated, quota, billing) are skipped for 10 minutes and the
# model is stood in by GPT Image 2.6 (tagged as a dev substitute), so a missing activation never breaks a session.
_off_until = {"gemini": 0.0, "seedream": 0.0}
FALLBACK = {}   # filled below: backend fn -> (name, HTTP codes that mean "account not ready")


def ready(name, key_var):
    return bool(os.environ.get(key_var)) and time.time() >= _off_until[name]


def backend(model):
    if PROVIDER == "mock":
        return gen_mock
    if model == "nano_banana_2_1" and ready("gemini", "GEMINI_API_KEY"):
        return gen_gemini
    if model == "seedream_5_5" and ready("seedream", "ARK_API_KEY"):
        return gen_seedream
    return gen_openai


def generate(model, prompt, aspect, refs):
    fn = backend(model)
    try:
        return fn, *fn(model, prompt, aspect, refs)
    except urllib.error.HTTPError as e:
        if fn not in FALLBACK or e.code not in FALLBACK[fn][1]:
            raise
        name = FALLBACK[fn][0]
        _off_until[name] = time.time() + 600
        sys.stderr.write(f"{name} HTTP {e.code}: {MODELS[model]} falls back to GPT Image 2.6 for 10 min\n")
        return gen_openai, *gen_openai(model, prompt, aspect, refs)


FALLBACK.update({gen_gemini: ("gemini", (403, 429)),                 # free-tier key: no image quota
                 gen_seedream: ("seedream", (401, 402, 403, 404, 429))})   # 404 ModelNotOpen: not activated


def probe_seedream():
    """Free check at startup: an empty prompt is rejected before generation, with 404 ModelNotOpen when the model
    is not activated on the account (then Seedream starts on the stand-in, and the banner says so)."""
    if PROVIDER == "mock" or not os.environ.get("ARK_API_KEY"):
        return
    req = urllib.request.Request(f"{ARK_BASE}/images/generations", method="POST",
                                 data=json.dumps({"model": SEEDREAM_MODEL, "prompt": ""}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['ARK_API_KEY']}",
                                          "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code in FALLBACK[gen_seedream][1]:
            _off_until["seedream"] = time.time() + 600
            sys.stderr.write(f"seedream probe: HTTP {e.code}, using the stand-in for now\n")
    except Exception as e:  # noqa: BLE001  (network trouble: leave it to the first real request)
        sys.stderr.write(f"seedream probe failed: {type(e).__name__}\n")


def error_message(e):
    if isinstance(e, urllib.error.HTTPError):
        detail = e.read().decode(errors="replace")
        msg = (json.loads(detail).get("error", {}) or {}).get("message", "") if detail.startswith("{") else detail[:200]
        return f"생성 서버 오류 ({e.code}): {msg[:300]}"
    return f"생성에 실패했어요: {type(e).__name__}: {str(e)[:200]}"


def run_job(job_id, model, prompt, aspect, refs):
    t0 = time.time()
    try:
        fn, image, note = generate(model, prompt, aspect, refs)
        provider = {gen_gemini: "gemini", gen_seedream: "byteplus", gen_openai: "openai", gen_mock: "mock"}[fn]
        res = {"status": "done", "image": image, "model": model, "provider": provider, "note": note,
               "ms": int((time.time() - t0) * 1000)}
    except Exception as e:  # noqa: BLE001
        res = {"status": "error", "error": error_message(e)}
    sys.stderr.write(f"job {job_id[:8]} {model} refs={len(refs)} {res['status']} {time.time() - t0:.1f}s\n")
    with _jobs_lock:
        _jobs[job_id].update(res, t=time.time())


def start_job(model, prompt, aspect, refs):
    job_id = uuid.uuid4().hex
    with _jobs_lock:
        now = time.time()
        for k in [k for k, j in _jobs.items() if j["status"] != "running" and now - j["t"] > JOB_TTL]:
            del _jobs[k]
        _jobs[job_id] = {"status": "running", "t": now}
    threading.Thread(target=run_job, args=(job_id, model, prompt, aspect, refs), daemon=True).start()
    return job_id


def dev_label():
    if PROVIDER == "mock":
        return "목업 모드: 실제 이미지 대신 자리표시 이미지를 돌려줘요 (비용 0)."
    real = [MODELS[m] for m in MODELS if backend(m) in (gen_gemini, gen_seedream) or m in REAL_ON_OPENAI]
    sub = [MODELS[m] for m in MODELS if MODELS[m] not in real]

    def topic(names):  # 은/는 by how the last digit is read: 영 일 삼 육 칠 팔 end in a consonant
        return "·".join(names) + ("은" if names[-1][-1] in "013678" else "는")
    label = "코워크크루 키를 연결하기 전이에요. " + topic(real) + " 실제 모델로 생성"
    return label + ("되고, " + topic(sub) + " GPT Image 2.6으로 대체 생성돼요." if sub else "돼요.")


def gen_mock(model, prompt, aspect, refs):
    time.sleep(1.5)
    try:
        w, h = (float(x) for x in aspect.split(":"))
    except Exception:
        w, h = 1, 1
    W = 768
    H = int(W * h / w)
    hue = random.randint(0, 360)
    words = re.sub(r"\s+", " ", prompt)[:90]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},45%,78%)"/>
<stop offset="1" stop-color="hsl({(hue + 50) % 360},45%,58%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="32" y="64" font-family="sans-serif" font-size="34" font-weight="700" fill="#fff">{MODELS[model]} (mock)</text>
<text x="32" y="108" font-family="sans-serif" font-size="20" fill="#fff">{aspect} · refs {len(refs)}</text>
<foreignObject x="32" y="130" width="{W - 64}" height="{H - 160}"><div xmlns="http://www.w3.org/1999/xhtml"
style="font:20px sans-serif;color:#fff;line-height:1.5">{words}…</div></foreignObject></svg>"""
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode(), "dev: mock"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def log_message(self, fmt, *args):
        # only API calls are logged; args[0] is not always the request line (send_error passes an int code)
        # job polls (every 2 s) are skipped; run_job logs each job's outcome instead
        if args and isinstance(args[0], str) and "/api/" in args[0] and "/api/images/jobs/" not in args[0]:
            sys.stderr.write("%s\n" % (fmt % args))

    def authorized(self):
        if not BASIC_AUTH:
            return True
        got = self.headers.get("Authorization", "")
        want = "Basic " + base64.b64encode(BASIC_AUTH.encode()).decode()
        if hmac.compare_digest(got, want):
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="AI study", charset="UTF-8"')
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def end_headers(self):
        # always revalidate, so a redeploy reaches browsers without a hard refresh (304 when unchanged)
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_HEAD(self):
        if self.authorized():
            super().do_HEAD()

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        try:
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            sys.stderr.write(f"client went away before {self.path} response ({code})\n")

    def do_GET(self):
        if not self.authorized():
            return
        if self.path.startswith("/api/config"):
            return self.send_json(200, {"mode": {"openai": "dev-openai", "mock": "mock"}.get(PROVIDER, "live"),
                                        "label": dev_label()})
        if self.path.startswith("/api/images/jobs/"):
            job_id = self.path.rsplit("/", 1)[-1].split("?")[0]
            with _jobs_lock:
                job = dict(_jobs.get(job_id) or {})
            if not job:
                return self.send_json(404, {"status": "error", "error": "생성 작업을 찾지 못했어요. 다시 생성해 주세요."})
            job.pop("t", None)
            return self.send_json(200, job)
        return super().do_GET()

    def do_POST(self):
        if not self.authorized():
            return
        if not self.path.startswith("/api/images/generate"):
            return self.send_json(404, {"error": "not found"})
        limited = rate_limited(self.client_address[0])
        if limited:
            return self.send_json(429, {"error": limited})
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n) or b"{}")
            model, prompt = req.get("model"), (req.get("prompt") or "").strip()
            aspect, refs = req.get("aspect_ratio") or "1:1", req.get("references") or []
            if model not in MODELS:
                return self.send_json(400, {"error": "알 수 없는 모델이에요."})
            if not prompt:
                return self.send_json(400, {"error": "프롬프트가 비어 있어요."})
            for r in refs:
                data_url_bytes(r)          # reject a bad reference now, not in the background
        except Exception as e:  # noqa: BLE001
            return self.send_json(400, {"error": f"요청을 읽지 못했어요: {type(e).__name__}: {str(e)[:200]}"})
        return self.send_json(202, {"job": start_job(model, prompt, aspect, refs), "status": "running"})


if __name__ == "__main__":
    probe_seedream()
    srv = http.server.ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"study site: http://{HOST}:{PORT}/   (image provider: {PROVIDER}, "
          f"nano banana: {'gemini' if backend('nano_banana_2_1') is gen_gemini else 'stand-in'}, "
          f"seedream: {'byteplus' if backend('seedream_5_5') is gen_seedream else 'stand-in'}, auth: {'on' if BASIC_AUTH else 'off'}, "
          f"limits: {PER_IP_HOUR}/ip/hour, {PER_DAY}/day)", flush=True)
    srv.serve_forever()
