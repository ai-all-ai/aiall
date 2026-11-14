import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootOfPackage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readTemplate = (name) => fs.readFileSync(path.join(rootOfPackage, 'templates', name), 'utf8');
const managed = '<!-- AIALL MANAGED ENTRYPOINT; edit ALL.md instead. -->';
const bridge =
  'Before performing this task, open and read `ALL.md` at the repository root. Apply its mandatory rules, then read only the documents and skills whose task triggers match. A Markdown reference is not proof that the file was loaded. If it cannot be read, report that before changing files.';
export const AGENTS = {
  codex: {
    file: 'AGENTS.md',
    kind: 'instruction',
    content: () => `${managed}\n# Project instructions\n\n${bridge}\n`,
  },
  claude: {
    file: 'CLAUDE.md',
    kind: 'import',
    content: () => `${managed}\n# Project instructions\n\n@ALL.md\n`,
  },
  gemini: {
    file: 'GEMINI.md',
    kind: 'import',
    content: () => `${managed}\n# Project instructions\n\n@./ALL.md\n`,
  },
  cursor: {
    file: '.cursor/rules/aiall.mdc',
    kind: 'instruction',
    content: () =>
      `---\ndescription: Project-wide AI-ALL rule routing\nalwaysApply: true\n---\n${managed}\n${bridge}\n`,
  },
  copilot: {
    file: '.github/copilot-instructions.md',
    kind: 'instruction',
    content: () => `${managed}\n# Shared project instructions\n\n${bridge}\n`,
  },
  windsurf: {
    file: '.windsurf/rules/aiall.md',
    kind: 'instruction',
    content: () => `---\ntrigger: always_on\n---\n${managed}\n${bridge}\n`,
  },
  roo: {
    file: '.roo/rules/aiall.md',
    kind: 'instruction',
    content: () => `${managed}\n${bridge}\n`,
  },
  antigravity: {
    file: '.agents/rules/aiall.md',
    kind: 'import',
    content: () => `${managed}\n# Shared rules\n\n@[Project Rules](../../ALL.md)\n`,
  },
};
const defaultAgents = ['codex', 'claude', 'gemini'];
const cliNames = { codex: 'codex', claude: 'claude', gemini: 'gemini' };
const systemTemplates = {
  '.ai/GOVERNANCE.md': 'GOVERNANCE.md',
  '.ai/rules/security.md': 'security.md',
  '.ai/rules/git.md': 'git.md',
  '.ai/rules/coding.md': 'coding.md',
  '.ai/rules/testing.md': 'testing.md',
  '.ai/workflows/review.md': 'review.md',
  '.ai/integrations/registry.md': 'integrations.md',
};
const configFile = '.ai/aiall.json';
const originalConfigContent = Symbol('originalConfigContent');

const packsBegin = '<!-- aiall:begin packs -->';
const packsEnd = '<!-- aiall:end packs -->';
const defaultPacks = ['aiall-core'];
const packNamePattern = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const corePack = () => ({
  name: 'aiall-core',
  version: JSON.parse(fs.readFileSync(path.join(rootOfPackage, 'package.json'), 'utf8')).version,
  title: 'AI-ALL core routing',
  directives: [
    {
      id: 'aiall.governance',
      title: 'Changing instructions',
      summary:
        'Read before adding, editing or removing any instruction, skill, adapter or integration record.',
      doc: '.ai/GOVERNANCE.md',
    },
    {
      id: 'aiall.git',
      title: 'Git and releases',
      summary: 'Read before commits, branches, rebases, resets or releases.',
      doc: '.ai/rules/git.md',
    },
    {
      id: 'aiall.security',
      title: 'Security',
      summary: 'Read before work on secrets, authentication, networking or credentials.',
      doc: '.ai/rules/security.md',
    },
    {
      id: 'aiall.coding',
      title: 'Source code',
      summary: 'Read before changing source code.',
      doc: '.ai/rules/coding.md',
    },
    {
      id: 'aiall.testing',
      title: 'Tests and verification',
      summary: 'Read before running tests or builds, or before claiming verification.',
      doc: '.ai/rules/testing.md',
    },
    {
      id: 'aiall.review',
      title: 'Review and audit',
      summary: 'Read for review or audit tasks.',
      doc: '.ai/workflows/review.md',
    },
    {
      id: 'aiall.integrations',
      title: 'Plugins, MCP and tools',
      summary: 'Read before changing plugin, MCP or tool integrations.',
      doc: '.ai/integrations/registry.md',
    },
  ],
});

