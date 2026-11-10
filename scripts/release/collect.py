"""Collect versioned release assets; Linux portable is the extracted, dependency-bundled AppImage."""
import json, os, shutil, subprocess, sys, tarfile
from pathlib import Path
root=Path(__file__).resolve().parents[2];os.chdir(root)
version=json.loads(Path('package.json').read_text())['version'];out=Path('release-assets');out.mkdir(exist_ok=True)
platform=sys.argv[1]
def single(pattern):
    paths=list(Path('src-tauri/target/release/bundle').glob(pattern))
    if len(paths)!=1:raise SystemExit(f'Expected one {pattern}, got {paths}')
    return paths[0]
if platform=='linux':
    image=single('appimage/*.AppImage');deb=single('deb/*.deb')
    shutil.copy2(deb,out/f'verso_{version}_amd64.deb')
    stage=Path(os.environ['RUNNER_TEMP'])/'verso-appimage-extract';stage.mkdir(exist_ok=True)
    subprocess.run([str(image.resolve()),'--appimage-extract'],cwd=stage,check=True,stdout=subprocess.DEVNULL)
    appdir=stage/'squashfs-root'
    # Tauri only copies usr/ from its custom files, dropping root-level hooks.
    # Install our relocatable font hook into the final AppDir and rebuild its
    # SquashFS while retaining the original unsigned Type-2 AppImage runtime.
    hook=appdir/'apprun-hooks/verso-fonts.sh'
    shutil.copy2('packaging/fonts/verso-fonts.sh',hook)
    hook.chmod(0o755)
    offset=int(subprocess.check_output([str(image.resolve()),'--appimage-offset'],text=True).strip())
    squashfs=stage/'verso.squashfs'
    subprocess.run(['mksquashfs',str(appdir),str(squashfs),'-noappend','-all-root','-no-progress'],check=True)
    rebuilt=out/f'Verso-{version}-x86_64.AppImage'
    with image.open('rb') as original, rebuilt.open('wb') as target:
        runtime=original.read(offset)
        if len(runtime)!=offset:raise SystemExit('Invalid AppImage runtime offset')
        target.write(runtime)
        with squashfs.open('rb') as filesystem:shutil.copyfileobj(filesystem,target)
    rebuilt.chmod(0o755)
    required=['libfontconfig.so.1','libfreetype.so.6','libharfbuzz.so.0','libwebkit2gtk-4.1.so*','libjavascriptcoregtk-4.1.so*','WebKitWebProcess','WebKitNetworkProcess','libgstapp.so','libgstplayback.so','libgstaudioconvert.so','libgstflac.so']
    for name in required:
        if not list(appdir.rglob(name)):raise SystemExit(f'AppImage lacks required dependency: {name}')
    if not any(list(appdir.rglob(name)) for name in ['libgstmpg123.so','libgstlibav.so']):raise SystemExit('AppImage lacks MP3 decoder')
    if not any(list(appdir.rglob(name)) for name in ['libgstfaad.so','libgstlibav.so','libgstfdkaac.so']):raise SystemExit('AppImage lacks AAC decoder')
    portable=stage/'verso-linux-x86_64';portable.mkdir(exist_ok=True);shutil.copytree(appdir,portable/'AppDir',symlinks=True)
    launcher=portable/'Verso';launcher.write_text('#!/bin/sh\nset -eu\nVERSO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$VERSO_DIR/AppDir/AppRun" "$@"\n');launcher.chmod(0o755)
    shutil.copy2('docs/RELEASE_PREPARATION.md',portable/'README.md')
    with tarfile.open(out/f'verso-{version}-linux-x86_64-portable.tar.gz','w:gz') as archive:archive.add(portable,arcname=portable.name)
    Path('artifacts').mkdir(exist_ok=True)
    Path('artifacts/appimage-file-list.txt').write_text('\n'.join(str(p.relative_to(appdir)) for p in appdir.rglob('*'))+'\n')
    # Store exact binary path for packaged WebDriver tests.
    with open(os.environ['GITHUB_ENV'],'a') as env:env.write(f'APPDIR={appdir}\n')
elif platform=='windows':
    shutil.copy2(single('msi/*.msi'),out/f'Verso-{version}-x64.msi')
    shutil.copy2('src-tauri/target/release/verso.exe',out/f'Verso-{version}-x64-portable.exe')
else:raise SystemExit('Expected linux or windows')
print('\n'.join(str(p) for p in out.iterdir()))
