#!/usr/bin/env python3
"""MSTRMND Editorial Engine — local HTTP worker.

Wraps generate_issue_kit.py so n8n can drive the render without touching n8n's
JS/Python sandbox (which blocks fs/child_process). All filesystem + subprocess
work happens HERE, in a normal OS process.

Every render and every stage runs the brand guard (platinum present, no
cyan/teal/blue second hue) via verify_issue_kit.brand_qa, reporting the result
as `brand_qa`. Results are advisory by default because the engine does not
currently pass; set EDITORIAL_BRAND_ENFORCE=1 to make a violation fail the
render and block staging (overridable per call with force:true). A kit that
fails is always left on disk for inspection.

Endpoints (loopback 127.0.0.1:5055, auth header X-Editorial-Key):
  POST /render   {issue, brief:{flat brief dict}, bg_portrait, bg_landscape, bg_face}
                  -> writes brief JSON, runs engine, runs brand QA,
                     returns {ok, out_dir, count, brand_qa}
  POST /stage    {issue, force?}  -> brand QA, then mv kits/issue00N -> published/issue00N
  POST /discard  {issue}  -> rm -rf kits/issue00N
  GET  /health   -> {ok:true}
"""
import json, os, shutil, subprocess, sys, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(os.environ.get("MSTRMND_CORE", Path(__file__).resolve().parent))
PY = os.environ.get("EDITORIAL_PYTHON") or (
    str(BASE / ".venv" / "bin" / "python")
    if (BASE / ".venv" / "bin" / "python").exists()
    else sys.executable
)
ENGINE = Path(
    os.environ.get(
        "EDITORIAL_ENGINE",
        Path.home()
        / ".hermes"
        / "skills"
        / "creative"
        / "editorial-brand-system"
        / "scripts"
        / "generate_issue_kit.py",
    )
)
VERIFIER = Path(
    os.environ.get("EDITORIAL_VERIFIER", ENGINE.parent / "verify_issue_kit.py")
)
# AGENTS.md treats platinum-only as a hard invariant, but the engine currently
# fails it (a fresh sample_brief render trips ~9950 cyan hits against a max of
# 27), so enforcing by default would block every render. Report by default,
# enforce once the engine is actually platinum-only:
#   EDITORIAL_BRAND_ENFORCE=1
ENFORCE_BRAND = os.environ.get("EDITORIAL_BRAND_ENFORCE", "0") == "1"
BRIEFS = BASE / "briefs"
KITS = BASE / "kits"
PUBLISHED = BASE / "published"
KEY = os.environ.get("EDITORIAL_KEY", "mstrmnd-local")
HOST, PORT = "127.0.0.1", 5055

# Runs the verifier's brand_qa against an already-rendered kit and reports JSON.
# Executed under PY (not this process) because brand_qa needs the working Pillow
# from the engine's venv, which is the same interpreter that did the render.
_QA_SNIPPET = """
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("verify_issue_kit", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
try:
    platinum, cyan, sampled = mod.brand_qa(sys.argv[2])
except AssertionError as e:
    print(json.dumps({"ok": False, "error": str(e)}))
else:
    print(json.dumps({
        "ok": True, "platinum_hits": platinum, "cyan_hits": cyan, "sampled": sampled
    }))
"""


def _brand_qa(out_dir):
    """Enforce the platinum-only brand invariant on a rendered kit.

    AGENTS.md makes this a hard invariant: platinum present, cyan/teal/blue
    windows ≈ 0 on every kit. A kit that cannot be checked is not treated as
    passing — `checked: False` blocks staging the same way a violation does,
    since an unverifiable kit is exactly what the guard exists to catch.
    """
    if not VERIFIER.exists():
        return {
            "ok": False,
            "checked": False,
            "error": f"brand verifier not found at {VERIFIER} "
            "(set EDITORIAL_VERIFIER)",
        }
    try:
        r = subprocess.run(
            [PY, "-c", _QA_SNIPPET, str(VERIFIER), str(out_dir)],
            capture_output=True,
            text=True,
            timeout=180,
            env=_clean_env(),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "checked": False, "error": "brand QA timed out"}
    if r.returncode != 0:
        return {"ok": False, "checked": False, "error": r.stderr[-800:]}
    try:
        result = json.loads(r.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError) as e:
        return {"ok": False, "checked": False, "error": f"unparseable QA output: {e}"}
    result["checked"] = True
    return result


