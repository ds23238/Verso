import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'package:ffi/ffi.dart';

typedef _RequestNative = Pointer<Utf8> Function(Pointer<Utf8>);
typedef _RequestDart = Pointer<Utf8> Function(Pointer<Utf8>);
typedef _FreeNative = Void Function(Pointer<Utf8>);
typedef _FreeDart = void Function(Pointer<Utf8>);

/// Native Dart/Flutter only. Flutter Web needs a future WASM backend.
class LyricsFile {
  final DynamicLibrary _library;
  late final _RequestDart _nativeRequest;
  late final _FreeDart _nativeFree;

  /// Pass an absolute libraryPath or set LYRICSFILE_LIBRARY.
  /// Mobile apps may inject DynamicLibrary.process/open after bundling the core.
  LyricsFile({String? libraryPath, DynamicLibrary? library})
      : _library = library ??
            DynamicLibrary.open(libraryPath ??
                Platform.environment['LYRICSFILE_LIBRARY'] ??
                (throw ArgumentError(
                    'Provide libraryPath or LYRICSFILE_LIBRARY'))) {
    _nativeRequest =
        _library.lookupFunction<_RequestNative, _RequestDart>('lf_request');
    _nativeFree = _library.lookupFunction<_FreeNative, _FreeDart>('lf_free');
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

  Map<String, dynamic> parse(String source) =>
      _request({'op': 'parse', 'source': source}) as Map<String, dynamic>;
  String stringify(Map<String, dynamic> document) =>
      _request({'op': 'stringify', 'document': document}) as String;
  List<dynamic> validate(Map<String, dynamic> document) =>
      _request({'op': 'validate', 'document': document}) as List<dynamic>;
}
