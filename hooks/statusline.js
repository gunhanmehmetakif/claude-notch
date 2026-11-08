#!/usr/bin/env node
'use strict';
// Claude Code status line for Claude Notch. Reads status JSON from stdin, prints a short line and
// writes claude-limits.json + centik/status/<session_id>.json (see docs/SOZLESME.md).
const fs = require('fs');
const path = require('path');
const os = require('os');

let d = {};
try { d = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { d = {}; }
if (!d || typeof d !== 'object') d = {};

const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? null : o[k]), obj);
const now = () => Math.floor(Date.now() / 1000);

const model = get(d, 'model.display_name') || get(d, 'model.id') || '?';
const fiveH = n(get(d, 'rate_limits.five_hour.used_percentage'));
const fiveR = get(d, 'rate_limits.five_hour.resets_at');
const sevenD = n(get(d, 'rate_limits.seven_day.used_percentage'));
const sevenR = get(d, 'rate_limits.seven_day.resets_at');
const ctx = n(get(d, 'context_window.used_percentage'));
const cost = n(get(d, 'cost.total_cost_usd'));
const added = n(get(d, 'cost.total_lines_added'));
const removed = n(get(d, 'cost.total_lines_removed'));

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) { /* ignore */ }
    throw e;
  }
}

const usageDir = path.join(os.homedir(), '.claude', 'usage');

// Format must not change: other tools read this file.
if (fiveH !== null || sevenD !== null) {
  try {
    writeAtomic(path.join(usageDir, 'claude-limits.json'), {
      updated_at: now(),
      five_hour: { used_percent: fiveH, resets_at: fiveR },
      seven_day: { used_percent: sevenD, resets_at: sevenR },
    });
  } catch (e) { /* ignore */ }
}

const sid = typeof d.session_id === 'string' && /^[A-Za-z0-9_-]+$/.test(d.session_id) ? d.session_id : null;
if (sid) {
  try {
    const root = process.env.CENTIK_DIR || path.join(usageDir, 'centik');
    writeAtomic(path.join(root, 'status', sid + '.json'), {
      v: 1, model, ctx, cost, added, removed, updated: now(),
    });
  } catch (e) { /* ignore */ }
}

const DIM = '\x1b[2m';
const RST = '\x1b[0m';
const parts = [model];
if (fiveH !== null) parts.push(`5h ${Math.round(fiveH)}%`);
if (sevenD !== null) parts.push(`7d ${Math.round(sevenD)}%`);
if (ctx !== null) parts.push(`ctx ${Math.round(ctx)}%`);
process.stdout.write(parts.join(`${DIM} · ${RST}`));