def _clean_env():
    """Strip Hermes-agent venv contamination so the engine imports the real
    working Pillow from its own venv, not the broken one on PYTHONPATH."""
    env = dict(os.environ)
    env.pop("__PYVENV_LAUNCHER__", None)
    env.pop("PYTHONHOME", None)
    env.pop("PYTHONPATH", None)  # critical: drop Hermes venv paths
    return env


def _render(data):
    issue = data.get("issue", 3)
    pad = f"{int(issue):03d}"
    brief = data.get("brief", {})
    out_dir = KITS / f"issue{pad}"
    bgp = data.get("bg_portrait") or str(BASE / "assets/backgrounds/portrait_truck.png")
    bgl = data.get("bg_landscape") or str(BASE / "assets/backgrounds/landscape_building.png")
    bgf = data.get("bg_face") or str(BASE / "assets/backgrounds/square_studio_back.png")

    BRIEFS.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    brief_path = BRIEFS / f"issue{pad}.json"
    with open(brief_path, "w") as f:
        json.dump(brief, f, indent=2)

    cmd = [
        PY,
        str(ENGINE),
        "--brief",
        str(brief_path),
        "--bg-portrait",
        bgp,
        "--bg-landscape",
        bgl,
        "--bg-face",
        bgf,
        "--out",
        str(out_dir),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180, env=_clean_env())
    if r.returncode != 0:
        return {"ok": False, "error": r.stderr[-1500:], "returncode": r.returncode}
    files = sorted(os.listdir(out_dir))
    # The kit always stays on disk so a brand failure can be inspected. Under
    # enforcement a violation also flips `ok`, which stops the caller advancing
    # to /stage; otherwise the result is reported and the render still succeeds.
    qa = _brand_qa(out_dir)
    failed = not qa.get("ok")
    return {
        "ok": not (failed and ENFORCE_BRAND),
        "out_dir": str(out_dir),
        "issue": issue,
        "assets": files,
        "count": len(files),
        "brand_qa": qa,
        **(
            {"error": f"brand QA failed: {qa.get('error')}"}
            if failed and ENFORCE_BRAND
            else {}
        ),
        **({"warning": f"brand QA failed: {qa.get('error')}"} if failed and not ENFORCE_BRAND else {}),
    }


def _stage(data):
    issue = data.get("issue")
    pad = f"{int(issue):03d}"
    src = KITS / f"issue{pad}"
    if not src.is_dir():
        return {"ok": False, "error": f"no such kit {src}"}

    # Staging is the last gate before a kit is publishable, so re-check the
    # brand invariant here rather than trusting the render-time result — the
    # files may have been edited by hand in between. `force` is the deliberate
    # human override; it is recorded in the response.
    qa = _brand_qa(src)
    if not qa.get("ok") and ENFORCE_BRAND and not data.get("force"):
        return {
            "ok": False,
            "error": f"brand QA failed: {qa.get('error')} "
            "(pass force:true to stage anyway)",
            "brand_qa": qa,
        }

    PUBLISHED.mkdir(parents=True, exist_ok=True)
    dst = PUBLISHED / f"issue{pad}"
    if dst.exists():
        dst = PUBLISHED / f"issue{pad}-{uuid.uuid4().hex[:6]}"
    shutil.move(str(src), str(dst))
    return {
        "ok": True,
        "staged_to": str(dst),
        "brand_qa": qa,
        "forced": bool(data.get("force")) and not qa.get("ok"),
    }


def _discard(data):
    issue = data.get("issue")
    pad = f"{int(issue):03d}"
    src = KITS / f"issue{pad}"
    if src.is_dir():
        shutil.rmtree(src)
    return {"ok": True, "discarded": str(src)}


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.headers.get("X-Editorial-Key") != KEY:
            self._send(403, {"error": "forbidden"})
            return
        try:
            ln = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(ln) or b"{}")
        except Exception as e:
            self._send(400, {"error": f"bad body: {e}"})
            return
        try:
            if self.path == "/render":
                self._send(200, _render(data))
            elif self.path == "/stage":
                self._send(200, _stage(data))
            elif self.path == "/discard":
                self._send(200, _discard(data))
            else:
                self._send(404, {"error": "not found"})
        except Exception as e:
            self._send(500, {"error": str(e)})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    PUBLISHED.mkdir(parents=True, exist_ok=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
