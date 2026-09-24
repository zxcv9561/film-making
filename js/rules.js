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
  starUnlock: 8,
  exclReuse: 'slotOnly',                 // re-contracting your exclusive card: pay slot cost only
  indFame: 1, indEvery: 2,               // v1.2 · 명성 1 per 2 industry-track steps you push                            // 명성 per industry-track step you push
  kcPerHallyu: 1, kcBonusOverseas: 1,
  noAirSched: 1,                         // 편성표 +1 if nobody aired this round
  investFail: -3,
  maxRounds: 12,
  lengths: { short: { mult: 2.2, rounds: 18, label: '짧게' }, std: { mult: 3.3, rounds: 24, label: '표준' }, long: { mult: 4.2, rounds: 30, label: '길게' } },
  dirImpl: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12'],   // directors whose ability is coded
  dice: 6,
  version: 'v1.5',
  // v1.1 · 시청률 등급표 — 명성 f / 자산 m / 인지도 a for grades C B A S SS
  gradeCut: [8, 13, 18, 23],
  gradeTab: {
    지상파: { f: [1, 3, 7, 12, 20], m: [1, 1, 2, 2, 3], a: [0, 1, 1, 2, 2] },
    케이블: { f: [1, 2, 5, 8, 14], m: [2, 3, 3, 4, 5], a: [1, 2, 2, 3, 3] },
    OTT:   { f: [0, 1, 4, 8, 14], m: [3, 5, 7, 9, 11], a: [0, 1, 1, 2, 2] },
    웹:    { f: [0, 1, 3, 5, 8], m: [1, 1, 2, 2, 3], a: [2, 3, 4, 5, 6] },
    해외:  { f: [1, 2, 6, 11, 18], m: [2, 4, 5, 7, 9], a: [1, 1, 2, 3, 3] },
  },
  // v1.2 · 장르 커리어 3단계 (그 장르로 이미 방영한 편수 k)
  stages: [
    { from: 1, name: '경력', q: [1, 1], b: 0, fame: 0 },   // 그 장르 1~2편 방영 후
    { from: 3, name: '전문', q: [2, 2], b: 1, fame: 1 },   // 3~4편
    { from: 5, name: '거장', q: [5], b: 2, fame: 4 },      // 5편 이상
  ],
  achFixed: [], achRandom: 4,
  objPts: { mid: [5, 3, 2], end: [10, 6, 3] },
  endBonus: { moneyPer: 4, deptLv3: 3, master: 3, excl: 2, grown: 2 },
  dirDept: { D03: 'prod', D04: 'plan', D06: 'promo', D09: 'cast', D12: 'cast' },
  sponsorAt: [8, 14, 20],
  awareSpend: [
    { name: '팬미팅', cost: 4, fame: 2, text: '명성 +2' },
    { name: 'PPL 협찬', cost: 3, money: 5, text: '자산 +5' },
    { name: '러브콜', cost: 3, starCut: 3, text: '이번 라운드 스타 계약비 −3' },
    { name: '제작발표회', cost: 2, buzz: 2, text: '다음 방영 화제성 +2' },
  ],
  premium: true,
  crewCap: 4, crewSlots: 3,
  deptCost: [4, 7, 11],                 // v1.3 · 부서 Lv1 · Lv2 · Lv3 강화 비용
  freeCrew: { writer: 'C19', actor: 'C20', promo: 'C21' },   // 라운드 첫 계약/홍보는 일꾼·칸 비용 없음
};
const GRADES = ['C', 'B', 'A', 'S', 'SS'];
/* k = 그 장르로 이미 방영한 편수 → { st: 0 신인 | 1 경력 | 2 전문 | 3 거장, q, b, fame, next } */
function careerAt(k) { const S = RULES.stages; let st = 0; S.forEach((s, i) => { if (k >= s.from) st = i + 1; });
  if (!st) return { st: 0, name: '신인', q: 0, b: 0, fame: 0, next: S[0] };
  const s = S[st - 1], q = s.q[Math.min(k - s.from, s.q.length - 1)]; return { st, name: s.name, q, b: s.b, fame: s.fame, next: S[st] || null }; }
/* v1.2 · 프리미엄 카드: 비싼 카드일수록 확실히 강하게 */
function applyPremium() { if (!RULES.premium) return; Object.values(DB).forEach(x => { if (!x || x.prem != null || x.deck === 'growth') return;
  if (x.quality != null) { if (x.deck === 'star') { x.quality += 2; x.cost += 2; x.prem = 2; } else if (x.cost >= 5) { x.quality += 1; x.cost += 1; x.prem = 1; } else x.prem = 0; }
  else if (x.acting != null && x.id[0] === 'A') { if (x.deck === 'star') { x.acting += 2; x.buzz += 1; x.cost += 2; x.prem = 2; } else if (x.cost >= 4) { x.acting += 1; x.cost += 1; x.prem = 1; } else x.prem = 0; } }); }
function gradeOf(v) { let g = 0; RULES.gradeCut.forEach(c => { if (v >= c) g++; }); return g; }
const ACH = {
  GENRE: { name: '장르 명가', cond: '같은 장르 3편 방영 · 장르마다 1장', pts: [4, 2] },
  MONEY: { name: '흥행 제작사', cond: '방영으로 번 자산 누적 20', pts: [5, 3] },
  BUZZ: { name: '화제의 중심', cond: '화제성 8 이상 작품 방영', pts: [3, 2] },
  SGRADE: { name: '걸작', cond: 'S등급 이상 작품 방영', pts: [4, 2] },
  ALLCAT: { name: '전 채널 제패', cond: '배급 분류 5종 모두 방영', pts: [5, 3] },
  HALLYU: { name: 'K-웨이브', cond: '한류 작품 3편 방영', pts: [4, 2] },
  GROW: { name: '스타 메이커', cond: '배우 성장 2회', pts: [4, 2] },
  CHEAP: { name: '저예산의 기적', cond: '계약비 합 3 이하로 A등급 이상', pts: [3, 2] },
};

