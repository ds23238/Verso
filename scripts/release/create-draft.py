"""Prepare assets on an unpublished draft. Never modify an already published release."""
import json,os,subprocess
from pathlib import Path
version=json.loads(Path('package.json').read_text())['version'];tag='v'+version
repo=os.environ['GITHUB_REPOSITORY'];head=os.environ['GITHUB_SHA']
def gh(*args):subprocess.run(['gh',*args],check=True)
result=subprocess.run(['gh','release','view',tag,'--repo',repo,'--json','isDraft'],capture_output=True,text=True)
if result.returncode==0:
    if not json.loads(result.stdout)['isDraft']:raise SystemExit('Refusing to modify an already published release')
    gh('release','edit',tag,'--repo',repo,'--draft','--target',head,'--title','Verso '+version,'--notes-file','release-assets/RELEASE_NOTES.md')
else:
    # Fail on auth/network errors rather than interpreting every error as a missing release.
    check=subprocess.run(['gh','api',f'repos/{repo}/releases/tags/{tag}'],capture_output=True,text=True)
    if check.returncode==0 or '404' not in check.stderr:raise SystemExit(check.stderr or 'Unexpected release lookup result')
    gh('release','create',tag,'--repo',repo,'--draft','--target',head,'--title','Verso '+version,'--notes-file','release-assets/RELEASE_NOTES.md')
gh('release','upload',tag,'--repo',repo,'--clobber',*[str(p) for p in sorted(Path('release-assets').iterdir()) if p.is_file()])
print('Prepared DRAFT only. Publishing remains a separate user decision.')
