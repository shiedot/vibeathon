#!/usr/bin/env python3
"""
Sync .env to Vercel (vibeathon). Skips overwriting Production/Preview DATABASE_URL
when .env points at localhost (local Cloud SQL proxy).
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
PROJECT_ID = "prj_wHATTins0RNXk735dasktTYzcCA0"
TEAM_ID = "team_U0gQbtNaGO0QqexleIUK0Wmq"
PRODUCTION_URL = "https://vibeathon-alpha.vercel.app"
LOCAL_URL = "http://localhost:3000"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def get_token() -> str:
    auth = Path.home() / "Library/Application Support/com.vercel.cli/auth.json"
    return str(json.loads(auth.read_text(encoding="utf-8"))["token"])


def api_json(method: str, url: str, token: str, body: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def resolve_value(
    key: str,
    targets: list[str],
    env: dict[str, str],
) -> str | None:
    """Return new value or None to skip PATCH."""
    if key in ("AUTH_URL", "NEXTAUTH_URL"):
        ts = set(targets)
        if ts == {"development"}:
            return LOCAL_URL
        return PRODUCTION_URL

    if key == "DATABASE_URL":
        local = env.get("DATABASE_URL", "")
        if "127.0.0.1" in local or "localhost" in local:
            if set(targets) & {"production", "preview"}:
                return None
        return env.get("DATABASE_URL")

    return env.get(key)


def main() -> int:
    env = load_env(ENV_FILE)
    token = get_token()

    list_url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env?teamId={TEAM_ID}"
    req = urllib.request.Request(list_url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        listing = json.loads(resp.read().decode("utf-8"))
    entries: list[dict] = listing.get("envs", [])

    for e in entries:
        eid = e["id"]
        key = e["key"]
        targets = e.get("target") or []
        typ = e.get("type") or "encrypted"

        if key not in env and key not in ("AUTH_URL", "NEXTAUTH_URL"):
            continue

        new_val = resolve_value(key, targets, env)
        if new_val is None:
            print(f"skip {key} {targets}", file=sys.stderr)
            continue

        url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env/{eid}?teamId={TEAM_ID}"
        # Do not send `key` — Vercel rejects PATCH on sensitive vars if key is present.
        body = {"value": new_val, "type": typ, "target": targets}
        try:
            api_json("PATCH", url, token, body)
            print(f"ok PATCH {key} {targets}")
        except urllib.error.HTTPError as err:
            print(f"FAIL {key}: {err.read().decode()}", file=sys.stderr)

    # Ensure NEXTAUTH_URL exists (mirror AUTH_URL) for tooling that still reads it
    have_nextauth = any(e["key"] == "NEXTAUTH_URL" for e in entries)
    if not have_nextauth and "NEXTAUTH_URL" in env:
        create_url = f"https://api.vercel.com/v10/projects/{PROJECT_ID}/env?teamId={TEAM_ID}"
        for t in ("production", "preview"):
            body = {
                "key": "NEXTAUTH_URL",
                "value": PRODUCTION_URL,
                "type": "encrypted",
                "target": [t],
            }
            try:
                api_json("POST", create_url, token, body)
                print(f"ok POST NEXTAUTH_URL [{t}]")
            except urllib.error.HTTPError as err:
                print(f"POST NEXTAUTH_URL {t}: {err.read().decode()}", file=sys.stderr)
        body = {
            "key": "NEXTAUTH_URL",
            "value": LOCAL_URL,
            "type": "encrypted",
            "target": ["development"],
        }
        try:
            api_json("POST", create_url, token, body)
            print("ok POST NEXTAUTH_URL [development]")
        except urllib.error.HTTPError as err:
            print(f"POST NEXTAUTH_URL dev: {err.read().decode()}", file=sys.stderr)

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
