'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const HOOK = path.join(__dirname, 'claude-hook.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'centik-test-'));
const sessDir = path.join(tmp, 'sessions');
const env = { ...process.env, CENTIK_DIR: tmp };
delete env.CENTIK_WORKER;

let failed = 0;
const sid = (n) => `test-${n}`;
const fileOf = (id) => path.join(sessDir, `${id}.json`);
const read = (id) => JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));

function fire(id, ev, extraEnv) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ session_id: id, cwd: 'D:\\projeler\\demo', transcript_path: 'x.jsonl', ...ev }),
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
}

function scenario(name, fn) {
  let ok = false;
  let err = '';
  try { ok = fn() !== false; } catch (e) { err = ` (${e.message})`; }
  if (!ok) failed++;
  console.log(`${ok ? 'GEÇTİ' : 'KALDI'}  ${name}${err}`);
}

scenario('1. SessionStart idle; UserPromptSubmit busy + turn_started', () => {
  const id = sid(1);
  fire(id, { hook_event_name: 'SessionStart' });
  const a = read(id);
  if (a.status !== 'idle' || a.project !== 'demo') return false;
  fire(id, { hook_event_name: 'UserPromptSubmit' });
  const b = read(id);
  return b.status === 'busy' && typeof b.turn_started === 'number';
});

scenario('2. permission_prompt waiting + question; PostToolUse busy', () => {
  const id = sid(1);
  fire(id, { hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Izin?' });
  const a = read(id);
  if (a.status !== 'waiting' || a.question !== 'Izin?') return false;
  fire(id, { hook_event_name: 'PostToolUse' });
  const b = read(id);
  return b.status === 'busy' && b.question === null;
});

scenario('3. SubagentStart/Stop + Stop akışı', () => {
  const id = sid(1);
  fire(id, { hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'gelistirici' });
  if (Object.keys(read(id).agents).length !== 1) return false;
  fire(id, { hook_event_name: 'SubagentStart', agent_id: 'a2', agent_type: '' });
  if (Object.keys(read(id).agents).length !== 1) return false;
  fire(id, { hook_event_name: 'Stop' });
  if (read(id).status !== 'resting') return false;
  fire(id, { hook_event_name: 'SubagentStop', agent_id: 'a1' });
  const s = read(id);
  return s.status === 'done' && typeof s.done_at === 'number' && Object.keys(s.agents).length === 0;
});

scenario('4. idle_prompt durumu değiştirmez', () => {
  const id = sid(1);
  const before = read(id).status;
  fire(id, { hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'x' });
  const s = read(id);
  return s.status === before && s.question === null;
});

scenario('5. SessionEnd dosyayı siler', () => {
  const id = sid(1);
  fire(id, { hook_event_name: 'SessionEnd' });
  return !fs.existsSync(fileOf(id));
});

scenario('6. CENTIK_WORKER=1 iken dosya oluşmaz', () => {
  const id = sid(6);
  const r = fire(id, { hook_event_name: 'UserPromptSubmit' }, { CENTIK_WORKER: '1' });
  return r.status === 0 && !fs.existsSync(fileOf(id));
});

scenario('7. Bozuk JSON: çıkış 0, stdout/stderr boş', () => {
  const r = spawnSync('node', [HOOK], { input: '{not json', env, encoding: 'utf8' });
  return r.status === 0 && r.stdout === '' && r.stderr === '';
});

const pending = [];
fire(sid(8), { hook_event_name: 'SessionStart' });
for (let i = 0; i < 10; i++) {
  pending.push(new Promise((resolve) => {
    const p = spawn('node', [HOOK], { env, stdio: ['pipe', 'ignore', 'ignore'] });
    p.on('close', resolve);
    p.stdin.end(JSON.stringify({
      session_id: sid(8), hook_event_name: 'SubagentStart', agent_id: `ag${i}`, agent_type: 'gelistirici',
      cwd: 'D:\\projeler\\demo',
    }));
  }));
}

Promise.all(pending).then(() => {
  scenario('8. Eşzamanlılık: 10 kayıt', () => Object.keys(read(sid(8)).agents).length === 10);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  const left = fs.existsSync(tmp);
  if (left) { console.log('KALDI  geçici klasör silinemedi'); failed++; }
  console.log(failed ? `\n${failed} senaryo KALDI` : '\nHepsi GEÇTİ');
  process.exit(failed ? 1 : 0);
});
