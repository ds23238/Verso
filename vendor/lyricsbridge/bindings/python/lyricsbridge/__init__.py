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
        filename = ('lyricsbridge' if sys.platform == 'win32' else 'liblyricsbridge') + suffix
        default = Path(__file__).resolve().parents[3] / 'build' / filename
        path = os.environ.get('LYRICSBRIDGE_LIBRARY', str(default))
        _library = ctypes.CDLL(path)
        _library.lb_request.argtypes = [ctypes.c_char_p]
        _library.lb_request.restype = ctypes.c_void_p
        _library.lb_free.argtypes = [ctypes.c_void_p]
        _library.lb_free.restype = None
    encoded = json.dumps(payload, ensure_ascii=True).encode('utf-8')
    pointer = _library.lb_request(encoded)
    if not pointer:
        raise RuntimeError('Native library returned a null pointer')
    try:
        result = json.loads(ctypes.string_at(pointer))
    finally:
        _library.lb_free(pointer)
    if not result['ok']:
        raise ValueError(result['error'])
    return result['value']

def from_lrc(source, **options):
    return _request({'op': 'from_lrc', 'source': source, 'options': options})

def to_lrc(source, *, enhanced=False):
    field = 'source' if isinstance(source, str) else 'document'
    return _request({'op': 'to_lrc', field: source, 'enhanced': enhanced})
