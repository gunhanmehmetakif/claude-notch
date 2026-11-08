'use strict';
// Tests for install.js and statusline.js using a temporary home directory.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const INSTALL = path.join(__dirname, 'install.js');
const STATUS = path.join(__dirname, 'statusline.js');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'centik-test-'));
let failed = 0;

function check(name, cond, extra) {
  console.log(`${cond ? 'GEÇTİ' : 'KALDI'}  ${name}${!cond && extra ? ' -> ' + extra : ''}`);
  if (!cond) failed++;
}
function newHome(label) {
  const h = path.join(tmpRoot, label);
  fs.mkdirSync(h, { recursive: true });
  return h;
}
function run(home, ...a) {
  const r = spawnSync(process.execPath, [INSTALL, ...a, '--home', home], { encoding: 'utf8' });
  if (r.status !== 0) console.log(r.stdout + r.stderr);
  return r;
}
const settingsPath = (h) => path.join(h, '.claude', 'settings.json');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const hookCount = (data) => Object.values(data.hooks || {}).reduce((s, a) => s + a.length, 0);

try {
  // (a) fresh install
  const a = newHome('a');
  run(a);
  const sa = readJson(settingsPath(a));
  const events = ['SessionStart', 'UserPromptSubmit', 'Notification', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd'];
  check('(a) 8 events installed', events.every((e) => sa.hooks[e] && sa.hooks[e].length === 1));
  const h0 = sa.hooks.Stop[0].hooks[0];
  check('(a) handler shape', h0.type === 'command' && h0.async === true && /^node ".*\/claude-hook\.js"$/.test(h0.command), h0.command);

  // (b) existing hooks + statusLine preserved; (f) backup
  const b = newHome('b');
  fs.mkdirSync(path.join(b, '.claude'), { recursive: true });
  const other = { type: 'command', command: 'node other.js' };
  const orig = { theme: 'dark', statusLine: { type: 'command', command: 'node mine.js' }, hooks: { Stop: [{ hooks: [other] }], PreToolUse: [{ hooks: [other] }] } };
  fs.writeFileSync(settingsPath(b), JSON.stringify(orig));
  run(b, '--statusline');
  const sb = readJson(settingsPath(b));
  check('(b) other hook kept first', sb.hooks.Stop[0].hooks[0].command === 'node other.js' && sb.hooks.Stop.length === 2);
  check('(b) unrelated event + key kept', sb.hooks.PreToolUse.length === 1 && sb.theme === 'dark');
  check('(b) existing statusLine untouched', sb.statusLine.command === 'node mine.js');
  const baks = fs.readdirSync(path.join(b, '.claude')).filter((f) => /^settings\.json\.bak-\d{8}-\d{6}/.test(f));
  check('(f) backup created', baks.length === 1);
  check('(f) backup holds original', baks.length === 1 && JSON.stringify(readJson(path.join(b, '.claude', baks[0]))) === JSON.stringify(orig));

  // statusLine added when absent
  const b2 = newHome('b2');
  run(b2, '--statusline');
  check('(b) statusLine set when absent', /statusline\.js"$/.test(readJson(settingsPath(b2)).statusLine.command));

  // (c) idempotent
  const before = hookCount(readJson(settingsPath(b)));
  run(b, '--statusline');
  check('(c) second install adds nothing', hookCount(readJson(settingsPath(b))) === before);

  // dry-run writes nothing
  const dr = newHome('dr');
  run(dr, '--dry-run', '--codex');
  check('dry-run writes nothing', !fs.existsSync(path.join(dr, '.claude')) && !fs.existsSync(path.join(dr, '.codex')));

  // (d) codex
  const d = newHome('d');
  fs.mkdirSync(path.join(d, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(d, '.codex', 'hooks.json'), JSON.stringify({ description: 'x', hooks: { Stop: [{ hooks: [other] }] } }));
  const rd = run(d, '--codex');
  const cx = readJson(path.join(d, '.codex', 'hooks.json'));
  const ch = cx.hooks.PermissionRequest && cx.hooks.PermissionRequest[0].hooks[0];
  check('(d) codex PermissionRequest handler', !!ch && ch.async === true && ch.command === ch.commandWindows && ch.command.endsWith(' --source codex'));
  check('(d) codex has no Notification, keeps other', !cx.hooks.Notification && cx.hooks.Stop.length === 2 && cx.description === 'x');
  check('(d) codex /hooks warning', /\/hooks/.test(rd.stdout));
  run(d, '--codex');
  check('(d) codex idempotent', cx.hooks.Stop.length === 2 && readJson(path.join(d, '.codex', 'hooks.json')).hooks.Stop.length === 2);

  // (e) uninstall
  run(b, '--uninstall');
  const se = readJson(settingsPath(b));
  check('(e) uninstall keeps other hooks', se.hooks.Stop.length === 1 && se.hooks.Stop[0].hooks[0].command === 'node other.js' && se.hooks.PreToolUse.length === 1);
  check('(e) emptied events removed', !se.hooks.SessionStart && !se.hooks.Notification);
  check('(e) foreign statusLine kept', se.statusLine.command === 'node mine.js');
  run(b2, '--uninstall');
  check('(e) our statusLine removed', !readJson(settingsPath(b2)).statusLine);
  run(d, '--codex', '--uninstall');
  const cu = readJson(path.join(d, '.codex', 'hooks.json'));
  check('(e) codex uninstall', cu.hooks.Stop.length === 1 && !cu.hooks.SessionStart);

  // (g) statusline.js
  const g = newHome('g');
  const reset = Math.floor(Date.now() / 1000) + 3600;
  const input = JSON.stringify({
    session_id: 'abc-123_X',
    model: { display_name: 'Opus 5.5' },
    rate_limits: { five_hour: { used_percentage: 34, resets_at: reset }, seven_day: { used_percentage: 12, resets_at: reset + 99999 } },
    context_window: { used_percentage: 41 },
    cost: { total_cost_usd: 1.82, total_lines_added: 120, total_lines_removed: 30 },
  });
  const env = { ...process.env, USERPROFILE: g, HOME: g };
  delete env.CENTIK_DIR;
  const rg = spawnSync(process.execPath, [STATUS], { input, encoding: 'utf8', env });
  const plain = rg.stdout.replace(/\x1b\[[0-9;]*m/g, '');
  check('(g) line printed', plain === 'Opus 5.5 · 5h 34% · 7d 12% · ctx 41%', plain);
  const lim = readJson(path.join(g, '.claude', 'usage', 'claude-limits.json'));
  check('(g) claude-limits.json format', lim.five_hour.used_percent === 34 && lim.five_hour.resets_at === reset && lim.seven_day.used_percent === 12 && typeof lim.updated_at === 'number');
  const st = readJson(path.join(g, '.claude', 'usage', 'centik', 'status', 'abc-123_X.json'));
  check('(g) status file', st.v === 1 && st.model === 'Opus 5.5' && st.ctx === 41 && st.cost === 1.82 && st.added === 120 && st.removed === 30);
  const rg2 = spawnSync(process.execPath, [STATUS], { input: JSON.stringify({ session_id: '../evil' }), encoding: 'utf8', env });
  check('(g) unsafe id skipped, garbage ok', rg2.status === 0 && fs.readdirSync(path.join(g, '.claude', 'usage', 'centik', 'status')).join() === 'abc-123_X.json');
  const rg3 = spawnSync(process.execPath, [STATUS], { input: 'not json', encoding: 'utf8', env });
  check('(g) bad stdin still prints', rg3.status === 0 && rg3.stdout.includes('?'));
} catch (e) {
  console.log(`KALDI  unexpected error: ${e.stack}`);
  failed++;
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} test KALDI` : '\nHepsi GEÇTİ');
process.exit(failed ? 1 : 0);
