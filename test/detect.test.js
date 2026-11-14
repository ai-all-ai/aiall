import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/cli.js');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aiall-detect-'));
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });
// Run the CLI with PATH limited to `bin`, so only the fake executables there count as installed.
const run = (root, bin, ...args) =>
  spawnSync(process.execPath, [cli, ...args, '--path', root], {
    encoding: 'utf8',
    env: { ...process.env, PATH: bin },
  });
const fakeCli = (bin, name) => {
  const file = path.join(bin, name);
  fs.writeFileSync(file, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(file, 0o755);
};

test(
  'init --detect creates only the entrypoints of agents found on PATH',
  { skip: process.platform === 'win32' },
  () => {
    const root = temp(),
      bin = temp();
    try {
      fakeCli(bin, 'claude');
      const result = run(root, bin, 'init', '--detect', '--json');
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(root, '.ai/aiall.json'), 'utf8')).agents,
        ['claude'],
      );
      assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')));
      assert.ok(
        !fs.existsSync(path.join(root, 'AGENTS.md')),
        'codex was not detected, so AGENTS.md must not be created',
      );
    } finally {
      cleanup(root);
      cleanup(bin);
    }
  },
);

test(
  'init --detect --dry-run writes nothing and falls back to the defaults when nothing is found',
  { skip: process.platform === 'win32' },
  () => {
    const root = temp(),
      bin = temp();
    try {
      const result = run(root, bin, 'init', '--detect', '--dry-run', '--json');
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readdirSync(root), []);
    } finally {
      cleanup(root);
      cleanup(bin);
    }
  },
);

test('--detect cannot be combined with --agents', () => {
  const root = temp(),
    bin = temp();
  try {
    const result = run(root, bin, 'init', '--detect', '--agents', 'codex');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--detect cannot be combined with --agents/);
  } finally {
    cleanup(root);
    cleanup(bin);
  }
});
