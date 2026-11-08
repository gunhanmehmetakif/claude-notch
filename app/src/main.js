/* Claude Çentiği front end: single render(state) over example data. */
const CHEV_UP = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10l4.5-4.5 4.5 4.5"/></svg>';
const CHEV_DOWN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6l4.5 4.5 4.5-4.5"/></svg>';
const WAVE = 'M0 50 Q12.5 43 25 50 T50 50 T75 50 T100 50 T125 50 T150 50 T175 50 T200 50 V150 H0 Z';
const RUNNER = `<svg class="cr-svg" viewBox="-9 -3 31 15" shape-rendering="crispEdges" aria-hidden="true">
  <g><rect class="cr-line l1" x="-3" y="1" width="4" height="1"/><rect class="cr-line l2" x="-5" y="3" width="5" height="1"/><rect class="cr-line l3" x="-2" y="6.5" width="3" height="1"/></g>
  <g><rect class="cr-puff p1" x="2" y="8.6" width="1.4" height="1.4"/><rect class="cr-puff p2" x="2.8" y="9" width="1" height="1"/><rect class="cr-puff p3" x="1.4" y="9.1" width=".9" height=".9"/></g>
  <line class="cr-ground cr-anim" x1="-9" y1="11.4" x2="22" y2="11.4"/>
  <rect class="cr-shadow cr-anim" x="3" y="10.2" width="12" height=".7"/>
  <g class="cr-mug"><rect x="18" y="8" width="2.4" height="2.2"/><rect x="20.4" y="8.6" width=".7" height="1"/><rect class="steam" x="18.5" y="6.3" width=".6" height=".9"/><rect class="steam s2" x="19.6" y="5.7" width=".6" height=".9"/></g>
  <g class="cr-body cr-anim">
    <g class="cr-leg-a cr-anim cr-fill"><rect x="4" y="8" width="1" height="2"/><rect x="11" y="8" width="1" height="2"/></g>
    <g class="cr-leg-b cr-anim cr-fill"><rect x="6" y="8" width="1" height="2"/><rect x="13" y="8" width="1" height="2"/></g>
    <rect class="cr-arm-l cr-anim cr-fill" x="1" y="4" width="2" height="2"/>
    <rect class="cr-arm-r cr-anim cr-fill" x="15" y="4" width="2" height="2"/>
    <rect class="cr-fill" x="3" y="0" width="12" height="8"/>
    <g class="cr-eyes"><rect x="5" y="2" width="1" height="2"/><rect x="12" y="2" width="1" height="2"/></g>
    <g class="cr-cig">
      <g class="cig-hand"><rect class="cr-fill" x="15" y="5" width="2" height="2"/><rect class="cig-filter" x="17" y="5.5" width=".8" height=".7"/><rect class="cig-paper" x="17.8" y="5.5" width="2" height=".7"/><rect class="cig-ember" x="19.8" y="5.5" width=".6" height=".7"/>
        <rect class="smoke" x="19.9" y="4.4" width=".6" height=".6"/><rect class="smoke s2" x="19.9" y="4.4" width=".7" height=".7"/><rect class="smoke s3" x="19.9" y="4.4" width=".5" height=".5"/></g>
      <g class="cr-mouth"><rect class="m-o" x="8.4" y="5.1" width="1.6" height="1.3"/><rect class="m-in" x="8.9" y="5.5" width=".6" height=".5"/></g>
      <g class="exhale"><rect x="8.9" y="4.6" width=".8" height=".8"/><rect class="e2" x="9.4" y="4" width="1" height="1"/><rect class="e3" x="8.6" y="3.6" width=".7" height=".7"/></g>
    </g>
    <g class="cr-tired">
      <rect class="t-mouth" x="8.2" y="5" width="1.8" height=".9"/><rect class="t-tongue" x="8.7" y="5.8" width=".9" height=".8"/>
      <rect class="sweat" x="14.6" y="-.4" width=".6" height=".8"/><rect class="sweat w2" x="15" y="1" width=".5" height=".7"/>
      <rect class="sweat l" x="2.8" y="-.2" width=".6" height=".8"/><rect class="sweat l w3" x="2.4" y="1.2" width=".5" height=".7"/>
      <rect class="drip" x="13.4" y=".6" width=".5" height=".8"/>
    </g>
  </g></svg><span class="bang">!</span><span class="zz">z<i>z</i></span>`;

