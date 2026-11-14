import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from '../src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'cli.js');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('upgrade without --check makes no network request and reports the installed version', () => {
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.ok, true);
  assert.equal(data.results[0].current, version);
  assert.equal(data.results[0].status, 'not-checked');
  assert.equal(data.results[0].latest, null);
});

test('compareVersions orders stable versions and rejects prereleases', () => {
  assert.equal(compareVersions('0.2.0', '0.3.0'), -1);
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions('0.3.0', '0.3.0'), 0);
  assert.throws(() => compareVersions('0.3.0-beta.1', '0.3.0'), /Not a stable version/);
});
