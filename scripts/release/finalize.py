"""Require all six variants, checksum every asset and record build/CI provenance."""
import hashlib,json,os
from pathlib import Path
version=json.loads(Path('package.json').read_text())['version'];out=Path('release-assets')
expected=[f'verso-{version}-linux-x86_64-portable.tar.gz',f'Verso-{version}-x86_64.AppImage',f'verso_{version}_amd64.deb',f'verso-{version}-x86_64.flatpak',f'Verso-{version}-x64.msi',f'Verso-{version}-x64-portable.exe']
assets=[]
for name in expected:
 p=out/name
 if not p.is_file() or p.stat().st_size<1024:raise SystemExit(f'Missing/empty release asset: {name}')
 digest=hashlib.sha256(p.read_bytes()).hexdigest();assets.append({'name':name,'bytes':p.stat().st_size,'sha256':digest})
manifest={'version':version,'source_commit':os.environ['GITHUB_SHA'],'ci_commit':os.environ['CI_SHA'],'ci_run':os.environ['CI_RUN_ID'],'release_build_run':os.environ['GITHUB_RUN_ID'],'architecture':'x86_64','published':False,'signed':False,'assets':assets}
(out/'BUILD-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'RELEASE_NOTES.md').write_text(Path('docs/RELEASE_PREPARATION.md').read_text())
files=sorted(p for p in out.iterdir() if p.is_file() and p.name!='SHA256SUMS')
(out/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in files))
print(f'All six release variants present, {sum(a["bytes"] for a in assets)/1024**2:.1f} MiB total')