let gid = 0;
function gaugeHTML(cls, size) {
  const id = 'clip' + (gid++);
  return `<div class="gauge ${cls}" style="--size:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><clipPath id="${id}"><circle cx="50" cy="50" r="46"/></clipPath></defs>
    <circle class="g-track" cx="50" cy="50" r="46"/>
    <g clip-path="url(#${id})"><g class="g-level"><path class="g-wave back" d="${WAVE}"/><path class="g-wave" d="${WAVE}"/></g></g>
    <circle class="g-ring" cx="50" cy="50" r="47.5"/></svg><span class="g-pct"></span></div>`;
}
function setGauge(el, p) {
  el.style.setProperty('--pct', p);
  el.dataset.level = p >= 85 ? 'crit' : p >= 60 ? 'warn' : 'ok';
  el.querySelector('.g-pct').textContent = '%' + Math.round(p);
}

function runner(pose, size, extra = '', speed) {
  const sp = speed ? `;--cr-speed:${speed}s` : '';
  return `<div class="claude-runner ${extra}" data-pose="${pose}" style="--cr-size:${size}px${sp}">${RUNNER}</div>`;
}
// src 'codex' draws the main character grey like Codex agents.
function scene(pose, agents, main, mini, max = 3, src = 'claude') {
  const still = pose !== 'busy' && agents.length === 0;
  let h = `<div class="scene${still ? ' still' : ''}">` + runner(pose, main, src === 'codex' ? 'gpt' : '');
  agents.slice(0, max).forEach((k, i) => { h += runner('busy', mini, 'mini' + (k === 'gpt' ? ' gpt' : ''), [.34, .4, .37][i]); });
  if (agents.length > max) h += `<span class="more">+${agents.length - max}</span>`;
  return h + '</div>';
}
function applyPoses(root) {
  root.querySelectorAll('.claude-runner[data-pose]').forEach((r) => {
    const st = r.dataset.pose, c = r.classList;
    c.toggle('is-idle', st !== 'busy');
    c.toggle('is-sitting', st === 'resting' || st === 'idle');
    c.toggle('is-mug', st === 'resting');
    c.toggle('is-zz', st === 'idle');
    c.toggle('is-waiting', st === 'waiting');
    c.toggle('is-done', st === 'done');
    c.toggle('is-tired', st === 'tired');
  });
}

const WORD = { busy: 'çalışıyor', resting: 'agent\'ları bekliyor', waiting: 'soru soruyor', done: 'bitti' };
function overall(ss) {
  if (ss.some((s) => s.st === 'waiting')) return 'waiting';
  if (ss.some((s) => s.st === 'busy')) return 'busy';
  if (ss.some((s) => s.st === 'resting')) return 'resting';
  return 'idle';
}
function rowDesc(s) {
  const n = s.agents.length, ag = n ? ` · ${n} agent` : '';
  if (s.st === 'waiting') return s.q || 'Onayın bekleniyor';
  if (s.st === 'resting') return `${n} agent'ı bekliyor, mola veriyor`;
  if (s.st === 'done') return 'Bitti';
  return 'Çalışıyor' + ag;
}

