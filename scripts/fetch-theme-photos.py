#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Aedan Lawrence (original contributions).
# Part of the modern frontend adapted from the SunRiser project and its workflows.
# Upstream: https://github.com/LEDaquaristik/sunriser
# Frontend adaptation (2026); see LICENSING.md and LICENSE.
# Third-party material retains its own terms.
"""Download Pexels-licensed theme photographs and rebuild their derivatives.

Public repositories do not store these photographs. Each record in
assets/photo/themes/*/manifest.json gives the original URL and SHA-256, the crops and
the encoder settings. This script downloads each original from Pexels (used under the
Pexels Licence by whoever runs it), verifies it, and writes the derivatives listed in
the manifest. Reports whether each file is byte-identical to the reference build.
Building needs Pillow with AVIF support; the reference encoder is in each manifest.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PEXELS = 'Pexels Licence'


def records(root, everything=False):
    """Theme manifests whose photographs are fetched at build time."""
    for path in sorted((root / 'assets/photo/themes').glob('*/manifest.json')):
        manifest = json.loads(path.read_text())
        if everything or manifest['original']['licence'] == PEXELS:
            yield manifest


def missing(root, everything=False):
    return [asset['path'] for manifest in records(root, everything)
            for asset in manifest['assets'] if not (root / asset['path']).is_file()]


def original(manifest, cache):
    expected = manifest['original']['sha256']
    cached = cache / f'{expected}.jpg'
    if cached.is_file() and hashlib.sha256(cached.read_bytes()).hexdigest() == expected:
        return cached.read_bytes()
    url = manifest['original']['original_url']
    print(f"Downloading {manifest['theme']} photograph by {manifest['original']['author']}: {url}", flush=True)
    request = urllib.request.Request(url, headers={'User-Agent': 'SunRiser-webapp theme photograph fetch'})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"{manifest['theme']}: downloaded original SHA-256 {actual} does not match the "
                         f'recorded {expected}; nothing written. The photograph may have changed at its source.')
    cache.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(data)
    return data


def build(root, cache, force=False, everything=False):
    from PIL import Image, ImageOps, features, __version__ as pillow
    if not features.check('avif'):
        raise ValueError(f'Pillow {pillow} lacks AVIF support; install Pillow 11.2 or newer.')
    identical, different = 0, []
    for manifest in records(root, everything):
        wanted = [a for a in manifest['assets'] if force or not (root / a['path']).is_file()]
        if not wanted:
            continue
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(original(manifest, cache)))).convert('RGB')
        settings = manifest['modifications']
        for asset in wanted:
            crop = ImageOps.fit(image.crop(tuple(asset['source_crop'])), (asset['width'], asset['height']),
                                Image.Resampling.LANCZOS)
            kind = asset['file'].rsplit('.', 1)[1]
            options = settings['AVIF'] if kind == 'avif' else settings['WebP']
            buffer = io.BytesIO()
            crop.save(buffer, kind.upper(), **options)
            data = buffer.getvalue()
            path = root / asset['path']
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            if hashlib.sha256(data).hexdigest() == asset['sha256']:
                identical += 1
            else:
                different.append(asset['path'])
    print(f'Theme photographs: {identical} byte-identical to the reference build.')
    if different:
        print(f'{len(different)} re-encoded with Pillow {pillow} differ from the reference bytes '
              f"({settings.get('encoder', 'unrecorded encoder')}); they show the same crops:\n  "
              + '\n  '.join(different))
    return different


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true', help='Only report missing files; exit 1 if any.')
    parser.add_argument('--force', action='store_true', help='Rebuild files that already exist.')
    parser.add_argument('--all', action='store_true', help='Include theme photographs stored in Git.')
    parser.add_argument('--root', type=Path, default=ROOT, help='Project root (default: this project).')
    parser.add_argument('--cache', type=Path, help='Downloaded originals (default: build/theme-photo-originals).')
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        absent = missing(root, args.all)
        if args.check:
            if absent:
                print('Missing theme photographs; run npm run fetch (or scripts/fetch-theme-photos.py):\n  '
                      + '\n  '.join(absent), file=sys.stderr)
                return 1
            print('Theme photographs present.')
            return 0
        build(root, args.cache or root / 'build/theme-photo-originals', args.force, args.all)
        return 0
    except (ValueError, OSError, KeyError) as error:
        print(f'Theme photograph fetch failed: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
