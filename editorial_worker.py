#!/usr/bin/env python3
"""MSTRMND Editorial Engine — local HTTP worker.

Wraps generate_issue_kit.py so n8n can drive the render without touching n8n's
JS/Python sandbox (which blocks fs/child_process). All filesystem + subprocess
work happens HERE, in a normal OS process.

Endpoints (loopback 127.0.0.1:5055, auth header X-Editorial-Key):
  POST /render   {issue, brief:{flat brief dict}, bg_portrait, bg_landscape, bg_face}
                  -> writes brief JSON, runs engine, returns {ok, out_dir, count}
  POST /stage    {issue}  -> mv kits/issue00N -> published/issue00N
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
BRIEFS = BASE / "briefs"
KITS = BASE / "kits"
PUBLISHED = BASE / "published"
KEY = os.environ.get("EDITORIAL_KEY", "mstrmnd-local")
HOST, PORT = "127.0.0.1", 5055


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
    return {
        "ok": True,
        "out_dir": str(out_dir),
        "issue": issue,
        "assets": files,
        "count": len(files),
    }


def _stage(data):
    issue = data.get("issue")
    pad = f"{int(issue):03d}"
    src = KITS / f"issue{pad}"
    if not src.is_dir():
        return {"ok": False, "error": f"no such kit {src}"}
    PUBLISHED.mkdir(parents=True, exist_ok=True)
    dst = PUBLISHED / f"issue{pad}"
    if dst.exists():
        dst = PUBLISHED / f"issue{pad}-{uuid.uuid4().hex[:6]}"
    shutil.move(str(src), str(dst))
    return {"ok": True, "staged_to": str(dst)}


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