function buildNotch() {
  const n = document.createElement('div');
  n.className = 'notch';
  n.innerHTML = `<div class="n-shell" role="group" aria-label="Claude çentiği">
    <div class="n-layer n-collapsed"><button class="chev" data-act="open" type="button" aria-label="Çentiği aç">${CHEV_DOWN}</button></div>
    <div class="n-layer n-compact" data-act="expand">
      <div class="q-mini">${gaugeHTML('c5', 40)}<small>5 sa</small></div>
      <div class="n-mid"><div class="slot-c"></div><div class="n-line"></div></div>
      <div class="q-mini">${gaugeHTML('c7', 40)}<small>7 gün</small></div>
      <button class="chev" data-act="collapse" type="button" aria-label="Sadece ok kalsın">${CHEV_UP}</button>
    </div>
    <div class="n-layer n-alert" data-act="expand"><div class="slot-a"></div><div class="n-text"><b class="a-main"></b><small class="a-sub"></small></div><span class="a-badge"></span></div>
    <div class="n-layer n-expanded">
      <div class="x-head" data-act="shrink"><b class="x-title"></b><span class="pill x-model">—</span></div>
      <div class="x-quotas">
        <div class="x-qrow"><span class="x-qname"><i class="lg"></i>Claude</span>
          <div class="x-cell">${gaugeHTML('c5 nopct', 36)}<div><b class="c5v"></b><small class="c5r"></small></div></div>
          <div class="x-cell">${gaugeHTML('c7 nopct', 36)}<div><b class="c7v"></b><small class="c7r"></small></div></div></div>
        <div class="x-qrow codex"><span class="x-qname"><i class="lg g"></i>Codex</span>
          <div class="x-cell">${gaugeHTML('x5 nopct', 36)}<div><b class="x5v"></b><small class="x5r"></small></div></div>
          <div class="x-cell">${gaugeHTML('x7 nopct', 36)}<div><b class="x7v"></b><small class="x7r"></small></div></div></div>
      </div>
      <div class="x-list"></div>
      <div class="x-foot"><span class="x-age">Son veri —</span><button class="chev" data-act="collapse" type="button" aria-label="Sadece ok kalsın">${CHEV_UP}</button><span><i class="lg"></i>Claude <i class="lg g"></i>Codex</span></div>
    </div></div>`;
  return n;
}


/* ---------- Time helpers ---------- */
function left(sec) { const m = Math.max(0, Math.round(sec / 60)), h = Math.floor(m / 60); return h ? `${h} sa ${m % 60} dk` : `${m} dk`; }
const weekday = (sec) => new Date(sec * 1000).toLocaleString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Quota used up in either Claude window (Codex does not count).
function isLimited(c) { return !!c && (c.p5 >= 100 || c.p7 >= 100); }

/* ---------- Render ---------- */
const root = document.getElementById('root');
const notch = buildNotch();
root.appendChild(notch);
const shell = notch.querySelector('.n-shell');

const $ = (sel) => notch.querySelector(sel);
function setQuota(k, q) {
  if (!q) return;
  notch.querySelectorAll('.gauge.' + k + '5').forEach((g) => setGauge(g, q.p5));
  notch.querySelectorAll('.gauge.' + k + '7').forEach((g) => setGauge(g, q.p7));
  $('.' + k + '5v').textContent = '%' + Math.round(q.p5);
  $('.' + k + '7v').textContent = '%' + Math.round(q.p7);
  $('.' + k + '5r').textContent = '5 sa · ' + (q.r5 ? left(q.r5 - Date.now() / 1000) + ' sonra' : '—');
  $('.' + k + '7r').textContent = '7 gün · ' + (q.r7 ? weekday(q.r7) : '—');
}