// A pack reference is either an npm package name or a project-relative .json file.
function validatePackRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return false;
  if (ref.endsWith('.json')) return !path.isAbsolute(ref) && !ref.split(/[\\/]/).includes('..');
  return packNamePattern.test(ref);
}

function validatePack(data, ref) {
  const fieldsOk = (d) =>
    d &&
    typeof d === 'object' &&
    ['id', 'title', 'summary', 'doc'].every((k) => typeof d[k] === 'string' && d[k].length > 0);
  const ok =
    data &&
    typeof data === 'object' &&
    typeof data.name === 'string' &&
    typeof data.version === 'string' &&
    typeof data.title === 'string' &&
    Array.isArray(data.directives) &&
    data.directives.every(fieldsOk);
  if (!ok)
    throw Error(
      `Invalid pack ${ref}: expected name, version, title and directives[] with id, title, summary and doc`,
    );
  return data;
}

function loadPack(root, ref) {
  if (ref === 'aiall-core') return corePack();
  if (!validatePackRef(ref)) throw Error(`Invalid pack reference: ${ref}`);
  const isFile = ref.endsWith('.json');
  const file = safePath(root, isFile ? ref : path.join('node_modules', ref, 'aiall-pack.json'));
  const stat = maybeStat(file);
  if (!stat || !stat.isFile())
    throw Error(
      isFile
        ? `Pack file not found: ${ref}`
        : `Pack not installed: ${ref}. Install it with: npm i -D ${ref}`,
    );
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw Error(`Cannot read pack ${ref}: ${error.message}`);
  }
  return validatePack(data, ref);
}

