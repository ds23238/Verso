from pathlib import Path
import json, os
import lyricsbridge as api
root = Path(os.environ['LYRICS_TEST_INPUTS'])
outputs = {}
for name in ['normal.lrc', 'enhanced.lrc']:
    result = api.from_lrc((root / name).read_text())
    doc = result['document']
    assert doc['lines'][0]['start_ms'] == 1200
    enhanced = name == 'enhanced.lrc'
    assert bool(doc['lines'][0].get('words')) == enhanced
    exported = api.to_lrc(doc, enhanced=enhanced)
    assert api.from_lrc(exported['output'])['document']['lines'] == doc['lines']
    outputs[name] = result
source = (root / 'example.lyricsfile.yaml').read_text()
for enhanced in [False, True]:
    result = api.to_lrc(source, enhanced=enhanced)
    assert any('end times' in w for w in result['warnings'])
    outputs['yaml-enhanced' if enhanced else 'yaml-normal'] = result
try: api.from_lrc('[00:61]Bad', title='A', artist='B')
except ValueError: pass
else: raise AssertionError('Bad timestamp accepted')
(root.parent / 'results-python.json').write_text(json.dumps(outputs, ensure_ascii=False))
print('lyricsbridge Python: all 3 fixtures, both directions and error passed')