function render(s) {
  const ss = s.sessions, ov = overall(ss);
  notch.dataset.view = s.view;
  notch.dataset.overall = ov;
  notch.dataset.codex = s.codex ? '1' : '0';
  if (s.alert) notch.dataset.alert = s.alert.kind; else delete notch.dataset.alert;

  setQuota('c', s.claude);
  setQuota('x', s.codex);

  // Model, context and cost come from the focus session (the first one in sorted order).
  const f = ss[0];
  const pill = $('.x-model');
  pill.textContent = f ? `${f.model || '—'} · ${f.ctx == null ? '—' : '%' + Math.round(f.ctx)} · ${f.cost == null ? '—' : '$' + Number(f.cost).toFixed(2)}` : '—';
  pill.title = f ? `Bağlam ${f.ctx == null ? '—' : '%' + Math.round(f.ctx)} · Maliyet ${f.cost == null ? '—' : '$' + Number(f.cost).toFixed(2)}` : '';
  $('.x-age').textContent = s.age == null ? 'Son veri —' : `Son veri ${s.age} dk önce`;

  const limited = isLimited(s.claude);
  const key = JSON.stringify([ss, s.alert, limited]);
  if (notch._key !== key) {
    notch._key = key;
    const agents = ss.flatMap((x) => x.agents);
    const onlyCodex = ss.length > 0 && ss.every((x) => x.src === 'codex');
    $('.slot-c').innerHTML = limited ? scene('tired', [], 74, 34, 4) : scene(ov, agents, 74, 34, 4, onlyCodex ? 'codex' : 'claude');
    const line = $('.n-line');
    const w = ss.find((x) => x.st === 'waiting');
    line.classList.toggle('warn', !!w);
    if (limited) {
      const c = s.claude, reset = c.p5 >= 100 ? c.r5 : c.r7;
      line.innerHTML = `<b style="color:var(--crit)">Kota doldu</b> · ${reset ? left(reset - Date.now() / 1000) : '—'} sonra açılır`;
    } else if (!ss.length) line.innerHTML = '<b>Claude dinleniyor</b>';
    else if (w) line.innerHTML = `<b>${esc(w.p)}</b> soru soruyor`;
    else if (ss.length === 1) line.innerHTML = `<b>${esc(ss[0].p)}</b> · ${WORD[ss[0].st]}`;
    else line.innerHTML = `<b>${ss.length} proje</b> · ${agents.length} agent çalışıyor`;

    if (s.alert) {
      $('.slot-a').innerHTML = scene(s.alert.kind === 'ask' ? 'waiting' : 'done', [], 58, 0, 0, s.alert.src);
      $('.a-main').textContent = s.alert.p;
      $('.a-sub').textContent = s.alert.msg;
      $('.a-badge').textContent = s.alert.kind === 'ask' ? '?' : '✓';
    }
    $('.x-title').textContent = ss.length
      ? `${ss.length} proje · ${agents.length} agent` : 'Çalışan oturum yok';
    $('.x-list').innerHTML = ss.length
      ? ss.map((x) => `<div class="x-row st-${x.st}"><div class="x-scene">${limited ? scene('tired', [], 54, 26, 3) : scene(x.st, x.agents, 54, 26, 3, x.src)}</div>
          <div class="n-text"><b>${esc(x.p)}</b><small>${rowDesc(x)}</small></div><span class="x-time">${x.d} dk</span></div>`).join('')
      : '<div class="x-empty">Claude şu an çalışmıyor. Bir pencerede iş verince burada görünür.</div>';
    applyPoses(notch);
  }
  shell.style.height = s.view === 'expanded' ? $('.n-expanded').scrollHeight + 'px' : '';
  queueHitRect();
}

/* ---------- Hit rect (tells Rust which area catches the mouse) ---------- */
const tauri = window.__TAURI__;
const invoke = tauri && tauri.core ? tauri.core.invoke : null;
const listen = tauri && tauri.event ? tauri.event.listen : null;
const PAD = 6;
function sendHitRect() {
  if (!invoke) return;
  const r = shell.getBoundingClientRect();
  const x = Math.max(0, r.left - PAD);
  invoke('set_hit_rect', { x, y: 0, w: r.right + PAD - x, h: r.bottom + PAD }).catch(() => {});
}
let hitQueued = false;
function queueHitRect() {
  if (hitQueued) return;
  hitQueued = true;
  requestAnimationFrame(() => { hitQueued = false; sendHitRect(); });
}
shell.addEventListener('transitionend', (e) => { if (e.target === shell) sendHitRect(); });
new ResizeObserver(sendHitRect).observe(shell);

/* ---------- State + interaction ---------- */
const state = { sessions: [], alert: null, claude: null, codex: null, age: null, view: 'sleep' };
let alertTimer = null, backView = 'compact';
const alertQueue = [];
let prevStatus = null; // id -> status of the previous payload (null until the first one)

// Keep the view consistent with the active sessions; collapsed/expanded are the user's choice.
function settle() {
  const active = state.sessions.length > 0 || isLimited(state.claude), v = state.view;
  if (!active && (v === 'compact' || v === 'alert')) state.view = 'sleep';
  else if (active && (v === 'sleep' || v === 'peek' || v === 'alert')) state.view = 'compact';
}

function showAlert(a) {
  if (state.alert) { alertQueue.push(a); return; }
  backView = state.view === 'alert' ? 'compact' : state.view;
  state.alert = a;
  state.view = 'alert';
  alertTimer = setTimeout(() => {
    state.alert = null;
    const next = alertQueue.shift();
    if (next) { showAlert(next); render(state); return; }
    state.view = backView;
    settle();
    render(state);
  }, 4200);
}