// The managed block: generated from the enabled packs, replaced as a whole by sync.
// Remove the version from pack headings: '### aiall-core 0.3.0' -> '### aiall-core'.
const stripPackVersions = (block) => block.replace(/^(### \S+) \S+$/gm, '$1');

function renderBlock(root, packs) {
  const sections = packs.map((ref) => {
    const pack = loadPack(root, ref);
    const items = pack.directives
      .map((d) => `- **${d.title}** (\`${d.id}\`): ${d.summary} Read [${d.doc}](${d.doc}).`)
      .join('\n');
    return `### ${pack.name} ${pack.version}\n\n${items}`;
  });
  return [
    packsBegin,
    '<!-- Generated by aiall from the packs listed in .ai/aiall.json. Edit text outside this block. -->',
    '',
    '## Directives from packs',
    '',
    sections.join('\n\n'),
    packsEnd,
  ].join('\n');
}

// Replace the managed block, or append it. Text outside the markers is never changed.
function replaceBlock(text, block) {
  const begin = text.indexOf(packsBegin),
    end = text.indexOf(packsEnd);
  if (begin === -1 && end === -1) return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
  if (begin === -1 || end < begin)
    throw Error(
      'ALL.md has an unmatched aiall packs marker; fix or remove it, then run sync again',
    );
  return text.slice(0, begin) + block + text.slice(end + packsEnd.length);
}

function allMdEntry(root, block) {
  const { dest, exists } = preparePath(root, 'ALL.md');
  if (!exists)
    return {
      name: 'ALL.md',
      dest,
      exists,
      content: `${readTemplate('ALL.md').replace(/\s*$/, '')}\n\n${block}\n`,
    };
  const previousContent = fs.readFileSync(dest, 'utf8');
  return {
    name: 'ALL.md',
    dest,
    exists,
    managed: true,
    previousContent,
    content: replaceBlock(previousContent, block),
  };
}

function checkPacksBlock(root, packs, allStat, issues) {
  let expected;
  try {
    expected = renderBlock(root, packs);
  } catch (error) {
    issues.push(error.message);
    return;
  }
  if (!allStat?.isFile()) return;
  const text = fs.readFileSync(safePath(root, 'ALL.md'), 'utf8');
  const begin = text.indexOf(packsBegin),
    end = text.indexOf(packsEnd);
  if (begin === -1 || end < begin) issues.push('ALL.md has no aiall packs block; run aiall sync');
  // Pack versions in the headings change with each release of a pack. Compare the
  // directives only, so a project created by an older version still passes check.
  else if (
    stripPackVersions(text.slice(begin, end + packsEnd.length)) !== stripPackVersions(expected)
  )
    issues.push('ALL.md packs block is out of date; run aiall sync');
}

function parseAgents(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((agent) => typeof agent !== 'string' || !Object.hasOwn(AGENTS, agent))
  ) {
    throw Error(
      `${label} must be an array of supported agent names: ${Object.keys(AGENTS).join(', ')}`,
    );
  }
  if (new Set(value).size !== value.length)
    throw Error(`${label} must not contain duplicate agents`);
  return value;
}

function parse(args) {
  let command = 'help',
    dir = process.cwd(),
    agents = null,
    agentsSpecified = false,
    json = false,
    dryRun = false,
    detect = false,
    check = false;
  const positional = [];
  if (args[0] && !args[0].startsWith('-')) command = args.shift();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' || arg === '-p') {
      if (!args[i + 1] || args[i + 1].startsWith('-')) throw Error('--path requires a directory');
      dir = path.resolve(args[++i]);
    } else if (arg === '--agents') {
      if (args[i + 1] === undefined) throw Error('--agents requires a comma-separated list');
      agentsSpecified = true;
      agents = args[++i].split(',').map((a) => a.trim());
      if (agents.length === 0 || agents.some((a) => !a))
        throw Error('--agents requires one or more agent names');
      parseAgents(agents, '--agents');
    } else if (arg === '--all-agents') {
      agentsSpecified = true;
      agents = Object.keys(AGENTS);
    } else if (arg === '--json') json = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--detect') detect = true;
    else if (arg === '--check') check = true;
    else if (arg === '--help' || arg === '-h') command = 'help';
    else if (arg === '--version' || arg === '-v') command = 'version';
    else if (!arg.startsWith('-') && command === 'packs' && positional.length < 2)
      positional.push(arg);
    else throw Error(`Unknown argument: ${arg}`);
  }
  let root;
  try {
    root = fs.realpathSync(dir);
  } catch {
    throw Error(`Directory not found: ${dir}`);
  }
  if (!fs.statSync(root).isDirectory()) throw Error(`Directory not found: ${dir}`);
  return { command, dir: root, agents, agentsSpecified, json, dryRun, detect, check, positional };
}

function safePath(root, relative) {
  const dest = path.resolve(root, relative);
  if (dest !== root && !dest.startsWith(root + path.sep))
    throw Error(`Path escapes project: ${relative}`);
  let cursor = root;
  for (const part of path.relative(root, dest).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw Error(`Refusing symlink: ${cursor}`);
    if (cursor !== dest && !stat.isDirectory())
      throw Error(`Path component is not a directory: ${cursor}`);
  }
  return dest;
}

