import 'dart:io';
import 'dart:convert';
import 'package:lyricsfile/lyricsfile.dart';

void check(bool ok) {
  if (!ok) throw StateError('Check failed');
}

void main() {
  final root = Platform.environment['LYRICS_TEST_INPUTS']!;
  final source = File('$root/example.lyricsfile.yaml').readAsStringSync();
  final api = LyricsFile();
  final doc = api.parse(source)['document'] as Map<String, dynamic>;
  check(doc['lines'][0]['words'][1]['start_ms'] == 1800);
  check(
      jsonEncode(api.parse(api.stringify(doc))['document']) == jsonEncode(doc));
  check(api.validate(doc).isEmpty);
  var rejected = false;
  try {
    api.parse('$source\nversion: "1.0"\n');
  } on FormatException {
    rejected = true;
  }
  check(rejected);
  print('lyricsfile Dart: fixture, roundtrip, validation and error passed');
}
