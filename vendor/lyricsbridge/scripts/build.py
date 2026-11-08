"""Build local native and Node bindings. Requires cargo and a C linker."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
build = root / 'build'
build.mkdir(exist_ok=True)
env = os.environ.copy()
# Keep feature variants apart: native libraries must not depend on Node symbols.
for node in (False, True):
    target = root / 'target' / ('node' if node else 'native')
    command = ['cargo', 'build', '--locked', '--release', '--target-dir', str(target)]
    if node:
        command += ['--features', 'node']
    subprocess.run(command, cwd=root, env=env, check=True)
    suffix = '.dll' if sys.platform == 'win32' else '.dylib' if sys.platform == 'darwin' else '.so'
    filename = ('lyricsbridge' if sys.platform == 'win32' else 'liblyricsbridge') + suffix
    destination = build / ('lyricsbridge.node' if node else filename)
    shutil.copy2(target / 'release' / filename, destination)
    print(destination)
