/* FILM MAKING mockup — UI layer. Reads/writes G only through rules.js functions. */
const SAVE_KEY = 'fm-mockup-v1';
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
    <div class="mres"><i style="background:${p.color}"></i><b>${esc(p.name)}</b><span>${I.money}${p.money}</span><span>${I.fame}${p.fame}</span><span>${I.aware}${p.aware}</span><span class="lab">일꾼 ${RULES.workers - p.placed}</span></div>
    <div class="brand"><span class="lab">HOTSEAT MOCKUP · ${G.n}P · ${esc(G.seed)}</span><b>FILM MAKING</b></div>
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
    grp('스타', 'star', 3, p.aware >= RULES.starUnlock ? `인지도 ${p.aware} · 해금` : `🔒 인지도 ${RULES.starUnlock} 필요`) + grp('투자사', 'investor', 3, `덱 ${G.decks.investor.draw.length}`) + grp('제작진', 'crew', 3, `덱 ${G.decks.crew.draw.length}`);
  const b = G.board;
  const dsHTML = G.dists.map(did => { const d = C(did); const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
    return `<div class="ds"><div class="dh">${DIST_ICON[d.category] || ''}<div class="tx"><b>${esc(d.name)}</b><span>${esc(d.category)} · ${esc(d.concept)}</span></div></div>
      <dl class="fm"><dt>조건</dt><dd>${esc(f.condition)}</dd><dt>${I.fame}명성</dt><dd>${esc(f.fame)}</dd><dt>${I.aware}인지도</dt><dd>${esc(f.awareness)}</dd><dt>${I.money}자산</dt><dd>${esc(f.money)}</dd></dl>
      <div class="md">${esc(d.modifier)}</div><div class="dsl">${b.air[did].map((o, k) => sl('air', [did, k], o)).join('')}</div></div>`; }).join('');
  $('board').innerHTML = `
    <div class="bhd"><h3>액션 보드</h3>${freeActions(G, cur(G)).map(a => `<button class="tb" data-free="${a.id}" style="border-color:var(--money);color:var(--money)">＋ ${esc(a.label)}</button>`).join('')}<div class="states"><span>빈 칸 클릭 → 대상 선택 → 확인</span><span>흐린 칸에 마우스 → 이유</span></div></div>
    <div class="zones">
      ${zoneBox('작가 계약', '3칸', b.writer.map((o, i) => sl('writer', i, o, costLab(RULES.slotCost[i]))).join(''))}
      ${zoneBox('배우 캐스팅', '3칸', b.actor.map((o, i) => sl('actor', i, o, costLab(RULES.slotCost[i]))).join(''))}
      ${zoneBox('대스타 영역', '개인 칸', G.players.map(x => sl('star', x.id, b.star[x.id], `<span class="cost" style="color:${x.color};font-size:11px">${esc(x.name)}</span>`)).join(''), '')}
      ${zoneBox('투자 유치', '2칸', b.invest.map((o, i) => sl('invest', i, o)).join(''), '', 'grp-res')}
      ${zoneBox('제작진 고용', '2칸', b.crew.map((o, i) => sl('crew', i, o)).join(''), '', 'grp-res')}
      ${zoneBox('홍보', '2칸', b.promo.map((o, i) => sl('promo', i, o)).join(''), `<div class="opts"><div>${I.money}2 → ${I.aware}인지도 +1</div><div>${I.money}4 → ${I.aware}인지도 +3</div></div>`, 'grp-act')}
      ${zoneBox('자금 확보', '무제한', b.fund.map(o => `<div class="sl wide">${W(pcol(o))}</div>`).join('') + sl('fund', 0, null, '<span class="cost" style="font-size:16px">＋</span>'), `<div class="opts"><div>${I.money}자산 +2</div><div>${I.money}5 → ${I.fame}명성 +1</div><div>${I.money}6 → 업계 지표 +1</div></div>`, 'grp-act')}
      <div class="z turnbox" style="background:${p.color};border-color:${p.color}"><span class="lab">지금 차례</span><div class="big">${esc(p.name)}</div><div style="font-size:13px;font-weight:600">남은 일꾼 ${RULES.workers - p.placed} / ${RULES.workers}</div><div class="wks">${Array.from({ length: RULES.workers }, (_, i) => `<div class="wk" style="background:${i < p.placed ? 'rgba(0,0,0,.35)' : '#fff'};width:22px;height:22px"></div>`).join('')}</div></div>
    </div>
    <div class="air"><div class="zh"><b>방영</b><span class="lab">준비 칸에 작가 + 배우가 있어야 함 · 배급사 5곳 · 각 ${RULES.distSlots}칸</span></div><div class="dists">${dsHTML}</div></div>`;
  // players
  const d = C(p.dir), awMarks = { 3: 'OTT', 5: '대스타', 6: '지상파' };
  const box = (t, ids, n) => `<div class="box"><span class="lab">${t}</span><div class="bx">${Array.from({ length: n }, (_, i) => tile(ids[i] || null)).join('')}</div></div>`;
  const opp = x => { const dd = C(x.dir); return `<div class="pp op"><div class="ph" style="background:${x.color}"><span>${esc(x.name)}</span><span class="sub">${esc(dd.concept)}</span></div><div class="body2">
      <div class="kv2"><div><span class="k">${I.fame}명성</span><div class="v">${x.fame}</div></div><div><span class="k">${I.aware}인지도</span><div class="v">${x.aware}</div></div><div><span class="k">${I.money}자산</span><div class="v">${x.money}</div></div><div><span class="k">방영</span><div class="v">${x.rec.length}</div></div></div>
      <div class="note">준비 ${[x.prep.writer, x.prep.actor].filter(Boolean).map(i => esc(C(i).name)).join(' · ') || '—'}${x.excl ? ` · 전속 ${esc(C(x.excl).name)}` : ''}</div>
      <div class="note">일꾼 ${RULES.workers - x.placed}/${RULES.workers}${x.inv ? ` · 투자 ${esc(C(x.inv).name)}` : ''}</div></div></div>`; };
  const others = G.players.filter(x => x.id !== p.id);
  $('players').style.gridTemplateColumns = `minmax(0,1fr) ${others.map(() => '236px').join(' ')}`;
  $('players').innerHTML = `
    <div class="pp me" style="border-color:${p.color}"><div class="ph" style="background:${p.color}"><span>${esc(p.name)} · 현재 차례</span><span class="sub">감독 ${d.id} · ${esc(d.concept)}</span></div>
      <div class="grid">
        <div class="dirm"><span class="lab" style="color:#999">DIRECTOR · ${d.id}</span><div class="cn">${esc(d.concept)}</div><div class="nm">${esc(d.name)}</div><div class="ab">${esc(d.ability)}</div><div class="rs">능력 효과는 3단계 구현 예정</div></div>
        <div class="res"><div class="r"><span class="k">${I.money}자산</span><span class="v" style="color:var(--money)">${p.money}</span></div><div class="r"><span class="k">${I.fame}명성</span><span class="v">${p.fame}</span></div><div class="r"><span class="k">${I.aware}인지도</span><span class="v" style="color:var(--aware)">${p.aware}</span></div></div>
        <div class="rt">
          <div class="line">${box('준비 칸 · 작가 / 배우', [p.prep.writer, p.prep.actor], 2)}${box('전속 1칸', [p.excl], 1)}${box('제작진 3칸', p.crews, 3)}</div>
          <div class="line" style="align-items:flex-end;gap:18px">${box('투자 계약', [p.inv], 1)}
            <div class="aw"><span class="lab">인지도 트랙 · ${p.aware}</span><div class="cells">${Array.from({ length: 10 }, (_, i) => `<div class="c ${i < p.aware ? 'f' : ''}"></div>`).join('')}</div><div class="mk">${Array.from({ length: 10 }, (_, i) => `<span>${awMarks[i + 1] || ''}</span>`).join('')}</div></div>
            <div class="box"><span class="lab">방영 기록 · ${p.rec.length}/8</span><div class="rec">${Array.from({ length: 8 }, (_, i) => p.rec[i] ? `<div class="rc f" style="background:var(${GENRE[p.rec[i]] || '--g-thriller'})">${p.rec[i]}</div>` : `<div class="rc">${i + 1}</div>`).join('')}</div></div>
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
function modal(title, kick, body, foot) { return `<div class="scrim"><div class="modal"><div class="mh"><span class="lab">${kick}</span><h2>${title}</h2></div><div class="mb">${body}</div><div class="mf">${foot}</div></div></div>`; }
function bonusModal() { const p = P(G, G.bonus.pid);
  return modal('시즌2 기획팀 · 작가 계약', `${esc(p.name)} · 일꾼 없이 · 칸 비용 없음`, `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">${bonusChoices(G).map(id => `<button class="optbtn" data-bonus="${id}" style="flex-direction:column;align-items:flex-start;gap:4px"><b>${esc(C(id).name)}</b><span style="font-size:13px;color:var(--muted)">${esc(C(id).title)} · 작품성 ${C(id).quality} · ${(C(id).genres || []).join('·')}</span><span style="color:var(--money)">자산 −${placeCost(G, p, 'writer', 0, id, 'market')}</span></button>`).join('')}</div>`, '<button class="btn" data-bonus="">건너뛰기</button>'); }
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
    if (i === 7) return `<div class="stp"><span class="n">8</span><div class="nm">작품 정리</div><div class="ls" style="gap:8px"><button class="btn" data-keep="writer">작가 전속 · ${esc(C(S.w).name)}</button><button class="btn" data-keep="actor">배우 전속 · ${esc(C(S.a).name)}</button><button class="btn" data-keep="none">남기지 않음</button></div><div class="v" style="font-size:13px;color:var(--muted)">전속 1칸${p.excl ? ` · 현재 ${esc(C(p.excl).name)} 교체됨` : ''}</div></div>`;
    return `<div class="stp ${i === 2 ? 'dice' : ''}"><span class="n">${i + 1}</span><div class="nm">${nm}</div><div class="ls">${s.t.map(x => `<span>${esc(x[0])}${x[1] ? ` <b>+${x[1]}</b>` : ''}</span>`).join('')}</div><div class="v">${esc(s.v)}</div></div>`; }).join('');
  const tot = S.rolled ? `<div class="brk" style="grid-template-columns:repeat(5,auto);justify-content:start;gap:4px 28px"><span>명성 <b>+${S.res.fame}</b></span><span>자산 <b>+${S.res.money}</b></span><span>인지도 <b>+${S.res.aware}</b></span><span>편성표 <b>+${S.ind.sched}</b></span><span>K-콘텐츠 <b>+${S.ind.kc}</b></span></div>` : '';
  return `<div class="scrim"><div class="modal" style="width:1180px"><div class="mh"><span class="lab">방영 정산 · ${esc(p.name)} · ${esc(d.name)}(${esc(d.category)}) · ${esc(S.g)}</span><h2>${esc(C(S.w).signature_work || '')} · ${esc(C(S.w).name)} × ${esc(C(S.a).name)}</h2></div><div class="mb" style="gap:0">${rows}${S.notes.length ? `<div style="font-size:12.5px;color:var(--muted);padding-top:10px">메모 · ${S.notes.map(esc).join(' / ')}</div>` : ''}</div><div class="mf" style="justify-content:space-between">${tot}<span class="lab" style="align-self:center">8단계에서 전속을 고르면 확정</span></div></div></div>`;
}

