#!/usr/bin/env node
'use strict';
// Installs Claude Notch hooks into Claude Code (and optionally Codex CLI) settings.
// Usage: node hooks/install.js [--codex] [--statusline] [--uninstall] [--dry-run] [--home <dir>]
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_EVENTS = ['SessionStart', 'UserPromptSubmit', 'Notification', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd'];
const CODEX_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd'];
const OURS = ['claude-hook.js', 'statusline.js'];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const homeIdx = args.indexOf('--home');
const HOME = homeIdx >= 0 && args[homeIdx + 1] ? path.resolve(args[homeIdx + 1]) : os.homedir();
const DRY = flag('--dry-run');
const UNINSTALL = flag('--uninstall');
const DO_CODEX = flag('--codex');
const DO_STATUSLINE = flag('--statusline');

const DIR = __dirname.replace(/\\/g, '/');
const HOOK_CMD = `node "${DIR}/claude-hook.js"`;
const CODEX_CMD = `${HOOK_CMD} --source codex`;
const STATUS_CMD = `node "${DIR}/statusline.js"`;

const log = (m) => console.log(m);
const isOurs = (cmd) => typeof cmd === 'string' && OURS.some((n) => cmd.includes(n));

function readJson(file) {
  if (!fs.existsSync(file)) return { data: {}, existed: false };
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (!text.trim()) return { data: {}, existed: true };
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error(`${file} is not valid JSON (${e.message}); not touching it`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file} is not a JSON object; not touching it`);
  return { data, existed: true };
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function backup(file) {
  let dest = `${file}.bak-${stamp()}`;
  for (let i = 1; fs.existsSync(dest); i++) dest = `${file}.bak-${stamp()}-${i}`;
  fs.copyFileSync(file, dest);
  return dest;
}

function save(file, data, existed) {
  if (DRY) { log(`[dry-run] would write ${file}`); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (existed) log(`backup: ${backup(file)}`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  log(`wrote: ${file}`);
}

function hasCommand(arr, cmd) {
  return arr.some((g) => g && Array.isArray(g.hooks) && g.hooks.some((h) => h && h.command === cmd));
}

// Returns number of changes.
function addHooks(data, events, makeHandler, cmd) {
  if (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)) data.hooks = {};
  let changes = 0;
  for (const ev of events) {
    if (!Array.isArray(data.hooks[ev])) data.hooks[ev] = [];
    if (hasCommand(data.hooks[ev], cmd)) { log(`  ${ev}: already installed`); continue; }
    data.hooks[ev].push({ hooks: [makeHandler(cmd)] });
    log(`  ${DRY ? '[dry-run] would add' : 'add'} ${ev}`);
    changes++;
  }
  return changes;
}

function removeHooks(data) {
  let changes = 0;
  if (!data.hooks || typeof data.hooks !== 'object') return 0;
  for (const ev of Object.keys(data.hooks)) {
    const groups = data.hooks[ev];
    if (!Array.isArray(groups)) continue;
    const kept = [];
    for (const g of groups) {
      if (g && Array.isArray(g.hooks)) {
        const before = g.hooks.length;
        g.hooks = g.hooks.filter((h) => !(h && (isOurs(h.command) || isOurs(h.commandWindows))));
        const removed = before - g.hooks.length;
        if (removed) { changes += removed; log(`  ${DRY ? '[dry-run] would remove' : 'remove'} ${ev}`); }
        if (removed && g.hooks.length === 0) continue;
      }
      kept.push(g);
    }
    if (kept.length) data.hooks[ev] = kept; else delete data.hooks[ev];
  }
  return changes;
}

function doClaude() {
  const file = path.join(HOME, '.claude', 'settings.json');
  log(`${UNINSTALL ? 'Uninstalling from' : 'Installing into'} ${file}`);
  const { data, existed } = readJson(file);
  let changes = 0;
  if (UNINSTALL) {
    changes += removeHooks(data);
    if (data.statusLine && isOurs(data.statusLine.command)) {
      delete data.statusLine;
      log(`  ${DRY ? '[dry-run] would remove' : 'remove'} statusLine`);
      changes++;
    }
  } else {
    changes += addHooks(data, CLAUDE_EVENTS, (command) => ({ type: 'command', command, async: true }), HOOK_CMD);
    if (DO_STATUSLINE) {
      if (!data.statusLine) {
        data.statusLine = { type: 'command', command: STATUS_CMD };
        log(`  ${DRY ? '[dry-run] would set' : 'set'} statusLine`);
        changes++;
      } else if (isOurs(data.statusLine.command)) {
        log('  statusLine: already installed');
      } else {
        log('  statusLine: you already have one, leaving it unchanged. To feed the notch, make your script write:');
        log('    1) <home>/.claude/usage/claude-limits.json  {"updated_at","five_hour":{"used_percent","resets_at"},"seven_day":{...}}');
        log('    2) <home>/.claude/usage/centik/status/<session_id>.json  {"v":1,"model","ctx","cost","added","removed","updated"}');
        log(`    (see ${DIR}/statusline.js for a reference implementation)`);
      }
    }
  }
  if (changes) save(file, data, existed); else log('  nothing to change');
}

function doCodex() {
  const file = path.join(HOME, '.codex', 'hooks.json');
  log(`${UNINSTALL ? 'Uninstalling from' : 'Installing into'} ${file}`);
  const { data, existed } = readJson(file);
  let changes;
  if (UNINSTALL) {
    changes = removeHooks(data);
  } else {
    changes = addHooks(data, CODEX_EVENTS, (command) => ({ type: 'command', command, commandWindows: command, async: true }), CODEX_CMD);
  }
  if (changes) save(file, data, existed); else log('  nothing to change');
  if (!UNINSTALL) log("Note: approve the new hooks in Codex with /hooks.");
}

try {
  doClaude();
  if (DO_CODEX) doCodex();
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