function maybeStat(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function validateConfig(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw Error(`Invalid ${configFile}: expected a JSON object`);
  if (data.schemaVersion !== undefined && data.schemaVersion !== 1)
    throw Error(`Invalid ${configFile}: schemaVersion must be 1`);
  parseAgents(data.agents, `${configFile} agents`);
  if (data.packs !== undefined) {
    if (!Array.isArray(data.packs) || data.packs.some((p) => !validatePackRef(p)))
      throw Error(
        `Invalid ${configFile}: packs must be an array of pack names or project-relative .json paths`,
      );
    if (new Set(data.packs).size !== data.packs.length)
      throw Error(`Invalid ${configFile}: packs must not contain duplicates`);
  }
  return {
    ...data,
    schemaVersion: data.schemaVersion ?? 1,
    agents: [...data.agents],
    ...(data.packs ? { packs: [...data.packs] } : {}),
  };
}

function readConfig(root) {
  const file = safePath(root, configFile);
  if (!maybeStat(file)) return null;
  let raw, data;
  try {
    raw = fs.readFileSync(file, 'utf8');
    data = JSON.parse(raw);
  } catch (error) {
    throw Error(`Cannot read ${configFile}: ${error.message}`);
  }
  const parsed = validateConfig(data);
  Object.defineProperty(parsed, originalConfigContent, { value: raw });
  return parsed;
}

function desired(agents) {
  const result = {};
  for (const [dest, template] of Object.entries(systemTemplates))
    result[dest] = readTemplate(template);
  for (const agent of agents) result[AGENTS[agent].file] = AGENTS[agent].content();
  return result;
}

function preparePath(root, name) {
  const dest = safePath(root, name);
  const stat = maybeStat(dest);
  if (stat && !stat.isFile()) throw Error(`Expected a regular file: ${name}`);
  return { dest, exists: !!stat };
}

function preflight(root, files, configUpdate, previousConfigContent) {
  const plan = [];
  for (const [name, content] of Object.entries(files))
    plan.push({ name, content, ...preparePath(root, name) });
  if (configUpdate) {
    const entry = preparePath(root, configFile);
    plan.push({
      ...entry,
      name: configFile,
      content: JSON.stringify(configUpdate, null, 2) + '\n',
      configuration: true,
      previousContent: previousConfigContent,
    });
  }
  return plan;
}

function ensureDirectory(root, dir, createdDirs) {
  const relative = path.relative(root, dir);
  let cursor = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = maybeStat(cursor);
    if (stat) {
      if (stat.isSymbolicLink()) throw Error(`Refusing symlink: ${cursor}`);
      if (!stat.isDirectory()) throw Error(`Path component is not a directory: ${cursor}`);
    } else {
      fs.mkdirSync(cursor);
      createdDirs.push(cursor);
    }
  }
}

function removeCreated(files, dirs) {
  const errors = [];
  for (const { file, content } of files.reverse()) {
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.readFileSync(file, 'utf8') !== content) {
        errors.push(`left changed file untouched: ${file}`);
      } else fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== 'ENOENT') errors.push(`could not remove file ${file}: ${error.message}`);
    }
  }
  for (const dir of dirs.reverse()) {
    try {
      fs.rmdirSync(dir);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY')
        errors.push(`could not remove directory ${dir}: ${error.message}`);
    }
  }
  return errors;
}