/* ── seeded RNG (mulberry32), state serialisable in G.rng ── */
function hashSeed(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function rnd(G) { let t = (G.rng += 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(G, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function roll(G) { if (G.dev && G.dev.dice) return G.dev.dice; return 1 + Math.floor(rnd(G) * RULES.dice); }

/* ── card db ── */
let DB = null, BASE = null;
function loadDB(J) { DB = {}; for (const k in J) if (Array.isArray(J[k])) J[k].forEach(x => x && x.id && (DB[x.id] = x)); BASE = J.distribution_base; Object.keys(DEPTS).forEach(id => { DB[id] = deptCard(id); }); SPONSORS.forEach(s => (DB[s.id] = s)); NEW_CREWS.forEach(c => { if (!J.crews.some(x => x.id === c.id)) J.crews.push({ ...c }); DB[c.id] = J.crews.find(x => x.id === c.id); }); applyPremium(); applyDirTextV12(); return J; }
/* v1.2 · 바뀐 감독 규칙 문구 (cards.json은 v1.0·v1.1과 공유하므로 여기서만 덮어씀) */
/* ── v1.3 · 제작 부서 5개 × 3레벨 (제작진 카드 대체) ── */
const DEPTS = {
  CPLAN: { key: 'plan', name: '기획실', act: '작가 계약', lv: ['작가 계약 칸 비용 −1', '라운드 첫 작가 계약은 일꾼·칸 비용 없음', '작가 계약비 −1 · 전속 재기용 칸 비용 −1'], grant: [[], ['C19'], ['C16', 'C11']] },
  CCAST: { key: 'cast', name: '캐스팅팀', act: '배우 캐스팅', lv: ['배우 계약비 −1', '라운드 첫 배우 계약은 일꾼·칸 비용 없음', '모든 작품 화제성 +1'], grant: [[], ['C20'], []] },
  CPROMO: { key: 'promo', name: '홍보팀', act: '홍보', lv: ['홍보 비용 −1', '방영마다 인지도 +1 · 인지도 구간 도달 시 자산 +2', '바이럴 주사위 획득 · 성공 기준 +1'], grant: [[], ['C08'], ['C07']] },
  CPROD: { key: 'prod', name: '제작본부', act: '방영', lv: ['모든 작품 작품성 +1', '장르 일치 보너스 +1 (2 → 3)', '매 라운드 일꾼 +1'], grant: [[], [], ['C22']] },
  CFIN: { key: 'fin', name: '재무팀', act: '투자 · 자금', lv: ['투자 유치 자산 +2 · 투자 실패 명성 −1로 완화', '라운드 수입 +1', '방영마다 자산 +2'], grant: [['C12'], [], []] },
};
let DEPT_VIEW = null;
/* v1.4 · 스폰서 — 인지도 8/14/20 도달 시 1장씩 계약 · 방영 효과 + 종료 명성 */
const SPONSORS = [
  { id: 'P01', name: '코스메틱 브랜드', k: 'genre', genres: ['로맨스'], m: 3, e: 'per2', f: 2, title: '로맨스', effect: '로맨스 방영마다 자산 +3 · 종료 때 해당 방영 2편당 명성 +2' },
  { id: 'P02', name: '게임사', k: 'buzz8', m: 3, e: 'per1', f: 1, title: '화제성 8+', effect: '화제성 8 이상 방영마다 자산 +3 · 종료 때 해당 방영 1편당 명성 +1' },
  { id: 'P03', name: '글로벌 스트리밍', k: 'cat', cats: ['OTT', '해외'], m: 3, e: 'if3', f: 5, title: 'OTT·해외', effect: 'OTT·해외 방영마다 자산 +3 · 종료 때 해당 방영 3편 이상이면 명성 +5' },
  { id: 'P04', name: '자동차 회사', k: 'cat', cats: ['지상파'], m: 2, e: 'per1', f: 1, title: '지상파', effect: '지상파 방영마다 자산 +2 · 종료 때 해당 방영 1편당 명성 +1' },
  { id: 'P05', name: '금융 그룹', k: 'any', m: 2, e: 'money5', f: 1, title: '모든 방영', effect: '모든 방영마다 자산 +2 · 종료 때 남은 자산 5당 명성 +1' },
  { id: 'P06', name: '식품 PPL', k: 'genre', genres: ['코미디'], m: 3, e: 'per2', f: 2, title: '코미디', effect: '코미디 방영마다 자산 +3 · 종료 때 해당 방영 2편당 명성 +2' },
  { id: 'P07', name: '주류 브랜드', k: 'genre', genres: ['스릴러', '범죄'], m: 3, e: 'per2', f: 2, title: '스릴러·범죄', effect: '스릴러·범죄 방영마다 자산 +3 · 종료 때 해당 방영 2편당 명성 +2' },
  { id: 'P08', name: '관광공사', k: 'genre', genres: ['사극'], m: 3, e: 'per2', f: 2, title: '사극', effect: '사극 방영마다 자산 +3 · 종료 때 해당 방영 2편당 명성 +2' },
  { id: 'P09', name: '테크 기업', k: 'genre', genres: ['판타지'], m: 3, e: 'per2', f: 2, title: '판타지', effect: '판타지 방영마다 자산 +3 · 종료 때 해당 방영 2편당 명성 +2' },
  { id: 'P10', name: '명품 하우스', k: 'sgrade', m: 4, e: 'per1', f: 3, title: 'S등급+', effect: 'S등급 이상 방영마다 자산 +4 · 종료 때 해당 방영 1편당 명성 +3' },
  { id: 'P11', name: '통신사', k: 'any', a: 1, e: 'aware5', f: 1, title: '모든 방영', effect: '모든 방영마다 인지도 +1 · 종료 때 최종 인지도 5당 명성 +1' },
  { id: 'P12', name: '문화 재단', k: 'none', e: 'flat', f: 7, title: '후원', effect: '방영 보상 없음 · 종료 때 명성 +7' },
].map(s => ({ ...s, deck: 'sponsor', kind: '스폰서' }));
function spHit(s, S, d) { return s.k === 'any' || (s.k === 'genre' && s.genres.includes(S.g)) || (s.k === 'buzz8' && S.b >= 8) || (s.k === 'cat' && s.cats.includes(d.category)) || (s.k === 'sgrade' && S.grade >= 3); }
function spEnd(G, p, x) { const s = C(x.id); return s.e === 'per2' ? Math.floor(x.cnt / 2) * s.f : s.e === 'per1' ? x.cnt * s.f : s.e === 'if3' ? (x.cnt >= 3 ? s.f : 0) : s.e === 'money5' ? Math.floor(p.money / 5) : s.e === 'aware5' ? Math.floor(p.aware / 5) : s.f; }
function spTiers(p) { return RULES.sponsorAt.filter(t => p.aware >= t).length; }
function sponsorDue(G, p) { return p && (p.spTier || 0) < spTiers(p) && G.market.sponsor && G.market.sponsor.some(Boolean); }
function lvl(p, key) { return ((p && p.dept) || {})[key] || 0; }
function deptCost(G, p, id) { const L = lvl(p, DEPTS[id].key); if (L >= 3) return 99; return Math.max(1, RULES.deptCost[L] - (p.dir === 'D12' ? 2 : 0) - (RULES.dirDept[p.dir] === DEPTS[id].key ? 2 : 0) - ((G && G.rmod && G.rmod.deptCut) || 0)); }
function deptCard(id) { const d = DEPTS[id]; return { id, deck: 'dept', kind: '부서 강화', name: d.name, title: d.act,
  get price() { const v = DEPT_VIEW; return v ? deptCost(v.G, v.p, id) : RULES.deptCost[0]; },
  get effect() { const v = DEPT_VIEW, L = v ? lvl(v.p, d.key) : 0; return L >= 3 ? `Lv3 완료 · ${d.lv.join(' / ')}` : `Lv${L} → Lv${L + 1}: ${d.lv[L]}`; } }; }
const NEW_CREWS = [
  { id: 'C19', kind: '보조 액션', name: '보조 작가팀', price: 5, effect: '라운드 첫 작가 계약은 일꾼을 쓰지 않고 칸 비용 없음' },
  { id: 'C20', kind: '보조 액션', name: '캐스팅 매니저', price: 5, effect: '라운드 첫 배우 계약은 일꾼을 쓰지 않고 칸 비용 없음' },
  { id: 'C21', kind: '보조 액션', name: 'PR 에이전시', price: 4, effect: '라운드 첫 홍보는 일꾼을 쓰지 않음' },
  { id: 'C22', kind: '추가 액션', name: '제작 총괄', price: 7, effect: '매 라운드 일꾼 +1' },
];
const TREND_V12 = {
  T15: { issue: '업계 연수 주간', issue_effect: '이번 라운드 부서 강화 비용 −2' },
  T04: { issue: '특별 편성 주간', issue_effect: '이번 라운드 모든 플레이어 2편까지 방영 가능' },
  T18: { issue: '드라마 과잉 편성', issue_effect: '이번 라운드 케이블 배급사 칸 +1, 케이블로는 두 번째 방영 가능' },
};
function applyDirTextV12() { const T = {
  D01: { ability: '일꾼 4개로 시작합니다.', restriction: '라운드 수입이 없습니다 (기본 +2).' },
  D02: { ability: '작가 없이 방영할 수 있습니다. 감독이 직접 집필하며 작품성은 2에서 시작해 직접 집필 2편마다 +1 (최대 4). 장르는 배우 장르 중 1개를 따릅니다.', restriction: '직접 집필 작품은 원작·작가 효과가 없고 전속으로 남길 수 없습니다' },
  D03: { ability: '방영 때 자산을 추가로 투입할 수 있습니다. 자산 3당 작품성 +2 · 화제성 +1 (최대 자산 9). 자산 3 이상 투입한 작품은 명성 +2. 부서 특전 · 제작본부 강화 −2, Lv3이면 자산을 투입한 작품 등급 +1.' },
  D04: { ability: '작가와 배우 계약비 합이 6 이하인 작품은 명성 +5 · 자산 +3. 부서 특전 · 기획실 강화 −2, Lv3이면 명성 +7.' },
  D06: { ability: '트렌드를 고를 때 4장 중에서 고릅니다. 내 작품 장르가 유행 장르면 작품성 +3, 트렌드 보너스도 +3 더 붙습니다. 유행 장르가 아니어도 작품성 +1 (시장 감각). 부서 특전 · 홍보팀 강화 −2, Lv3이면 트렌드 보너스 +5.' },
  D07: { ability: '방영 후 자산 5를 내면 작가와 배우를 모두 전속으로 남길 수 있습니다 (전속 2칸). 다음 작품이 같은 장르일 때만 유지됩니다.', restriction: '장르를 바꾸면 남은 두 카드 모두 계약 종료 · 같은 작가·배우를 그대로 다시 쓴 작품은 장르 커리어 명성 보너스를 받지 않습니다 · 종료 "전속 보유" 보너스는 1장만' },
  D09: { ability: '작가·배우를 계약할 때 진열 대신 다른 플레이어의 전속 카드를 데려올 수 있습니다. 일반 계약과 같은 비용(계약비 + 칸 비용)이며 추가금은 없습니다. 데려온 카드로 만든 작품은 화제성 +3. 부서 특전 · 캐스팅팀 강화 −2, Lv3이면 빼앗기 계약비 0.', restriction: '원래 소속 플레이어는 보상을 받지 않습니다. 횟수 제한 없음' },
  D11: { ability: '전속 배우를 다시 캐스팅할 때마다 뮤즈 마커 +1 (최대 2). 뮤즈 마커 1개당 그 배우 작품 작품성 +1, 마커가 있으면 화제성 +1.' },
  D12: { ability: '제작본부 Lv1로 시작하고 부서 강화 비용이 항상 −2입니다. 작품 두 편을 동시에 준비할 수 있습니다 (작가·배우 준비 칸 2세트). 두 번째 세트에는 일꾼 없이 계약하고 칸 비용 −1, 계약비 −1. 두 번째 세트로 만든 작품은 작품성 +2 · 화제성 +1. 부서 특전 · 캐스팅팀 강화 추가 −2, Lv3이면 두 번째 세트 계약비 0.', restriction: '방영은 라운드당 1편' },
}; T.D05 = { ability: '부정 이슈의 효과를 받을 때마다 그 효과 대신 인지도 +2 · 명성 +1을 받습니다. 찌라시가 돈 라운드에 방영하면 화제성 +3.' }; T.D10 = { ability: "방영할 때 주사위 2개를 굴립니다. 합 10 이상 명성 +4, 7~9 명성 +2, 6 이하 명성 −1. 결과와 상관없이 방영마다 명성 +2." };
  for (const id in T) if (DB[id]) Object.assign(DB[id], T[id]);
  for (const id in TREND_V12) if (DB[id]) Object.assign(DB[id], TREND_V12[id]);
  Object.values(DB).forEach(o => { if (o && /^O0\d$/.test(o.id)) { o.reward = '1위 +10 · 2위 +6 · 3위 +3 (중간 시상식 때 절반 점수로 한 번 더)'; if (o.id === 'O04') o.criterion = '작품성 12 이상 방영 수'; } }); }
const C = id => DB[id] || (typeof id === 'string' && id.startsWith('WSELF') ? (DB[id] = { id, deck: 'self', name: '윤재하', title: '1인 제작자 · 직접 집필', quality: 3, genres: ['로맨스'], origin: '직접 집필', effect: '', cost: 0, hallyu: false, career: '' }) : undefined);
const num = s => parseInt(String(s).replace('−', '-'), 10);
function parseRes(text) { const out = {}; const re = /(명성|자산|인지도)\s*([+−-])\s*(\d+)/g; let m; while ((m = re.exec(text))) { const k = { 명성: 'fame', 자산: 'money', 인지도: 'aware' }[m[1]]; out[k] = (out[k] || 0) + (m[2] === '+' ? 1 : -1) * +m[3]; } return out; }

/* ── setup ── */
function newGame(J, cfg) {
  loadDB(J);
  const G = { v: 1, gameId: 'G' + Date.now().toString(36), seed: cfg.seed, rng: hashSeed(cfg.seed), n: cfg.players.length,
    round: 0, phase: 'Setup', order: [], turn: 0, sched: 0, kc: 0, len: cfg.length || 'std', maxRounds: RULES.lengths[cfg.length || 'std'].rounds,
    schedMax: Math.round(RULES.sched[cfg.players.length] * RULES.lengths[cfg.length || 'std'].mult), kcMax: Math.round(RULES.kc[cfg.players.length] * RULES.lengths[cfg.length || 'std'].mult), rmod: {}, issue: null, issues: [],
    trend: { now: null, next: null, deck: [], disc: [], choices: [], picker: null }, dists: [], objectives: [],
    decks: {}, market: { actor: [], writer: [], star: [], investor: [], crew: [] }, board: {}, players: [], log: [], airings: [],
    airedThisRound: false, pending: null, undo: null, dev: { dice: 0 }, over: false };
  const by = d => J[d];
  const deckOf = (arr, f) => ({ draw: shuffle(G, arr.filter(f).map(x => x.id)), disc: [] });
  G.decks.actor = deckOf(J.actors, x => x.deck === 'actor');
  G.decks.star = deckOf([...J.actors, ...J.writers], x => x.deck === 'star');
  G.decks.writer = deckOf(J.writers, x => x.deck === 'writer');
  G.decks.investor = deckOf(J.investors, () => true);
  G.decks.crew = { draw: [], disc: [] }; G.market.crew = Object.keys(DEPTS);
  G.decks.sponsor = deckOf(SPONSORS, () => true); G.market.sponsor = [];
  G.trend.deck = shuffle(G, J.trends.map(t => t.id));
  const cats = [...new Set(J.distributors.map(d => d.category))];
  G.dists = cats.map(c => shuffle(G, J.distributors.filter(d => d.category === c).map(d => d.id))[0]);
  G.objectives = shuffle(G, J.objectives.map(o => o.id)).slice(0, 3);
  cfg.players.forEach((p, i) => {
    const d = C(p.dir), sb = parseRes(d.start_bonus);
    G.players.push({ id: i, name: p.name, color: p.color, dir: p.dir, money: RULES.startMoney + (sb.money || 0), fame: sb.fame || 0, aware: sb.aware || 0,
      placed: 0, prep: { writer: null, actor: null }, prep2: { writer: null, actor: null }, excl: null, excl2: null, poach: 0, selfN: 0, crews: [], inv: null, rec: [], src: { work: 0, ind: 0, aware: 0, award: 0, obj: 0, end: 0 }, fameByRound: [], invFails: 0, invCount: 0, bot: !!p.bot, style: p.style || (p.bot ? ['spec', 'spread', 'money'][i % 3] : 'human'),
    career: {}, sponsors: [], spTier: 0, dept: p.dir === 'D12' ? { prod: 1 } : {}, workMoney: 0, hallyuN: 0, growN: 0, cats: [], airedR: 0, air2R: 0 });
  });
  G.order = G.players.map(p => p.id);
  G.ach = [...RULES.achFixed, ...shuffle(G, Object.keys(ACH).filter(k => !RULES.achFixed.includes(k) && k !== 'ALLCAT')).slice(0, RULES.achRandom)]; G.achWin = {}; G.ceremony = 0; G.cerFrom = 1;
  G.trend.now = G.trend.deck.pop(); G.trend.next = G.trend.deck.pop();
  log(G, 'sys', `게임 시작 · ${G.n}인 · 시드 ${G.seed} · 길이 ${RULES.lengths[G.len].label} · 편성표 ${G.schedMax} · K-콘텐츠 ${G.kcMax} · 최대 ${G.maxRounds}라운드`);
  log(G, 'sys', `활성 배급사 ${G.dists.map(id => C(id).name).join(', ')}`);
  log(G, 'sys', `공개 업적 · ${G.ach.map(k => ACH[k].name).join(', ')}`);
  startRound(G);
  return G;
}

function log(G, who, text, calc) { G.log.push({ r: G.round, ph: G.phase, who, text, calc: calc || null }); }
function P(G, id) { return G.players[id]; }
function cur(G) { return G.players[G.order[G.turn]]; }

/* ── round flow ── */
function startRound(G) {
  G.round++; G.airedThisRound = false; G.rmod = {};
  G.board = { writer: [null, null, null], actor: [null, null, null], star: {}, air: {}, invest: [null, null], crew: Array(RULES.crewSlots).fill(null), promo: [null, null], fund: [] };
  G.dists.forEach(d => (G.board.air[d] = Array(RULES.distSlots).fill(null)));
  G.players.forEach(p => { G.board.star[p.id] = null; p.placed = 0; });
  G.phase = 'TrendPick';
  G.trend.choices = [];
  const lastP = [...G.order].reverse().reduce((a, b) => (P(G, b).fame < P(G, a).fame ? b : a)), nCh = P(G, lastP).dir === 'D06' ? 4 : 3;
  for (let i = 0; i < nCh; i++) { if (!G.trend.deck.length) { G.trend.deck = shuffle(G, G.trend.disc); G.trend.disc = []; } if (G.trend.deck.length) G.trend.choices.push(G.trend.deck.pop()); }
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
  const e = t.issue_effect, neg = !!t.issue_negative, hit = []; let done = true, m; G.rmod = G.rmod || {};
  if (t.issue_kind === '찌라시') G.rmod.jjirasi = true;
  const give = (p, res) => { if (neg && p.dir === 'D05') { applyRes(G, p, { aware: 2, fame: 1 }, 'aware'); hit.push(`${p.name} 인지도 +2 · 명성 +1 (막장의 제왕)`); return; } applyRes(G, p, res, 'aware'); hit.push(`${p.name} ${fmtRes(res)}`); };
  const top = k => { const v = Math.max(...G.players.map(p => p[k])); return G.players.filter(p => p[k] === v); };
  if ((m = e.match(/K-콘텐츠 지수 \+(\d)/))) G.kc = Math.min(G.kcMax, G.kc + +m[1]);
  else if ((m = e.match(/^편성표 \+(\d)/))) G.sched = Math.min(G.schedMax, G.sched + +m[1]);
  else if ((m = e.match(/^(.+?) (배우|작가)를 준비 칸이나 전속에 둔 플레이어 (.+)$/))) { const cs = m[1].split('·'), res = parseRes(m[3]), isA = m[2] === '배우';
    G.players.forEach(p => { const xs = [isA ? p.prep.actor : p.prep.writer, p.excl].filter(Boolean).map(C).filter(x => isA ? x.acting != null : x.quality != null);
      if (xs.some(x => cs.some(c => isA ? actorHas(x, c) : x.origin === c))) give(p, res); }); }
  else if ((m = e.match(/^모든 플레이어 (.+)$/))) G.players.forEach(p => give(p, parseRes(m[1])));
  else if ((m = e.match(/^준비 칸에 배우가 있는 플레이어 (.+)$/))) G.players.filter(p => p.prep.actor).forEach(p => give(p, parseRes(m[1])));
  else if ((m = e.match(/^인지도 최하위 플레이어 (.+)$/))) { const v = Math.min(...G.players.map(p => p.aware)); G.players.filter(p => p.aware === v).forEach(p => give(p, parseRes(m[1]))); }
  else if ((m = e.match(/^명성 1위 플레이어 (.+)$/))) top('fame').forEach(p => give(p, parseRes(m[1])));
  else if ((m = e.match(/^인지도 1위 플레이어 (.+)$/))) top('aware').forEach(p => give(p, parseRes(m[1])));
  else if (/무명·신인 배우 계약비 0/.test(e)) G.rmod.rookieFree = true;
  else if (/배우 진열 .*전부 교체/.test(e)) wipe(G, 'actor');
  else if (/제작진 진열 .*전부 교체/.test(e)) wipe(G, 'crew');
  else if (/투자사 진열 전부 교체/.test(e)) { wipe(G, 'investor'); if ((m = e.match(/투자금 −(\d)/))) G.rmod.investCut = +m[1]; }
  else if ((m = e.match(/작가 계약 칸 비용 \+(\d)/))) G.rmod.writerSlot = +m[1];
  else if ((m = e.match(/스타 배우 계약비 \+(\d)/))) G.rmod.starCost = +m[1];
  else if (/2편까지 방영 가능/.test(e)) G.rmod.doubleAir = true;
  else if ((m = e.match(/부서 강화 비용 −(\d)/))) G.rmod.deptCut = +m[1];
  else if ((m = e.match(/(케이블|해외) 배급사 칸 \+(\d)/))) { G.dists.filter(id => C(id).category === m[1]).forEach(id => { for (let k = 0; k < +m[2]; k++) G.board.air[id].push(null); }); if (/두 번째 방영/.test(e)) G.rmod.doubleAirCat = m[1]; }
  else if (/투자사 진열 1장 추가/.test(e)) G.rmod.investExtra = 1;
  else if (/지상파·케이블 방영 시 자산 \+1/.test(e)) G.rmod.tvMoney = 1;
  else if ((m = e.match(/홍보 비용 −(\d)/))) G.rmod.promoCut = +m[1];
  else done = false;
  G.issue = { id: t.id, round: G.round, hit }; (G.issues = G.issues || []).push(t.id);
  log(G, 'sys', `이슈 · ${t.issue}${neg ? ' ⚠' : ''} — ${e}${hit.length ? ' → ' + hit.join(', ') : ''}${done ? '' : ' (자동 적용 안 됨)'}`);
}
function wipe(G, k) { if (k === 'crew') return; G.market[k].forEach(id => id && discard(G, id)); G.market[k] = G.market[k].map(() => null); }
function fmtRes(r) { return Object.entries(r).map(([k, v]) => ({ fame: '명성', money: '자산', aware: '인지도' })[k] + (v > 0 ? ' +' : ' −') + Math.abs(v)).join(', ') || '효과 없음'; }
function actorHas(a, c) { return c === '한류' ? a.hallyu : c === '스타' ? a.career === '스타' : a.type === c || a.career === c; }
function applyRes(G, p, r, srcKey) { if (r.money) p.money = Math.max(0, p.money + r.money); if (r.aware) p.aware = Math.max(0, p.aware + r.aware); if (r.fame) { p.fame += r.fame; p.src[srcKey || 'work'] += r.fame; } }

function income(G) { G.players.forEach(p => { p.money += (p.dir === 'D01' ? 0 : RULES.income) + (lvl(p, 'fin') >= 2 ? 1 : 0); }); log(G, 'sys', `수입 · 자산 +${RULES.income}${G.players.some(p => p.dir === 'D01') ? ' (워커홀릭 제외)' : ''}`); }
function drawTo(G, key) { const d = G.decks[key]; if (!d.draw.length) { d.draw = shuffle(G, d.disc); d.disc = []; } return d.draw.pop() || null; }
function refill(G) { const size = { actor: 4, writer: 4, star: 3, investor: 3 + ((G.rmod && G.rmod.investExtra) || 0), crew: 5, sponsor: 3 };
  for (const k in size) { const m = G.market[k]; while (m.length > size[k]) { const x = m.pop(); if (x) discard(G, x); } while (m.length < size[k]) m.push(null); for (let i = 0; i < size[k]; i++) if (!m[i]) m[i] = drawTo(G, k); } }
function discard(G, id) { if (!id) return; const x = C(id); if (!x || x.deck === 'self' || x.deck === 'dept') return; const k = x.deck === 'star' ? 'star' : x.deck === 'growth' ? null : x.id[0] === 'A' ? 'actor' : x.id[0] === 'W' ? 'writer' : x.id[0] === 'I' ? 'investor' : x.id[0] === 'P' ? 'sponsor' : 'crew'; if (k) G.decks[k].disc.push(id); }

/* ── legality ── */
const ok = (x = {}) => ({ ok: true, ...x }), err = why => ({ ok: false, why });
function workerCap(p) { return (p.dir === 'D01' ? 4 : RULES.workers) + (hasCrew(p, 'C22') ? 1 : 0); }
function d12Free(G, p, zone) { return p.dir === 'D12' && (zone === 'writer' || zone === 'actor') && !!p.prep[zone] && !(zone === 'writer' && C(p.prep.writer).deck === 'self') && !((p.prep2 || {})[zone]); }
function freeCrewOn(G, p, zone) { const id = RULES.freeCrew[zone]; return !!(id && hasCrew(p, id) && (p.freeUsedR || {})[id] !== G.round); }
function workersLeft(G, p) { return workerCap(p) - p.placed; }
function dirImpl(id) { return RULES.dirImpl.includes(id); }
function slotState(G, zone, i) {
  const p = cur(G); const b = G.board; syncSelf(G, p); DEPT_VIEW = { G, p };
  if (G.phase !== 'Action') return err('행동 단계가 아님');
  if (G.bonus) return err('시즌2 기획팀 작가 계약을 먼저 끝내세요');
  if (workersLeft(G, p) <= 0 && !d12Free(G, p, zone)) return err('남은 일꾼 없음');
  if (zone === 'star') { if (+i !== p.id) return err('다른 플레이어의 개인 칸'); if (b.star[i] != null) return err('이미 사용'); if (p.aware < RULES.starUnlock) return err(`인지도 ${RULES.starUnlock} 필요`); if (!G.market.star.some(id => id && C(id).required_fame <= p.aware)) return err('계약 가능한 스타 없음'); return ok(); }
  if (zone === 'fund') return ok();
  if (zone === 'air') { const s = b.air[i[0]]; if (s[i[1]] != null) return err('이미 차지됨'); return canAir(G, p, i[0]); }
  const arr = b[zone]; const coord = arr[i] != null;
  if (coord && !(hasCrew(p, 'C15') && p.coordUsed !== G.round)) return err(hasCrew(p, 'C15') ? '제작 코디네이터 이번 라운드 사용함' : '이미 차지됨');
  const ex = coord ? 1 : 0;
  if (zone === 'writer' || zone === 'actor') { const min = Math.min(...G.market[zone].filter(Boolean).map(id => C(id).cost), p.excl && C(p.excl)[zone === 'writer' ? 'quality' : 'acting'] != null ? 0 : 99) + RULES.slotCost[i]; if (p.money < min + ex) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'invest') { if (p.inv) return err('투자 계약 1건 보유 중'); if (p.money < ex) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'crew') { const m = Math.min(...Object.keys(DEPTS).map(id => deptCost(G, p, id))); if (m >= 99) return err('모든 부서 Lv3'); if (p.money < ex + m) return err('자산 부족'); return ok({ coord }); }
  if (zone === 'promo') { if (p.money < 2 + ex && p.aware < 2) return err('자산·인지도 부족'); return ok({ coord }); }
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
  const t = RULES.gradeTab[d.category]; f.fame = t.f.join('/'); f.money = t.m.join('/'); f.aware = t.a.join('/');
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
/* D02 self-written, D12 second prep set, D09 poach, D07 season — shared helpers */
function syncSelf(G, p) { if (p.dir !== 'D02') return; if (!p.prep.writer) p.prep.writer = 'WSELF' + p.id; const w = C(p.prep.writer); if (!w || w.deck !== 'self') return;
  const a = p.prep.actor ? C(p.prep.actor) : null, ag = a ? (a.genres || []).filter(g => g !== '모든 장르') : [];
  w.quality = Math.min(4, 2 + Math.floor((p.selfN || 0) / 2)); w.genres = ag.length ? [ag[0]] : ['로맨스']; }
function normPrep(p) { if (p.dir !== 'D12' || !p.prep2) return; const f = s => s.writer && s.actor; if (!f(p.prep) && f(p.prep2)) { const t = p.prep; p.prep = p.prep2; p.prep2 = t; p.fromSecond = true; } }
function srcOf(G, p, id) { if (id && (id === p.excl || id === p.excl2)) return 'excl'; if (p.dir === 'D09' && G.players.some(o => o !== p && (o.excl === id || o.excl2 === id))) return 'poach'; return 'market'; }
function extraPicks(G, p, zone, i) { const out = [], isW = zone === 'writer';
  if (p.excl2 && (C(p.excl2).quality != null) === isW && placeCost(G, p, zone, i, p.excl2, 'excl') <= p.money) out.push(p.excl2);
  if ((zone === 'actor' || zone === 'writer') && p.dir === 'D09') G.players.forEach(o => { if (o === p) return; [o.excl, o.excl2].forEach(x => { if (x && (C(x).quality != null) === isW && placeCost(G, p, zone, i, x, 'poach') <= p.money) out.push(x); }); });
  return out; }
function canAir(G, p, did) { syncSelf(G, p); normPrep(p);
  if (p.airedR === G.round) { const rm = G.rmod || {}, cat = C(did).category;
    if (p.air2R === G.round) return err('이번 라운드 이미 2편 방영');
    if (!(rm.doubleAir || rm.doubleAirCat === cat)) return err(rm.doubleAirCat ? `이번 라운드 두 번째 방영은 ${rm.doubleAirCat}만` : '라운드당 1편 방영'); } if (!p.prep.writer || !p.prep.actor) return err('준비 칸에 작가와 배우 필요'); const bad = distCond(G, p, did).find(c => !c.ok); return bad ? err(bad.why) : ok(); }

/* ── contract / place ── */
function hasCrew(p, id) { if (p.crews.includes(id)) return true; for (const k in DEPTS) { const L = lvl(p, DEPTS[k].key); for (let i = 0; i < L; i++) if (DEPTS[k].grant[i].includes(id)) return true; } return false; }
function coordExtra(G, zone, i) { return zone !== 'star' && zone !== 'fund' && zone !== 'air' && G.board[zone] && G.board[zone][i] != null ? 1 : 0; }
function placeCost(G, p, zone, i, card, from) {
  const c = C(card), isW = c.quality != null, extra = coordExtra(G, zone, i), rm = G.rmod || {};
  if (from === 'poach') return (lvl(p, 'cast') >= 3 ? 0 : c.cost) + RULES.slotCost[i] + extra;   // v1.2 · 캐스팅 승부사: 일반 계약과 같은 비용 (추가금 없음)
  let base = c.cost - (isW && hasCrew(p, 'C16') ? 1 : 0) - (!isW && lvl(p, 'cast') >= 1 ? 1 : 0);
  if (!isW && rm.rookieFree && /무명|신인/.test(c.career || '')) base = 0;
  if (!isW && rm.starCost && c.deck === 'star') base += rm.starCost;
  if (zone === 'star') return Math.max(0, base - (p.starCutR === G.round ? 3 : 0));
  const toSecond = p.dir === 'D12' && from !== 'excl' && p.prep[isW ? 'writer' : 'actor'] && !(isW && C(p.prep.writer).deck === 'self');
  if (toSecond) base = lvl(p, 'cast') >= 3 ? 0 : base - 1;
  const slot = freeCrewOn(G, p, zone) ? extra : Math.max(0, RULES.slotCost[i] + extra + (zone === 'writer' && rm.writerSlot ? rm.writerSlot : 0) - (toSecond ? 1 : 0) - (zone === 'writer' && lvl(p, 'plan') >= 1 ? 1 : 0));
  if (from === 'excl') { if (p.exclFree === card) return extra; return Math.max(0, slot - (hasCrew(p, 'C11') ? 1 : 0) - (p.dir === 'D11' && !isW ? 1 : 0)); }
  return Math.max(0, base) + slot;
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
function bonusChoices(G) { const b = G.bonus; if (!b) return []; if (b.type === 'SP') return G.market.sponsor.filter(Boolean); const p = P(G, b.pid); return G.market.writer.filter(id => id && placeCost(G, p, 'writer', 0, id, 'market') <= p.money); }
function bonusSponsor(G, id) { const b = G.bonus, p = P(G, b.pid); G.bonus = null; p.spTier = (p.spTier || 0) + 1;
  if (id) { const k = G.market.sponsor.indexOf(id); if (k < 0) return err('없는 스폰서'); G.market.sponsor[k] = drawTo(G, 'sponsor'); p.sponsors.push({ id, cnt: 0 }); log(G, p.id, `스폰서 계약 · ${C(id).name} — ${C(id).effect}`); }
  else log(G, p.id, '스폰서 계약 건너뜀'); G.undo = null; return advance(G); }
function bonusWriter(G, id) { if (G.bonus && G.bonus.type === 'SP') return bonusSponsor(G, id); const b = G.bonus; if (!b) return err('보너스 없음'); const p = P(G, b.pid); G.bonus = null;
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
  const d12w = d12Free(G, p, zone), freeW = d12w || ((zone === 'writer' || zone === 'actor' || zone === 'promo') && freeCrewOn(G, p, zone));

  if (zone === 'writer' || zone === 'actor' || zone === 'star') {
    const { card, from } = choice; const x = C(card); const kind = x.quality != null ? 'writer' : 'actor';
    if (zone !== 'star' && kind !== zone) return err('카드 유형이 다름');
    if (zone === 'star' && x.required_fame > p.aware) return err(`인지도 ${x.required_fame} 필요`);
    if (from === 'poach' && !((zone === 'actor' || zone === 'writer') && p.dir === 'D09' && G.players.some(y => y !== p && (y.excl === card || y.excl2 === card)))) return err('데려올 수 없음');
    const cost = placeCost(G, p, zone, i, card, from); if (p.money < cost) return err('자산 부족');
    p.money -= cost;
    if (from === 'excl') { if (p.excl === card) p.excl = null; else p.excl2 = null; }
    else if (from === 'poach') { const o = G.players.find(y => y !== p && (y.excl === card || y.excl2 === card)); if (o.excl === card) o.excl = null; else o.excl2 = null; p.poach = (p.poach || 0) + 1; p.poachA = card; log(G, o.id, `캐스팅 승부사에게 ${x.name} 이적`); }
    else { const mk = G.market[zone === 'star' ? 'star' : zone]; mk[mk.indexOf(card)] = null; }
    p.prep2 = p.prep2 || { writer: null, actor: null }; let out = null;
    const selfW = kind === 'writer' && p.prep.writer && C(p.prep.writer).deck === 'self';
    if (p.dir === 'D12' && p.prep[kind] && !selfW) { out = p.prep2[kind]; if (out) discard(G, out); p.prep2[kind] = card; log(G, p.id, `멀티 프로젝트 · 두 번째 준비 칸에 ${x.name}`); }
    else { out = selfW ? null : p.prep[kind]; if (out) discard(G, out); p.prep[kind] = card; }
    if (zone === 'star') G.board.star[i] = p.id; else mark(G.board[zone], i);
    if (from === 'excl') p.exclFree = null;
    if (from === 'excl' && kind === 'actor' && p.dir === 'D11') { const n = Math.min(2, (p.muse && p.muse.id === card ? p.muse.n : 0) + 1); p.muse = { id: card, n }; log(G, p.id, `페르소나 감독 · ${x.name} 뮤즈 마커 ${n}`); }
    const pdBonus = kind === 'writer' && hasCrew(p, 'C10') ? 1 : 0; p.money += pdBonus;
    log(G, p.id, `${zone === 'star' ? '대스타 계약' : zone === 'writer' ? '작가 계약' : '배우 캐스팅'} · ${x.name} (${x.title}) · 자산 −${cost}${pdBonus ? ' · 기획PD +1' : ''}${ex ? ' · 제작 코디네이터(칸 비용 +1)' : ''}${out ? ` · ${C(out).name} 밀려남` : ''}`);
  } else if (zone === 'invest') {
    const v = C(choice.card); G.market.investor[G.market.investor.indexOf(choice.card)] = null;
    const fin = hasCrew(p, 'C12') ? 2 : 0; const cut = (G.rmod && G.rmod.investCut) || 0; p.money += v.payout - cut + fin - ex; p.inv = choice.card; p.invCount++; mark(G.board.invest, i);
    log(G, p.id, `투자 유치 · ${v.name} · 자산 +${v.payout}${fin ? ' · 재무팀 +2' : ''}${ex ? ' · 코디네이터 −1' : ''} · 조건: ${v.next_drama_condition}`);
  } else if (zone === 'crew') {
    if (DEPTS[choice.card]) { const d = DEPTS[choice.card], cost = deptCost(G, p, choice.card); if (cost >= 99) return err('이미 Lv3'); if (p.money < cost + ex) return err('자산 부족');
      p.money -= cost + ex; p.dept = p.dept || {}; p.dept[d.key] = lvl(p, d.key) + 1; mark(G.board.crew, i);
      log(G, p.id, `부서 강화 · ${d.name} Lv${p.dept[d.key]} · 자산 −${cost + ex} — ${d.lv[p.dept[d.key] - 1]}`);
      if (!freeW) p.placed++; return advance(G); }
    const c = C(choice.card); if (p.money < c.price + ex) return err('자산 부족');
    p.money -= c.price + ex; G.market.crew[G.market.crew.indexOf(choice.card)] = null;
    let out = null; if (p.crews.length >= RULES.crewCap) { out = p.crews.splice(choice.replace ?? 0, 1)[0]; discard(G, out); }
    p.crews.push(choice.card); mark(G.board.crew, i);
    log(G, p.id, `제작진 고용 · ${c.name} · 자산 −${c.price}${out ? ` · ${C(out).name} 해고` : ''}`);
  } else if (zone === 'promo') {
    if (choice.opt >= 2) { const A = RULES.awareSpend[choice.opt - 2]; if (!A) return err('옵션 없음'); if (p.aware < A.cost) return err('인지도 부족'); if (p.money < ex) return err('자산 부족');
      p.aware -= A.cost; p.money -= ex; mark(G.board.promo, i);
      if (A.fame) applyRes(G, p, { fame: A.fame }, 'aware'); if (A.money) p.money += A.money; if (A.starCut) p.starCutR = G.round; if (A.buzz) p.buzzNext = (p.buzzNext || 0) + A.buzz;
      log(G, p.id, `${A.name} · 인지도 −${A.cost} → ${A.text}`); if (!freeW) p.placed++; return advance(G); }
    const o0 = [{ c: 2, a: 1 }, { c: 4, a: 3 }][choice.opt], o = { c: Math.max(0, o0.c - ((G.rmod && G.rmod.promoCut) || 0) - (lvl(p, 'promo') >= 1 ? 1 : 0)), a: o0.a }; if (p.money < o.c + ex) return err('자산 부족');
    const a0 = p.aware; p.money -= o.c + ex; p.aware += o.a; mark(G.board.promo, i); log(G, p.id, `홍보 · 자산 −${o.c + ex} → 인지도 +${o.a}`); awareUp(G, p, a0);
  } else if (zone === 'fund') {
    const o = choice.opt; if (o === 0) { p.money += 2; log(G, p.id, '자금 확보 · 자산 +2'); }
    else if (o === 1) { if (p.money < 5) return err('자산 부족'); p.money -= 5; applyRes(G, p, { fame: 1 }, 'ind'); log(G, p.id, '자금 확보 · 자산 −5 → 명성 +1'); }
    else { if (p.money < 6) return err('자산 부족'); p.money -= 6; pushTrack(G, p, choice.track || 'sched', 1); log(G, p.id, `자금 확보 · 자산 −6 → ${choice.track === 'kc' ? 'K-콘텐츠 지수' : '편성표'} +1`); }
    G.board.fund.push(p.id);
  } else if (zone === 'air') {
    const boost = p.dir === 'D03' ? Math.min(9, Math.max(0, +(choice && choice.boost) || 0)) : 0; if (boost > p.money) return err('자산 부족');
    p.money -= boost; G.board.air[i[0]][i[1]] = p.id; p.placed++;
    G.pending = beginSettle(G, p, i[0], boost); G.phase = 'Settle';
    return ok({ settle: true });
  }
  if (d12w) log(G, p.id, '멀티 프로젝트 · 두 번째 세트 계약은 일꾼 없이');
  else if (freeW) { p.freeUsedR = p.freeUsedR || {}; p.freeUsedR[RULES.freeCrew[zone]] = G.round; log(G, p.id, `${C(RULES.freeCrew[zone]).name} · 일꾼 없이${zone === 'promo' ? '' : ' · 칸 비용 없음'}`); }
  if (!freeW) p.placed++; return advance(G);
}
function pushTrack(G, p, which, n) { let got = 0; for (let k = 0; k < n; k++) { if (which === 'kc') { if (G.kc < G.kcMax) { G.kc++; got++; } } else if (G.sched < G.schedMax) { G.sched++; got++; } }
  if (!got || !p) return 0; const e = RULES.indEvery || 1, s0 = p.indSteps || 0; p.indSteps = s0 + got; const f = (Math.floor(p.indSteps / e) - Math.floor(s0 / e)) * RULES.indFame;
  if (f) applyRes(G, p, { fame: f }, 'ind'); return f; }
function undo(G) { if (!G.undo) return null; const S = JSON.parse(G.undo); S.undo = null; S.log.push({ r: S.round, ph: S.phase, who: 'sys', text: '되돌리기 · 직전 일꾼 회수' }); return S; }
function advance(G) {
  if (G.phase === 'Action' && !G.bonus) { const q = cur(G); if (sponsorDue(G, q)) { G.bonus = { pid: q.id, type: 'SP' }; return ok({ bonus: true }); } }
  const n = G.order.length; for (let k = 1; k <= n; k++) { const t = (G.turn + k) % n; if (workersLeft(G, P(G, G.order[t])) > 0) { G.turn = t; return ok(); } }
  return cleanup(G);
}

/* ── settlement: 8 steps ── */
function workGenre(w, a, p) { const ag = a.genres || []; if (ag.includes('모든 장르')) return { g: w.genres[0], match: true }; const m = w.genres.find(g => ag.includes(g)); if (m) return { g: m, match: true };
  if (p && p.dir === 'D08') return { g: w.genres[0], match: true, alt: ag[0], cross: true }; return { g: w.genres[0], match: false }; }
function hasCrewNamed(p, name) { return p.crews.some(id => C(id).name === name.trim()); }
function statBonuses(G, p, w, a, g) {
  const q = [], b = []; const notes = [];
  const noBuzz = /화제성 보너스를 받을 수 없음/.test(a.effect);
  const HANDLED = ['C06', 'C07', 'C08', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22'];
  p.crews.forEach(id => { const c = C(id); let m;
    if ((m = c.effect.match(/^아이돌 주연 (작품성|화제성) \+(\d)$/))) { if (a.type === '아이돌') (m[1] === '작품성' ? q : b).push([c.name, +m[2]]); return; }
    if ((m = c.effect.match(/^(모든 작품|[가-힣·]+) (작품성|화제성) \+(\d)$/))) { if (m[1] === '모든 작품' || m[1].split('·').includes(g)) (m[2] === '작품성' ? q : b).push([c.name, +m[3]]); return; }
    if (!HANDLED.includes(id)) notes.push(`${c.name}(${c.kind}) 미구현`); });
  [[w, '작가'], [a, '배우']].forEach(([x]) => { const e = x.effect || ''; let m;
    if ((m = e.match(/^(.+?) 보유 시 (작품성|화제성) \+(\d)/))) { if (m[1].split('또는').some(n => hasCrewNamed(p, n))) (m[2] === '작품성' ? q : b).push([`${x.name} · ${m[1]} 보유`, +m[3]]); }
    else if ((m = e.match(/아이돌 주연이면 (작품성|화제성) \+(\d)/))) { if (a.type === '아이돌') (m[1] === '작품성' ? q : b).push([`${x.name} · 아이돌 주연`, +m[2]]); } });
  if (lvl(p, 'prod') >= 1) q.push(['제작본부 Lv1', 1]);
  if (lvl(p, 'cast') >= 3) b.push(['캐스팅팀 Lv3', 1]);
  const cr = careerAt((p.career || {})[g] || 0);
  if (cr.q) q.push([`장르 커리어 · ${g} ${cr.name}`, cr.q]);
  if (cr.b) b.push([`장르 커리어 · ${g} ${cr.name}`, cr.b]);
  return { q, b: noBuzz ? [] : b, notes, noBuzz };
}
function previewQuality(G, p) { syncSelf(G, p); const w = C(p.prep.writer), a = C(p.prep.actor); const { g, match } = workGenre(w, a, p); const s = statBonuses(G, p, w, a, g); return w.quality + a.acting + (match ? RULES.genreMatch : 0) + s.q.reduce((t, x) => t + x[1], 0); }
/* 예상 시청률 (주사위·트렌드 제외) → 등급 */
function previewRating(G, p) { syncSelf(G, p); normPrep(p); const w = C(p.prep.writer), a = C(p.prep.actor); if (!w || !a) return null;
  const wg = workGenre(w, a, p), s = statBonuses(G, p, w, a, wg.g);
  const q = previewQuality(G, p) + (wg.match && lvl(p, 'prod') >= 2 ? 1 : 0) + (p.dir === 'D12' && p.fromSecond ? 2 : 0);
  const bz = a.buzz + (s.noBuzz ? 0 : ((RULES.origin[w.origin] || {}).buzz || 0)) + s.b.reduce((t, x) => t + x[1], 0);
  const v = q + bz, gi = gradeOf(v); return { q, b: bz, r: v, gi, grade: GRADES[gi], g: wg.g, toNext: gi < 4 ? RULES.gradeCut[gi] - v : 0 }; }
function evalExpr(expr, q, b) { if (/^\s*[+−-]?\d+\s*$/.test(expr)) return num(expr.replace('+', ''));
  let e = expr.replace(/작품성/g, q).replace(/화제성/g, b).replace(/−/g, '-').replace(/÷/g, '/'); const up = /올림/.test(e), dn = /내림/.test(e); e = e.replace(/\(.*?\)/g, '');
  let v = Function(`return (${e})`)(); v = up ? Math.ceil(v) : dn ? Math.floor(v) : v; return Math.max(0, Math.round(v)); }

function beginSettle(G, p, did, boost = 0) { let b0 = 0;
  syncSelf(G, p); normPrep(p);
  const w = C(p.prep.writer), a = C(p.prep.actor), d = C(did); const { g, match, alt, cross } = workGenre(w, a, p); const s = statBonuses(G, p, w, a, g);
  const hallyu = !!(w.hallyu || a.hallyu);
  const S = { pid: p.id, did, g, alt, hallyu, boost, w: w.id, a: a.id, steps: [], dice: [], rolled: false, done: false, notes: s.notes.slice(), res: { fame: 0, money: 0, aware: 0 }, ind: { sched: 0, kc: 0 } };
  let q = w.quality + a.acting; const qT = [[`작가 ${w.name}`, w.quality], [`연기력 ${a.name}`, a.acting]];
  if (match) { const gm = RULES.genreMatch + (lvl(p, 'prod') >= 2 ? 1 : 0); q += gm; qT.push([(cross ? `크로스오버 · ${g}/${alt} 일치 판정` : `장르 일치 · ${g}`) + (gm > RULES.genreMatch ? ' · 제작본부 Lv2' : ''), gm]); }
  s.q.forEach(x => { q += x[1]; qT.push(x); });
  const muse = p.dir === 'D11' && p.muse && p.muse.id === a.id ? p.muse.n : 0; if (muse) { q += muse; qT.push([`뮤즈 마커 ×${muse}`, muse]); }
  if (p.dir === 'D12' && p.fromSecond) { q += 2; qT.push(['멀티 프로젝트 · 두 번째 기획', 2]); p.fromSecond = false; S.d12 = true; }
  if (boost) { const k = Math.min(6, Math.floor(boost * 2 / 3)); q += k; b0 = Math.floor(boost / 3); qT.push([`블록버스터 · 자산 ${boost} 투입`, k]); }
  let b = a.buzz; const bT = [[`화제성 ${a.name}`, a.buzz]]; if (b0) { b += b0; bT.push([`블록버스터 · 대형 홍보`, b0]); }
  const ob = (RULES.origin[w.origin] || {}).buzz || 0; if (ob && !s.noBuzz) { b += ob; bT.push([`원작 · ${w.origin}`, ob]); }
  s.b.forEach(x => { b += x[1]; bT.push(x); });
  if (muse) { b += 1; bT.push([`뮤즈 마커 ×${muse}`, 1]); }
  if (S.d12) { b += 1; bT.push(['멀티 프로젝트 · 두 번째 기획', 1]); }
  if (p.poachA && p.poachA === a.id) { b += 3; bT.push(['캐스팅 승부사 · 이적 화제', 3]); p.poachA = null; }
  if (p.dir === 'D06') { const tr = C(G.trend.now), tm = tr && tr.trend_effect.match(/^([가-힣]+) 방영 시/); if (tm && (tm[1] === g || tm[1] === alt)) { q += 3; qT.push(['트렌드 예언가 · 유행 장르 선점', 3]); } else { q += 1; qT.push(['트렌드 예언가 · 시장 감각', 1]); } }
  if (p.dir === 'D05' && G.rmod && G.rmod.jjirasi) { b += 3; bT.push(['막장의 제왕 · 찌라시 라운드', 3]); }
  if (p.buzzNext) { b += p.buzzNext; bT.push(['제작발표회', p.buzzNext]); p.buzzNext = 0; }
  if (s.noBuzz) S.notes.push(`${a.name}: 화제성 보너스 없음`);
  if (w.deck === 'self') S.notes.push(`1인 제작자 · 직접 집필 ${(p.selfN || 0) + 1}번째 · 원작·작가 효과 없음`);
  if (p.season && p.season.w === w.id && p.season.a === a.id) { S.noCareerFame = true; S.notes.push('시즌제 · 같은 작가·배우 재기용 → 장르 커리어 명성 보너스 없음'); }
  if (p.season) { if (p.season.g !== g && (p.excl || p.excl2)) { [p.excl, p.excl2].forEach(x => x && discard(G, x)); log(G, p.id, `시즌제 · 장르 변경(${p.season.g}→${g}) → 남은 시즌 계약 종료`); p.excl = null; p.excl2 = null; } p.season = null; }
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
  const rating = S.q + S.b, gi = Math.min(4, gradeOf(rating) + (p.dir === 'D03' && S.boost && lvl(p, 'prod') >= 3 ? 1 : 0)), t = RULES.gradeTab[d.category], F = { fame: t.f[gi], money: t.m[gi], aware: t.a[gi] };
  S.rating = rating; S.grade = gi;
  S.steps[3] = { t: [[`시청률 ${S.q} + ${S.b} = ${rating} → ${GRADES[gi]}등급`, 0], [`${d.name}(${d.category}) ${GRADES[gi]}등급 · 명성`, F.fame], ['자산', F.money], ['인지도', F.aware]], v: `${GRADES[gi]} · 명성 ${F.fame} · 자산 ${F.money} · 인지도 ${F.aware}` };
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
  if (lvl(p, 'fin') >= 3) add('재무팀 Lv3', { money: 2 });
  if (p.dir === 'D07') { let n = 0; for (let k = p.rec.length - 1; k >= 0 && p.rec[k] === S.g; k--) n++; }
  if (p.dir === 'D10') add('시청률 도박사 · 최저 보장', { fame: 2 });
  if (p.dir === 'D03' && S.boost >= 3) add('블록버스터 · 대작 효과', { fame: 2 });
  { const cr = careerAt((p.career || {})[S.g] || 0); if (cr.fame && !S.noCareerFame) add(`장르 커리어 · ${S.g} ${cr.name}`, { fame: cr.fame }); }
  if (p.dir === 'D04' && (w.cost || 0) + (a.cost || 0) <= 6) add(`저예산의 귀재 · 계약비 합 ${(w.cost || 0) + (a.cost || 0)}`, { fame: lvl(p, 'plan') >= 3 ? 7 : 5, money: 3 });
  if (G.rmod && G.rmod.tvMoney && (d.category === '지상파' || d.category === '케이블')) add('이슈 · 광고 단가 상승', { money: 1 });
  if ((m = mod.match(/한류 태그 포함 시 (.+)/)) && S.hallyu) add(`${d.name} · 한류`, parseRes(m[1]));
  if ((m = mod.match(/(웹툰|소설|오리지널) 원작 작가면 (.+)/)) && w.origin === m[1]) add(`${d.name} · ${m[1]} 원작`, parseRes(m[2]));
  const tr = C(G.trend.now); if (tr) { const e = tr.trend_effect; let hit = false;
    let gHit = false; if ((m = e.match(/^([가-힣]+) 방영 시 (.+)/)) && (m[1] === S.g || (S.alt && m[1] === S.alt))) { hit = true; gHit = true; }
    if (/^한류 태그 포함 방영 시/.test(e) && S.hallyu) hit = true;
    if (/^아이돌 주연 방영 시/.test(e) && a.type === '아이돌') hit = true;
    if (hit) { const tr0 = parseRes(e.split('방영 시')[1]); add(`트렌드 · ${tr.trend}`, tr0);
      if (gHit && p.dir === 'D06') { const one = {}; Object.keys(tr0).forEach(k => (one[k] = lvl(p, 'promo') >= 3 ? 5 : 3)); add('트렌드 예언가 · 장르 유행 +2', one); }
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
  const isSelf = w.deck === 'self'; if (isSelf) p.selfN = (p.selfN || 0) + 1; if (isSelf && keep === 'writer') keep = null; if (keep === 'both' && (p.dir !== 'D07' || isSelf || p.money < 5)) keep = 'actor';
  let kept = null;
  if (keep === 'both') { [p.excl, p.excl2].forEach(x => x && discard(G, x)); p.excl = w.id; p.excl2 = aId; p.season = { g: S.g, w: w.id, a: aId }; kept = w.id; p.money -= 5; log(G, p.id, `시즌제 · ${w.name}·${C(aId).name} 둘 다 전속 · 자산 −3 (${S.g} 유지 시)`); }
  else { if (keep === 'writer') { kept = w.id; discard(G, aId !== a.id ? null : a.id); } else if (keep === 'actor') { kept = aId; discard(G, w.id); } else { discard(G, w.id); if (!grown) discard(G, a.id); }
  if (p.excl && kept) discard(G, p.excl);
  if (kept) p.excl = kept; }
  if (p.muse && !(keep === 'actor' && (p.muse.id === a.id))) p.muse = null; else if (p.muse && grown) p.muse.id = aId;
  p.exclFree = kept && ((keep === 'writer' && /재계약비 0/.test(d.modifier)) || (keep === 'actor' && /재계약비 0/.test(a.effect || ''))) ? kept : null;
  if (p.dir === 'D12' && p.prep2 && p.prep2.writer && p.prep2.actor) p.fromSecond = true;
  p.prep = p.dir === 'D12' && p.prep2 ? p.prep2 : { writer: null, actor: null }; p.prep2 = { writer: null, actor: null };
  p.rec.push(S.g); G.airedThisRound = true;
  if (p.airedR === G.round) p.air2R = G.round; p.airedR = G.round;
  p.career = p.career || {}; if (!S.noCareer) p.career[S.g] = (p.career[S.g] || 0) + 1;
  p.workMoney = (p.workMoney || 0) + S.res.money; if (S.hallyu) p.hallyuN = (p.hallyuN || 0) + 1; if (grown) p.growN = (p.growN || 0) + 1;
  p.cats = p.cats || []; if (!p.cats.includes(d.category)) p.cats.push(d.category);
  checkAch(G, p, S, w, a);
  (p.sponsors || []).forEach(x => { const s = C(x.id); if (!spHit(s, S, d)) return; x.cnt++; if (s.m) p.money += s.m; if (s.a) p.aware += s.a; if (s.m || s.a) log(G, p.id, `스폰서 · ${s.name} → ${s.m ? '자산 +' + s.m : '인지도 +' + s.a}`); });
  S.steps[7] = { t: [[kept ? `전속 · ${C(kept).name}` : '전속 없음', 0], grown ? [`성장 · ${a.name} → ${C(aId).title}`, 0] : null].filter(Boolean), v: 'done' };
  const calc = S.steps.map((s, i) => ({ n: i + 1, lines: s.t.map(x => x[0] + (x[1] ? ` (+${x[1]})` : '')), v: s.v }));
  log(G, p.id, `방영 · ${d.name} · ${S.g} · 작품성 ${S.q} · 화제성 ${S.b} → 명성 +${workFame + gs + gk} · 자산 +${S.res.money} · 인지도 +${S.res.aware}`, calc);
  if (S.notes.length) log(G, 'sys', '정산 메모 · ' + S.notes.join(' / '));
  G.airings.push({ game: G.gameId, round: G.round, player: p.name, dir: p.dir, writer: w.id, actor: a.id, dist: d.id, genre: S.g, quality: S.q, buzz: S.b, rating: S.rating, grade: GRADES[S.grade], fame: workFame + gs + gk, money: S.res.money, aware: S.res.aware, trend: G.trend.now, crews: p.crews.join('|'), invest: S.inv ? (S.inv.ok ? 'success' : 'fail') : '', dice: S.dice.map(x => x.r).join('|') });
  G.pending = null; G.phase = 'Action'; G.undo = null;
  if (hasCrew(p, 'C14')) { G.bonus = { pid: p.id, type: 'C14' }; if (bonusChoices(G).length) return ok({ bonus: true }); G.bonus = null; log(G, p.id, '시즌2 기획팀 · 계약 가능한 작가 없음'); }
  return advance(G);
}

/* ── cleanup / finale ── */
function claimAch(G, p, key, base) { const arr = G.achWin[key] = G.achWin[key] || []; if (arr.includes(p.id) || arr.length >= 2) return;
  arr.push(p.id); const pts = ACH[base].pts[arr.length - 1]; p.fame += pts; p.src.obj += pts;
  log(G, p.id, `업적 · ${ACH[base].name}${key.includes(':') ? ' (' + key.split(':')[1] + ')' : ''} ${arr.length === 1 ? '1등' : '2등'} → 명성 +${pts}`); }
function checkAch(G, p, S, w, a) { const on = k => (G.ach || []).includes(k);
  if (on('GENRE') && p.career[S.g] >= 3) claimAch(G, p, 'GENRE:' + S.g, 'GENRE');
  if (on('MONEY') && p.workMoney >= 20) claimAch(G, p, 'MONEY', 'MONEY');
  if (on('BUZZ') && S.b >= 8) claimAch(G, p, 'BUZZ', 'BUZZ');
  if (on('SGRADE') && S.grade >= 3) claimAch(G, p, 'SGRADE', 'SGRADE');
  if (on('ALLCAT') && p.cats.length >= 5) claimAch(G, p, 'ALLCAT', 'ALLCAT');
  if (on('HALLYU') && p.hallyuN >= 3) claimAch(G, p, 'HALLYU', 'HALLYU');
  if (on('GROW') && p.growN >= 2) claimAch(G, p, 'GROW', 'GROW');
  if (on('CHEAP') && (w.cost || 0) + (a.cost || 0) <= 3 && S.grade >= 2) claimAch(G, p, 'CHEAP', 'CHEAP'); }
/* ties: everyone tied at a rank takes the next-lower prize (1st tie → 2nd prize, 2nd tie → 1) and the rank below is skipped */
function rankAward(G, name, vals, pts) { const vs = [...new Set(vals.map(x => x.v).filter(v => v > 0))].sort((x, y) => y - x); let place = 0;
  for (const v of vs) { if (place > 1) break; const who = vals.filter(x => x.v === v), tie = who.length > 1, pt = tie ? (place === 0 ? pts[1] : 1) : pts[place];
    who.forEach(({ p }) => { p.fame += pt; p.src.award += pt; log(G, p.id, `시상식 · ${name} ${tie ? '공동 ' : ''}${place + 1}위 → 명성 +${pt}`); }); place += tie ? 2 : 1; } }
function rankN(G, name, vals, pts, key) { const vs = [...new Set(vals.map(x => x.v).filter(v => v > 0))].sort((x, y) => y - x); let place = 0;
  for (const v of vs) { if (place >= pts.length) break; const who = vals.filter(x => x.v === v), tie = who.length > 1, pt = tie ? (pts[place + 1] != null ? pts[place + 1] : 1) : pts[place];
    who.forEach(({ p }) => { p.fame += pt; p.src[key] += pt; log(G, p.id, `${name} ${tie ? '공동 ' : ''}${place + 1}위 → 명성 +${pt}`); }); place += tie ? 2 : 1; } }
const OBJ_MET = { O01: p => Object.keys(p.career || {}).length, O02: p => Math.max(0, ...Object.values(p.career || {})), O03: p => p.aware,
  O04: (p, G) => G.airings.filter(x => x.player === p.name && x.quality >= 12).length, O05: p => p.growN || 0, O06: p => (p.cats || []).length, O07: p => p.hallyuN || 0, O08: p => p.rec.length };
function scoreObjectives(G, half) { (G.objectives || []).forEach(o => { const fn = OBJ_MET[o]; if (!fn) return;
  rankN(G, `공개 목표 · ${C(o).name}${half ? ' (중간)' : ''}`, G.players.map(p => ({ p, v: fn(p, G) })), half ? RULES.objPts.mid : RULES.objPts.end, 'obj'); }); }
function ceremony(G, label, final) {
  const as = G.airings.filter(x => x.round >= G.cerFrom);
  log(G, 'sys', `${label} 시상식`);
  if (as.length) {
    rankAward(G, '대상 · 최고 시청률', G.players.map(p => ({ p, v: Math.max(0, ...as.filter(x => x.player === p.name).map(x => x.rating || 0)) })), [4, 2]);
    rankAward(G, '최우수 제작사 · 방영 편수', G.players.map(p => ({ p, v: as.filter(x => x.player === p.name).length })), [2, 1]); }
  scoreObjectives(G, !final);
  G.cerFrom = G.round + 1; G.ceremony++; }
function cleanup(G) {
  G.phase = 'Cleanup';
  if (!G.airedThisRound) { G.sched = Math.min(G.schedMax, G.sched + RULES.noAirSched); log(G, 'sys', `무방영 라운드 · 편성표 +${RULES.noAirSched}`); }
  if (G.ceremony < 1 && G.sched >= Math.round(G.schedMax / 2)) ceremony(G, '중간');
  G.players.forEach(p => p.fameByRound.push(p.fame));
  G.order = [...G.order].sort((x, y) => P(G, x).fame - P(G, y).fame || G.order.indexOf(x) - G.order.indexOf(y));
  log(G, 'sys', `라운드 ${G.round} 종료 · 편성표 ${G.sched}/${G.schedMax} · K-콘텐츠 ${G.kc}/${G.kcMax} · 다음 턴 순서 ${G.order.map(i => P(G, i).name).join(' › ')}`);
  if ((G.sched >= G.schedMax && G.kc >= G.kcMax) || G.round >= (G.maxRounds || RULES.maxRounds)) return finale(G);
  startRound(G); return ok();
}
function finale(G) {
  G.phase = 'Finale';
  G.players.forEach(p => { if (p.inv) { const pen = hasCrew(p, 'C12') ? -1 : RULES.investFail; p.fame += pen; p.src.end += pen; p.invFails++; log(G, p.id, `종료 · 투자 ${C(p.inv).name} 미이행 → 명성 ${pen}`); p.inv = null; }
    if (hasCrew(p, 'C17')) { const n = 2 + G.airings.filter(x => x.player === p.name && x.quality >= 9).length; p.fame += n; p.src.end += n; log(G, p.id, `편집팀 · 종료 명성 +${n}`); } });
  const E = RULES.endBonus; G.players.forEach(p => { const add = (n, t) => { if (!n) return; p.fame += n; p.src.end += n; log(G, p.id, `종료 · ${t} → 명성 +${n}`); };
    add(Math.floor(p.money / E.moneyPer), `남은 자산 ${p.money}`);
    add(Object.keys(DEPTS).filter(id => lvl(p, DEPTS[id].key) >= 3).length * E.deptLv3, '부서 Lv3');
    add(Object.values(p.career || {}).filter(k => k >= 5).length * E.master, '장르 거장');
    add(Math.min(1, [p.excl, p.excl2].filter(Boolean).length) * E.excl, '전속 보유');
    add([p.excl, p.excl2].filter(x => x && C(x).deck === 'growth').length * E.grown, '성장 배우 보유');
    (p.sponsors || []).forEach(x => add(spEnd(G, p, x), `스폰서 ${C(x.id).name}`)); });
  ceremony(G, '최종', true);
  G.phase = 'Result'; G.over = true; log(G, 'sys', '게임 종료');
  return ok({ over: true });
}

/* ── CSV ── */
function csv(rows) { if (!rows.length) return ''; const k = Object.keys(rows[0]); const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [k.join(','), ...rows.map(r => k.map(x => q(r[x])).join(','))].join('\n'); }
function exportCSV(G) {
  const win = [...G.players].sort((a, b) => b.fame - a.fame)[0];
  return {
    'games.csv': csv([{ game: G.gameId, seed: G.seed, players: G.n, rounds: G.round, dists: G.dists.join('|'), objectives: G.objectives.join('|'), winner_dir: win.dir, length: G.len || 'std', max_rounds: G.maxRounds || RULES.maxRounds, issues: (G.issues || []).join('|') }]),
    'players.csv': csv(G.players.map(p => ({ game: G.gameId, player: p.name, dir: p.dir, fame: p.fame, src_work: p.src.work, src_ind: p.src.ind, src_aware: p.src.aware, src_award: p.src.award, src_obj: p.src.obj, src_end: p.src.end, airings: p.rec.length, invest: p.invCount, invest_fail: p.invFails, aware: p.aware, money: p.money }))),
    'airings.csv': csv(G.airings),
  };
}

if (typeof module !== 'undefined') module.exports = { SPONSORS, spEnd, spTiers, OBJ_MET, previewRating, DEPTS, lvl, deptCost, careerAt, GRADES, gradeOf, ACH, srcOf, extraPicks, syncSelf, dirImpl, workerCap, distInfo, freeActions, useFree, bonusChoices, bonusWriter, diceClauses, RULES, newGame, loadDB, pickTrend, place, slotState, placeCost, settleRoll, settleFinish, undo, exportCSV, cur, P, C, BASE: () => BASE, distCond, previewQuality, evalExpr };