function endAlerts() {
  clearTimeout(alertTimer);
  alertQueue.length = 0;
  state.alert = null;
}

function applyPayload(p) {
  if (!p) return;
  const all = p.sessions || [];
  const fresh = [];
  if (prevStatus) {
    for (const x of all) {
      const was = prevStatus.get(x.id);
      if (x.st === 'waiting' && was !== 'waiting') fresh.push({ kind: 'ask', p: x.p, src: x.src, msg: 'Soru soruyor: ' + (x.q || '') });
      else if (x.st === 'done' && was !== 'done') fresh.push({ kind: 'done', p: x.p, src: x.src, msg: `Bitti · ${x.d} dk sürdü` });
    }
  }
  prevStatus = new Map(all.map((x) => [x.id, x.st]));

  state.sessions = all.filter((x) => x.st !== 'done' && x.st !== 'idle');
  state.claude = p.claude || null;
  state.codex = p.codex || null;
  state.age = p.age == null ? null : p.age;
  if (!state.alert) settle();
  fresh.forEach(showAlert);
  render(state);
}

notch.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) { if (state.view === 'sleep') { state.view = 'peek'; render(state); } return; }
  e.stopPropagation();
  const act = t.dataset.act, idle = !state.sessions.length && !isLimited(state.claude);
  if (act === 'collapse') state.view = 'collapsed';
  else if (act === 'open') state.view = idle ? 'peek' : 'compact';
  else if (act === 'expand') { endAlerts(); state.view = 'expanded'; }
  else if (act === 'shrink') state.view = idle ? 'peek' : 'compact';
  render(state);
});

// Mouse events do not arrive while the window ignores the cursor, so Rust reports hover.
if (listen) {
  listen('cursor-inside', (e) => {
    if (e.payload && state.view === 'sleep') { state.view = 'peek'; render(state); }
    else if (!e.payload && state.view === 'peek') { state.view = 'sleep'; render(state); }
  });
}

// Live data: first load, then pushes from the Rust watcher.
if (invoke) invoke('get_state').then(applyPayload).catch(() => {});
const setRestStyle = (style) => document.body.classList.toggle('rest-coffee', style === 'coffee');
if (invoke) invoke('get_rest_style').then(setRestStyle).catch(() => {});
if (listen) listen('rest-style', (e) => setRestStyle(e.payload));
if (listen) listen('centik-state', (e) => applyPayload(e.payload));
render(state);
setInterval(() => render(state), 30000);

/* Example presets from the prototype (unused, kept for reference):
const PROJ = { a: 'claude-centik', b: 'kutu_taslaklari', c: 'personel_kutusu_A' };
const PRESETS = {
  sleep: { sessions: [] },
  one: { sessions: [{ p: PROJ.a, st: 'busy', agents: [], d: 4 }] },
  agents: { sessions: [{ p: PROJ.a, st: 'resting', agents: ['claude', 'claude', 'gpt'], d: 9 }] },
  three: { sessions: [
    { p: PROJ.a, st: 'resting', agents: ['claude', 'gpt'], d: 14 },
    { p: PROJ.b, st: 'busy', agents: ['claude'], d: 6 },
    { p: PROJ.c, st: 'busy', agents: [], d: 21 } ] },
  ask: { sessions: [
    { p: PROJ.a, st: 'resting', agents: ['claude', 'gpt'], d: 15 },
    { p: PROJ.b, st: 'waiting', agents: [], d: 7, q: 'Kutu duvarı 2 mm mi 2,4 mm mi?' },
    { p: PROJ.c, st: 'busy', agents: [], d: 22 } ],
    alert: { kind: 'ask', p: PROJ.b, msg: 'Soru soruyor: kutu duvarı 2 mm mi 2,4 mm mi?' } },
  done: { sessions: [
    { p: PROJ.a, st: 'busy', agents: ['gpt'], d: 18 },
    { p: PROJ.b, st: 'busy', agents: [], d: 9 },
    { p: PROJ.c, st: 'done', agents: [], d: 24 } ],
    alert: { kind: 'done', p: PROJ.c, msg: 'Bitti · 24 dk sürdü' } },
};
const PRESET_KEYS = ['sleep', 'one', 'agents', 'three', 'ask', 'done'];
*/