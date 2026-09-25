/* FILM MAKING mockup — UI layer. Reads/writes G only through rules.js functions. */
const SAVE_KEY = 'fm-mockup-v1_v1_10';
const PCOL = ['#3B6FD6', '#D64545', '#3C9D5D', '#E0B400', '#8E5BD6'];
const PNAME = ['파랑', '빨강', '초록', '노랑', '보라'];
let J = null, G = null;
const UI = { pick: null, modal: null, open: new Set(), setup: null, toast: '', botDelay: 700, tab: 'board' };
const $ = id => document.getElementById(id);
const stageEl = () => $('stage');
let SC = 1;
const FORCE_M = /[?&]m=1\b/.test(location.search);
const isMobile = () => FORCE_M || matchMedia('(pointer: coarse) and (max-width: 950px), (pointer: coarse) and (max-height: 560px)').matches;
function fit() { const m = isMobile(); const was = document.body.classList.contains('m'); document.body.classList.toggle('m', m);
  if (m) { SC = 1; stageEl().style.transform = ''; } else { SC = Math.min(innerWidth / 1920, innerHeight / 1080); stageEl().style.transform = `translate(${(innerWidth - 1920 * SC) / 2}px,${(innerHeight - 1080 * SC) / 2}px) scale(${SC})`; }
  if (was !== m && J) render(); }
function renderRail() { const r = $('rail'); if (!r) return; const mine = G && !G.over && !botTurnNow();
  const tabs = [['board', '행동', mine ? '●' : ''], ['players', '패널', ''], ['market', '진열', ''], ['log', '로그', G ? G.log.length : '']];
  r.innerHTML = tabs.map(([k, l, b]) => `<button data-tab="${k}" class="${UI.tab === k ? 'on' : ''}"><b>${l}</b><span>${b}</span></button>`).join('');
  stageEl().dataset.tab = UI.tab; }
