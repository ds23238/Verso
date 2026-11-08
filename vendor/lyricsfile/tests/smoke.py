from pathlib import Path
import json, os
import lyricsfile as api
root = Path(os.environ['LYRICS_TEST_INPUTS'])
source = (root / 'example.lyricsfile.yaml').read_text()
result = api.parse(source)
doc = result['document']
assert doc['lines'][0]['words'][1]['start_ms'] == 1800
assert api.parse(api.stringify(doc))['document'] == doc
assert not api.validate(doc)
try: api.parse(source + '\nversion: "1.0"\n')
except ValueError: pass
else: raise AssertionError('Duplicate key accepted')
print('lyricsfile Python: fixture, roundtrip, validation and error passed')
