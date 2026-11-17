// Auto-healing step for .github/workflows/ci.yml.
//
// Reads the Jest failure log left behind by the `test` job, picks the source
// files the log implicates, and asks a model on GitHub Models for corrected
// versions of them. Whatever comes back is written to the working tree; the
// workflow then re-runs lint, typecheck and the suite before opening a PR.
//
// The model may only rewrite files under src/. Test files, the shared
// contract and anything outside src/ are sent as read-only context, so a
// patch cannot "fix" the build by relaxing an assertion.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const MODEL = process.env.AUTO_HEAL_MODEL ?? 'openai/gpt-4o';
const LOG_PATH = process.env.AUTO_HEAL_LOG ?? 'test-results.log';

// GitHub Models caps the request size on the free tier, so both the log and
// the bundle of source files are trimmed before they are sent.
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
 * Keeps the parts of the log that name a failure. Jest prints the summary
 * first and the stack traces after, and the tail is what carries the detail.
 */
function trimLog(log) {
  if (log.length <= LOG_BUDGET) return log;
  return `...(earlier output omitted)...\n${log.slice(-LOG_BUDGET)}`;
}

/**
 * Orders source files by how strongly the log points at them: a direct mention
 * counts most, and a failing test file points at the module it is named after.
 */
function rankByRelevance(files, log) {
  const scored = files.map((path) => {
    const stem = basename(path, '.ts');
    let score = 0;
    if (log.includes(path)) score += 100;
    if (log.includes(`${stem}.test.ts`)) score += 50;
    if (log.includes(stem)) score += 10;
    return { path, score };
  });
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.filter((entry) => entry.score > 0).map((entry) => entry.path);
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

const token = process.env.GITHUB_TOKEN;
if (!token) fail('GITHUB_TOKEN is not set.');

let log;
try {
  log = readFileSync(LOG_PATH, 'utf8');
} catch {
  fail(`${LOG_PATH} is missing — the build failed before the tests ran.`);
}

const sources = collectSources('src');
const suspects = rankByRelevance(sources, log);
if (suspects.length === 0)
  fail('No source file in src/ matches the failure log.');

console.log(`auto-heal: model ${MODEL}`);
console.log(`auto-heal: candidate files\n  ${suspects.join('\n  ')}`);

const systemPrompt = [
  'You repair failing builds in a TypeScript Express API.',
  'You return corrected source files, never explanations outside the format you are given.',
  'You never weaken a test, an assertion or a validation rule to make a build pass.',
].join(' ');

const userPrompt = `Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.

Rules:
- Only files under src/ may be changed, and never a file under src/test/ or any __tests__/ directory. The tests describe the intended behaviour; the source is what is wrong.
- Return the complete new content of each file you change. Do not return a diff and do not elide anything with comments such as "unchanged".
- Change as little as possible. If one operator or one condition is wrong, fix that and leave the rest of the file byte-for-byte identical.
- Keep the existing code style: explicit return types, no \`any\`, no new dependencies, no suppression comments.

Reply in exactly this format:

### DIAGNOSIS
<two sentences: what is broken and why the tests fail>

### FILE: <path from the repository root>
\`\`\`ts
<the complete corrected file>
\`\`\`

Repeat the FILE block for each file you change.

--- JEST FAILURE LOG ---
${trimLog(log)}

--- SOURCE FILES ---
${renderBundle(suspects)}
`;

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({
    model: MODEL,
    temperature: 0,
    max_tokens: 4_000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }),
});

if (!response.ok) {
  fail(`GitHub Models answered ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const reply = payload?.choices?.[0]?.message?.content;
if (typeof reply !== 'string' || reply.trim() === '') {
  fail('GitHub Models returned an empty completion.');
}

const diagnosis = parseDiagnosis(reply);
const patch = parsePatch(reply);
if (patch.length === 0) {
  fail(`The agent returned no file blocks. Raw reply:\n${reply}`);
}

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
  'auto-heal-report.md',
  `**Model:** \`${MODEL}\` on GitHub Models\n\n` +
    `**Files rewritten:** ${changed.map((path) => `\`${path}\``).join(', ')}\n\n` +
    `### Agent diagnosis\n\n${diagnosis}\n`,
);
