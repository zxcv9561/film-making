/* FILM MAKING v1.3 — online room (PeerJS, host-authoritative state sync).
   · 방장: 게임을 시작한 뒤 "방 만들기" → 4자리 코드. 방장 브라우저가 규칙·봇을 진행합니다.
   · 참가자: 코드 + 이름으로 입장 → 비어 있는 사람 자리(봇이 아닌 자리)에 배정됩니다.
   · 자기 차례인 사람만 조작할 수 있고, 행동이 끝날 때마다 전체 상태가 모두에게 전달됩니다. */
(() => {
  const NET = window.NET = { role: null, seat: null, peer: null, conns: [], host: null, code: '', seats: {}, names: {}, status: '', open: false, applying: false };
  const PREFIX = 'filmmaking-v13-';
  const $n = id => document.getElementById(id);
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function activeSeat() { if (!G || G.over) return null; if (G.bonus) return G.bonus.pid; if (G.phase === 'TrendPick') return G.trend.picker; if (G.phase === 'Settle' && G.pending) return G.pending.pid; return G.order[G.turn]; }
  function hostSeat() { return G ? G.players.findIndex(p => !p.bot) : 0; }
  function myTurn() { if (!NET.role || !G || G.over) return true; const s = activeSeat(); if (s == null) return true;
    if (NET.role === 'host') return !NET.seats[s]; return s === NET.seat; }

  /* ── hooks into the page's save / scheduleBot ── */
  const origSave = window.save, origSched = window.scheduleBot;
  window.save = function () { if (NET.role !== 'guest') origSave(); if (!NET.applying) push(); paint(); };
  window.scheduleBot = function () { if (NET.role === 'guest') return; return origSched.apply(this, arguments); };
  function push() { if (!NET.role || !G) return; const msg = { t: 'state', G: JSON.stringify(G) };
    if (NET.role === 'host') NET.conns.forEach(c => c.open && c.send(msg)); else if (NET.host && NET.host.open) NET.host.send(msg); }
  function apply(json) { NET.applying = true; try { G = JSON.parse(json); if (NET.role === 'host') origSave(); render(); } finally { NET.applying = false; } paint(); }

  /* block clicks when it isn't my turn (viewing stays free) */
  const FREE = '#netbox,button[data-tab],button[data-page],[data-act="growth"],[data-act="gclose"],[data-act="close"],.ev,[data-card],.grab';
  document.addEventListener('click', e => { if (myTurn()) return; if (e.target.closest(FREE)) return; e.stopPropagation(); e.preventDefault(); flash(); }, true);

  /* ── PeerJS ── */
  function loadPeer() { return window.Peer ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('PeerJS를 불러오지 못했습니다')); document.head.appendChild(s); }); }
  const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

  async function hostRoom() {
    if (!G || G.over) return status('먼저 게임을 시작하세요 (사람 자리는 봇 끄기)');
    const free = G.players.filter((p, i) => !p.bot && i !== hostSeat()); if (!free.length) return status('참가자가 앉을 사람 자리가 없습니다 · 설정에서 봇을 끄고 시작하세요');
    try { await loadPeer(); } catch (e) { return status(e.message); }
    NET.code = newCode(); status('방 만드는 중…');
    const peer = NET.peer = new Peer(PREFIX + NET.code);
    peer.on('open', () => { NET.role = 'host'; NET.seat = hostSeat(); status('참가자를 기다리는 중'); paint(); });
    peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); return hostRoom(); } status('연결 오류 · ' + e.type); });
    peer.on('connection', conn => {
      conn.on('open', () => {
        const nm = String((conn.metadata && conn.metadata.name) || '참가자').slice(0, 10);
        const seat = G.players.findIndex((p, i) => !p.bot && i !== hostSeat() && !NET.seats[i]);
        if (seat < 0) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return; }
        NET.seats[seat] = conn.peer; NET.names[seat] = nm; NET.conns.push(conn);
        G.players[seat].name = nm; conn.send({ t: 'welcome', seat, code: NET.code }); origSave(); render(); push(); status(`${nm} 입장 · ${seat + 1}번 자리`);
      });
      conn.on('data', m => { if (!m || m.t !== 'state') return; const seat = +Object.keys(NET.seats).find(k => NET.seats[k] === conn.peer);
        if (seat !== activeSeat()) return;          // 자기 차례가 아닌 상태는 무시
        apply(m.G); NET.conns.forEach(c => c !== conn && c.open && c.send({ t: 'state', G: m.G })); });
      conn.on('close', () => { const k = Object.keys(NET.seats).find(k => NET.seats[k] === conn.peer); if (k != null) { status(`${NET.names[k]} 연결 끊김 · 그 자리는 방장이 대신 둡니다`); delete NET.seats[k]; }
        NET.conns = NET.conns.filter(c => c !== conn); paint(); });
    });
  }
  async function joinRoom(code, name) {
    code = String(code || '').trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(code)) return status('코드는 영문 4자리입니다');
    try { await loadPeer(); } catch (e) { return status(e.message); }
    status('접속 중…'); const peer = NET.peer = new Peer();
    peer.on('error', e => status(e.type === 'peer-unavailable' ? '방을 찾지 못했습니다 · 코드를 확인하세요' : '연결 오류 · ' + e.type));
    peer.on('open', () => { const c = NET.host = peer.connect(PREFIX + code, { metadata: { name: name || '참가자' }, reliable: true });
      c.on('data', m => { if (m.t === 'welcome') { NET.role = 'guest'; NET.seat = m.seat; NET.code = m.code; status(`입장 완료 · ${m.seat + 1}번 자리`); paint(); }
        else if (m.t === 'full') status('빈 자리가 없습니다');
        else if (m.t === 'state') apply(m.G); });
      c.on('close', () => { status('방장과 연결이 끊겼습니다'); NET.role = null; paint(); }); });
  }

  /* ── panel ── */
  let msg = '';
  function status(t) { msg = t; paint(); }
  function flash() { const b = $n('netturn'); if (b) { b.style.transform = 'scale(1.06)'; setTimeout(() => (b.style.transform = ''), 160); } }
  function seatList() { return G ? G.players.map((p, i) => `<div style="display:flex;justify-content:space-between;gap:8px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color};margin-right:5px"></i>${esc2(p.name)}</span><span style="color:#8A8780">${p.bot ? '봇' : i === hostSeat() ? '방장' : NET.seats[i] ? '참가자' : '비어 있음 · 방장이 대신'}</span></div>`).join('') : ''; }
  function paint() {
    let box = $n('netbox'); if (!box) { box = document.createElement('div'); box.id = 'netbox'; document.body.appendChild(box); }
    box.style.cssText = 'position:fixed;right:12px;bottom:56px;z-index:3000;font-family:"Noto Sans KR",sans-serif;font-size:13px;color:#132454';
    const s = activeSeat(), turnName = G && s != null ? G.players[s].name : '';
    const banner = NET.role && G && !G.over ? `<div id="netturn" style="transition:transform .15s;background:${myTurn() ? '#2B7A4B' : '#132454'};color:#fff;border-radius:6px;padding:7px 12px;font-weight:800;margin-bottom:6px">${myTurn() ? '내 차례입니다' : `${esc2(turnName)} 차례 · 기다리는 중`}</div>` : '';
    if (!NET.open) { box.innerHTML = banner + `<button id="netopen" style="background:#fff;border:1.5px solid #624267;color:#624267;border-radius:6px;padding:7px 12px;font-weight:800;cursor:pointer">온라인 방${NET.role ? ' · ' + NET.code : ''}</button>`; return; }
    const url = location.origin + location.pathname.replace(/mobile\.html$/, 'index.html') + '?room=' + NET.code;
    const body = NET.role === 'host' ? `<div style="font-size:12px;color:#5C5A55">방 코드</div><div style="font-size:28px;font-weight:900;letter-spacing:.12em">${NET.code}</div>
        <button id="netcopy" style="margin:4px 0 8px;border:1px solid #D6CFBE;background:#F4F1EA;border-radius:4px;padding:5px 8px;cursor:pointer;font-size:12px">초대 링크 복사</button>${seatList()}`
      : NET.role === 'guest' ? `<div>방 <b>${NET.code}</b> · 내 자리 <b>${G ? esc2(G.players[NET.seat].name) : NET.seat + 1}</b></div>${seatList()}`
      : `<button id="nethost" style="width:100%;background:#132454;color:#fff;border:0;border-radius:5px;padding:8px;font-weight:800;cursor:pointer">방 만들기 (게임 시작 후)</button>
        <div style="margin:10px 0 4px;font-size:12px;color:#5C5A55">또는 참가</div>
        <div style="display:flex;gap:6px"><input id="netcode" maxlength="4" placeholder="코드" style="width:70px;text-transform:uppercase;padding:6px;border:1.5px solid #132454;border-radius:4px;font-weight:800;letter-spacing:.1em" value="${esc2(new URLSearchParams(location.search).get('room') || '')}"><input id="netname" maxlength="10" placeholder="이름" style="flex:1;min-width:0;padding:6px;border:1.5px solid #132454;border-radius:4px"></div>
        <button id="netjoin" style="width:100%;margin-top:6px;background:#624267;color:#fff;border:0;border-radius:5px;padding:8px;font-weight:800;cursor:pointer">참가</button>`;
    box.innerHTML = banner + `<div style="background:#fff;border:1.5px solid #624267;border-radius:8px;padding:12px;width:250px;box-shadow:0 6px 20px rgba(0,0,0,.18)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:14px">온라인 방</b><button id="netclose" style="border:0;background:none;font-size:18px;cursor:pointer;color:#5C5A55">×</button></div>
      ${body}${msg ? `<div style="margin-top:8px;font-size:12px;color:#624267">${esc2(msg)}</div>` : ''}</div>`;
  }
  document.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'netopen') { NET.open = true; paint(); } else if (t.id === 'netclose') { NET.open = false; paint(); }
    else if (t.id === 'nethost') hostRoom(); else if (t.id === 'netjoin') joinRoom($n('netcode').value, $n('netname').value.trim());
    else if (t.id === 'netcopy') { const u = location.origin + location.pathname.replace(/mobile\.html$/, 'index.html') + '?room=' + NET.code; navigator.clipboard && navigator.clipboard.writeText(u); status('링크 복사됨 · ' + u); } });
  if (new URLSearchParams(location.search).get('room')) NET.open = true;
  setTimeout(paint, 300); setInterval(() => { if (NET.role) paint(); }, 1500);
})();
