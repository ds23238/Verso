import 'dart:io';
import 'dart:convert';
import 'package:lyricsbridge/lyricsbridge.dart';

void check(bool ok) {
  if (!ok) throw StateError('Check failed');
}

void main() {
  final root = Platform.environment['LYRICS_TEST_INPUTS']!;
  final api = LyricsBridge();
  final outputs = <String, dynamic>{};
  for (final name in ['normal.lrc', 'enhanced.lrc']) {
    final result = api.fromLrc(File('$root/$name').readAsStringSync());
    final doc = result['document'] as Map<String, dynamic>;
    final enhanced = name == 'enhanced.lrc';
    check(doc['lines'][0]['start_ms'] == 1200);
    check((doc['lines'][0]['words'] != null) == enhanced);
    final exported = api.toLrc(doc, enhanced: enhanced);
    check(jsonEncode(
            api.fromLrc(exported['output'] as String)['document']['lines']) ==
        jsonEncode(doc['lines']));
    outputs[name] = result;
  }
  final source = File('$root/example.lyricsfile.yaml').readAsStringSync();
  for (final enhanced in [false, true]) {
    final result = api.toLrc(source, enhanced: enhanced);
    check((result['warnings'] as List)
        .any((w) => (w as String).contains('end times')));
    outputs[enhanced ? 'yaml-enhanced' : 'yaml-normal'] = result;
  }
  var rejected = false;
  try {
    api.fromLrc('[00:61]Bad', title: 'A', artist: 'B');
  } on FormatException {
    rejected = true;
  }
  check(rejected);
  File('$root/../results-dart.json').writeAsStringSync(jsonEncode(outputs));
  print('lyricsbridge Dart: all 3 fixtures, both directions and error passed');
}