/* ── interactions ── */
function eligible(zone, idx) { const p = cur(G);
  if (zone === 'writer' || zone === 'actor') { const ids = G.market[zone].filter(id => id && C(id).cost + RULES.slotCost[idx] <= p.money); if (p.excl && (C(p.excl).quality != null) === (zone === 'writer') && placeCost(G, p, zone, idx, p.excl, 'excl') <= p.money) ids.push(p.excl); return ids; }
  if (zone === 'star') return G.market.star.filter(id => id && C(id).required_fame <= p.aware && C(id).cost <= p.money);
  if (zone === 'invest') return G.market.investor.filter(Boolean);
  if (zone === 'crew') return G.market.crew.filter(id => id && C(id).price <= p.money);
  return []; }
function onSlot(zone, idx) {
  const p = cur(G);
  if (zone === 'promo') { UI.modal = modal('홍보', '옵션 선택', [0, 1].map(o => { const c = [2, 4][o], a = [1, 3][o]; return `<button class="optbtn" data-opt="${o}" ${p.money < c ? 'disabled' : ''}><span>자산 ${c} → 인지도 +${a}</span><span>${p.money} → ${p.money - c}</span></button>`; }).join(''), '<button class="btn" data-act="close">취소</button>'); UI.optFor = { zone, idx }; return renderOverlay(); }
  if (zone === 'fund') { const o = [['자산 +2', 0, true], ['자산 5 → 명성 +1', 1, p.money >= 5], ['자산 6 → 편성표 +1 (명성 +1)', 2, p.money >= 6 && G.sched < G.schedMax], ['자산 6 → K-콘텐츠 지수 +1 (명성 +1)', 3, p.money >= 6 && G.kc < G.kcMax]];
    UI.modal = modal('자금 확보', '옵션 선택 · 무제한', o.map(([t, v, en]) => `<button class="optbtn" data-opt="${v}" ${en ? '' : 'disabled'}><span>${t}</span></button>`).join(''), '<button class="btn" data-act="close">취소</button>'); UI.optFor = { zone, idx }; return renderOverlay(); }
  if (zone === 'air') return confirmAir(idx);
  const ids = eligible(zone, idx); if (!ids.length) return toast('고를 수 있는 카드가 없습니다');
  UI.pick = { zone, idx, ids, msg: { writer: '작가 카드를 고르세요 (진열 또는 전속)', actor: '배우 카드를 고르세요 (진열 또는 전속)', star: '스타 카드를 고르세요', invest: '투자사를 고르세요', crew: '제작진을 고르세요' }[zone] };
  render();
}
function onTile(id) {
  const { zone, idx } = UI.pick, p = cur(G), x = C(id), from = id === p.excl ? 'excl' : 'market';
  let body = '', choice = { card: id, from };
  if (zone === 'invest') { body = `<div class="brk"><span>투자금</span><b>자산 +${x.payout}</b><span>다음 작품 조건</span><b>${esc(x.next_drama_condition)}</b><span>달성</span><b>${esc(x.success_bonus)}</b><span>실패</span><b style="color:#C2410C">${esc(x.failure_penalty)}</b></div>`; }
  else if (zone === 'crew') { body = `<div class="brk"><span>가격</span><b>자산 −${x.price}</b><span>효과</span><b style="text-align:left;font-weight:600">${esc(x.effect)}</b><span class="tot">남는 자산</span><b class="tot">${p.money - x.price}</b></div>` + (p.crews.length >= 3 ? `<div><span class="lab">제작진 3칸이 꽉 찼습니다 · 내보낼 카드</span><div style="display:flex;gap:6px;margin-top:6px">${p.crews.map((c, i) => `<label class="optbtn" style="padding:8px 12px"><input type="radio" name="rep" value="${i}" ${i ? '' : 'checked'}> ${esc(C(c).name)}</label>`).join('')}</div></div>` : ''); }
  else { const cost = placeCost(G, p, zone, idx, id, from), kind = x.quality != null ? 'writer' : 'actor', out = p.prep[kind];
    body = `<div class="brk"><span>계약비${from === 'excl' ? ' (전속 재기용)' : ''}</span><b>${from === 'excl' ? 0 : x.cost}</b>${zone !== 'star' ? `<span>칸 비용</span><b>+${RULES.slotCost[idx]}</b>` : ''}<span class="tot">총비용</span><b class="tot">자산 −${cost}</b><span>남는 자산</span><b>${p.money - cost}</b></div>${out ? `<div style="color:#C2410C;font-weight:700">준비 칸의 ${esc(C(out).name)}(${esc(C(out).title)})이 밀려나 버려집니다</div>` : ''}`; }
  UI.confirm = { zone, idx, choice };
  UI.modal = modal(`${esc(x.name)}${x.title ? ' · ' + esc(x.title) : ''}`, { writer: '작가 계약', actor: '배우 캐스팅', star: '대스타 계약', invest: '투자 유치', crew: '제작진 고용' }[zone] + ' · 확인', `<div style="display:flex;gap:22px;align-items:flex-start"><div>${fullCard(id)}</div><div style="display:flex;flex-direction:column;gap:12px;min-width:360px">${body}</div></div>`, '<button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">확정</button>');
  renderOverlay();
}
function confirmAir(idx) {
  const did = idx[0]; const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
  const p = cur(G), d = C(idx[0]), w = C(p.prep.writer), a = C(p.prep.actor), q = previewQuality(G, p);
  const conds = distCond(G, p, idx[0]); const inv = p.inv ? C(p.inv) : null;
  UI.confirm = { zone: 'air', idx, choice: {} };
  UI.modal = modal(`${esc(d.name)} 방영`, `${esc(d.category)} · ${esc(d.concept)} · 정산 미리보기`, `<div class="brk"><span>작품</span><b>${esc(w.name)} × ${esc(a.name)}</b><span>예상 작품성 (주사위 제외)</span><b>${q}</b><span>배급사 공식</span><b>명성 ${esc(f.fame)} · 인지도 ${esc(f.awareness)} · 자산 ${esc(f.money)}</b><span>변경점</span><b style="font-weight:600">${esc(d.modifier)}</b>${conds.map(c => `<span>조건</span><b style="color:${c.ok ? 'var(--money)' : '#C2410C'}">${esc(c.why.replace(' 필요', ''))} ${c.ok ? '✓' : '✗'}</b>`).join('')}${inv ? `<span>투자 ${esc(inv.name)}</span><b>${esc(inv.next_drama_condition)} · 정산 6단계에서 판정</b>` : ''}</div>`, '<button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">방영 확정</button>');
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
    <aside class="l"><div><span class="lab">인원</span><div class="seg" style="margin-top:8px">${[2, 3, 4, 5].map(n => `<button class="${n === S.n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="lab">플레이어 · 이름과 색</span>${S.pl.slice(0, S.n).map((p, i) => `<div class="prow" style="grid-template-columns:28px minmax(0,1fr) auto auto"><span class="lab">P${i + 1}</span><input value="${esc(p.name)}" data-name="${i}"><button class="tb" data-bot="${i}" style="min-width:58px;${p.bot ? 'background:#111;color:#fff' : ''}">${p.bot ? '봇' : '사람'}</button><div class="cols">${PCOL.map((c, ci) => `<i style="background:${c}" class="${p.c === ci ? 'on' : S.pl.slice(0, S.n).some(q => q.c === ci) ? 'taken' : ''}" data-pi="${i}" data-c="${ci}"></i>`).join('')}</div></div>`).join('')}</div>
      <div><span class="lab">무작위 시드</span><div style="display:flex;gap:8px;margin-top:8px"><input id="seed" value="${esc(S.seed)}" style="flex:1;font-family:var(--mono);font-size:16px;border:1.5px solid var(--ink);border-radius:4px;padding:10px 12px"><button class="btn" data-act="reseed">새로 뽑기</button><button class="btn" data-act="autodir">감독 자동</button></div><div style="font-size:13px;color:var(--muted);margin-top:6px">같은 시드 + 같은 선택 → 같은 게임. 규칙 수정 전후 비교용.</div></div></aside>
    <main class="r"><span class="lab">감독 선택 · 플레이어마다 2장 중 1장</span>${S.pl.slice(0, S.n).map((p, i) => `<div class="dpick"><b style="font-size:16px;color:${PCOL[p.c]}">${esc(p.name)}</b><div class="opts2">${S.opts[i].map(id => `<div class="o2 ${p.dir === id ? 'sel' : ''}" style="--pc:${PCOL[p.c]}" data-pd="${i}" data-d="${id}">${directorCard(C(id))}</div>`).join('')}</div></div>`).join('')}</main>
    <footer class="ft"><span class="lab">${S.pl.slice(0, S.n).filter(p => p.dir).length} / ${S.n} 감독 선택 · 1차 목업: 감독 능력·공개 목표·시상식 미구현</span><button class="btn pri" data-act="start" ${S.pl.slice(0, S.n).every(p => p.dir) ? '' : 'disabled'}>게임 시작 →</button></footer></div>`;
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
function freshSetup() { const seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); UI.setup = { n: 3, seed, pl: PNAME.map((name, i) => ({ name, c: i, dir: null, bot: i > 0 })), opts: dirOpts(seed) }; }

/* ── events ── */
document.addEventListener('click', e => {
  const t = e.target; const q = s => t.closest(s);
  let el;
  if (!G || G.over) {
    const S = UI.setup;
    if ((el = q('[data-n]'))) { S.n = +el.dataset.n; return renderSetup(); }
    if ((el = q('i[data-c]')) && !el.classList.contains('taken')) { S.pl[+el.dataset.pi].c = +el.dataset.c; return renderSetup(); }
    if ((el = q('[data-bot]'))) { const p = S.pl[+el.dataset.bot]; p.bot = !p.bot; return renderSetup(); }
    if ((el = q('[data-pd]'))) { S.pl[+el.dataset.pd].dir = el.dataset.d; return renderSetup(); }
    if ((el = q('[data-csv]'))) return download(el.dataset.csv, exportCSV(G)[el.dataset.csv]);
    if (q('[data-act="logjson"]')) return download('log.json', JSON.stringify(G.log, null, 1), 'application/json');
    if (q('[data-act="autodir"]')) { S.pl.forEach((p, i) => (p.dir = S.opts[i][0])); return renderSetup(); }
    if (q('[data-act="reseed"]')) { S.seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); S.opts = dirOpts(S.seed); S.pl.forEach(p => (p.dir = null)); return renderSetup(); }
    if (q('[data-act="continue"]')) { G = JSON.parse(localStorage.getItem(SAVE_KEY)); return render(); }
    if (q('[data-act="new"]')) { localStorage.removeItem(SAVE_KEY); G = null; freshSetup(); return render(); }
    if (q('[data-act="start"]')) { G = newGame(J, { seed: S.seed, players: S.pl.slice(0, S.n).map(p => ({ name: p.name + (p.bot ? ' 🤖' : ''), color: PCOL[p.c], dir: p.dir, bot: p.bot })) }); save(); $('ovl').innerHTML = ''; return render(); }
    return;
  }
  if ((el = q('button[data-tab]'))) { UI.tab = el.dataset.tab; return renderGame(); }
  if (isMobile() && !UI.pick && !UI.modal && (el = q('.mt[data-id]'))) { UI.modal = modal(esc(C(el.dataset.id).name), '카드', fullCard(el.dataset.id), '<button class="btn" data-act="close">닫기</button>'); return renderOverlay(); }
  if (botTurnNow() && !q('[data-act="dev"],[data-act="new"],[data-act="close"],[data-act="devsave"],[data-act="speed"],.ev.set')) return;
  if (q('[data-act="speed"]')) { UI.botDelay = UI.botDelay > 100 ? 60 : 700; return renderGame(); }
  if ((el = q('[data-free]'))) { const r = useFree(G, el.dataset.free); if (!r.ok) toast(r.why); save(); return render(); }
  if ((el = q('[data-bonus]'))) { const r = bonusWriter(G, el.dataset.bonus || null); if (r && r.ok === false) toast(r.why); save(); return render(); }
  if ((el = q('[data-trend]'))) { pickTrend(G, el.dataset.trend); save(); return render(); }
  if (q('[data-act="roll"]')) { settleRoll(G); save(); return render(); }
  if ((el = q('[data-keep]'))) { settleFinish(G, el.dataset.keep === 'none' ? null : el.dataset.keep); save(); return render(); }
  if (q('[data-act="cancel"]')) { UI.pick = null; return render(); }
  if (q('[data-act="close"]')) { UI.modal = null; UI.confirm = null; return renderOverlay(); }
  if (q('[data-act="confirm"]')) { const c = UI.confirm; if (c.zone === 'crew') { const r = document.querySelector('input[name="rep"]:checked'); if (r) c.choice.replace = +r.value; } UI.confirm = null; return doPlace(c.zone, c.idx, c.choice); }
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
