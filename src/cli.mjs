import { readFile } from 'node:fs/promises';
import { fromLrc, toLrc } from 'lyricsbridge';
const [direction, path, ...flags] = process.argv.slice(2);
try {
  if (!['import', 'export'].includes(direction) || !path || flags.some(f => f !== '--enhanced')) {
    throw new Error('Usage: npm run convert -- import input.lrc | export input.lyricsfile.yaml [--enhanced]');
  }
  const source = await readFile(path, 'utf8');
  const result = direction === 'import' ? fromLrc(source) : toLrc(source, {enhanced: flags.includes('--enhanced')});
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
  process.stdout.write(direction === 'import' ? result.yaml : result.output);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
