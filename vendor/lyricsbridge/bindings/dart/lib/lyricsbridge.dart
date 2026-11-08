import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'package:ffi/ffi.dart';

typedef _RequestNative = Pointer<Utf8> Function(Pointer<Utf8>);
typedef _RequestDart = Pointer<Utf8> Function(Pointer<Utf8>);
typedef _FreeNative = Void Function(Pointer<Utf8>);
typedef _FreeDart = void Function(Pointer<Utf8>);

/// Native Dart/Flutter only. Flutter Web needs a future WASM backend.
class LyricsBridge {
  final DynamicLibrary _library;
  late final _RequestDart _nativeRequest;
  late final _FreeDart _nativeFree;

  /// Pass an absolute libraryPath or set LYRICSBRIDGE_LIBRARY.
  /// Mobile apps may inject DynamicLibrary.process/open after bundling the core.
  LyricsBridge({String? libraryPath, DynamicLibrary? library})
      : _library = library ??
            DynamicLibrary.open(libraryPath ??
                Platform.environment['LYRICSBRIDGE_LIBRARY'] ??
                (throw ArgumentError(
                    'Provide libraryPath or LYRICSBRIDGE_LIBRARY'))) {
    _nativeRequest =
        _library.lookupFunction<_RequestNative, _RequestDart>('lb_request');
    _nativeFree = _library.lookupFunction<_FreeNative, _FreeDart>('lb_free');
  }

  dynamic _request(Map<String, dynamic> payload) {
    final input = jsonEncode(payload).toNativeUtf8();
    Pointer<Utf8> output = nullptr;
    try {
      output = _nativeRequest(input);
      if (output == nullptr) throw StateError('Native null response');
      final result = jsonDecode(output.toDartString()) as Map<String, dynamic>;
      if (result['ok'] != true)
        throw FormatException(result['error'] as String);
      return result['value'];
    } finally {
      malloc.free(input);
      if (output != nullptr) _nativeFree(output);
    }
  }

  Map<String, dynamic> fromLrc(String source,
          {String? title, String? artist, String offset = 'reject'}) =>
      _request({
        'op': 'from_lrc',
        'source': source,
        'options': {
          if (title != null) 'title': title,
          if (artist != null) 'artist': artist,
          'offset': offset,
        }
      }) as Map<String, dynamic>;
  Map<String, dynamic> toLrc(Object source, {bool enhanced = false}) {
    if (source is! String && source is! Map<String, dynamic>) {
      throw ArgumentError('Expected YAML string or document map');
    }
    return _request({
      'op': 'to_lrc',
      if (source is String) 'source': source else 'document': source,
      'enhanced': enhanced
    }) as Map<String, dynamic>;
  }
}
