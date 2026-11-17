// Auto-healing step for .github/workflows/ci.yml. Runs in two halves around
// the model call, which the workflow delegates to actions/ai-inference.
//
//   prepare  Read the Jest failure log left behind by the `test` job, pick the
//            source files it implicates, and write the system and user prompts
//            to disk for the inference step.
//   apply    Parse the model's reply and write the files it returned back into
//            the working tree.
//
// The model may only rewrite files under src/. Test files and anything outside
// src/ are read-only context, so a patch cannot make the build green by
// relaxing an assertion.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const LOG_PATH = process.env.AUTO_HEAL_LOG ?? 'test-results.log';
const PROMPT_PATH = 'agent-prompt.md';
const SYSTEM_PATH = 'agent-system.md';
const RESPONSE_PATH = 'agent-response.md';
const REPORT_PATH = 'auto-heal-report.md';

// The free GitHub Models tier caps the request size, so both the log and the
// bundle of source files are trimmed before they are sent.
const LOG_BUDGET = 8_000;
const SOURCE_BUDGET = 20_000;

function fail(message) {
  console.error(`auto-heal: ${message}`);
  process.exit(1);
}

/** Every .ts file under a directory, minus the test tree. */
function collectSources(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== '__tests__' && entry !== 'test') walk(path);
      } else if (entry.endsWith('.ts')) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * The part of the log that describes failures. Jest also prints console output
 * from the suites that passed, and ranking against the whole log lets an
 * unrelated file that happened to log something outrank the broken one.
 */
function failureSection(log) {
  const lines = log.split('\n');
  const first = lines.findIndex((line) => line.trimStart().startsWith('●'));
  const failures = first === -1 ? [] : lines.slice(first);
  const headers = lines.filter((line) => line.startsWith('FAIL '));
  return [...headers, ...failures].join('\n');
}

/** Keeps the tail of the log, which is where Jest puts the detail. */
function trimLog(log) {
  if (log.length <= LOG_BUDGET) return log;
  return `...(earlier output omitted)...\n${log.slice(-LOG_BUDGET)}`;
}

/**
 * Orders source files by how strongly the failures point at them: a path named
 * in a stack trace counts most, then a failing test file named after the
 * module, then a bare mention anywhere in the log.
 */
function rankByRelevance(files, log) {
  const focus = failureSection(log);
  const scored = files.map((path) => {
    const stem = basename(path, '.ts');
    let score = 0;
    if (focus.includes(path)) score += 200;
    if (focus.includes(`${stem}.test.ts`)) score += 100;
    if (focus.includes(stem)) score += 20;
    if (log.includes(path)) score += 5;
    return { path, score };
  });
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const relevant = scored.filter((entry) => entry.score > 0);
  return (relevant.length > 0 ? relevant : scored).map((entry) => entry.path);
}

function renderBundle(files) {
  let bundle = '';
  for (const path of files) {
    const block = `\n--- ${path} ---\n${readFileSync(path, 'utf8')}`;
    if (bundle.length + block.length > SOURCE_BUDGET) break;
    bundle += block;
  }
  return bundle;
}

function prepare() {
  let log;
  try {
    log = readFileSync(LOG_PATH, 'utf8');
  } catch {
    fail(`${LOG_PATH} is missing — the build failed before the tests ran.`);
  }

  const sources = collectSources('src');
  const suspects = rankByRelevance(sources, log);
  console.log(
    `auto-heal: candidate files, most relevant first\n  ${suspects.join('\n  ')}`,
  );

  writeFileSync(
    SYSTEM_PATH,
    [
      'You repair failing builds in a TypeScript Express API.',
      'You return corrected source files and nothing outside the format you are given.',
      'You never weaken a test, an assertion or a validation rule to make a build pass.',
    ].join(' ') + '\n',
  );

  writeFileSync(
    PROMPT_PATH,
    `Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.

Rules:
- Only files under src/ may be changed, and never a file under src/test/ or any __tests__/ directory. The tests describe the intended behaviour; the source is what is wrong.
- Return the complete new content of each file you change. Do not return a diff, and do not elide anything with a comment such as "unchanged".
- Change as little as possible. If one operator or one condition is wrong, fix that and leave the rest of the file identical.
- Keep the existing style: explicit return types, no \`any\`, no new dependency, no suppression comment.

Reply in exactly this format and add nothing else:

### DIAGNOSIS
<two sentences: what is broken, and why the tests fail>

### FILE: <path from the repository root>
\`\`\`ts
<the complete corrected file>
\`\`\`

Repeat the FILE block once per file you change.

--- JEST FAILURE LOG ---
${trimLog(log)}

--- SOURCE FILES ---
${renderBundle(suspects)}
`,
  );

  console.log(`auto-heal: wrote ${SYSTEM_PATH} and ${PROMPT_PATH}`);
}

/** Pulls `### FILE: <path>` blocks out of the model's reply. */
function parsePatch(reply) {
  const blocks = [
    ...reply.matchAll(/^### FILE:\s*(\S+)\s*\n+```[a-z]*\n([\s\S]*?)\n```/gm),
  ];
  return blocks.map(([, path, content]) => ({ path, content }));
}

function parseDiagnosis(reply) {
  const match = /^### DIAGNOSIS\s*\n([\s\S]*?)(?=\n### |$)/m.exec(reply);
  return match ? match[1].trim() : 'The agent returned no diagnosis.';
}

function apply() {
  let reply;
  try {
    reply = readFileSync(RESPONSE_PATH, 'utf8');
  } catch {
    fail(`${RESPONSE_PATH} is missing — the inference step produced nothing.`);
  }
  if (reply.trim() === '') fail('The model returned an empty completion.');

  const patch = parsePatch(reply);
  if (patch.length === 0) {
    fail(
      `The agent returned no file blocks. Raw reply:\n${reply.slice(0, 4_000)}`,
    );
  }

  const sources = collectSources('src');
  const changed = [];
  for (const { path, content } of patch) {
    if (
      !path.startsWith('src/') ||
      path.includes('__tests__') ||
      path.startsWith('src/test/')
    ) {
      fail(`The agent tried to rewrite ${path}, which is out of bounds.`);
    }
    if (!sources.includes(path)) {
      fail(`The agent returned ${path}, which is not an existing source file.`);
    }
    const before = readFileSync(path, 'utf8');
    const after = content.endsWith('\n') ? content : `${content}\n`;
    if (before === after) continue;
    writeFileSync(path, after);
    changed.push(path);
  }

  if (changed.length === 0) fail('The agent returned the files unchanged.');
  console.log(`auto-heal: rewrote\n  ${changed.join('\n  ')}`);

  writeFileSync(
    REPORT_PATH,
    `**Model:** \`${process.env.AUTO_HEAL_MODEL ?? 'unknown'}\` on GitHub Models\n\n` +
      `**Files rewritten:** ${changed.map((path) => `\`${path}\``).join(', ')}\n\n` +
      `### Agent diagnosis\n\n${parseDiagnosis(reply)}\n`,
  );
}

const mode = process.argv[2];
if (mode === 'prepare') prepare();
else if (mode === 'apply') apply();
else fail(`Unknown mode "${mode ?? ''}". Use "prepare" or "apply".`);
