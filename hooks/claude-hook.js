'use strict';
// Claude Code hook: keeps sessions/<id>.json up to date (see docs/SOZLESME.md).
// Must stay silent: no stdout/stderr output, always exit code 0.
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK_WAIT_MS = 1000;
const LOCK_STALE_MS = 10000;
const ACTIVE_NOTIFICATIONS = ['permission_prompt', 'elicitation_dialog', 'agent_needs_input'];
// Codex CLI calls the same script with `--source codex` (~/.codex/hooks.json).
const SOURCE = process.argv.includes('--source') && process.argv[process.argv.indexOf('--source') + 1] === 'codex' ? 'codex' : 'claude';
const AGENT_KIND = SOURCE === 'codex' ? 'gpt' : 'claude';
let EVENT = '';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(lockPath, 'wx'));
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST' && e.code !== 'EPERM' && e.code !== 'EACCES') return false;
    }
    try {
      if (Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
        fs.unlinkSync(lockPath);
        continue;
      }
    } catch (e) { /* lock vanished or racing; retry */ }
    if (Date.now() >= deadline) return false;
    sleep(5 + Math.floor(Math.random() * 10));
  }
}

function readSession(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (s && typeof s === 'object' && !Array.isArray(s)) return s;
  } catch (e) { /* missing or corrupt */ }
  return null;
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ }
    throw e;
  }
}

function apply(ev, s, now) {
  const name = ev.hook_event_name;
  switch (name) {
    case 'SessionStart':
      break;
    case 'UserPromptSubmit':
      s.status = 'busy';
      s.question = null;
      s.turn_started = now;
      s.done_at = null;
      break;
    case 'Notification':
      if (!ACTIVE_NOTIFICATIONS.includes(ev.notification_type)) return false;
      s.status = 'waiting';
      s.question = typeof ev.message === 'string' ? ev.message : null;
      break;
    case 'PermissionRequest': {
      const ti = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
      s.status = 'waiting';
      s.question = typeof ti.description === 'string' && ti.description
        ? ti.description
        : `${ev.tool_name || 'Araç'} için onay istiyor`;
      break;
    }
    case 'PostToolUse':
      if (s.status !== 'waiting') return false;
      s.status = 'busy';
      s.question = null;
      break;
    case 'SubagentStart': {
      const type = typeof ev.agent_type === 'string' ? ev.agent_type : '';
      if (!type || !ev.agent_id) return false;
      s.agents[String(ev.agent_id)] = { kind: AGENT_KIND, type, started: now };
      if (s.status === 'idle' || s.status === 'done') s.status = 'busy';
      break;
    }
    case 'SubagentStop':
      if (!ev.agent_id) return false;
      delete s.agents[String(ev.agent_id)];
      if (s.status === 'resting' && Object.keys(s.agents).length === 0) {
        s.status = 'done';
        s.done_at = now;
      }
      break;
    case 'Stop':
      s.question = null;
      if (Object.keys(s.agents).length > 0) {
        s.status = 'resting';
      } else {
        s.status = 'done';
        s.done_at = now;
      }
      break;
    default:
      return false;
  }
  return true;
}

// Nearest ancestor (max 6 levels) holding .git or CLAUDE.md; otherwise the cwd itself.
function projectRoot(cwd) {
  let dir = cwd.replace(/[\\/]+$/, '');
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'CLAUDE.md'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return cwd;
}

function main() {
  if (process.env.CENTIK_WORKER === '1') return;
  let raw;
  try { raw = fs.readFileSync(0, 'utf8'); } catch (e) { return; }
  if (!raw || !raw.trim()) return;
  const ev = JSON.parse(raw);
  if (!ev || typeof ev !== 'object') return;
  EVENT = String(ev.hook_event_name || '');
  const id = ev.session_id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) return;

  const root = process.env.CENTIK_DIR || path.join(os.homedir(), '.claude', 'usage', 'centik');
  const dir = path.join(root, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  const lockPath = path.join(dir, `${id}.lock`);

  const locked = acquireLock(lockPath);
  try {
    if (ev.hook_event_name === 'SessionEnd') {
      try { fs.unlinkSync(file); } catch (e) { /* already gone */ }
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    let s = readSession(file);
    if (!s) {
      s = {
        v: 1, id, source: SOURCE, project: '', cwd: '', status: 'idle', question: null,
        agents: {}, turn_started: null, done_at: null, transcript: null, updated: now,
      };
    }
    if (!s.agents || typeof s.agents !== 'object') s.agents = {};
    // The shell may cd into subfolders; name the session after its project root, set once.
    if (typeof ev.cwd === 'string' && ev.cwd && !s.cwd) {
      s.cwd = projectRoot(ev.cwd);
      s.project = path.basename(s.cwd.replace(/[\\/]+$/, '')) || s.cwd;
    }
    if (typeof ev.transcript_path === 'string' && ev.transcript_path) s.transcript = ev.transcript_path;
    if (!apply(ev, s, now)) return;
    s.updated = now;
    writeAtomic(file, s);
  } finally {
    if (locked) { try { fs.unlinkSync(lockPath); } catch (e) { /* ignore */ } }
  }
}

try {
  main();
} catch (e) { /* stay silent */ }
// Codex docs ask Stop/SubagentStop hooks for JSON on exit 0; "{}" is a no-op. Claude stays fully silent.
if (SOURCE === 'codex' && (EVENT === 'Stop' || EVENT === 'SubagentStop')) {
  try { process.stdout.write('{}'); } catch (e) { /* ignore */ }
}
process.exit(0);
