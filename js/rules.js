/* FILM MAKING mockup — rules engine. Pure: never touches the DOM, so bots can run it headless.
   Everything the rulebook didn't spell out lives in RULES — edit here, not in code. */
const RULES = {
  workers: 3,
  startMoney: 5,
  income: 2,
  sched: { 2: 9, 3: 11, 4: 12, 5: 13 },   // 편성표 length by player count
  kc:    { 2: 5, 3: 6, 4: 7, 5: 8 },      // K-콘텐츠 지수 length by player count
  eventCells: { sched: [4, 8], kc: [3] }, // display only (effects not implemented)
  genreMatch: 2,
  origin: { 웹툰: { buzz: 1 }, 소설: {}, 오리지널: {} },
  slotCost: [0, 1, 2],
  distSlots: 2,
  starUnlock: 5,
  exclReuse: 'slotOnly',                 // re-contracting your exclusive card: pay slot cost only
  indFame: 1,                            // 명성 per industry-track step you push
  kcPerHallyu: 1, kcBonusOverseas: 1,
  noAirSched: 1,                         // 편성표 +1 if nobody aired this round
  investFail: -3,
  maxRounds: 12,
  dice: 6,
};

/* ── seeded RNG (mulberry32), state serialisable in G.rng ── */
function hashSeed(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function rnd(G) { let t = (G.rng += 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(G, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function roll(G) { if (G.dev && G.dev.dice) return G.dev.dice; return 1 + Math.floor(rnd(G) * RULES.dice); }

/* ── card db ── */
let DB = null, BASE = null;
function loadDB(J) { DB = {}; for (const k in J) if (Array.isArray(J[k])) J[k].forEach(x => x && x.id && (DB[x.id] = x)); BASE = J.distribution_base; return J; }
const C = id => DB[id];
const num = s => parseInt(String(s).replace('−', '-'), 10);
function parseRes(text) { const out = {}; const re = /(명성|자산|인지도)\s*([+−-])\s*(\d+)/g; let m; while ((m = re.exec(text))) { const k = { 명성: 'fame', 자산: 'money', 인지도: 'aware' }[m[1]]; out[k] = (out[k] || 0) + (m[2] === '+' ? 1 : -1) * +m[3]; } return out; }

/* ── setup ── */
function newGame(J, cfg) {
  loadDB(J);
  const G = { v: 1, gameId: 'G' + Date.now().toString(36), seed: cfg.seed, rng: hashSeed(cfg.seed), n: cfg.players.length,
    round: 0, phase: 'Setup', order: [], turn: 0, sched: 0, kc: 0, schedMax: RULES.sched[cfg.players.length], kcMax: RULES.kc[cfg.players.length],
    trend: { now: null, next: null, deck: [], disc: [], choices: [], picker: null }, dists: [], objectives: [],
    decks: {}, market: { actor: [], writer: [], star: [], investor: [], crew: [] }, board: {}, players: [], log: [], airings: [],
    airedThisRound: false, pending: null, undo: null, dev: { dice: 0 }, over: false };
  const by = d => J[d];
  const deckOf = (arr, f) => ({ draw: shuffle(G, arr.filter(f).map(x => x.id)), disc: [] });
  G.decks.actor = deckOf(J.actors, x => x.deck === 'actor');
  G.decks.star = deckOf([...J.actors, ...J.writers], x => x.deck === 'star');
  G.decks.writer = deckOf(J.writers, x => x.deck === 'writer');
  G.decks.investor = deckOf(J.investors, () => true);
  G.decks.crew = deckOf(J.crews, () => true);
  G.trend.deck = shuffle(G, J.trends.map(t => t.id));
  const cats = [...new Set(J.distributors.map(d => d.category))];
  G.dists = cats.map(c => shuffle(G, J.distributors.filter(d => d.category === c).map(d => d.id))[0]);
  G.objectives = shuffle(G, J.objectives.map(o => o.id)).slice(0, 3);
  cfg.players.forEach((p, i) => {
    const d = C(p.dir), sb = parseRes(d.start_bonus);
    G.players.push({ id: i, name: p.name, color: p.color, dir: p.dir, money: RULES.startMoney + (sb.money || 0), fame: sb.fame || 0, aware: sb.aware || 0,
      placed: 0, prep: { writer: null, actor: null }, excl: null, crews: [], inv: null, rec: [], src: { work: 0, ind: 0, aware: 0, award: 0, obj: 0, end: 0 }, fameByRound: [], invFails: 0, invCount: 0, bot: !!p.bot });
  });
  G.order = G.players.map(p => p.id);
  G.trend.now = G.trend.deck.pop(); G.trend.next = G.trend.deck.pop();
  log(G, 'sys', `게임 시작 · ${G.n}인 · 시드 ${G.seed} · 편성표 ${G.schedMax} · K-콘텐츠 ${G.kcMax}`);
  log(G, 'sys', `활성 배급사 ${G.dists.map(id => C(id).name).join(', ')}`);
  startRound(G);
  return G;
}

function log(G, who, text, calc) { G.log.push({ r: G.round, ph: G.phase, who, text, calc: calc || null }); }
function P(G, id) { return G.players[id]; }
function cur(G) { return G.players[G.order[G.turn]]; }

/* ── round flow ── */
function startRound(G) {
  G.round++; G.airedThisRound = false;
  G.board = { writer: [null, null, null], actor: [null, null, null], star: {}, air: {}, invest: [null, null], crew: [null, null], promo: [null, null], fund: [] };
  G.dists.forEach(d => (G.board.air[d] = Array(RULES.distSlots).fill(null)));
  G.players.forEach(p => { G.board.star[p.id] = null; p.placed = 0; });
  G.phase = 'TrendPick';
  G.trend.choices = [];
  for (let i = 0; i < 3; i++) { if (!G.trend.deck.length) { G.trend.deck = shuffle(G, G.trend.disc); G.trend.disc = []; } if (G.trend.deck.length) G.trend.choices.push(G.trend.deck.pop()); }
  const last = [...G.order].reverse().reduce((a, b) => (P(G, b).fame < P(G, a).fame ? b : a));
  G.trend.picker = last;
  log(G, 'sys', `ROUND ${G.round} 시작`);
}

function pickTrend(G, id) {
  if (G.phase !== 'TrendPick' || !G.trend.choices.includes(id)) return err('선택할 수 없는 트렌드');
  G.trend.choices.filter(x => x !== id).forEach(x => G.trend.disc.push(x));
  if (G.trend.now) G.trend.disc.push(G.trend.now);
  G.trend.now = G.trend.next; G.trend.next = id; G.trend.choices = [];
  log(G, G.trend.picker, `트렌드 선택 · ${C(id).trend} → 다음 라운드. 이번 라운드: ${C(G.trend.now).trend}`);
  resolveIssue(G, C(id));
  income(G); refill(G);
  G.phase = 'Action'; G.turn = 0; G.undo = null;
  return ok();
}

function resolveIssue(G, t) {
  const e = t.issue_effect; let done = false;
  let m = e.match(/K-콘텐츠 지수 \+(\d)/); if (m) { G.kc = Math.min(G.kcMax, G.kc + +m[1]); done = true; }
  m = e.match(/^(.+?) 배우를 준비 칸이나 전속에 둔 플레이어 (.+)$/);
  if (m) {
    const conds = m[1].split('·'), res = parseRes(m[2]);
    G.players.forEach(p => { const ids = [p.prep.actor, p.excl].filter(Boolean).map(C).filter(x => x && x.acting != null);
      if (ids.some(a => conds.some(c => actorHas(a, c)))) applyRes(G, p, res, 'aware'); });
    done = true;
  }
  log(G, 'sys', `이슈 · ${t.issue}${t.issue_negative ? ' ⚠' : ''} — ${e}${done ? '' : ' (자동 적용 안 됨 · 개발자 패널로 수동 반영)'}`);
}
function actorHas(a, c) { return c === '한류' ? a.hallyu : c === '스타' ? a.career === '스타' : a.type === c || a.career === c; }
function applyRes(G, p, r, srcKey) { if (r.money) p.money = Math.max(0, p.money + r.money); if (r.aware) p.aware = Math.max(0, p.aware + r.aware); if (r.fame) { p.fame += r.fame; p.src[srcKey || 'work'] += r.fame; } }

function income(G) { G.players.forEach(p => (p.money += RULES.income)); log(G, 'sys', `수입 · 모든 플레이어 자산 +${RULES.income}`); }
function drawTo(G, key) { const d = G.decks[key]; if (!d.draw.length) { d.draw = shuffle(G, d.disc); d.disc = []; } return d.draw.pop() || null; }
function refill(G) { const size = { actor: 4, writer: 4, star: 3, investor: 3, crew: 3 };
  for (const k in size) { const m = G.market[k]; while (m.length < size[k]) m.push(null); for (let i = 0; i < size[k]; i++) if (!m[i]) m[i] = drawTo(G, k); } }
function discard(G, id) { if (!id) return; const x = C(id); const k = x.deck === 'star' ? 'star' : x.deck === 'growth' ? null : x.id[0] === 'A' ? 'actor' : x.id[0] === 'W' ? 'writer' : x.id[0] === 'I' ? 'investor' : 'crew'; if (k) G.decks[k].disc.push(id); }

/* ── legality ── */
const ok = (x = {}) => ({ ok: true, ...x }), err = why => ({ ok: false, why });
function workersLeft(G, p) { return RULES.workers - p.placed; }
function slotState(G, zone, i) {
  const p = cur(G); const b = G.board;
  if (G.phase !== 'Action') return err('행동 단계가 아님');
  if (G.bonus) return err('시즌2 기획팀 작가 계약을 먼저 끝내세요');
  if (workersLeft(G, p) <= 0) return err('남은 일꾼 없음');
  if (zone === 'star') { if (+i !== p.id) return err('다른 플레이어의 개인 칸'); if (b.star[i] != null) return err('이미 사용'); if (p.aware < RULES.starUnlock) return err(`인지도 ${RULES.starUnlock} 필요`); if (!G.market.star.some(id => id && C(id).required_fame <= p.aware)) return err('계약 가능한 스타 없음'); return ok(); }
  if (zone === 'fund') return ok();
  if (zone === 'air') { const s = b.air[i[0]]; if (s[i[1]] != null) return err('이미 차지됨'); return canAir(G, p, i[0]); }
  const arr = b[zone]; const coord = arr[i] != null;
  if (coord && !(hasCrew(p, 'C15') && p.coordUsed !== G.round)) return err(hasCrew(p, 'C15') ? '제작 코디네이터 이번 라운드 사용함' : '이미 차지됨');
  const ex = coord ? 1 : 0;
  if (zone === 'writer' || zone === 'actor') { const min = Math.min(...G.market[zone].filter(Boolean).map(id => C(id).cost), p.excl && C(p.excl)[zone === 'writer' ? 'quality' : 'acting'] != null ? 0 : 99) + RULES.slotCost[i]; if (p.money < min + ex) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'invest') { if (p.inv) return err('투자 계약 1건 보유 중'); if (p.money < ex) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'crew') { if (p.money < ex + Math.min(...G.market.crew.filter(Boolean).map(id => C(id).price))) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'promo') { if (p.money < 2 + ex) return err('자산 부족'); return ok({ coord }); }
  return ok();
}
/* Effective distributor rules = category base formula with the tile's modifier applied on top. */
function distInfo(did) {
  const d = C(did), base = BASE.find(x => x.category === d.category), mod = d.modifier; let m;
  const f = { fame: base.fame, aware: base.awareness, money: base.money };
  let aware = +((base.condition.match(/인지도 (\d+)/) || [])[1] || 0), hallyu = /한류 태그 포함/.test(base.condition), minQ = 0, genres = null;
  if ((m = mod.match(/조건 인지도 (\d+)/))) aware = +m[1];
  if (/한류 불필요/.test(mod)) hallyu = false;
  if ((m = mod.match(/조건 작품성 (\d+) 이상/))) minQ = +m[1];
  if ((m = mod.match(/([가-힣·]+)만 방영 가능/))) genres = m[1].split('·');
  if ((m = mod.match(/(?:^|, )명성 (0|작품성[^,]*)(?=,|$)/))) f.fame = m[1].trim();
  if (/명성 올림 처리/.test(mod)) f.fame = f.fame.replace('내림', '올림');
  if ((m = mod.match(/(?:^|, )인지도 (화제성 \+ \d+|[+−-]?\d+)(?=,|$)/))) f.aware = m[1];
  if ((m = mod.match(/(?:^|, )자산 (\d+ \+ 화제성|[+−-]?\d+)(?=,|$)/))) f.money = m[1];
  if ((m = mod.match(/자산은 \+(\d)로 감소/))) f.money = '+' + m[1];
  const cond = [aware ? `인지도 ${aware} 이상` : '', hallyu ? '한류 태그 포함' : '', minQ ? `작품성 ${minQ} 이상` : '', genres ? genres.join('·') + ' 작품만' : ''].filter(Boolean).join(' · ') || '없음';
  return { d, f, aware, hallyu, minQ, genres, cond };
}
function distCond(G, p, did) {
  const di = distInfo(did), w = C(p.prep.writer), a = C(p.prep.actor), conds = [];
  const ignoreAware = a && /배급사 인지도 조건 무시/.test(a.effect);
  if (di.aware && !ignoreAware) conds.push({ ok: p.aware >= di.aware, why: `인지도 ${di.aware} 필요` });
  if (di.hallyu) conds.push({ ok: !!((w && w.hallyu) || (a && a.hallyu)), why: '한류 태그 필요' });
  if (di.minQ && w && a) conds.push({ ok: previewQuality(G, p) >= di.minQ, why: `작품성 ${di.minQ} 이상 필요 (주사위 제외 예상)` });
  if (di.genres && w && a) { const { g } = workGenre(w, a); conds.push({ ok: di.genres.includes(g), why: `${di.genres.join('·')} 작품만 방영 가능` }); }
  return conds;
}
function canAir(G, p, did) { if (!p.prep.writer || !p.prep.actor) return err('준비 칸에 작가와 배우 필요'); const bad = distCond(G, p, did).find(c => !c.ok); return bad ? err(bad.why) : ok(); }

/* ── contract / place ── */
function hasCrew(p, id) { return p.crews.includes(id); }
function coordExtra(G, zone, i) { return zone !== 'star' && zone !== 'fund' && zone !== 'air' && G.board[zone] && G.board[zone][i] != null ? 1 : 0; }
function placeCost(G, p, zone, i, card, from) {
  const c = C(card), isW = c.quality != null, extra = coordExtra(G, zone, i);
  if (zone === 'star') return Math.max(0, c.cost - (isW && hasCrew(p, 'C16') ? 1 : 0));
  const slot = RULES.slotCost[i] + extra;
  if (from === 'excl') { if (p.exclFree === card) return extra; return Math.max(0, slot - (hasCrew(p, 'C11') ? 1 : 0)); }
  return Math.max(0, c.cost - (isW && hasCrew(p, 'C16') ? 1 : 0)) + slot;
}
const AWARE_TIERS = [3, 6, 10];
function awareTiers(n) { return AWARE_TIERS.filter(t => n >= t).length; }
function awareUp(G, p, from) { if (!hasCrew(p, 'C08')) return; const k = awareTiers(p.aware) - awareTiers(from); if (k > 0) { p.money += 2 * k; log(G, p.id, `홍보팀 · 인지도 구간 도달 → 자산 +${2 * k}`); } }
/* Crew "추가 액션" that cost no worker. */
function freeActions(G, p) {
  if (G.phase !== 'Action' || G.pending || G.bonus || cur(G).id !== p.id) return [];
  const u = p.freeUsed || {}, out = [];
  if (hasCrew(p, 'C13') && u.C13 !== G.round) out.push({ id: 'C13', label: '라인PD · 자산 +2' });
  if (hasCrew(p, 'C18') && u.C18 !== G.round && awareTiers(p.aware)) out.push({ id: 'C18', label: `기념품 사업부 · 자산 +${awareTiers(p.aware)}` });
  return out;
}
function useFree(G, id) { const p = cur(G); if (!freeActions(G, p).some(x => x.id === id)) return err('사용할 수 없음');
  p.freeUsed = p.freeUsed || {}; p.freeUsed[id] = G.round; const n = id === 'C13' ? 2 : awareTiers(p.aware); p.money += n;
  log(G, p.id, `${C(id).name} · 일꾼 없이 자산 +${n}`); G.undo = null; return ok(); }
/* C14 시즌2 기획팀: right after airing, contract one writer with no worker and no slot cost. */
function bonusChoices(G) { const b = G.bonus; if (!b) return []; const p = P(G, b.pid); return G.market.writer.filter(id => id && placeCost(G, p, 'writer', 0, id, 'market') <= p.money); }
function bonusWriter(G, id) { const b = G.bonus; if (!b) return err('보너스 없음'); const p = P(G, b.pid); G.bonus = null;
  if (id) { const x = C(id), cost = placeCost(G, p, 'writer', 0, id, 'market'); if (cost > p.money) return err('자산 부족');
    p.money -= cost; G.market.writer[G.market.writer.indexOf(id)] = null; if (p.prep.writer) discard(G, p.prep.writer); p.prep.writer = id;
    if (hasCrew(p, 'C10')) p.money += 1;
    log(G, p.id, `시즌2 기획팀 · 일꾼 없이 작가 계약 · ${x.name} · 자산 −${cost}${hasCrew(p, 'C10') ? ' · 기획PD +1' : ''}`); }
  else log(G, p.id, '시즌2 기획팀 · 작가 계약 건너뜀');
  return advance(G); }
function snapshot(G) { G.undo = JSON.stringify({ ...G, undo: null }); }
function place(G, zone, i, choice) {
  const st = slotState(G, zone, i); if (!st.ok) return st; const p = cur(G); snapshot(G);
  const ex = st.coord ? 1 : 0; if (st.coord) { p.coordUsed = G.round; (G.board.extra = G.board.extra || []).push({ zone, i, pid: p.id }); }
  const mark = (arr, k) => { if (!st.coord) arr[k] = p.id; };
  if (zone === 'writer' || zone === 'actor' || zone === 'star') {
    const { card, from } = choice; const x = C(card); const kind = x.quality != null ? 'writer' : 'actor';
    if (zone !== 'star' && kind !== zone) return err('카드 유형이 다름');
    if (zone === 'star' && x.required_fame > p.aware) return err(`인지도 ${x.required_fame} 필요`);
    const cost = placeCost(G, p, zone, i, card, from); if (p.money < cost) return err('자산 부족');
    p.money -= cost;
    if (from === 'excl') { p.excl = null; } else { const mk = G.market[zone === 'star' ? 'star' : zone]; mk[mk.indexOf(card)] = null; }
    const out = p.prep[kind]; if (out) discard(G, out);
    p.prep[kind] = card;
    if (zone === 'star') G.board.star[i] = p.id; else mark(G.board[zone], i);
    if (from === 'excl') p.exclFree = null;
    const pdBonus = kind === 'writer' && hasCrew(p, 'C10') ? 1 : 0; p.money += pdBonus;
    log(G, p.id, `${zone === 'star' ? '대스타 계약' : zone === 'writer' ? '작가 계약' : '배우 캐스팅'} · ${x.name} (${x.title}) · 자산 −${cost}${pdBonus ? ' · 기획PD +1' : ''}${ex ? ' · 제작 코디네이터(칸 비용 +1)' : ''}${out ? ` · ${C(out).name} 밀려남` : ''}`);
  } else if (zone === 'invest') {
    const v = C(choice.card); G.market.investor[G.market.investor.indexOf(choice.card)] = null;
    const fin = hasCrew(p, 'C12') ? 2 : 0; p.money += v.payout + fin - ex; p.inv = choice.card; p.invCount++; mark(G.board.invest, i);
    log(G, p.id, `투자 유치 · ${v.name} · 자산 +${v.payout}${fin ? ' · 재무팀 +2' : ''}${ex ? ' · 코디네이터 −1' : ''} · 조건: ${v.next_drama_condition}`);
  } else if (zone === 'crew') {
    const c = C(choice.card); if (p.money < c.price + ex) return err('자산 부족');
    p.money -= c.price + ex; G.market.crew[G.market.crew.indexOf(choice.card)] = null;
    let out = null; if (p.crews.length >= 3) { out = p.crews.splice(choice.replace ?? 0, 1)[0]; discard(G, out); }
    p.crews.push(choice.card); mark(G.board.crew, i);
    log(G, p.id, `제작진 고용 · ${c.name} · 자산 −${c.price}${out ? ` · ${C(out).name} 해고` : ''}`);
  } else if (zone === 'promo') {
    const o = [{ c: 2, a: 1 }, { c: 4, a: 3 }][choice.opt]; if (p.money < o.c + ex) return err('자산 부족');
    const a0 = p.aware; p.money -= o.c + ex; p.aware += o.a; mark(G.board.promo, i); log(G, p.id, `홍보 · 자산 −${o.c + ex} → 인지도 +${o.a}`); awareUp(G, p, a0);
  } else if (zone === 'fund') {
    const o = choice.opt; if (o === 0) { p.money += 2; log(G, p.id, '자금 확보 · 자산 +2'); }
    else if (o === 1) { if (p.money < 5) return err('자산 부족'); p.money -= 5; applyRes(G, p, { fame: 1 }, 'ind'); log(G, p.id, '자금 확보 · 자산 −5 → 명성 +1'); }
    else { if (p.money < 6) return err('자산 부족'); p.money -= 6; pushTrack(G, p, choice.track || 'sched', 1); log(G, p.id, `자금 확보 · 자산 −6 → ${choice.track === 'kc' ? 'K-콘텐츠 지수' : '편성표'} +1`); }
    G.board.fund.push(p.id);
  } else if (zone === 'air') {
    G.board.air[i[0]][i[1]] = p.id; p.placed++;
    G.pending = beginSettle(G, p, i[0]); G.phase = 'Settle';
    return ok({ settle: true });
  }
  p.placed++; return advance(G);
}
function pushTrack(G, p, which, n) { let got = 0; for (let k = 0; k < n; k++) { if (which === 'kc') { if (G.kc < G.kcMax) { G.kc++; got++; } } else if (G.sched < G.schedMax) { G.sched++; got++; } } if (got && p) applyRes(G, p, { fame: got * RULES.indFame }, 'ind'); return got; }
function undo(G) { if (!G.undo) return null; const S = JSON.parse(G.undo); S.undo = null; S.log.push({ r: S.round, ph: S.phase, who: 'sys', text: '되돌리기 · 직전 일꾼 회수' }); return S; }
function advance(G) {
  const n = G.order.length; for (let k = 1; k <= n; k++) { const t = (G.turn + k) % n; if (workersLeft(G, P(G, G.order[t])) > 0) { G.turn = t; return ok(); } }
  return cleanup(G);
}

/* ── settlement: 8 steps ── */
function workGenre(w, a) { const ag = a.genres || []; if (ag.includes('모든 장르')) return { g: w.genres[0], match: true }; const m = w.genres.find(g => ag.includes(g)); return m ? { g: m, match: true } : { g: w.genres[0], match: false }; }
function hasCrewNamed(p, name) { return p.crews.some(id => C(id).name === name.trim()); }
function statBonuses(G, p, w, a, g) {
  const q = [], b = []; const notes = [];
  const noBuzz = /화제성 보너스를 받을 수 없음/.test(a.effect);
  const HANDLED = ['C06', 'C07', 'C08', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18'];
  p.crews.forEach(id => { const c = C(id); let m;
    if ((m = c.effect.match(/^아이돌 주연 (작품성|화제성) \+(\d)$/))) { if (a.type === '아이돌') (m[1] === '작품성' ? q : b).push([c.name, +m[2]]); return; }
    if ((m = c.effect.match(/^(모든 작품|[가-힣·]+) (작품성|화제성) \+(\d)$/))) { if (m[1] === '모든 작품' || m[1].split('·').includes(g)) (m[2] === '작품성' ? q : b).push([c.name, +m[3]]); return; }
    if (!HANDLED.includes(id)) notes.push(`${c.name}(${c.kind}) 미구현`); });
  [[w, '작가'], [a, '배우']].forEach(([x]) => { const e = x.effect || ''; let m;
    if ((m = e.match(/^(.+?) 보유 시 (작품성|화제성) \+(\d)/))) { if (m[1].split('또는').some(n => hasCrewNamed(p, n))) (m[2] === '작품성' ? q : b).push([`${x.name} · ${m[1]} 보유`, +m[3]]); }
    else if ((m = e.match(/아이돌 주연이면 (작품성|화제성) \+(\d)/))) { if (a.type === '아이돌') (m[1] === '작품성' ? q : b).push([`${x.name} · 아이돌 주연`, +m[2]]); } });
  return { q, b: noBuzz ? [] : b, notes, noBuzz };
}
function previewQuality(G, p) { const w = C(p.prep.writer), a = C(p.prep.actor); const { g, match } = workGenre(w, a); const s = statBonuses(G, p, w, a, g); return w.quality + a.acting + (match ? RULES.genreMatch : 0) + s.q.reduce((t, x) => t + x[1], 0); }
function evalExpr(expr, q, b) { if (/^\s*[+−-]?\d+\s*$/.test(expr)) return num(expr.replace('+', ''));
  let e = expr.replace(/작품성/g, q).replace(/화제성/g, b).replace(/−/g, '-').replace(/÷/g, '/'); const up = /올림/.test(e), dn = /내림/.test(e); e = e.replace(/\(.*?\)/g, '');
  let v = Function(`return (${e})`)(); v = up ? Math.ceil(v) : dn ? Math.floor(v) : v; return Math.max(0, Math.round(v)); }

function beginSettle(G, p, did) {
  const w = C(p.prep.writer), a = C(p.prep.actor), d = C(did); const { g, match } = workGenre(w, a); const s = statBonuses(G, p, w, a, g);
  const hallyu = !!(w.hallyu || a.hallyu);
  const S = { pid: p.id, did, g, hallyu, w: w.id, a: a.id, steps: [], dice: [], rolled: false, done: false, notes: s.notes.slice(), res: { fame: 0, money: 0, aware: 0 }, ind: { sched: 0, kc: 0 } };
  let q = w.quality + a.acting; const qT = [[`작가 ${w.name}`, w.quality], [`연기력 ${a.name}`, a.acting]];
  if (match) { q += RULES.genreMatch; qT.push([`장르 일치 · ${g}`, RULES.genreMatch]); }
  s.q.forEach(x => { q += x[1]; qT.push(x); });
  let b = a.buzz; const bT = [[`화제성 ${a.name}`, a.buzz]];
  const ob = (RULES.origin[w.origin] || {}).buzz || 0; if (ob && !s.noBuzz) { b += ob; bT.push([`원작 · ${w.origin}`, ob]); }
  s.b.forEach(x => { b += x[1]; bT.push(x); });
  if (s.noBuzz) S.notes.push(`${a.name}: 화제성 보너스 없음`);
  S.q = q; S.b = b; S.steps[0] = { t: qT, v: q }; S.steps[1] = { t: bT, v: b };
  // dice sources
  S.noBuzz = s.noBuzz;
  if (/🎲/.test(a.effect || '')) S.dice.push({ src: a.name, kind: 'card', text: a.effect });
  if (/🎲/.test(w.effect || '')) S.dice.push({ src: w.name, kind: 'card', text: w.effect });
  if (p.dir === 'D10') S.dice.push({ src: '시청률 도박사 (감독)', kind: 'd10', text: C('D10').ability });
  if (hasCrew(p, 'C07')) S.dice.push({ src: '바이럴팀', kind: 'viral', text: C('C07').effect });
  if (!S.dice.length) { S.rolled = true; S.steps[2] = { t: [['주사위 없음', 0]], v: '—' }; finishSteps(G, S); }
  return S;
}
/* "🎲 ... : 4~5 화제성 +2 / 6 \"밈 스타\" 화제성 +5, 인지도 +2" → [{test, fx:[[stat,n]], grow}] */
function diceClauses(text) {
  return text.replace(/^.*?주사위\s*:\s*/, '').split('/').map(s => { s = s.trim(); let t = null, m;
    if ((m = s.match(/(\d)\s*~\s*(\d)/))) { const lo = +m[1], hi = +m[2]; t = r => r >= lo && r <= hi; }
    else if (/짝수/.test(s)) t = r => r % 2 === 0; else if (/홀수/.test(s)) t = r => r % 2 === 1;
    else if ((m = s.match(/^(\d)(?:이면|\s|$)/))) { const v = +m[1]; t = r => r === v; }
    const fx = [], re = /(연기력|작품성|화제성|명성|인지도|자산)\s*([+−-])\s*(\d+)/g; let e; while ((e = re.exec(s))) fx.push([e[1], (e[2] === '+' ? 1 : -1) * +e[3]]);
    return { t, fx, grow: /성장 카드로 교체/.test(s), lbl: (s.match(/"([^"]+)"/) || [])[1] || '' }; }).filter(c => c.t && c.fx.length);
}
function applyDiceFx(S, fx) { const out = []; fx.forEach(([k, n]) => {
    if (k === '연기력' || k === '작품성') S.q += n; else if (k === '화제성') { if (S.noBuzz && n > 0) return; S.b += n; }
    else S.res[{ 명성: 'fame', 인지도: 'aware', 자산: 'money' }[k]] += n;
    out.push(`${k} ${n > 0 ? '+' : ''}${n}`); }); return out.join(', '); }
function settleRoll(G) {
  const S = G.pending; if (!S || S.rolled) return err('굴릴 주사위 없음');
  const p = P(G, S.pid), a = C(S.a), dmod = C(S.did).modifier;
  const t = []; S.dice.forEach(d => {
    if (d.kind === 'card') { const r = roll(G); d.r = r; const hit = diceClauses(d.text).find(c => c.t(r));
      if (hit) { if (hit.grow) S.discover = true; t.push([`${d.src} 🎲${r}${hit.lbl ? ' · ' + hit.lbl : ''} → ${applyDiceFx(S, hit.fx)}`, 0]); } else t.push([`${d.src} 🎲${r} · 효과 없음`, 0]); return; }
    if (d.kind === 'd10') { const r1 = roll(G), r2 = roll(G), sum = r1 + r2; d.r = `${r1}+${r2}`; const f = sum >= 10 ? 4 : sum >= 7 ? 2 : -1; S.res.fame += f;
      t.push([`${d.src} 🎲${r1}+${r2}=${sum} → 명성 ${f > 0 ? '+' : ''}${f}`, 0]); return; }
    const r0 = roll(G), cut = +((dmod.match(/바이럴팀 주사위 결과 [−-](\d)/) || [])[1] || 0), r = Math.max(1, r0 - cut);
    const up = +(((a.effect || '').match(/바이럴팀 판정 성공 기준 \+(\d)/) || [])[1] || 0); d.r = cut ? `${r0}−${cut}` : r0;
    const lab = `${d.src} 🎲${r0}${cut ? `−${cut}=${r}` : ''}`;
    if (r === 6) { S.res.aware += 3; t.push([`${lab} · 6 → 인지도 +3`, 0]); }
    else if (r <= S.b + up) { S.res.aware += 2; t.push([`${lab} ≤ 화제성 ${S.b}${up ? '+' + up : ''} → 인지도 +2`, 0]); }
    else t.push([`${lab} > 화제성 ${S.b}${up ? '+' + up : ''} → 실패`, 0]); });
  S.steps[2] = { t, v: S.dice.map(d => d.r).join(' · ') }; S.rolled = true; G.undo = null;
  finishSteps(G, S); return ok();
}
function finishSteps(G, S) {
  const p = P(G, S.pid), w = C(S.w), a = C(S.a), d = C(S.did), base = BASE.find(x => x.category === d.category), mod = d.modifier;
  const f = { ...distInfo(S.did).f };
  if (d.id === 'B04' && a.type === '아이돌') f.aware = '+1';
  const F = { fame: evalExpr(f.fame, S.q, S.b), aware: evalExpr(f.aware, S.q, S.b), money: evalExpr(f.money, S.q, S.b) };
  S.steps[3] = { t: [[`${d.name}(${d.category}) · 명성 ${f.fame}`, F.fame], [`인지도 ${f.aware}`, F.aware], [`자산 ${f.money}`, F.money]], v: `명성 ${F.fame} · 인지도 ${F.aware} · 자산 ${F.money}` };
  S.res.fame += F.fame; S.res.aware += F.aware; S.res.money += F.money;
  // 5 fixed bonuses
  const bonus = []; const add = (label, r) => { if (!r || !Object.keys(r).length) return; for (const k in r) S.res[k] += r[k]; bonus.push([label, r]); };
  let m;
  if ((m = mod.match(/([가-힣·]+) 작품 (명성|자산|인지도) \+(\d)/)) && m[1].split('·').includes(S.g)) add(`${d.name} · ${m[1]}`, parseRes(`${m[2]} +${m[3]}`));
  if ((m = mod.match(/화제성 (\d+) 이상이면 (.+)/)) && S.b >= +m[1]) add(`${d.name} · 화제성 ${m[1]} 이상`, parseRes(m[2]));
  if ((m = mod.match(/(?<!조건 )작품성 (\d+) 이상이면 (.+)/)) && S.q >= +m[1]) add(`${d.name} · 작품성 ${m[1]} 이상`, parseRes(m[2]));
  if (/만 방영 가능, 명성 \+(\d)/.test(mod)) add(`${d.name}`, { fame: +mod.match(/만 방영 가능, 명성 \+(\d)/)[1] });
  if (d.id === 'B04' && (a.type === '연기파' || a.type === '예능인')) add(`${d.name} · ${a.type} 주연`, { aware: 1 });
  if (hasCrew(p, 'C06') && (d.category === 'OTT' || d.category === '해외')) add('로케이션팀', { money: 2 });
  if (hasCrew(p, 'C08')) add('홍보팀', { aware: 1 });
  if ((m = mod.match(/한류 태그 포함 시 (.+)/)) && S.hallyu) add(`${d.name} · 한류`, parseRes(m[1]));
  if ((m = mod.match(/(웹툰|소설|오리지널) 원작 작가면 (.+)/)) && w.origin === m[1]) add(`${d.name} · ${m[1]} 원작`, parseRes(m[2]));
  const tr = C(G.trend.now); if (tr) { const e = tr.trend_effect; let hit = false;
    if ((m = e.match(/^([가-힣]+) 방영 시 (.+)/)) && m[1] === S.g) hit = true;
    if (/^한류 태그 포함 방영 시/.test(e) && S.hallyu) hit = true;
    if (/^아이돌 주연 방영 시/.test(e) && a.type === '아이돌') hit = true;
    if (hit) { const tr0 = parseRes(e.split('방영 시')[1]); add(`트렌드 · ${tr.trend}`, tr0);
      if (/트렌드 보너스 \+1/.test(mod)) { const one = {}; Object.keys(tr0).forEach(k => (one[k] = 1)); add(`${d.name} · 트렌드 +1`, one); } } }
  [w, a].forEach(x => { const e = x.effect || '';
    if ((m = e.match(/방영할 때마다 (.+)/))) add(`${x.name}`, parseRes(m[1]));
    else if ((m = e.match(/^방영 시 (인지도 \+\d)/))) add(`${x.name}`, parseRes(m[1]));
    else if ((m = e.match(/^(.+?)로 방영 시 (.+)/))) { const t = m[1]; if (t === d.name || (t.includes('해외') && d.category === '해외')) add(`${x.name} · ${t}`, parseRes(m[2])); } });
  S.steps[4] = { t: bonus.length ? bonus.map(([l, r]) => [l + ' · ' + Object.entries(r).map(([k, v]) => ({ fame: '명성', money: '자산', aware: '인지도' })[k] + (v > 0 ? ' +' : ' ') + v).join(', '), 0]) : [['없음', 0]], v: bonus.length + '건' };
  // 6 investment
  if (p.inv) { const v = C(p.inv), c = v.next_drama_condition; let okv = null;
    if (c === '주연이 아이돌') okv = a.type === '아이돌'; else if (/한류 태그 포함/.test(c)) okv = S.hallyu;
    else if ((m = c.match(/작품성 (\d+) 이상/))) okv = S.q >= +m[1]; else if ((m = c.match(/화제성 (\d+) 이상/))) okv = S.b >= +m[1];
    else if ((m = c.match(/^([가-힣]+) (장르|작품)/))) okv = S.g === m[1];
    const unk = okv === null; if (unk) { okv = true; S.notes.push(`투자 조건 "${c}" 자동 판정 불가 → 달성 처리`); }
    S.inv = { id: v.id, ok: okv };
    if (okv) { const r = parseRes(v.success_bonus); for (const k in r) S.res[k] += r[k]; S.steps[5] = { t: [[`${v.name} · ${c} → 달성${unk ? ' (수동 확인)' : ''}`, 0], [`보너스 ${v.success_bonus}`, 0]], v: '달성' }; }
    else { const pen = hasCrew(p, 'C12') ? -1 : RULES.investFail; S.res.fame += pen; p.invFails++; S.steps[5] = { t: [[`${v.name} · ${c} → 실패`, 0], [`명성 ${pen}${hasCrew(p, 'C12') ? ' (재무팀)' : ''}`, 0]], v: '실패' }; }
  } else S.steps[5] = { t: [['투자 계약 없음', 0]], v: '—' };
  // 7 resources + tracks (computed now, applied on finish)
  S.ind.sched = 1; S.ind.kc = (S.hallyu ? RULES.kcPerHallyu : 0) + (S.hallyu && d.category === '해외' ? RULES.kcBonusOverseas : 0);
  S.steps[6] = { t: [[`명성 +${S.res.fame} · 자산 +${S.res.money} · 인지도 +${S.res.aware}`, 0], [`편성표 +${S.ind.sched} · K-콘텐츠 +${S.ind.kc} (명성 칸당 +${RULES.indFame})`, 0]], v: '' };
  S.steps[7] = { t: [['전속 여부 선택', 0]], v: '선택 필요' };
}
function settleFinish(G, keep) {
  const S = G.pending; if (!S || !S.rolled) return err('정산 미완료'); const p = P(G, S.pid), d = C(S.did), a = C(S.a), w = C(S.w);
  const workFame = S.res.fame, a0 = p.aware; p.fame += workFame; p.src.work += workFame; p.money += S.res.money; p.aware = Math.max(0, p.aware + S.res.aware); awareUp(G, p, a0);
  const gs = pushTrack(G, p, 'sched', S.ind.sched), gk = pushTrack(G, p, 'kc', S.ind.kc);
  if (S.inv) p.inv = null, discard(G, S.inv.id);
  // growth
  let aId = a.id; if (S.discover && a.grow_to) aId = a.grow_to.split(' ')[0]; else if (a.grow_to && !/^🎲/.test(a.effect) && !String(a.grow_to).startsWith('←')) aId = a.grow_to.split(' ')[0];
  const grown = aId !== a.id;
  let kept = null; if (keep === 'writer') { kept = w.id; discard(G, aId !== a.id ? null : a.id); } else if (keep === 'actor') { kept = aId; discard(G, w.id); } else { discard(G, w.id); if (!grown) discard(G, a.id); }
  if (p.excl && kept) discard(G, p.excl);
  if (kept) p.excl = kept;
  p.exclFree = kept && ((keep === 'writer' && /재계약비 0/.test(d.modifier)) || (keep === 'actor' && /재계약비 0/.test(a.effect || ''))) ? kept : null;
  p.prep = { writer: null, actor: null };
  p.rec.push(S.g); G.airedThisRound = true;
  S.steps[7] = { t: [[kept ? `전속 · ${C(kept).name}` : '전속 없음', 0], grown ? [`성장 · ${a.name} → ${C(aId).title}`, 0] : null].filter(Boolean), v: 'done' };
  const calc = S.steps.map((s, i) => ({ n: i + 1, lines: s.t.map(x => x[0] + (x[1] ? ` (+${x[1]})` : '')), v: s.v }));
  log(G, p.id, `방영 · ${d.name} · ${S.g} · 작품성 ${S.q} · 화제성 ${S.b} → 명성 +${workFame + gs + gk} · 자산 +${S.res.money} · 인지도 +${S.res.aware}`, calc);
  if (S.notes.length) log(G, 'sys', '정산 메모 · ' + S.notes.join(' / '));
  G.airings.push({ game: G.gameId, round: G.round, player: p.name, dir: p.dir, writer: w.id, actor: a.id, dist: d.id, genre: S.g, quality: S.q, buzz: S.b, fame: workFame + gs + gk, money: S.res.money, aware: S.res.aware, trend: G.trend.now, crews: p.crews.join('|'), invest: S.inv ? (S.inv.ok ? 'success' : 'fail') : '', dice: S.dice.map(x => x.r).join('|') });
  G.pending = null; G.phase = 'Action'; G.undo = null;
  if (hasCrew(p, 'C14')) { G.bonus = { pid: p.id, type: 'C14' }; if (bonusChoices(G).length) return ok({ bonus: true }); G.bonus = null; log(G, p.id, '시즌2 기획팀 · 계약 가능한 작가 없음'); }
  return advance(G);
}

/* ── cleanup / finale ── */
function cleanup(G) {
  G.phase = 'Cleanup';
  if (!G.airedThisRound) { G.sched = Math.min(G.schedMax, G.sched + RULES.noAirSched); log(G, 'sys', `무방영 라운드 · 편성표 +${RULES.noAirSched}`); }
  G.players.forEach(p => p.fameByRound.push(p.fame));
  G.order = [...G.order].sort((x, y) => P(G, x).fame - P(G, y).fame || G.order.indexOf(x) - G.order.indexOf(y));
  log(G, 'sys', `라운드 ${G.round} 종료 · 편성표 ${G.sched}/${G.schedMax} · K-콘텐츠 ${G.kc}/${G.kcMax} · 다음 턴 순서 ${G.order.map(i => P(G, i).name).join(' › ')}`);
  if ((G.sched >= G.schedMax && G.kc >= G.kcMax) || G.round >= RULES.maxRounds) return finale(G);
  startRound(G); return ok();
}
function finale(G) {
  G.phase = 'Finale';
  G.players.forEach(p => { if (p.inv) { const pen = hasCrew(p, 'C12') ? -1 : RULES.investFail; p.fame += pen; p.src.end += pen; p.invFails++; log(G, p.id, `종료 · 투자 ${C(p.inv).name} 미이행 → 명성 ${pen}`); p.inv = null; }
    if (hasCrew(p, 'C17')) { const n = 2 + G.airings.filter(x => x.player === p.name && x.quality >= 9).length; p.fame += n; p.src.end += n; log(G, p.id, `편집팀 · 종료 명성 +${n}`); } });
  log(G, 'sys', '공개 목표·시상식·종료 효과는 이번 목업 범위 밖 (0점 처리)');
  G.phase = 'Result'; G.over = true; log(G, 'sys', '게임 종료');
  return ok({ over: true });
}

/* ── CSV ── */
function csv(rows) { if (!rows.length) return ''; const k = Object.keys(rows[0]); const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [k.join(','), ...rows.map(r => k.map(x => q(r[x])).join(','))].join('\n'); }
function exportCSV(G) {
  const win = [...G.players].sort((a, b) => b.fame - a.fame)[0];
  return {
    'games.csv': csv([{ game: G.gameId, seed: G.seed, players: G.n, rounds: G.round, dists: G.dists.join('|'), objectives: G.objectives.join('|'), winner_dir: win.dir }]),
    'players.csv': csv(G.players.map(p => ({ game: G.gameId, player: p.name, dir: p.dir, fame: p.fame, src_work: p.src.work, src_ind: p.src.ind, src_aware: p.src.aware, src_award: p.src.award, src_obj: p.src.obj, src_end: p.src.end, airings: p.rec.length, invest: p.invCount, invest_fail: p.invFails, aware: p.aware, money: p.money }))),
    'airings.csv': csv(G.airings),
  };
}

if (typeof module !== 'undefined') module.exports = { distInfo, freeActions, useFree, bonusChoices, bonusWriter, diceClauses, RULES, newGame, loadDB, pickTrend, place, slotState, placeCost, settleRoll, settleFinish, undo, exportCSV, cur, P, C, BASE: () => BASE, distCond, previewQuality, evalExpr };