function save() { try { if (G) localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function toast(t) { UI.toast = t; renderOverlay(); clearTimeout(toast.h); toast.h = setTimeout(() => { UI.toast = ''; renderOverlay(); }, 2600); }
const pcol = id => G.players[id].color, pnm = id => G.players[id].name;
const W = c => `<div class="wk" style="background:${c}"></div>`;

/* ── compact market tile (same visual as Game Screen) ── */
function band(gs) { gs = (gs || []).filter(Boolean); if (!gs.length) return 'repeating-linear-gradient(90deg,#E8E8E5 0 6px,#F4F4F2 6px 12px)';
  if (gs[0] === '모든 장르') { const k = Object.values(GENRE); return `linear-gradient(90deg,${k.map((v, i) => `var(${v}) ${i * 100 / 6}% ${(i + 1) * 100 / 6}%`).join(',')})`; }
  if (gs.length === 1) return `var(${GENRE[gs[0]]})`; return `linear-gradient(90deg,var(${GENRE[gs[0]]}) 0 50%,var(${GENRE[gs[1]]}) 50% 100%)`; }
function tile(id) {
  if (!id) return `<div class="mt empty">빈 칸</div>`;
  const x = C(id), t = id[0], pk = UI.pick && UI.pick.ids.includes(id) ? 'pickable' : '';
  if (t === 'A' || t === 'G' || t === 'W') { const isW = t === 'W';
    const st = isW ? `<span class="m">${I.money}${x.cost}</span><span>${I.quality}${x.quality}</span>` : `<span class="m">${I.money}${x.cost}</span><span>${I.acting}${x.acting}</span><span>${I.buzz}${x.buzz}</span>`;
    return `<div class="mt ${x.deck === 'star' ? 'star' : ''} ${pk}" data-id="${id}"><div class="bd" style="background:${band(x.genres)}"></div><div class="in"><div class="hr"><div class="nm">${esc(x.name)}</div><div class="fl">${x.hallyu ? '<span class="k">한류</span>' : ''}${x.required_fame != null ? `<span class="rq">인지도 ${x.required_fame}</span>` : ''}</div></div><div class="tt">${esc(x.title)}</div>${isW ? `<div class="og">원작 · ${esc(x.origin)}</div>` : ''}<div class="st">${st}</div></div><span class="id">${id}</span></div>`; }
  if (t === 'I') return `<div class="mt ${pk}" data-id="${id}"><div class="in"><div class="nm">${esc(x.name)}</div><div class="big">${I.money}${x.payout}</div><div class="tt">다음 작품 · ${esc(x.next_drama_condition)}</div></div><span class="id">${id}</span></div>`;
  if (t === 'C') return `<div class="mt ${pk}" data-id="${id}"><div class="in"><span class="kd">${esc(x.kind)}</span><div class="nm">${esc(x.name)}</div><div class="st"><span class="m">${I.money}${x.price}</span></div></div><span class="id">${id}</span></div>`;
  return '';
}

/* ── board slot ── */
function sl(zone, idx, occ, label = '') {
  const st = slotState(G, zone, idx), key = JSON.stringify(idx);
  if (occ != null) return st.ok && st.coord ? `<div class="sl can" data-zone="${zone}" data-idx='${key}' title="제작 코디네이터 · 칸 비용 +1">${W(pcol(occ))}<span class="cost">＋1</span></div>` : `<div class="sl">${W(pcol(occ))}</div>`;
  if (st.ok) return `<div class="sl can" data-zone="${zone}" data-idx='${key}'>${label || '<span class="cost" style="color:var(--muted)">빈 칸</span>'}</div>`;
  const lock = /인지도 \d+ 필요/.test(st.why) && zone === 'star';
  return `<div class="sl ${lock ? 'lock' : 'dim'}" title="${esc(st.why)}">${lock ? '<span style="font-size:15px">🔒</span>' : ''}${label}<span class="why2">${esc(st.why)}</span></div>`;
}
const costLab = n => `<span class="cost">${I.money}${n ? '+' + n : '0'}</span>`;
const zoneBox = (t, sub, slots, extra = '', grp = '') => `<div class="z ${grp}"><div class="zh"><b>${t}</b><span class="lab">${sub}</span></div><div class="slots">${slots}</div>${extra}</div>`;

/* ── game screen ── */
function renderGame() {
  const p = cur(G), stg = stageEl(); stg.classList.toggle('picking', !!UI.pick); renderRail();
  const FMAX = Math.max(40, ...G.players.map(x => x.fame + 5)), px = v => Math.max(0, v) / FMAX * 400;
  const cells = (v, max, ev) => `<div class="cells">${Array.from({ length: max }, (_, i) => `<div class="c ${i < v ? 'f' : ''} ${ev.includes(i + 1) ? 'ev' : ''}"></div>`).join('')}</div>`;
  $('top').innerHTML = `
    <div class="mres"><i style="background:${p.color}"></i><b>${esc(p.name)}</b><span>${I.money}${p.money}</span><span>${I.fame}${p.fame}</span><span>${I.aware}${p.aware}</span><span class="lab">일꾼 ${workersLeft(G, p)}</span>${gradeChip(p)}</div>
    <div class="brand"><span class="lab">HOTSEAT MOCKUP ${RULES.version} · ${G.n}P · ${esc(G.seed)}</span><b>FILM MAKING</b></div><button class="tb" data-act="growth" style="font-size:15px;padding:10px 16px;border:2px solid #624267;color:#624267;background:#fff;border-radius:6px;font-weight:800">성장 · 업적 · 시상식</button>
    <div class="phase"><span class="rd">ROUND ${G.round}</span><span class="ph">${{ TrendPick: '트렌드', Action: '행동 단계', Settle: '방영 정산', Cleanup: '정리' }[G.phase] || G.phase}</span></div>
    <div class="order"><span class="lab" style="margin-right:4px">턴 순서</span>${G.order.map((id, i) => `${i ? '<span class="sep">›</span>' : ''}<span class="o ${id === p.id ? 'cur' : ''}"><i style="background:${pcol(id)}"></i>${esc(pnm(id))}</span>`).join('')}</div>
    <div class="vr"></div>
    <div class="track"><span class="lab">${I.fame} 명성 트랙</span><div class="fame" style="width:400px"><div class="rail"></div>${[0, 10, 20, 30, 40, 50, 60].filter(v => v <= FMAX).map(v => `<div class="tick" style="left:${px(v)}px"></div><div class="tn" style="left:${px(v)}px">${v}</div>`).join('')}${G.players.map(x => `<div class="pm" style="left:${px(x.fame)}px"><span style="background:${x.color}">${x.fame}</span><i style="background:${x.color}"></i></div>`).join('')}</div></div>
    <div class="vr"></div>
    <div class="track"><div class="tv"><span class="lab">편성표</span><b>${G.sched}/${G.schedMax}</b></div>${cells(G.sched, G.schedMax, RULES.eventCells.sched)}</div>
    <div class="track"><div class="tv"><span class="lab">K-콘텐츠 지수</span><b>${G.kc}/${G.kcMax}</b></div>${cells(G.kc, G.kcMax, RULES.eventCells.kc)}</div>
    <div style="margin-left:auto;display:flex;gap:6px"><button class="tb" data-act="undo" ${G.undo ? '' : 'disabled'} title="직전 일꾼 1개까지 · 주사위 후 불가">↶ 되돌리기</button><button class="tb" data-act="speed" title="봇 속도">${UI.botDelay > 100 ? '봇 ▶' : '봇 ▶▶'}</button><button class="tb" data-act="dev">개발자</button><button class="tb" data-act="new">새 게임</button></div>`;
  const tn = C(G.trend.now), tx = C(G.trend.next);
  const trBox = (t, cls, lab) => t ? `<div class="tr ${cls}"><span class="lab">${lab} · ${t.id}</span><div class="n">${esc(t.trend)}</div><div class="e">${esc(t.trend_effect)}</div><div class="is"><b style="color:var(--ink)">${esc(t.issue)}</b> · ${esc(t.issue_kind)}${t.issue_negative ? ' ⚠' : ''}</div></div>` : `<div class="tr ${cls}"><span class="lab">${lab}</span><div class="e" style="color:var(--muted)">—</div></div>`;
  $('trend').innerHTML = trBox(tn, 'now', '이번 라운드') + trBox(tx, 'next', '다음 라운드');
  const grp = (t, k, cols, note) => `<div class="mg"><div class="hd"><b>${t}</b><span class="lab">${note}</span></div><div class="row${cols}">${G.market[k].map(tile).join('')}</div></div>`;
  $('market').innerHTML = grp('배우', 'actor', 4, `덱 ${G.decks.actor.draw.length}`) + grp('작가', 'writer', 4, `덱 ${G.decks.writer.draw.length}`) +
    grp('스타', 'star', 3, p.aware >= RULES.starUnlock ? `인지도 ${p.aware} · 해금` : `🔒 인지도 ${RULES.starUnlock} 필요`) + grp('투자사', 'investor', 6, `소액 · 중형 · 대형 · 2장씩`) + grp('제작 부서', 'crew', 5, `Lv3까지`);
  const b = G.board;
  const dsHTML = G.dists.map(did => { const d = C(did); const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
    return `<div class="ds"><div class="dh">${DIST_ICON[d.category] || ''}<div class="tx"><b>${esc(d.name)}</b><span>${esc(d.category)} · ${esc(d.concept)}</span></div></div>
      <dl class="fm"><dt>조건</dt><dd>${esc(f.condition)}</dd><dt>${I.fame}명성</dt><dd>${esc(f.fame)}</dd><dt>${I.aware}인지도</dt><dd>${esc(f.awareness)}</dd><dt>${I.money}자산</dt><dd>${esc(f.money)}</dd></dl>
      <div class="md">${esc(d.modifier)}</div><div class="dsl">${b.air[did].map((o, k) => sl('air', [did, k], o)).join('')}</div></div>`; }).join('');
  $('board').innerHTML = `
    <div class="bhd" style="flex-wrap:wrap"><h3>액션 보드</h3>${freeActions(G, cur(G)).map(a => `<button class="tb" data-free="${a.id}" style="border-color:var(--money);color:var(--money)">＋ ${esc(a.label)}</button>`).join('')}<div class="states"><span>빈 칸 클릭 → 대상 선택 → 확인</span><span>흐린 칸에 마우스 → 이유</span></div></div>
    ${issueBadge()}
    <div class="zones">
      ${zoneBox('작가 계약', '3칸', b.writer.map((o, i) => sl('writer', i, o, costLab(RULES.slotCost[i]))).join(''))}
      ${zoneBox('배우 캐스팅', '3칸', b.actor.map((o, i) => sl('actor', i, o, costLab(RULES.slotCost[i]))).join(''))}
      ${zoneBox('대스타 영역', '개인 칸', G.players.map(x => sl('star', x.id, b.star[x.id], `<span class="cost" style="color:${x.color};font-size:11px">${esc(x.name)}</span>`)).join(''), '')}
      ${zoneBox('투자 유치', '2칸', b.invest.map((o, i) => sl('invest', i, o)).join(''), '', 'grp-res')}
      ${zoneBox('제작진 고용', '2칸', b.crew.map((o, i) => sl('crew', i, o)).join(''), '', 'grp-res')}
      ${zoneBox('홍보', '2칸', b.promo.map((o, i) => sl('promo', i, o)).join(''), `<div class="opts"><div>${I.money}2 → ${I.aware}인지도 +1</div><div>${I.money}4 → ${I.aware}인지도 +3</div></div>`, 'grp-act')}
      ${zoneBox('자금 확보', '무제한', b.fund.map(o => `<div class="sl wide">${W(pcol(o))}</div>`).join('') + sl('fund', 0, null, '<span class="cost" style="font-size:16px">＋</span>'), `<div class="opts"><div>${I.money}자산 +2</div><div>${I.money}5 → ${I.fame}명성 +1</div><div>${I.money}6 → 업계 지표 +1</div></div>`, 'grp-act')}
      <div class="z turnbox" style="background:${p.color};border-color:${p.color}"><span class="lab">지금 차례</span><div class="big">${esc(p.name)}</div><div style="font-size:13px;font-weight:600">남은 일꾼 ${workersLeft(G, p)} / ${RULES.workers}</div><div class="wks">${Array.from({ length: RULES.workers }, (_, i) => `<div class="wk" style="background:${i < p.placed ? 'rgba(0,0,0,.35)' : '#fff'};width:22px;height:22px"></div>`).join('')}</div></div>
    </div>
    <div class="air"><div class="zh"><b>방영</b><span class="lab">준비 칸에 작가 + 배우가 있어야 함 · 배급사 5곳 · 각 ${RULES.distSlots}칸</span></div><div class="dists">${dsHTML}</div></div>`;
  // players
  const d = C(p.dir), awMarks = { 3: 'OTT', 5: '대스타', 6: '지상파' };
  const box = (t, ids, n) => `<div class="box"><span class="lab">${t}</span><div class="bx">${Array.from({ length: n }, (_, i) => tile(ids[i] || null)).join('')}</div></div>`;
  const opp = x => { const dd = C(x.dir); return `<div class="pp op"><div class="ph" style="background:${x.color}"><span>${esc(x.name)}</span><span class="sub">${esc(dd.concept)}</span></div><div class="body2">
      <div class="kv2"><div><span class="k">${I.fame}명성</span><div class="v">${x.fame}</div></div><div><span class="k">${I.aware}인지도</span><div class="v">${x.aware}</div></div><div><span class="k">${I.money}자산</span><div class="v">${x.money}</div></div><div><span class="k">방영</span><div class="v">${x.rec.length}</div></div></div>
      <div class="note">준비 ${[x.prep.writer, x.prep.actor].filter(Boolean).map(i => esc(C(i).name)).join(' · ') || '—'}${x.excl ? ` · 전속 ${esc(C(x.excl).name)}` : ''}${x.excl2 ? ` · ${esc(C(x.excl2).name)}` : ''}</div>
      <div class="note">일꾼 ${workersLeft(G, x)}/${workerCap(x)}${x.inv ? ` · 투자 ${esc(C(x.inv).name)}` : ''}</div></div></div>`; };
  const others = G.players.filter(x => x.id !== p.id);
  $('players').style.gridTemplateColumns = `minmax(0,1fr) ${others.map(() => '236px').join(' ')}`;
  $('players').innerHTML = `
    <div class="pp me" style="border-color:${p.color}"><div class="ph" style="background:${p.color}"><span>${esc(p.name)} · 현재 차례</span><span class="sub">감독 ${d.id} · ${esc(d.concept)}</span></div>
      <div class="grid">
        <div class="dirm"><span class="lab" style="color:#999">DIRECTOR · ${d.id}</span><div class="cn">${esc(d.concept)}</div><div class="nm">${esc(d.name)}</div><div class="ab">${esc(d.ability)}</div>${dirTag(p)}</div>
        <div class="res"><div class="r"><span class="k">${I.money}자산</span><span class="v" style="color:var(--money)">${p.money}</span></div><div class="r"><span class="k">${I.fame}명성</span><span class="v">${p.fame}</span></div><div class="r"><span class="k">${I.aware}인지도</span><span class="v" style="color:var(--aware)">${p.aware}</span></div></div>
        <div class="rt">
          <div class="line">${box('준비 칸 · 작가 / 배우', [p.prep.writer, p.prep.actor], 2)}${false ? box('준비 칸 2 · 멀티 프로젝트', [(p.prep2 || {}).writer, (p.prep2 || {}).actor], 2) : ''}${p.excl2 ? box('전속 2칸 · 시즌제', [p.excl, p.excl2], 2) : box('전속 1칸', [p.excl], 1)}<div class="box"><span class="lab">제작 부서</span><div style="display:flex;flex-direction:column;gap:2px;font-size:13px;margin-top:4px">${Object.keys(DEPTS).map(id => `<span><b>${DEPTS[id].name}</b> Lv${lvl(p, DEPTS[id].key)}</span>`).join('')}</div></div></div>
          <div class="line" style="align-items:flex-end;gap:18px">${box('투자 계약', [p.inv], 1)}
            <div class="aw"><span class="lab">인지도 트랙 · ${p.aware}</span><div class="cells">${Array.from({ length: 10 }, (_, i) => `<div class="c ${i < p.aware ? 'f' : ''}"></div>`).join('')}</div><div class="mk">${Array.from({ length: 10 }, (_, i) => `<span>${awMarks[i + 1] || ''}</span>`).join('')}</div></div>
            <div class="box"><span class="lab">방영 기록 · ${p.rec.length}</span><div class="rec">${Array.from({ length: 8 }, (_, i) => p.rec[i] ? `<div class="rc f" style="background:var(${GENRE[p.rec[i]] || '--g-thriller'})">${p.rec[i]}</div>` : `<div class="rc">${i + 1}</div>`).join('')}</div></div>
          </div></div></div></div>
    ${others.map(opp).join('')}`;
  // log
  const L = G.log.map((e, i) => ({ ...e, i })).reverse(); let lastR = null;
  $('log').innerHTML = `<div class="lh"><b>로그</b><span class="lab">${G.log.length}줄 · 최신 위</span></div><div class="lg-list">${L.map(e => {
    const hd = e.r !== lastR ? `<div class="rd-h">ROUND ${e.r}</div>` : ''; lastR = e.r;
    const col = e.who === 'sys' ? 'var(--ink)' : pcol(e.who); const open = UI.open.has(e.i);
    return hd + `<div class="ev ${e.calc ? 'set' : ''} ${open ? 'open' : ''}" data-log="${e.i}"><i style="background:${col}"></i><div>${e.who === 'sys' ? '' : `<span class="who">${esc(pnm(e.who))}</span> · `}${esc(e.text)}${e.calc ? ` <span class="chev">${open ? '▾' : '▸'}</span>` : ''}${e.calc && open ? `<div class="calc">${e.calc.map(s => `<div><span>${s.n}</span><span>${s.lines.map(esc).join(' / ')}</span><b>${esc(s.v)}</b></div>`).join('')}</div>` : ''}</div></div>`; }).join('')}</div>`;
}

/* ── overlays: pick banner, modals, trend pick, settlement, setup, results ── */
function boostSel(p) { return `<label style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-weight:700;font-size:14px;margin-bottom:10px">블록버스터 · 자산 추가 투입 <select id="boost" style="font-size:16px;padding:6px 10px;border:1.5px solid #111;border-radius:6px">${[0, 3, 6, 9].filter(v => v <= p.money).map(v => `<option value="${v}">자산 ${v} → 작품성 +${v * 2 / 3}</option>`).join('')}</select></label>`; }
function issueBadge() { const s = G.issue; if (!s || s.round !== G.round) return ''; const t = C(s.id), neg = t.issue_negative;
  return `<div class="wide" style="grid-column:1/-1;background:${neg ? '#FBEDE6' : '#EEF6F0'};color:${neg ? '#C2410C' : '#2B7A4B'};border-radius:6px;padding:8px 12px;font-size:13px;font-weight:700;line-height:1.45">${neg ? '⚠ ' : ''}이번 라운드 이슈 · <b>${esc(t.issue)}</b> — ${esc(t.issue_effect)}${s.hit.length ? '<br>→ ' + s.hit.map(esc).join(' · ') : ''}</div>`; }
function dirTag(p) { return dirImpl(p.dir) ? '<span class="lab" style="color:var(--money)">✓ 능력 적용 중</span>' : '<span class="lab" style="color:var(--warn)">능력 미구현 · 효과 없음</span>'; }
const LENS = [['short', '짧게'], ['std', '표준'], ['long', '길게']];

/* ── v1.2 · 성장 · 업적 · 시상식 (shared view) ── */
function achProgress(p, k) { const mine = G.airings.filter(x => x.player === p.name), car = p.career || {};
  if (k === 'GENRE') { const best = Object.entries(car).sort((a, b) => b[1] - a[1])[0]; return best ? [Math.min(best[1], 3), 3, best[0]] : [0, 3, '']; }
  if (k === 'MONEY') return [Math.min(p.workMoney || 0, 20), 20, '방영 자산'];
  if (k === 'BUZZ') return [Math.min(Math.max(0, ...mine.map(x => x.buzz)), 8), 8, '최고 화제성'];
  if (k === 'SGRADE') { const g = Math.max(-1, ...mine.map(x => GRADES.indexOf(x.grade))); return [g >= 3 ? 1 : 0, 1, g >= 0 ? '최고 ' + GRADES[g] : '']; }
  if (k === 'ALLCAT') return [(p.cats || []).length, 5, (p.cats || []).join('·')];
  if (k === 'HALLYU') return [Math.min(p.hallyuN || 0, 3), 3, '한류 작품'];
  if (k === 'GROW') return [Math.min(p.growN || 0, 2), 2, '배우 성장'];
  if (k === 'CHEAP') return [0, 1, '조건 작품 방영 시 즉시']; return [0, 1, '']; }

function deptHTML(p) { return Object.keys(DEPTS).map(id => { const d = DEPTS[id], L = lvl(p, d.key), nx = L < 3 ? deptCost(G, p, id) : null;
  return `<div style="display:grid;grid-template-columns:96px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #ECE7DB;align-items:start">
    <div><b style="font-size:14px">${d.name}</b><div style="font-size:11px;color:#5C5A55">${d.act}</div><div style="display:flex;gap:3px;margin-top:4px">${[0, 1, 2].map(i => `<span style="width:18px;height:8px;border-radius:2px;background:${i < L ? '#624267' : '#ECE7DB'}"></span>`).join('')}</div></div>
    <div style="font-size:12.5px;line-height:1.5">${d.lv.map((t, i) => `<div style="${i < L ? 'color:#132454;font-weight:700' : i === L ? 'color:#132454' : 'color:#8A8780'}">Lv${i + 1} · ${t}${i === L ? ` <span style="color:#624267;font-weight:700">(다음 · 자산 ${nx})</span>` : ''}</div>`).join('')}</div></div>`; }).join(''); }

/* ── v1.3 · 시청률 등급 미리보기 ── */
const GCOL = ['#8A8780', '#5C6B8A', '#132454', '#624267', '#C28A00'];
function gradeChip(p) { const pr = previewRating(G, p); if (!pr) return ''; return `<span style="background:${GCOL[pr.gi]};color:#fff;border-radius:4px;padding:2px 8px;font-weight:800;font-size:13px" title="작품성 ${pr.q} + 화제성 ${pr.b}">예상 ${pr.grade} · 시청률 ${pr.r}</span>`; }
function gradeHTML(p) { const pr = previewRating(G, p), cut = RULES.gradeCut, rng = ['0~' + (cut[0] - 1), cut[0] + '~' + (cut[1] - 1), cut[1] + '~' + (cut[2] - 1), cut[2] + '~' + (cut[3] - 1), cut[3] + '+'];
  const head = pr ? `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:#fff;border:1.5px solid ${GCOL[pr.gi]};border-radius:6px;padding:10px 12px;margin-bottom:8px">
    <span style="font-size:30px;font-weight:900;color:${GCOL[pr.gi]}">${pr.grade}</span>
    <span style="font-size:14px;line-height:1.5">지금 준비 칸 작품 · <b>${esc(pr.g)}</b><br>작품성 ${pr.q} + 화제성 ${pr.b} = 시청률 <b>${pr.r}</b>${pr.toNext > 0 ? ` · 다음 등급까지 +${pr.toNext}` : ' · 최고 등급'}</span>
    <span style="font-size:12px;color:#5C5A55">주사위·트렌드 제외 예상값</span></div>` : '<p style="font-size:13px;color:#5C5A55;margin:0 0 8px">준비 칸에 작가와 배우가 모두 있으면 예상 등급이 나옵니다.</p>';
  const th = GRADES.map((g, i) => `<th style="padding:5px 6px;text-align:center;background:${pr && pr.gi === i ? GCOL[i] : '#ECE7DB'};color:${pr && pr.gi === i ? '#fff' : '#132454'}">${g}<div style="font-size:10px;font-weight:500">${rng[i]}</div></th>`).join('');
  const rows = G.dists.map(did => { const d = C(did), t = RULES.gradeTab[d.category], ok = pr ? canAir(G, p, did).ok : true;
    return `<tr style="opacity:${ok ? 1 : .45}"><td style="padding:5px 6px;font-size:12px;white-space:nowrap"><b>${esc(d.name)}</b><div style="font-size:10px;color:#5C5A55">${esc(d.category)}${pr && !ok ? ' · 조건 미충족' : ''}</div></td>${GRADES.map((g, i) => `<td style="padding:5px 4px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11.5px;${pr && pr.gi === i ? 'background:#FFF6DC;font-weight:800' : ''}">${t.f[i]}/${t.m[i]}/${t.a[i]}</td>`).join('')}</tr>`; }).join('');
  return head + `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #D6CFBE"><tr><th style="padding:5px 6px;text-align:left;background:#ECE7DB;font-size:11px">배급사 · 명성/자산/인지도</th>${th}</tr>${rows}</table>
    <p style="font-size:12px;color:#5C5A55;margin:6px 0 0">시청률 = 작품성 + 화제성. 배급사별 보너스·트렌드·주사위는 따로 더해집니다.</p>`; }

function sponsorHTML(p) { const t = RULES.sponsorAt, got = (p.sponsors || []).length;
  const tiers = t.map((v, i) => `<span style="padding:3px 8px;border-radius:4px;font-size:12px;font-weight:800;${p.aware >= v ? 'background:#624267;color:#fff' : 'background:#ECE7DB;color:#8A8780'}">인지도 ${v} · ${i + 1}번째 칸</span>`).join(' ');
  const mine = (p.sponsors || []).map(x => { const s = C(x.id); return `<div style="background:#fff;border:1.5px solid #624267;border-radius:6px;padding:8px 10px"><b>${esc(s.name)}</b> <span style="font-size:12px;color:#5C5A55">조건 충족 ${x.cnt}회 · 종료 예상 명성 +${Math.max(RULES.endBonus.spMin || 0, spEnd(G, p, x))}</span><div style="font-size:12px">${esc(s.effect)}</div></div>`; }).join('') || '<p style="font-size:13px;color:#5C5A55;margin:0">아직 계약한 스폰서가 없습니다.</p>';
  const mk = (G.market.sponsor || []).filter(Boolean).map(id => `<div style="font-size:12px;padding:3px 0"><b>${esc(C(id).name)}</b> · ${esc(C(id).effect)}</div>`).join('');
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${tiers}</div><div style="display:grid;gap:6px;margin-bottom:8px">${mine}</div><div style="font-size:12px;color:#5C5A55;margin-bottom:2px">공개된 스폰서 (인지도 구간에 닿으면 1장 고름)</div>${mk}
    <div style="font-size:12px;color:#5C5A55;margin-top:8px">인지도 소모 · 홍보 칸에서 ${RULES.awareSpend.map(A => `${A.name}(−${A.cost}: ${A.text})`).join(' · ')}</div>`; }
function objHTML(p) { const E = RULES.endBonus;
  const ob = (G.objectives || []).map(o => { const fn = OBJ_MET[o], rows = G.players.map(x => ({ x, v: fn ? fn(x, G) : 0 })).sort((a, c) => c.v - a.v), me = rows.findIndex(r => r.x.id === p.id);
    return `<div style="background:#fff;border:1.5px solid #132454;border-radius:6px;padding:8px 10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(C(o).name)}</b><span style="font-size:12px">1위 +${(RULES.objPtsByLen[G.len] || RULES.objPts).end[0]} · 2위 +${(RULES.objPtsByLen[G.len] || RULES.objPts).end[1]} · 3위 +${(RULES.objPtsByLen[G.len] || RULES.objPts).end[2]}</span></div><div style="font-size:12px;color:#5C5A55">${esc(C(o).criterion)} · 중간 시상식 때 절반 점수</div><div style="font-size:12px;margin-top:4px">${rows.map(r => `<span style="margin-right:8px;${r.x.id === p.id ? 'font-weight:800' : ''}">${esc(r.x.name)} ${r.v}</span>`).join('')}</div><div style="font-size:12px;color:#624267;font-weight:700">내 순위 ${me + 1}위</div></div>`; }).join('');
  const lv3 = Object.keys(DEPTS).filter(id => lvl(p, DEPTS[id].key) >= 3).length, ms = Object.values(p.career || {}).filter(k => k >= 5).length, ex = [p.excl, p.excl2].filter(Boolean), gr = ex.filter(x => C(x).deck === 'growth').length, spn = (p.sponsors || []).reduce((t, x) => t + Math.max(E.spMin || 0, spEnd(G, p, x)), 0);
  const end = [[`남은 자산 ${E.moneyPer}당 +1 (최대 ${E.moneyMax})`, Math.min(E.moneyMax, Math.floor(p.money / E.moneyPer))], [`부서 Lv3 1개당 +${E.deptLv3}`, lv3 * E.deptLv3], [`장르 거장 1개당 +${E.master}`, ms * E.master], [`전속 보유 1장당 +${E.excl}`, ex.length * E.excl], [`성장 배우 보유 +${E.grown}`, gr * E.grown], ['스폰서 종료 보너스', spn]];
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:10px">${ob}</div><div style="background:#fff;border:1px solid #D6CFBE;border-radius:6px;padding:8px 10px"><b style="font-size:14px">종료 보너스 · 지금 끝나면</b> <b style="color:#624267">+${end.reduce((t, x) => t + x[1], 0)}</b><div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:12.5px;margin-top:4px">${end.map(([t, v]) => `<span>${t}</span><b>+${v}</b>`).join('')}</div></div>`; }

function genreRuleHTML(p) { const car = p.career || {}, gs = ['로맨스', '범죄', '사극', '판타지', '코미디', '스릴러'], n = gs.filter(g => car[g]).length, V = RULES.variety;
  const chips = gs.map(g => `<span style="padding:3px 9px;border-radius:4px;font-size:12.5px;font-weight:800;${car[g] ? 'background:#132454;color:#fff' : 'background:#ECE7DB;color:#8A8780'}">${g}</span>`).join(' ');
  return `<ol style="margin:0 0 10px;padding-left:20px;font-size:13.5px;line-height:1.6">
    <li>작품 장르는 <b>작가와 배우가 함께 가진 장르</b>입니다. 여러 개면 작가 카드에 먼저 적힌 장르 · 장르 일치 보너스를 받습니다.</li>
    <li>배우가 <b>모든 장르</b>면 작가의 첫 장르, 작가가 <b>모든 장르</b>면 배우의 첫 장르로 정하고 일치로 봅니다.</li>
    <li>둘 다 모든 장르면 원하는 장르를 고릅니다 (목업: 아직 덜 한 장르가 자동 선택).</li>
    <li>함께 가진 장르가 없으면 작가의 첫 장르로 방영하고 일치 보너스는 없습니다 (D08 크로스오버는 예외).</li></ol>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${chips}</div>
    <div style="font-size:13px">다장르 보너스 · 새 장르 첫 방영마다 명성 +${V.every} · 3장르째 +${V.at3} 추가 · 6장르 전부 +${V.at6} 추가 — 지금 <b>${n}/6</b>${n < 3 ? ` · ${3 - n}장르 더 → +${V.at3}` : n < 6 ? ` · ${6 - n}장르 더 → +${V.at6}` : ' · 달성'}</div>`; }
function growthHTML(p) {
  const car = p.career || {}, gs = Object.keys(GENRE), st = RULES.stages;
  const stTxt = s => [s.q ? `작품성 +${Array.isArray(s.q) ? s.q[0] : s.q}` : '', s.b ? `화제성 +${s.b}` : '', s.fame ? `방영마다 명성 +${s.fame}` : ''].filter(Boolean).join(' · ');
  const pip = (k, i) => { const mark = st.find(s => s.from === i + 1); return `<span style="width:26px;height:26px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;${i < k ? 'background:#132454;color:#fff' : 'background:#ECE7DB;color:#8A8780'};${mark ? 'outline:2px solid #fcbc2c;outline-offset:1px' : ''}">${mark ? mark.name[0] : i + 1}</span>`; };
  const rows = gs.map(g => { const k = car[g] || 0, cr = careerAt(k), nx = cr.next;
    return `<div style="display:grid;grid-template-columns:78px auto 1fr;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #ECE7DB">
      <span style="background:var(${GENRE[g]});color:#fff;border-radius:4px;padding:3px 8px;font-weight:800;font-size:13px;text-align:center">${esc(g)}</span>
      <span style="display:flex;gap:4px">${Array.from({ length: 6 }, (_, i) => pip(k, i)).join('')}</span>
      <span style="font-size:13px;line-height:1.45"><b>${cr.name}</b>${cr.st ? ' · ' + stTxt(cr) : ' · 보너스 없음'}<br><span style="color:#5C5A55">${nx ? `${nx.from - k}편 더 → <b>${nx.name}</b>: ${stTxt(nx)}` : '최고 단계'}</span></span></div>`; }).join('');
  const ach = (G.ach || []).map(k => { const a = ACH[k], [v, max, note] = achProgress(p, k);
    const keys = k === 'GENRE' ? Object.keys(G.achWin || {}).filter(x => x.startsWith('GENRE:')) : [k];
    const won = keys.map(x => (G.achWin[x] || []).map((pid, i) => `${esc(G.players[pid].name)} ${i ? '2등' : '1등'}${k === 'GENRE' ? '(' + x.split(':')[1] + ')' : ''}`).join(', ')).filter(Boolean).join(' · ');
    const full = k !== 'GENRE' && (G.achWin[k] || []).length >= 2, mineGot = keys.some(x => (G.achWin[x] || []).includes(p.id));
    return `<div style="border:1.5px solid ${mineGot ? '#2B7A4B' : full ? '#D6CFBE' : '#132454'};border-radius:6px;padding:10px 12px;background:#fff;opacity:${full && !mineGot ? .55 : 1}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:15px">${a.name}${RULES.achFixed.includes(k) ? ' <span style="font-size:10px;color:#624267">고정</span>' : ''}</b><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;white-space:nowrap">1등 +${a.pts[0]} · 2등 +${a.pts[1]}</span></div>
      <div style="font-size:13px;color:#5C5A55;margin:2px 0 6px">${a.cond}</div>
      <div style="height:8px;background:#ECE7DB;border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round(100 * v / max)}%;background:${mineGot ? '#2B7A4B' : '#624267'}"></div></div>
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-top:4px"><span>내 진행 · ${v}/${max}${note ? ' · ' + esc(note) : ''}</span><span style="color:#5C5A55">${won || '아직 아무도'}</span></div></div>`; }).join('');
  const c1 = Math.round(G.schedMax / 2), since = G.airings.filter(x => x.round >= (G.cerFrom || 1));
  const lead = (f) => { const v = G.players.map(x => ({ x, v: f(x) })).sort((a, b) => b.v - a.v)[0]; return v && v.v > 0 ? `${esc(v.x.name)} (${v.v})` : '—'; };
  const cer = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
    <div style="background:#fff;border-radius:6px;padding:10px 12px;border:1px solid #D6CFBE"><b>중간 시상식</b><div style="font-size:13px;color:#5C5A55">편성표 ${c1}칸 도달 시 · 지금 ${G.sched}/${G.schedMax}${G.ceremony >= 1 ? ' · <b style="color:#2B7A4B">개최됨</b>' : ''}</div></div>
    <div style="background:#fff;border-radius:6px;padding:10px 12px;border:1px solid #D6CFBE"><b>최종 시상식</b><div style="font-size:13px;color:#5C5A55">게임 종료 때 · 직전 시상식 이후 작품 기준</div></div>
    <div style="background:#fff;border-radius:6px;padding:10px 12px;border:1px solid #D6CFBE"><b>대상 · 최고 시청률</b> <span style="font-size:12px">1위 +4 · 2위 +2</span><div style="font-size:13px;color:#5C5A55">현재 선두 · ${lead(x => Math.max(0, ...since.filter(a => a.player === x.name).map(a => a.rating || 0)))}</div></div>
    <div style="background:#fff;border-radius:6px;padding:10px 12px;border:1px solid #D6CFBE"><b>최우수 제작사 · 방영 편수</b> <span style="font-size:12px">1위 +2 · 2위 +1</span><div style="font-size:13px;color:#5C5A55">현재 선두 · ${lead(x => since.filter(a => a.player === x.name).length)}</div></div>
    <div style="background:#fff;border-radius:6px;padding:10px 12px;border:1px solid #D6CFBE"><b>인기상 · 인지도</b> <span style="font-size:12px">최종만 · 1위 +3 · 2위 +1</span><div style="font-size:13px;color:#5C5A55">현재 선두 · ${lead(x => x.aware)}</div></div></div>
    <p style="font-size:12px;color:#5C5A55;margin:6px 0 0">공동 순위는 한 단계 아래 상을 받습니다.</p>`;
  const sec = (t, sub, h) => `<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px"><b style="font-size:16px">${t}</b><span style="font-size:12px;color:#5C5A55">${sub}</span></div>${h}</div>`;
  return sec('장르 결정 규칙 · 다장르 보너스', '작품 장르를 정하는 법', genreRuleHTML(p)) + sec('공개 목표 · 종료 보너스', '종료 때 순위로 명성 · 중간 시상식 때 절반', objHTML(p)) + sec('스폰서 · 인지도 활용', `인지도 ${p.aware} · 스폰서 ${(p.sponsors || []).length}/${RULES.sponsorAt.length}`, sponsorHTML(p)) + sec('시청률 등급', '작품성 + 화제성 → 등급 → 배급사 표 한 칸', gradeHTML(p) + `<div style="margin-top:8px;font-size:13px;background:#fff;border:1px solid #D6CFBE;border-radius:6px;padding:8px 10px"><b>제작비</b> · ${GRADES.map((g, k) => `${g} ${RULES.prodCost[k]}`).join(' · ')} — 방영 때 등급에 맞춰 냅니다. 자산이 모자라면 낼 수 있는 등급으로 내려갑니다 (재무팀 Lv2 −1 · 직접 집필 +2)</div>`) + sec('제작 부서', '행동 보드의 부서 강화 칸 · 일꾼 1 + 자산 · Lv3까지', deptHTML(p)) + sec('장르 커리어 트랙', '그 장르로 방영할 때마다 1칸 · 노란 테두리가 단계 시작 칸', rows)
    + sec('업적 · 먼저 달성하면 획득', `이번 게임 공개 ${(G.ach || []).length}장`, `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">${ach}</div>`)
    + sec('시상식', '명성 보너스', cer); }
function modal(title, kick, body, foot) { return `<div class="scrim"><div class="modal"><div class="mh"><span class="lab">${kick}</span><h2>${title}</h2></div><div class="mb">${body}</div><div class="mf">${foot}</div></div></div>`; }
function bonusModal() { const p = P(G, G.bonus.pid), sel = UI.bsel;
  if (G.bonus.type === 'SP') return modal('스폰서 계약', `${esc(p.name)} · 인지도 ${p.aware} · ${(p.spTier || 0) + 1}번째 스폰서 칸 · 1장 선택`, `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">${bonusChoices(G).map(id => `<button class="optbtn" data-bonus="${id}" style="flex-direction:column;align-items:flex-start;gap:4px;text-align:left"><b>${esc(C(id).name)}</b><span style="font-size:12px;color:#624267;font-weight:700">${esc(C(id).title)}</span><span style="font-size:13px">${esc(C(id).effect)}</span></button>`).join('')}</div>`, '<button class="btn" data-bonus="">건너뛰기</button>');
  if (sel) { const x = C(sel); return modal(`${esc(x.name)} · ${esc(x.title)}`, '시즌2 기획팀 · 작가 계약 확인', `<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap"><div>${fullCard(sel)}</div><div class="brk" style="min-width:220px"><span>계약비</span><b>자산 −${placeCost(G, p, 'writer', 0, sel, 'market')}</b><span>칸 비용</span><b>없음</b><span>일꾼</span><b>사용 안 함</b><span>남는 자산</span><b>${p.money - placeCost(G, p, 'writer', 0, sel, 'market')}</b></div></div>`, `<button class="btn" data-bsel="">← 목록</button><button class="btn pri" data-bonus="${sel}">계약</button>`); }
  return modal('시즌2 기획팀 · 작가 계약', `${esc(p.name)} · 일꾼 없이 · 칸 비용 없음 · 카드를 눌러 상세 확인`, `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">${bonusChoices(G).map(id => `<button class="optbtn" data-bsel="${id}" style="flex-direction:column;align-items:flex-start;gap:4px"><b>${esc(C(id).name)}</b><span style="font-size:13px;color:var(--muted)">${esc(C(id).title)} · 작품성 ${C(id).quality} · ${(C(id).genres || []).join('·')} · ${esc(C(id).origin || '')}</span><span style="font-size:12px;color:var(--muted)">${esc(C(id).effect || '')}</span><span style="color:var(--money)">자산 −${placeCost(G, p, 'writer', 0, id, 'market')}</span></button>`).join('')}</div>`, '<button class="btn" data-bonus="">건너뛰기</button>'); }
function renderOverlay() {
  let h = '';
  if (G && !G.over && G.bonus && !P(G, G.bonus.pid).bot) { $('ovl').innerHTML = bonusModal(); return; }
  if (UI.toast) h += `<div class="banner" style="background:#C2410C">${esc(UI.toast)}</div>`;
  else if (botTurnNow()) { const who = G.phase === 'TrendPick' ? G.players[G.trend.picker] : G.phase === 'Settle' ? G.players[G.pending.pid] : cur(G); h += `<div class="banner" style="background:${who.color}">${esc(who.name)} 생각 중…</div>`; }
  else if (UI.pick && isMobile()) h += `<div class="scrim sheet-scrim"><div class="sheet"><div class="sh-h"><b>${esc(UI.pick.msg)}</b><button class="btn" data-act="cancel">취소</button></div><div class="sh-row">${UI.pick.ids.map(tile).join('')}</div></div></div>`;
  else if (UI.pick) h += `<div class="banner">${esc(UI.pick.msg)}<button data-act="cancel">취소 · Esc</button></div>`;
  if (G && !G.over) {
    if (G.phase === 'TrendPick') h += modal('트렌드 선택', `ROUND ${G.round} · 꼴찌 ${esc(pnm(G.trend.picker))}가 고름`, `<div style="display:flex;gap:18px">${G.trend.choices.map(id => `<div style="cursor:pointer" data-trend="${id}">${trendCard(C(id))}</div>`).join('')}</div><div style="font-size:13px;color:var(--muted)">고른 카드는 <b>다음 라운드</b> 칸으로 들어가고, 지금 다음 라운드 카드가 이번 라운드로 밀려옵니다. 고른 카드의 이슈는 바로 해결합니다.</div>`, '<span class="lab" style="align-self:center">카드를 클릭</span>');
    else if (G.phase === 'Settle' && G.pending) h += settleModal();
    else if (UI.modal) h += UI.modal;
  }
  $('ovl').innerHTML = h;
}
function settleModal() {
  const S = G.pending, p = G.players[S.pid], d = C(S.did);
  const names = ['작품성', '화제성', '주사위', '배급사 공식', '고정 보너스', '투자 판정', '재화 반영', '작품 정리'];
  const rows = names.map((nm, i) => { const s = S.steps[i];
    if (i === 2 && !S.rolled) return `<div class="stp dice"><span class="n">3</span><div class="nm">주사위</div><div class="ls">${S.dice.map(x => `<span>🎲 ${esc(x.src)}</span>`).join('')}</div><button class="btn" data-act="roll" style="background:#fff">굴리기${G.dev.dice ? ` (고정 ${G.dev.dice})` : ''}</button></div>`;
    if (!s || (!S.rolled && i > 2)) return `<div class="stp wait"><span class="n">${i + 1}</span><div class="nm">${nm}</div><div class="ls"><span style="color:var(--muted)">주사위 후 계산</span></div><div></div></div>`;
    if (i === 7) return `<div class="stp"><span class="n">8</span><div class="nm">작품 정리</div><div class="ls" style="gap:8px"><button class="btn" data-keep="writer">작가 전속 · ${esc(C(S.w).name)}</button><button class="btn" data-keep="actor">배우 전속 · ${esc(C(S.a).name)}</button>${P(G, S.pid).dir === 'D07' && C(S.w).deck !== 'self' ? '<button class="btn" data-keep="both">둘 다 전속 · 시즌제</button>' : ''}<button class="btn" data-keep="none">남기지 않음</button></div><div class="v" style="font-size:13px;color:var(--muted)">전속 1칸${p.excl ? ` · 현재 ${esc(C(p.excl).name)} 교체됨` : ''}</div></div>`;
    return `<div class="stp ${i === 2 ? 'dice' : ''}"><span class="n">${i + 1}</span><div class="nm">${nm}</div><div class="ls">${s.t.map(x => `<span>${esc(x[0])}${x[1] ? ` <b>+${x[1]}</b>` : ''}</span>`).join('')}</div><div class="v">${esc(s.v)}</div></div>`; }).join('');
  const tot = S.rolled ? `<div class="brk" style="grid-template-columns:repeat(5,auto);justify-content:start;gap:4px 28px"><span>명성 <b>+${S.res.fame}</b></span><span>자산 <b>+${S.res.money}</b></span><span>인지도 <b>+${S.res.aware}</b></span><span>편성표 <b>+${S.ind.sched}</b></span><span>K-콘텐츠 <b>+${S.ind.kc}</b></span></div>` : '';
  return `<div class="scrim"><div class="modal" style="width:1180px"><div class="mh"><span class="lab">방영 정산 · ${esc(p.name)} · ${esc(d.name)}(${esc(d.category)}) · ${esc(S.g)}</span><h2>${esc(C(S.w).signature_work || '')} · ${esc(C(S.w).name)} × ${esc(C(S.a).name)}</h2></div><div class="mb" style="gap:0">${rows}${S.notes.length ? `<div style="font-size:12.5px;color:var(--muted);padding-top:10px">메모 · ${S.notes.map(esc).join(' / ')}</div>` : ''}</div><div class="mf" style="justify-content:space-between">${tot}<span class="lab" style="align-self:center">8단계에서 전속을 고르면 확정</span></div></div></div>`;
}

/* ── interactions ── */
function eligible(zone, idx) { const p = cur(G);
  if (zone === 'writer' || zone === 'actor') { const ids = G.market[zone].filter(id => id && C(id).cost + RULES.slotCost[idx] <= p.money); extraPicks(G, p, zone, idx).forEach(id => ids.includes(id) || ids.push(id)); if (p.excl && (C(p.excl).quality != null) === (zone === 'writer') && placeCost(G, p, zone, idx, p.excl, 'excl') <= p.money) ids.push(p.excl); return ids; }
  if (zone === 'star') return G.market.star.filter(id => id && C(id).required_fame <= p.aware && C(id).cost <= p.money);
  if (zone === 'invest') return G.market.investor.filter(x => x && invAllowed(G, p, x));
  if (zone === 'crew') return G.market.crew.filter(id => id && C(id).price <= p.money);
  return []; }
function onSlot(zone, idx) {
  const p = cur(G);
  if (zone === 'promo') { UI.modal = modal('홍보', '옵션 선택', [0, 1].map(o => { const c = [2, 4][o], a = [1, 3][o]; return `<button class="optbtn" data-opt="${o}" ${p.money < c ? 'disabled' : ''}><span>자산 ${c} → 인지도 +${a}</span><span>${p.money} → ${p.money - c}</span></button>`; }).join('') + `<div style="margin-top:10px;font-size:12px;color:#5C5A55">인지도 소모</div>${RULES.awareSpend.map((A, k) => `<button class="optbtn" data-opt="${k + 2}" ${p.aware < A.cost ? 'disabled' : ''}><span>${A.name} · 인지도 ${A.cost} → ${A.text}</span><span>인지도 ${p.aware} → ${p.aware - A.cost}</span></button>`).join('')}`, '<button class="btn" data-act="close">취소</button>'); UI.optFor = { zone, idx }; return renderOverlay(); }
  if (zone === 'fund') { const o = [['자산 +2', 0, true], ['자산 5 → 명성 +1', 1, p.money >= 5], ['자산 6 → 편성표 +1 (명성 +1)', 2, p.money >= 6 && G.sched < G.schedMax], ['자산 6 → K-콘텐츠 지수 +1 (명성 +1)', 3, p.money >= 6 && G.kc < G.kcMax]];
    UI.modal = modal('자금 확보', '옵션 선택 · 무제한', o.map(([t, v, en]) => `<button class="optbtn" data-opt="${v}" ${en ? '' : 'disabled'}><span>${t}</span></button>`).join(''), '<button class="btn" data-act="close">취소</button>'); UI.optFor = { zone, idx }; return renderOverlay(); }
  if (zone === 'air') return confirmAir(idx);
  const ids = eligible(zone, idx); if (!ids.length) return toast('고를 수 있는 카드가 없습니다');
  UI.pick = { zone, idx, ids, msg: { writer: '작가 카드를 고르세요 (진열 또는 전속)', actor: '배우 카드를 고르세요 (진열 또는 전속)', star: '스타 카드를 고르세요', invest: '투자사를 고르세요', crew: '강화할 부서를 고르세요' }[zone] };
  render();
}
function onTile(id) {
  const { zone, idx } = UI.pick, p = cur(G), x = C(id), from = srcOf(G, p, id);
  let body = '', choice = { card: id, from };
  if (zone === 'invest') { body = `<div class="brk"><span>투자금</span><b>자산 +${x.payout}</b><span>다음 작품 조건</span><b>${esc(x.next_drama_condition)}</b><span>달성</span><b>${esc(x.success_bonus)}</b><span>실패</span><b style="color:#C2410C">${esc(x.failure_penalty)}</b></div>`; }
  else if (zone === 'crew') { body = `<div class="brk"><span>가격</span><b>자산 −${x.price}</b><span>효과</span><b style="text-align:left;font-weight:600">${esc(x.effect)}</b><span class="tot">남는 자산</span><b class="tot">${p.money - x.price}</b></div>` + (p.crews.length >= 3 ? `<div><span class="lab">제작진 ${RULES.crewCap}칸이 꽉 찼습니다 · 내보낼 카드</span><div style="display:flex;gap:6px;margin-top:6px">${p.crews.map((c, i) => `<label class="optbtn" style="padding:8px 12px"><input type="radio" name="rep" value="${i}" ${i ? '' : 'checked'}> ${esc(C(c).name)}</label>`).join('')}</div></div>` : ''); }
  else { const cost = placeCost(G, p, zone, idx, id, from), kind = x.quality != null ? 'writer' : 'actor', out = p.prep[kind];
    body = `<div class="brk"><span>계약비${from === 'excl' ? ' (전속 재기용 · 계약비 1/3)' : from === 'poach' ? ' (캐스팅 승부사 · 전속 빼앗기)' : ''}</span><b>${from === 'excl' ? (x.deck === 'growth' ? 0 : Math.floor(x.cost / 3)) : x.cost}</b>${zone !== 'star' ? `<span>칸 비용</span><b>+${Math.max(0, cost - (from === 'excl' ? (x.deck === 'growth' ? 0 : Math.floor(x.cost / 3)) : x.cost))}</b>` : ''}<span class="tot">총비용</span><b class="tot">자산 −${cost}</b><span>남는 자산</span><b>${p.money - cost}</b></div>${out ? `<div style="color:#C2410C;font-weight:700">준비 칸의 ${esc(C(out).name)}(${esc(C(out).title)})이 밀려나 버려집니다</div>` : ''}`; }
  UI.confirm = { zone, idx, choice };
  UI.modal = modal(`${esc(x.name)}${x.title ? ' · ' + esc(x.title) : ''}`, { writer: '작가 계약', actor: '배우 캐스팅', star: '대스타 계약', invest: '투자 유치', crew: '제작진 고용' }[zone] + ' · 확인', `<div style="display:flex;gap:22px;align-items:flex-start"><div>${fullCard(id)}</div><div style="display:flex;flex-direction:column;gap:12px;min-width:360px">${body}</div></div>`, '<button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">확정</button>');
  renderOverlay();
}
function confirmAir(idx) {
  const did = idx[0]; const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
  const p = cur(G), d = C(idx[0]), w = C(p.prep.writer), a = C(p.prep.actor), q = previewQuality(G, p);
  const conds = distCond(G, p, idx[0]); const inv = p.inv ? C(p.inv) : null;
  UI.confirm = { zone: 'air', idx, choice: {} };
  UI.modal = modal(`${esc(d.name)} 방영`, `${esc(d.category)} · ${esc(d.concept)} · 정산 미리보기`, `<div class="brk"><span>작품</span><b>${esc(w.name)} × ${esc(a.name)}</b><span>예상 작품성 (주사위 제외)</span><b>${q}</b>${(() => { const pr = previewRating(G, p), t = RULES.gradeTab[d.category]; return pr ? `<span>예상 시청률</span><b>작품성 ${pr.q} + 화제성 ${pr.b} = ${pr.r} → <span style="color:${GCOL[pr.gi]}">${pr.grade}등급</span></b><span>예상 보상</span><b>명성 ${t.f[pr.gi]} · 자산 ${t.m[pr.gi]} · 인지도 ${t.a[pr.gi]} <span style="font-weight:500;color:#5C5A55">(보너스·주사위 별도)</span></b>` : ''; })()}<span>변경점</span><b style="font-weight:600">${esc(d.modifier)}</b>${conds.map(c => `<span>조건</span><b style="color:${c.ok ? 'var(--money)' : '#C2410C'}">${esc(c.why.replace(' 필요', ''))} ${c.ok ? '✓' : '✗'}</b>`).join('')}${inv ? `<span>투자 ${esc(inv.name)}</span><b>${esc(inv.next_drama_condition)} · 정산 6단계에서 판정</b>` : ''}</div>`, '<button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">방영 확정</button>');
  if (p.dir === 'D03') UI.modal = UI.modal.replace('<div class="brk">', boostSel(p) + '<div class="brk">');
  renderOverlay();
}
function fullCard(id) { const x = C(id), t = id[0]; return t === 'A' || t === 'G' ? actorCard(x, DB) : t === 'W' ? writerCard(x) : t === 'I' ? investorCard(x) : t === 'C' ? crewCard(x) : ''; }
function doPlace(zone, idx, choice) { const r = place(G, zone, idx, choice); UI.pick = null; UI.modal = null; if (!r.ok) toast(r.why); save(); render(); }
function devPanel() { const p = cur(G);
  UI.modal = modal('개발자 패널', `현재 플레이어 · ${esc(p.name)}`, `<div class="ctrl"><label>자산<input id="dv-money" type="number" value="${p.money}"></label><label>명성<input id="dv-fame" type="number" value="${p.fame}"></label><label>인지도<input id="dv-aware" type="number" value="${p.aware}"></label><label>편성표<input id="dv-sched" type="number" value="${G.sched}"></label><label>K-콘텐츠<input id="dv-kc" type="number" value="${G.kc}"></label><label>주사위 고정<select id="dv-dice">${[0, 1, 2, 3, 4, 5, 6].map(v => `<option value="${v}" ${G.dev.dice === v ? 'selected' : ''}>${v ? v : '무작위'}</option>`).join('')}</select></label></div><div class="ctrl" style="grid-template-columns:1fr auto"><label>카드 강제 진열 (ID)<input id="dv-card" placeholder="예: A01, W27, C07"></label><button class="btn" data-act="force" style="align-self:end">진열</button></div>`, '<button class="btn" data-act="close">닫기</button><button class="btn pri" data-act="devsave">적용</button>'); renderOverlay(); }

/* ── setup & results ── */
function dirOpts(seed) { const g = { rng: hashSeed(seed + '#dir') }; const ids = shuffle(g, J.directors.map(d => d.id)); return Array.from({ length: 5 }, (_, i) => [ids[i * 2], ids[i * 2 + 1]]); }
function renderSetup() {
  const S = UI.setup; const hasSave = !!localStorage.getItem(SAVE_KEY);
  $('ovl').innerHTML = `<div class="setup"><header class="hd"><div><span class="lab">FILM MAKING · HOTSEAT MOCKUP · 규칙서 v2 검증용</span><h1>준비</h1></div>${hasSave ? '<button class="btn" data-act="continue">저장된 게임 이어하기</button>' : ''}</header>
    <aside class="l"><div><span class="lab">게임 길이 · 업계 지표 트랙 길이와 최대 라운드</span><div class="seg" style="margin-top:8px;grid-template-columns:repeat(3,1fr)">${LENS.map(([k, l]) => `<button class="${S.len === k ? 'on' : ''}" data-len="${k}" style="font-size:15px">${l}</button>`).join('')}</div></div><div><span class="lab">인원</span><div class="seg" style="margin-top:8px">${[2, 3, 4, 5].map(n => `<button class="${n === S.n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="lab">플레이어 · 이름과 색</span>${S.pl.slice(0, S.n).map((p, i) => `<div class="prow" style="grid-template-columns:28px minmax(0,1fr) auto auto"><span class="lab">P${i + 1}</span><input value="${esc(p.name)}" data-name="${i}"><button class="tb" data-bot="${i}" style="min-width:58px;${p.bot ? 'background:#111;color:#fff' : ''}">${p.bot ? '봇' : '사람'}</button><div class="cols">${PCOL.map((c, ci) => `<i style="background:${c}" class="${p.c === ci ? 'on' : S.pl.slice(0, S.n).some(q => q.c === ci) ? 'taken' : ''}" data-pi="${i}" data-c="${ci}"></i>`).join('')}</div></div>`).join('')}</div>
      <div><span class="lab">무작위 시드</span><div style="display:flex;gap:8px;margin-top:8px"><input id="seed" value="${esc(S.seed)}" style="flex:1;font-family:var(--mono);font-size:16px;border:1.5px solid var(--ink);border-radius:4px;padding:10px 12px"><button class="btn" data-act="reseed">새로 뽑기</button><button class="btn" data-act="autodir">감독 자동</button></div><div style="font-size:13px;color:var(--muted);margin-top:6px">같은 시드 + 같은 선택 → 같은 게임. 규칙 수정 전후 비교용.</div></div></aside>
    <main class="r"><span class="lab">감독 선택 · 플레이어마다 2장 중 1장</span>${S.pl.slice(0, S.n).map((p, i) => `<div class="dpick"><b style="font-size:16px;color:${PCOL[p.c]}">${esc(p.name)}</b><div class="opts2">${S.opts[i].map(id => `<div class="o2 ${p.dir === id ? 'sel' : ''}" style="--pc:${PCOL[p.c]}" data-pd="${i}" data-d="${id}">${directorCard(C(id))}</div>`).join('')}</div></div>`).join('')}</main>
    <footer class="ft"><span class="lab">${S.pl.slice(0, S.n).filter(p => p.dir).length} / ${S.n} 감독 선택 · 감독 능력 ${RULES.dirImpl.length}/12 적용 · 공개 목표·시상식·스폰서 적용</span><button class="btn pri" data-act="start" ${S.pl.slice(0, S.n).every(p => p.dir) ? '' : 'disabled'}>게임 시작 →</button></footer></div>`;
}
function renderResults() {
  const rk = [...G.players].sort((a, b) => b.fame - a.fame); const SRC = [['work', '작품', '#111'], ['ind', '업계 지표', '#555553'], ['aware', '인지도 보상', '#1E88E5'], ['award', '시상식', '#C9A227'], ['obj', '공개 목표', '#8A8A86'], ['end', '종료 효과', '#C2410C']];
  const max = Math.max(1, ...G.players.map(p => Object.values(p.src).reduce((a, b) => a + Math.max(0, b), 0)));
  const w = 1180, h = 280, pl = 44, pr = 30, pt = 12, pb = 30, R = Math.max(2, G.round), Y = Math.max(10, ...G.players.map(p => Math.max(0, ...p.fameByRound)));
  const X = i => pl + i * (w - pl - pr) / (R - 1), Yp = v => pt + (h - pt - pb) * (1 - v / Y);
  const du = {}; G.airings.forEach(a => { du[a.dist] = du[a.dist] || { n: 0, f: 0 }; du[a.dist].n++; du[a.dist].f += a.fame; });
  const avgAir = (G.airings.length / G.n).toFixed(1);
  $('ovl').innerHTML = `<div class="results"><header class="hd"><div><span class="lab">GAME OVER · ${G.round} ROUNDS · ${esc(G.seed)}</span><h1>결과</h1></div><span class="lab">편성표 ${G.sched}/${G.schedMax} · K-콘텐츠 ${G.kc}/${G.kcMax}</span></header>
    <aside class="rk"><span class="lab">최종 순위</span>${rk.map((p, i) => `<div class="rrow ${i ? '' : 'w'}"><span class="pos">${i + 1}</span><div><div class="nm"><i style="background:${p.color}"></i>${esc(p.name)}</div><div style="font-size:13px;color:var(--muted);font-weight:600">${esc(C(p.dir).concept)} · 방영 ${p.rec.length}편 · 인지도 ${p.aware} · 자산 ${p.money}</div></div><span class="sc">${I.fame}${p.fame}</span></div>`).join('')}
      <div class="kpi"><div><span class="lab">1위−꼴찌</span><b>${rk[0].fame - rk[rk.length - 1].fame}</b></div><div><span class="lab">1인당 방영</span><b>${avgAir}</b></div><div><span class="lab">라운드</span><b>${G.round}</b></div></div>
      <div><span class="lab">배급사 사용 · 평균 명성</span>${G.dists.map(id => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(C(id).name)}</span><b>${du[id] ? `${du[id].n}회 · ${(du[id].f / du[id].n).toFixed(1)}` : '0회'}</b></div>`).join('')}</div></aside>
    <main class="mn"><section><div style="display:flex;justify-content:space-between"><b style="font-size:17px">명성 출처</b><span class="lab">목표 · 작품 50% · 지표 20% · 인지도·시상식 15% · 목표·종료 15%</span></div><div style="display:flex;gap:14px;font-size:13px;color:var(--muted);margin:8px 0">${SRC.map(s => `<span style="display:flex;align-items:center;gap:5px"><i style="width:11px;height:11px;background:${s[2]};display:block"></i>${s[1]}</span>`).join('')}</div>
      ${rk.map(p => { const t = Object.values(p.src).reduce((a, b) => a + Math.max(0, b), 0); return `<div class="brow"><b>${esc(p.name)}</b><div class="bar" style="width:${Math.max(4, t / max * 100)}%">${SRC.map(s => p.src[s[0]] > 0 ? `<div style="flex:${p.src[s[0]]};background:${s[2]}" title="${s[1]} ${p.src[s[0]]}">${p.src[s[0]] >= 3 ? p.src[s[0]] : ''}</div>` : '').join('')}</div><b style="text-align:right">${t}${p.src.end < 0 ? ` <span style="color:#C2410C;font-size:12px">${p.src.end}</span>` : ''}</b></div>`; }).join('')}</section>
      <section><b style="font-size:17px">라운드별 명성 추이</b><div style="border:1px solid var(--line);border-radius:4px;padding:12px;margin-top:10px"><svg width="${w}" height="${h}">${[0, .25, .5, .75, 1].map(f => `<line x1="${pl}" x2="${w - pr}" y1="${Yp(Y * f)}" y2="${Yp(Y * f)}" stroke="#E6E6E3"/><text x="${pl - 8}" y="${Yp(Y * f) + 4}" text-anchor="end" font-size="12" fill="#6B6B6B">${Math.round(Y * f)}</text>`).join('')}${Array.from({ length: R }, (_, i) => `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="12" fill="#6B6B6B">R${i + 1}</text>`).join('')}${G.players.map(p => `<polyline fill="none" stroke="${p.color}" stroke-width="3" points="${p.fameByRound.map((v, i) => X(i) + ',' + Yp(Math.max(0, v))).join(' ')}"/>`).join('')}</svg></div></section></main>
    <footer class="ft"><span class="lab">로그 ${G.log.length}줄 · 방영 ${G.airings.length}회</span><div style="display:flex;gap:8px"><button class="btn" data-csv="games.csv">games.csv</button><button class="btn" data-csv="players.csv">players.csv</button><button class="btn" data-csv="airings.csv">airings.csv</button><button class="btn" data-act="logjson">로그 .json</button><button class="btn pri" data-act="new">새 게임</button></div></footer></div>`;
}
function download(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }

function botTurnNow() { if (!G || G.over) return false; if (G.phase === 'TrendPick') return G.players[G.trend.picker].bot; if (G.phase === 'Settle') return G.pending && G.players[G.pending.pid].bot; if (G.phase === 'Action') return cur(G).bot; return false; }
function scheduleBot() { clearTimeout(scheduleBot.h); if (!botTurnNow()) return; scheduleBot.h = setTimeout(() => { if (!botTurnNow()) return; const r = botStep(G); if (r && r.ok === false) { const f = place(G, 'fund', 0, { opt: 0 }); if (!f.ok) console.warn('bot stuck', r.why); } G.undo = null; save(); render(); }, UI.botDelay); }
function render() { if (!G) return renderSetup(); if (G.over) return renderResults(); renderGame(); renderOverlay(); scheduleBot(); }
function freshSetup() { const seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); UI.setup = { n: 4, len: 'std', seed, pl: PNAME.map((name, i) => ({ name, c: i, dir: null, bot: i > 0 })), opts: dirOpts(seed) }; }

/* ── events ── */
document.addEventListener('click', e => {
  const t = e.target; const q = s => t.closest(s);
  let el;
  if (!G || G.over) {
    const S = UI.setup;
    if ((el = q('[data-n]'))) { S.n = +el.dataset.n; return renderSetup(); }
    if ((el = q('[data-len]'))) { S.len = el.dataset.len; return renderSetup(); }
    if ((el = q('i[data-c]')) && !el.classList.contains('taken')) { S.pl[+el.dataset.pi].c = +el.dataset.c; return renderSetup(); }
    if ((el = q('[data-bot]'))) { const p = S.pl[+el.dataset.bot]; p.bot = !p.bot; return renderSetup(); }
    if ((el = q('[data-pd]'))) { S.pl[+el.dataset.pd].dir = el.dataset.d; return renderSetup(); }
    if ((el = q('[data-csv]'))) return download(el.dataset.csv, exportCSV(G)[el.dataset.csv]);
    if (q('[data-act="logjson"]')) return download('log.json', JSON.stringify(G.log, null, 1), 'application/json');
    if (q('[data-act="autodir"]')) { S.pl.forEach((p, i) => (p.dir = S.opts[i][0])); return renderSetup(); }
    if (q('[data-act="reseed"]')) { S.seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); S.opts = dirOpts(S.seed); S.pl.forEach(p => (p.dir = null)); return renderSetup(); }
    if (q('[data-act="continue"]')) { G = JSON.parse(localStorage.getItem(SAVE_KEY)); return render(); }
    if (q('[data-act="new"]')) { localStorage.removeItem(SAVE_KEY); G = null; freshSetup(); return render(); }
    if (q('[data-act="start"]')) { G = newGame(J, { seed: S.seed, length: S.len, players: S.pl.slice(0, S.n).map(p => ({ name: p.name + (p.bot ? ' 🤖' : ''), color: PCOL[p.c], dir: p.dir, bot: p.bot })) }); save(); $('ovl').innerHTML = ''; return render(); }
    return;
  }
  if ((el = q('button[data-tab]'))) { UI.tab = el.dataset.tab; return renderGame(); }
  if (isMobile() && !UI.pick && !UI.modal && (el = q('.mt[data-id]'))) { UI.modal = modal(esc(C(el.dataset.id).name), '카드', fullCard(el.dataset.id), '<button class="btn" data-act="close">닫기</button>'); return renderOverlay(); }
  if (botTurnNow() && !q('[data-act="dev"],[data-act="new"],[data-act="close"],[data-act="devsave"],[data-act="speed"],.ev.set')) return;
  if (q('[data-act="speed"]')) { UI.botDelay = UI.botDelay > 100 ? 60 : 700; return renderGame(); }
  if (q('[data-act="growth"]')) { UI.modal = modal('성장 · 업적 · 시상식', `${esc(cur(G).name)} 기준`, growthHTML(cur(G)), '<button class="btn pri" data-act="gclose">닫기</button>'); return renderOverlay(); }
  if (q('[data-act="gclose"]')) { UI.modal = ''; return renderOverlay(); }
  if ((el = q('[data-free]'))) { const r = useFree(G, el.dataset.free); if (!r.ok) toast(r.why); save(); return render(); }
  if ((el = q('[data-bsel]'))) { UI.bsel = el.dataset.bsel || null; return renderOverlay(); }
  if ((el = q('[data-bonus]'))) { UI.bsel = null; const r = bonusWriter(G, el.dataset.bonus || null); if (r && r.ok === false) toast(r.why); save(); return render(); }
  if ((el = q('[data-trend]'))) { pickTrend(G, el.dataset.trend); save(); return render(); }
  if (q('[data-act="roll"]')) { settleRoll(G); save(); return render(); }
  if ((el = q('[data-keep]'))) { settleFinish(G, el.dataset.keep === 'none' ? null : el.dataset.keep); save(); return render(); }
  if (q('[data-act="cancel"]')) { UI.pick = null; return render(); }
  if (q('[data-act="close"]')) { UI.modal = null; UI.confirm = null; return renderOverlay(); }
  if (q('[data-act="confirm"]')) { const c = UI.confirm; if (c.zone === 'air') { const bs = document.getElementById('boost'); if (bs) c.choice.boost = +bs.value; } if (c.zone === 'crew') { const r = document.querySelector('input[name="rep"]:checked'); if (r) c.choice.replace = +r.value; } UI.confirm = null; return doPlace(c.zone, c.idx, c.choice); }
  if ((el = q('[data-opt]'))) { const o = +el.dataset.opt, { zone, idx } = UI.optFor; return doPlace(zone, idx, zone === 'fund' ? { opt: o > 2 ? 2 : o, track: o === 3 ? 'kc' : 'sched' } : { opt: o }); }
  if (q('[data-act="undo"]')) { const S = undo(G); if (S) { G = S; UI.pick = null; save(); render(); } return; }
  if (q('[data-act="dev"]')) return devPanel();
  if (q('[data-act="new"]')) { if (confirm('진행 중인 게임을 버리고 새로 시작할까요?')) { localStorage.removeItem(SAVE_KEY); G = null; freshSetup(); render(); } return; }
  if (q('[data-act="devsave"]')) { const p = cur(G), v = id => +$(id).value; p.money = v('dv-money'); p.fame = v('dv-fame'); p.aware = v('dv-aware'); G.sched = Math.min(G.schedMax, v('dv-sched')); G.kc = Math.min(G.kcMax, v('dv-kc')); G.dev.dice = v('dv-dice'); G.log.push({ r: G.round, ph: G.phase, who: 'sys', text: `개발자 패널 · ${p.name} 자산 ${p.money} 명성 ${p.fame} 인지도 ${p.aware} · 주사위 ${G.dev.dice || '무작위'}` }); UI.modal = null; save(); return render(); }
  if (q('[data-act="force"]')) { const id = $('dv-card').value.trim().toUpperCase(), x = C(id); if (!x) return toast('없는 카드 ID'); const k = x.deck === 'star' ? 'star' : id[0] === 'A' ? 'actor' : id[0] === 'W' ? 'writer' : id[0] === 'I' ? 'investor' : id[0] === 'C' ? 'crew' : null; if (!k) return toast('진열할 수 없는 카드'); for (const d in G.decks) { const i = G.decks[d].draw.indexOf(id); if (i >= 0) G.decks[d].draw.splice(i, 1); } if (G.market[k][0]) G.decks[k].disc.push(G.market[k][0]); G.market[k][0] = id; G.log.push({ r: G.round, ph: G.phase, who: 'sys', text: `개발자 패널 · ${x.name} 강제 진열` }); UI.modal = null; save(); return render(); }
  if (UI.pick && (el = q('.mt.pickable'))) return onTile(el.dataset.id);
  if (!UI.pick && !UI.modal && (el = q('.sl.can'))) return onSlot(el.dataset.zone, JSON.parse(el.dataset.idx));
  if ((el = q('.ev.set'))) { const i = +el.dataset.log; UI.open.has(i) ? UI.open.delete(i) : UI.open.add(i); return renderGame(); }
});
document.addEventListener('input', e => { const i = e.target.dataset && e.target.dataset.name; if (i != null && UI.setup) UI.setup.pl[+i].name = e.target.value; if (e.target.id === 'seed' && UI.setup) { UI.setup.seed = e.target.value; UI.setup.opts = dirOpts(e.target.value || 'x'); UI.setup.pl.forEach(p => (p.dir = null)); clearTimeout(renderSetup.h); renderSetup.h = setTimeout(() => { const pos = e.target.selectionStart; renderSetup(); const s = $('seed'); s.focus(); s.setSelectionRange(pos, pos); }, 400); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && G && !G.over) { if (UI.modal) { UI.modal = null; UI.confirm = null; renderOverlay(); } else if (UI.pick) { UI.pick = null; render(); } } });
// hover enlarge
document.addEventListener('mouseover', e => { const pop = $('pop'); if (isMobile()) { pop.style.display = 'none'; return; } const t = e.target.closest && e.target.closest('.mt[data-id]'); if (!t || !G || G.over) { pop.style.display = 'none'; return; }
  pop.innerHTML = fullCard(t.dataset.id); pop.style.display = 'block'; const sr = stageEl().getBoundingClientRect(), r = t.getBoundingClientRect();
  const tx = (r.left - sr.left) / SC, ty = (r.top - sr.top) / SC, tw = r.width / SC, cw = pop.offsetWidth, ch = pop.offsetHeight;
  let left = tx + tw + 10; if (left + cw > 1910) left = tx - cw - 10; pop.style.left = left + 'px'; pop.style.top = Math.max(10, Math.min(1080 - ch - 10, ty - ch / 3)) + 'px'; });

(async () => {
  addEventListener('resize', fit); fit();
  try { J = await (await fetch('cards.json')).json(); } catch (e) { $('ovl').innerHTML = `<div class="banner" style="background:#C2410C">cards.json을 불러오지 못했습니다 · ${esc(e.message)}</div>`; return; }
  loadDB(J); freshSetup(); render();
})();
