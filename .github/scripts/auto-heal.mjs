// Auto-healing step for .github/workflows/ci.yml.
//
// Reads the Jest failure log left behind by the `test` job, picks the source
// files it implicates, asks Claude for corrected versions of them, and writes
// the reply back into the working tree. The workflow then re-runs lint,
// typecheck and the suite before opening a pull request.
//
// The model may only rewrite files under src/. Test files and anything outside
// src/ are read-only context, so a patch cannot make the build green by
// relaxing an assertion.
//
// The call is plain HTTP rather than the Anthropic SDK on purpose: this script
// runs only on the CI runner, and the alternative is a dependency in
// package.json that the application itself never imports.

import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = process.env.AUTO_HEAL_MODEL ?? 'claude-opus-5-5';

const LOG_PATH = process.env.AUTO_HEAL_LOG ?? 'test-results.log';
const PROMPT_PATH = 'agent-prompt.md';
const RESPONSE_PATH = 'agent-response.md';
const REPORT_PATH = 'auto-heal-report.md';

const SYSTEM_PROMPT = [
  'You repair failing builds in a TypeScript Express API.',
  'You return corrected source files and nothing outside the format you are given.',
  'You never weaken a test, an assertion or a validation rule to make a build pass.',
].join(' ');

// The free GitHub Models tier caps the request size, so both the log and the
// bundle of source files are trimmed before they are sent.
/** Which credential answered, for the pull-request body. */
let routeTaken = 'unknown';

/** Backoff between retries of a 429 or 5xx, in milliseconds. */
const RETRY_DELAYS = [15_000, 45_000, 90_000, 180_000];

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
 * The part of the log that describes failures. Jest bullets a passing suite's
 * console output with the same `●`, and prints suites in whatever order they
 * finish, so the scan tracks which suite header it is under and keeps only the
 * blocks that belong to a failing one.
 */
function failureSection(log) {
  const kept = [];
  let inFailure = false;
  for (const line of log.split('\n')) {
    if (line.startsWith('FAIL ')) {
      inFailure = true;
    } else if (line.startsWith('PASS ') || line.startsWith('Test Suites:')) {
      inFailure = false;
    }
    if (inFailure) kept.push(line);
  }
  return kept.join('\n');
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

function buildPrompt(log, suspects) {
  return `Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.

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
`;
}

/**
 * A subscription token from `claude setup-token` belongs to the Claude Code
 * client, and the Messages API rate-limits it when a script calls the endpoint
 * directly, so that credential runs the CLI instead. A console API key calls
 * the endpoint.
 */
function transport() {
  const clean = (value) => value?.replace(/\s+/g, '') ?? '';

  const apiKey = clean(process.env.ANTHROPIC_API_KEY);
  if (apiKey) return { kind: 'api', apiKey };

  const oauthToken = clean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
  if (oauthToken) return { kind: 'cli', oauthToken };

  fail(
    'Neither CLAUDE_CODE_OAUTH_TOKEN nor ANTHROPIC_API_KEY is set. ' +
      'Add one under Settings > Secrets and variables > Actions.',
  );
}

/** Runs `claude -p` with the prompt on stdin and returns what it printed. */
function askViaCli(prompt, oauthToken) {
  return new Promise((resolve) => {
    const child = execFile(
      'claude',
      ['-p', '--model', MODEL, '--allowedTools', ''],
      {
        env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: oauthToken },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) fail(`claude -p failed: ${error.message}\n${stderr}`);
        resolve(stdout);
      },
    );
    child.stdin.end(prompt);
  });
}

/** Posts the prompt to the Messages API, retrying a 429 or 5xx. */
async function askViaApi(prompt, apiKey) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  let response;
  for (let attempt = 1; ; attempt += 1) {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body,
    });

    if (response.ok) break;

    const detail = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt > RETRY_DELAYS.length) {
      fail(`The Messages API answered ${response.status}: ${detail}`);
    }

    const header = Number(response.headers.get('retry-after'));
    const wait =
      Number.isFinite(header) && header > 0
        ? header * 1_000
        : RETRY_DELAYS[attempt - 1];
    console.log(
      `auto-heal: ${response.status} on attempt ${attempt}, retrying in ${wait / 1_000}s`,
    );
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  const payload = await response.json();
  if (payload.stop_reason === 'refusal')
    fail('The model declined the request.');

  console.log(
    `auto-heal: ${payload.usage?.input_tokens ?? '?'} input and ` +
      `${payload.usage?.output_tokens ?? '?'} output tokens, stop reason ${payload.stop_reason}`,
  );

  return (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function askClaude(prompt) {
  const route = transport();
  routeTaken = route.kind;
  console.log(`auto-heal: asking ${MODEL} via the ${route.kind}`);

  const text =
    route.kind === 'cli'
      ? await askViaCli(`${SYSTEM_PROMPT}\n\n${prompt}`, route.oauthToken)
      : await askViaApi(prompt, route.apiKey);

  if (text.trim() === '') fail('The model returned an empty completion.');
  return text;
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

/** Writes back the files the reply contains, refusing anything out of bounds. */
function applyPatch(reply, sources) {
  const patch = parsePatch(reply);
  if (patch.length === 0) {
    fail(
      `The agent returned no file blocks. Raw reply:\n${reply.slice(0, 4_000)}`,
    );
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
  return changed;
}

let log;
try {
  log = readFileSync(LOG_PATH, 'utf8');
} catch {
  fail(`${LOG_PATH} is missing — the build failed before the tests ran.`);
}

const sources = collectSources('src');
const suspects = rankByRelevance(sources, log);
console.log(`auto-heal: model ${MODEL}`);
console.log(
  `auto-heal: candidate files, most relevant first\n  ${suspects.join('\n  ')}`,
);

const prompt = buildPrompt(log, suspects);
writeFileSync(PROMPT_PATH, prompt);

const reply = await askClaude(prompt);
writeFileSync(RESPONSE_PATH, reply);

const changed = applyPatch(reply, sources);
console.log(`auto-heal: rewrote\n  ${changed.join('\n  ')}`);

writeFileSync(
  REPORT_PATH,
  `**Model:** \`${MODEL}\`, reached through the ${routeTaken === 'cli' ? 'Claude Code CLI' : 'Anthropic Messages API'}\n\n` +
    `**Files rewritten:** ${changed.map((path) => `\`${path}\``).join(', ')}\n\n` +
    `### Agent diagnosis\n\n${parseDiagnosis(reply)}\n`,
);
