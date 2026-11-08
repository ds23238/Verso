"""Native Rust bindings; build the core before use. No Python dependencies."""
import ctypes
import json
import os
import sys
from pathlib import Path

_library = None

def _request(payload):
    global _library
    if _library is None:
        suffix = '.dll' if sys.platform == 'win32' else '.dylib' if sys.platform == 'darwin' else '.so'
        filename = ('lyricsfile' if sys.platform == 'win32' else 'liblyricsfile') + suffix
        default = Path(__file__).resolve().parents[3] / 'build' / filename
        path = os.environ.get('LYRICSFILE_LIBRARY', str(default))
        _library = ctypes.CDLL(path)
        _library.lf_request.argtypes = [ctypes.c_char_p]
        _library.lf_request.restype = ctypes.c_void_p
        _library.lf_free.argtypes = [ctypes.c_void_p]
        _library.lf_free.restype = None
    encoded = json.dumps(payload, ensure_ascii=True).encode('utf-8')
    pointer = _library.lf_request(encoded)
    if not pointer:
        raise RuntimeError('Native library returned a null pointer')
    try:
        result = json.loads(ctypes.string_at(pointer))
    finally:
        _library.lf_free(pointer)
    if not result['ok']:
        raise ValueError(result['error'])
    return result['value']

def parse(source):
    return _request({'op': 'parse', 'source': source})

def stringify(document):
    return _request({'op': 'stringify', 'document': document})

def validate(document):
    return _request({'op': 'validate', 'document': document})
