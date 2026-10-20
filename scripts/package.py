# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Aedan Lawrence (original contributions).
# Part of the modern frontend adapted from the SunRiser project and its workflows.
# Upstream: https://github.com/LEDaquaristik/sunriser
# Frontend adaptation (2026); see LICENSING.md and LICENSE.
# Third-party material retains its own terms.

"""Package the modern website with unchanged original v1.007 C firmware."""
import hashlib
import json
from pathlib import Path
import sys

from bee import records, cdb_make, mp_encode, gzip_bytes

ROOT = Path(__file__).resolve().parents[1]
VENDOR = json.loads((ROOT / "scripts/vendor.json").read_text())


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_vendor():
    path = ROOT / "NEW.BEE"
    if not path.is_file():
        raise ValueError(
            f"Missing root NEW.BEE. Download {VENDOR['url']}, verify SHA-256 "
            f"{VENDOR['sha256']}, and place it in the repository root."
        )
    data = path.read_bytes()
    actual = sha(data)
    if actual != VENDOR["sha256"]:
        raise ValueError(
            f"Root NEW.BEE SHA-256 mismatch: expected {VENDOR['sha256']} "
            f"(vendor v{VENDOR['version']}), got {actual}. "
            "No package generated; do not bypass the check for a newer release."
        )
    return data


def package():
    retained = [(key, value) for _, key, value in records(load_vendor())
                if not key.startswith(b"web#")]
    dist = ROOT / "dist"
    if not (dist / "index.html").is_file() or not (dist / "notices.html").is_file():
        raise ValueError("Build the website before packaging")

    pairs = retained.copy()
    assets = []
    for path in sorted(dist.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlink in distribution: {path}")
        if not path.is_file():
            continue
        name = path.relative_to(dist).as_posix()
        if not name.isascii() or "#" in name or len("/" + name) > 48:
            raise ValueError(f"Asset path exceeds firmware constraints: {name}")
        if path.suffix not in {".html", ".js", ".css", ".avif", ".webp"}:
            raise ValueError(f"Unsupported asset type: {name}")
        data = path.read_bytes()
        compressed = path.suffix not in {".avif", ".webp"}
        body = gzip_bytes(data) if compressed else data
        for field, value in [
            ("bytes", len(data)), ("gzip", compressed),
            ("content", body), ("deleted", False),
        ]:
            pairs.append((f"web#{name}#{field}".encode(), mp_encode(value)))
        assets.append({
            "path": name, "bytes": len(data), "stored_bytes": len(body),
            "gzip": compressed, "sha256": sha(data),
        })
    output = cdb_make(pairs)
    if [(k, v) for _, k, v in records(output) if not k.startswith(b"web#")] != retained:
        raise ValueError("Packaging changed original firmware records")
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    (build / "NEW.BEE").write_bytes(output)
    (build / "SHA256SUMS").write_text(f"{sha(output)}  NEW.BEE\n")
    (build / "package.json").write_text(json.dumps({
        "firmware_version": VENDOR["version"],
        "firmware": "Original vendor v1.007 firmware images, unchanged",
        "vendor_package_sha256": VENDOR["sha256"],
        "package_sha256": sha(output),
        "non_web_records": len(retained), "assets": assets,
    }, indent=2) + "\n")
    print(f"build/NEW.BEE: {sha(output)} ({len(output)} bytes)")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--check-input"]:
            print(f"Verified root NEW.BEE: {sha(load_vendor())} (vendor v{VENDOR['version']})")
        elif not sys.argv[1:]:
            package()
        else:
            raise ValueError("Usage: python3 scripts/package.py [--check-input]")
    except ValueError as error:
        sys.exit(str(error))