function writeConfig(root, entry, createdFiles, createdDirs) {
  const { dest, content, exists } = entry;
  ensureDirectory(root, path.dirname(dest), createdDirs);
  const temp = path.join(
    path.dirname(dest),
    `.aiall-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );
  let tempCreated = false;
  try {
    fs.writeFileSync(temp, content, { flag: 'wx' });
    tempCreated = true;
    if (exists) {
      safePath(root, configFile);
      const current = maybeStat(dest);
      if (!current || !current.isFile()) throw Error(`${configFile} changed during update`);
      if (fs.readFileSync(dest, 'utf8') !== entry.previousContent)
        throw Error(`${configFile} changed during update`);
      fs.renameSync(temp, dest);
      tempCreated = false;
    } else {
      fs.linkSync(temp, dest);
      createdFiles.push({ file: dest, content });
    }
  } finally {
    if (tempCreated) {
      try {
        fs.unlinkSync(temp);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

function applyPlan(root, plan) {
  const results = [],
    createdFiles = [],
    createdDirs = [];
  try {
    for (const entry of plan) {
      if (entry.configuration) continue;
      if (entry.managed) {
        if (entry.content === entry.previousContent) {
          results.push({ status: 'preserved', file: entry.name });
          continue;
        }
        writeConfig(
          root,
          {
            dest: entry.dest,
            content: entry.content,
            exists: true,
            previousContent: entry.previousContent,
          },
          createdFiles,
          createdDirs,
        );
        results.push({ status: 'updated', file: entry.name });
        continue;
      }
      if (entry.exists) {
        results.push({ status: 'preserved', file: entry.name });
        continue;
      }
      const dest = safePath(root, entry.name);
      ensureDirectory(root, path.dirname(dest), createdDirs);
      try {
        fs.writeFileSync(dest, entry.content, { flag: 'wx' });
      } catch (error) {
        if (error.code === 'EEXIST') {
          results.push({ status: 'preserved', file: entry.name });
          continue;
        }
        throw error;
      }
      createdFiles.push({ file: dest, content: entry.content });
      results.push({ status: 'created', file: entry.name });
    }
    const configEntry = plan.find((entry) => entry.configuration);
    if (configEntry) {
      writeConfig(root, configEntry, createdFiles, createdDirs);
      results.push({ status: configEntry.exists ? 'updated' : 'created', file: configFile });
    } else results.push({ status: 'preserved', file: configFile });
    return results;
  } catch (error) {
    const rollbackErrors = removeCreated(createdFiles, createdDirs);
    if (rollbackErrors.length)
      throw Error(`${error.message}; rollback incomplete: ${rollbackErrors.join('; ')}`);
    throw error;
  }
}

function planResults(plan) {
  return plan.map((entry) => {
    if (entry.configuration) {
      return { status: entry.exists ? 'would-update' : 'would-create', file: configFile };
    }
    if (entry.managed && entry.content !== entry.previousContent)
      return { status: 'would-update', file: entry.name };
    return { status: entry.exists ? 'preserved' : 'would-create', file: entry.name };
  });
}

function detect(root, config) {
  return Object.entries(AGENTS).map(([name, agent]) => {
    const file = agent.file;
    const present = !!maybeStat(safePath(root, file));
    const executable = cliNames[name];
    let installed = null,
      evidence = 'installation not detectable';
    if (executable) {
      const extensions =
        process.platform === 'win32'
          ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
          : [''];
      installed = (process.env.PATH || '').split(path.delimiter).some((dir) => {
        if (!dir) return false;
        return extensions.some((extension) => {
          try {
            const candidate = path.join(dir, executable + extension);
            if (!fs.statSync(candidate).isFile()) return false;
            fs.accessSync(candidate, fs.constants.X_OK);
            return true;
          } catch {
            return false;
          }
        });
      });
      evidence = installed
        ? `executable found on PATH: ${executable}`
        : `executable not found on PATH: ${executable}`;
    }
    return {
      name,
      installed,
      installationEvidence: evidence,
      projectFiles: present ? [file] : [],
      selected: config?.agents.includes(name) || false,
    };
  });
}

function check(root, agents, config) {
  const issues = [],
    warnings = [],
    results = [];
  const entrypoints = new Set(agents.map((agent) => AGENTS[agent].file));
  for (const [name, expected] of Object.entries(desired(agents))) {
    const dest = safePath(root, name),
      stat = maybeStat(dest);
    if (!stat) {
      issues.push(`Missing: ${name}`);
      results.push({ file: name, status: 'missing' });
      continue;
    }
    if (!stat.isFile()) {
      issues.push(`Not a regular file: ${name}`);
      continue;
    }
    if (entrypoints.has(name)) {
      const text = fs.readFileSync(dest, 'utf8');
      if (text !== expected) {
        if (text.includes(managed)) issues.push(`Managed entrypoint differs: ${name}`);
        else
          warnings.push(
            `Existing custom entrypoint: ${name}; verify manually that it loads ALL.md`,
          );
      }
    }
    results.push({ file: name, status: 'present' });
  }
  const all = safePath(root, 'ALL.md'),
    allStat = maybeStat(all);
  if (!allStat) {
    issues.push('Missing: ALL.md');
    results.push({ file: 'ALL.md', status: 'missing' });
  } else if (!allStat.isFile()) issues.push('Not a regular file: ALL.md');
  else results.push({ file: 'ALL.md', status: 'present' });
  checkPacksBlock(root, config?.packs ?? defaultPacks, allStat, issues);
  if (allStat?.isFile()) {
    const source = fs.readFileSync(all, 'utf8');
    const links = [...source.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map((match) => match[1]);
    for (const ref of links) {
      if (/^(?:https?:|mailto:|#)/i.test(ref)) continue;
      try {
        const decoded = decodeURIComponent(ref);
        const linked = safePath(root, path.join(path.dirname(all), decoded));
        if (!maybeStat(linked)) issues.push(`Broken ALL.md link: ${ref}`);
      } catch (error) {
        issues.push(`Unsafe or invalid ALL.md link: ${ref} (${error.message})`);
      }
    }
  }
  if (!config) issues.push(`Missing: ${configFile}`);
  return { ok: issues.length === 0, issues, warnings, results };
}

function jsonResponse(
  command,
  { ok = true, code = 0, errors = [], warnings = [], results = [], issues = [] } = {},
) {
  return { ok, command, code, errors, warnings, results, issues };
}

function emitJson(response) {
  console.log(JSON.stringify(response, null, 2));
  process.exitCode = response.code;
}

// Shared by init, sync and packs. The packs block is rendered first, so a missing
// pack stops the command before any file is written.
function syncProject({ dir, agents, agentsSpecified, packs, packsChanged, savedConfig, dryRun }) {
  const packsBlock = renderBlock(dir, packs);
  const files = desired(agents);
  const updateConfig = agentsSpecified || !savedConfig || packsChanged;
  const configValue = updateConfig
    ? { ...(savedConfig || {}), schemaVersion: 1, agents, packs }
    : null;
  const plan = preflight(dir, files, configValue, savedConfig?.[originalConfigContent]);
  plan.unshift(allMdEntry(dir, packsBlock));
  if (dryRun) {
    const results = planResults(plan);
    if (!updateConfig) results.push({ status: 'preserved', file: configFile });
    return results;
  }
  return applyPlan(dir, plan);
}

function usage() {
  return `AI-ALL — shared agent instructions

Usage: aiall <command> [--path DIR] [--agents codex,claude,...] [--dry-run] [--json]

Commands:
  init     Create ALL.md, project rules and native entrypoints (no overwrite)
           --detect selects the agents found on PATH or present in the project
  detect   Show installation, project-file and configured-selection evidence
  sync     Add missing entrypoints; refresh the packs block in ALL.md; keep your text
  check    Validate required files, managed entrypoints, packs block and ALL.md links
  packs    List, add or remove packs: packs [list|add <name>|remove <name>]
  doctor   check plus detection evidence
  upgrade  Show the installed version; --check compares it with npm
  --version

Supported adapters: ${Object.keys(AGENTS).join(', ')}
`;
}

// Read the latest stable version from the npm registry. Only called with `upgrade --check`.
export async function fetchLatestVersion() {
  const response = await fetch('https://registry.npmjs.org/@ai.all/aiall/latest', {
    signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw Error(`npm registry returned ${response.status}`);
  const data = await response.json();
  if (typeof data.version !== 'string') throw Error('npm registry response has no version');
  return data.version;
}

// Compare two stable x.y.z versions: -1, 0 or 1.
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    if (!m) throw Error(`Not a stable version: ${v}`);
    return m.slice(1).map(Number);
  };
  const x = parse(a),
    y = parse(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

export async function run(raw) {
  const json = raw.includes('--json');
  let command = raw.find((arg) => !arg.startsWith('-')) || 'help';
  try {
    const opts = parse([...raw]);
    command = opts.command;
    const {
      dir,
      agents: specifiedAgents,
      agentsSpecified,
      dryRun,
      positional,
      detect: detectRequested,
      check: checkRequested,
    } = opts;
    if (command === 'version') {
      const version = JSON.parse(
        fs.readFileSync(path.join(rootOfPackage, 'package.json'), 'utf8'),
      ).version;
      if (json) emitJson(jsonResponse(command, { results: [{ version }] }));
      else console.log(version);
      return;
    }
    if (command === 'help') {
      if (json) emitJson(jsonResponse(command, { results: [{ usage: usage() }] }));
      else console.log(usage());
      return;
    }
    const savedConfig = readConfig(dir);
    let agents = agentsSpecified ? specifiedAgents : savedConfig?.agents || defaultAgents;
    let agentsFixed = agentsSpecified;
    if (detectRequested) {
      if (command !== 'init') throw Error('--detect is only supported by init');
      if (agentsSpecified) throw Error('--detect cannot be combined with --agents');
      const found = detect(dir, savedConfig)
        .filter((a) => a.installed || a.projectFiles.length > 0)
        .map((a) => a.name);
      agents = found.length ? found : defaultAgents;
      agentsFixed = true;
      if (!json)
        console.log(
          found.length
            ? `Detected agents: ${found.join(', ')}`
            : `No agents detected; using defaults: ${defaultAgents.join(', ')}`,
        );
    }
    if (command === 'detect') {
      const results = detect(dir, savedConfig);
      if (json) emitJson(jsonResponse(command, { results }));
      else console.log(JSON.stringify(results, null, 2));
      return;
    }
    if (command === 'upgrade') {
      const current = JSON.parse(
        fs.readFileSync(path.join(rootOfPackage, 'package.json'), 'utf8'),
      ).version;
      let latest = null,
        status = 'not-checked',
        error = null;
      if (checkRequested) {
        try {
          latest = await fetchLatestVersion();
          status = compareVersions(current, latest) < 0 ? 'update-available' : 'up-to-date';
        } catch (failure) {
          status = 'unknown';
          error = failure.message;
        }
      }
      const message =
        status === 'update-available'
          ? `AI-ALL ${latest} is available (installed ${current}). Run: npm i -g @ai.all/aiall@latest, then aiall sync --dry-run, aiall sync and aiall check. Text outside the packs block in ALL.md is never changed.`
          : status === 'up-to-date'
            ? `AI-ALL ${current} is the latest version.`
            : status === 'unknown'
              ? `Could not check npm (${error}). Installed version: ${current}.`
              : `Installed version: ${current}. Run with --check to compare with npm.`;
      if (json)
        emitJson(jsonResponse(command, { results: [{ current, latest, status, message }] }));
      else console.log(message);
      return;
    }
    if (command === 'packs') {
      const [action = 'list', name] = positional;
      const current = savedConfig?.packs ?? defaultPacks;
      if (action === 'list') {
        const results = current.map((pack) => {
          let status = 'ok';
          try {
            loadPack(dir, pack);
          } catch {
            status = 'missing';
          }
          return { pack, status };
        });
        if (json) emitJson(jsonResponse(command, { results }));
        else results.forEach((result) => console.log(`${result.status}: ${result.pack}`));
        return;
      }
      if (action !== 'add' && action !== 'remove')
        throw Error('packs accepts: list, add <name>, remove <name>');
      if (!name) throw Error(`packs ${action} requires a pack name`);
      if (!validatePackRef(name)) throw Error(`Invalid pack reference: ${name}`);
      let next;
      if (action === 'add') {
        if (current.includes(name)) throw Error(`Pack already enabled: ${name}`);
        next = [...current, name];
      } else {
        if (!current.includes(name)) throw Error(`Pack not enabled: ${name}`);
        if (name === 'aiall-core') throw Error('aiall-core cannot be removed');
        next = current.filter((pack) => pack !== name);
      }
      const results = syncProject({
        dir,
        agents,
        agentsSpecified,
        packs: next,
        packsChanged: true,
        savedConfig,
        dryRun,
      });
      if (json) emitJson(jsonResponse(command, { results }));
      else results.forEach((result) => console.log(`${result.status}: ${result.file}`));
      return;
    }
    if (command === 'init' || command === 'sync') {
      const results = syncProject({
        dir,
        agents,
        agentsSpecified: agentsFixed,
        packs: savedConfig?.packs ?? defaultPacks,
        packsChanged: false,
        savedConfig,
        dryRun,
      });
      if (json) emitJson(jsonResponse(command, { results }));
      else results.forEach((result) => console.log(`${result.status}: ${result.file}`));
      return;
    }
    if (command === 'check' || command === 'doctor') {
      const result = check(dir, agents, savedConfig);
      if (command === 'doctor') result.detected = detect(dir, savedConfig);
      const jsonResults =
        command === 'doctor'
          ? { files: result.results, detected: result.detected }
          : result.results;
      if (json)
        emitJson(
          jsonResponse(command, {
            ok: result.ok,
            code: result.ok ? 0 : 1,
            warnings: result.warnings,
            results: jsonResults,
            issues: result.issues,
          }),
        );
      else console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    throw Error(`Unknown command: ${command}`);
  } catch (error) {
    if (json) emitJson(jsonResponse(command, { ok: false, code: 1, errors: [error.message] }));
    else throw error;
  }
}
