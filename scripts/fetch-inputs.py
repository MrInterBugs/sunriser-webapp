#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Aedan Lawrence (original contributions).
# Part of the modern frontend adapted from the SunRiser project and its workflows.
# Upstream: https://github.com/LEDaquaristik/sunriser
# Frontend adaptation (2026); see LICENSING.md and LICENSE.
"""Download and verify the build inputs this repository does not store, then build.

1. The vendor NEW.BEE (URL and SHA-256 in scripts/vendor.json).
2. The Pexels theme photographs (scripts/fetch-theme-photos.py), encoded with the
   reference Pillow version in a local virtual environment (.venv-photos).

With --build it then runs npm ci --ignore-scripts, npm run build and npm test, and
prints the checksum of build/NEW.BEE. Nothing is uploaded or installed on a device.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.request
import venv

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def vendor():
    info = json.loads((ROOT / 'scripts/vendor.json').read_text())
    path = ROOT / 'NEW.BEE'
    if path.is_file():
        if sha(path.read_bytes()) != info['sha256']:
            raise SystemExit(f"Root NEW.BEE is not the expected vendor v{info['version']} input; "
                             'move it aside and rerun. It was not overwritten.')
        print(f"Vendor v{info['version']} NEW.BEE present and verified.")
        return
    print(f"Downloading vendor v{info['version']} NEW.BEE: {info['url']}", flush=True)
    with urllib.request.urlopen(info['url'], timeout=300) as response:
        data = response.read()
    if sha(data) != info['sha256']:
        raise SystemExit(f"Downloaded NEW.BEE SHA-256 {sha(data)} does not match {info['sha256']}; nothing kept.")
    partial = ROOT / 'NEW.BEE.download'
    partial.write_bytes(data)
    os.replace(partial, path)
    print('Vendor NEW.BEE verified.')


def pillow():
    """Python with the Pillow version that produced the reference photographs."""
    manifest = next((ROOT / 'assets/photo/themes').glob('*/manifest.json'))
    encoder = json.loads(manifest.read_text())['modifications']['encoder']
    version = re.fullmatch(r'Pillow (\S+)', encoder).group(1)
    environment = ROOT / '.venv-photos'
    python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        venv.create(environment, with_pip=True)
    installed = subprocess.run([python, '-c', 'import PIL; print(PIL.__version__)'],
                               capture_output=True, text=True).stdout.strip()
    if installed != version:
        print(f'Installing Pillow {version} into .venv-photos', flush=True)
        subprocess.run([python, '-m', 'pip', 'install', '--quiet', '--disable-pip-version-check',
                        f'pillow=={version}'], check=True)
    return python


def build():
    npm = shutil.which('npm') or sys.exit('npm is required to build.')
    for command in [[npm, 'ci', '--ignore-scripts'], [npm, 'run', 'build'], [npm, 'test']]:
        subprocess.run(command, cwd=ROOT, check=True)
    print('Built ' + (ROOT / 'build/SHA256SUMS').read_text().strip())


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--build', action='store_true', help='Then install dependencies, build and test.')
    args = parser.parse_args()
    vendor()
    subprocess.run([pillow(), str(ROOT / 'scripts/fetch-theme-photos.py')], check=True)
    if args.build:
        build()


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode or 1)
