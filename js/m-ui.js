/* FILM MAKING mockup — mobile UI. Same rules.js / bot.js / save slot as desktop; only the view differs.
   Layout: fixed top bar · 5 pages you swipe sideways (scroll-snap) · tab dots at the bottom · bottom sheets for choices. */
const SAVE_KEY = 'fm-mockup-v1_v1_7';
const PCOL = ['#3B6FD6', '#D64545', '#3C9D5D', '#E0B400', '#8E5BD6'];
const PNAME = ['파랑', '빨강', '초록', '노랑', '보라'];
const PAGES = ['행동', '내 패널', '진열', '상대', '로그'];
const PH = { TrendPick: '트렌드', Action: '행동', Settle: '방영 정산', Cleanup: '정리' };
let J = null, G = null;
const UI = { over: '', page: 0, botDelay: 700, toast: '', open: new Set(), setup: null, ctx: null };
const $ = id => document.getElementById(id);
function save() { try { if (G) localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
const pcol = id => G.players[id].color, pnm = id => G.players[id].name;
function toast(t) { UI.toast = t; renderOvl(); clearTimeout(toast.h); toast.h = setTimeout(() => { UI.toast = ''; renderOvl(); }, 2400); }
function viewer() { const p = cur(G); return p.bot ? (G.players.find(x => !x.bot) || p) : p; }
function band(gs) { gs = (gs || []).filter(Boolean); if (!gs.length) return '#E2E2DE';
  if (gs[0] === '모든 장르') { const k = Object.values(GENRE); return `linear-gradient(180deg,${k.map((v, i) => `var(${v}) ${i * 100 / 6}% ${(i + 1) * 100 / 6}%`).join(',')})`; }
  if (gs.length === 1) return `var(${GENRE[gs[0]]})`; return `linear-gradient(180deg,var(${GENRE[gs[0]]}) 0 50%,var(${GENRE[gs[1]]}) 50% 100%)`; }
function fullCard(id) { const x = C(id), t = id[0]; return t === 'A' || t === 'G' ? actorCard(x, DB) : t === 'W' ? writerCard(x) : t === 'I' ? investorCard(x) : t === 'C' ? crewCard(x) : ''; }

function boostSel(p) { return `<label style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-weight:700;font-size:14px;margin-bottom:10px">블록버스터 · 자산 추가 투입 <select id="boost" style="font-size:16px;padding:6px 10px;border:1.5px solid #111;border-radius:6px">${[0, 3, 6, 9].filter(v => v <= p.money).map(v => `<option value="${v}">자산 ${v} → 작품성 +${v * 2 / 3}</option>`).join('')}</select></label>`; }
function issueBadge() { const s = G.issue; if (!s || s.round !== G.round) return ''; const t = C(s.id), neg = t.issue_negative;
  return `<div class="wide" style="grid-column:1/-1;background:${neg ? '#FBEDE6' : '#EEF6F0'};color:${neg ? '#C2410C' : '#2B7A4B'};border-radius:6px;padding:8px 12px;font-size:13px;font-weight:700;line-height:1.45">${neg ? '⚠ ' : ''}이번 라운드 이슈 · <b>${esc(t.issue)}</b> — ${esc(t.issue_effect)}${s.hit.length ? '<br>→ ' + s.hit.map(esc).join(' · ') : ''}</div>`; }
function dirTag(p) { return dirImpl(p.dir) ? '<span class="lab" style="color:var(--money)">✓ 능력 적용 중</span>' : '<span class="lab" style="color:var(--warn)">능력 미구현 · 효과 없음</span>'; }
const LENS = [['short', '짧게'], ['std', '표준'], ['long', '길게']];
/* ── card row ── */
function mrow(id, o = {}) {
  if (!id) return `<div class="mr empty">${o.empty || '비어 있음'}</div>`;
  const x = C(id), t = id[0]; let st = '', title = x.title || '';
  if (t === 'A' || t === 'G') st = `<span class="m">${I.money}${x.cost}</span><span>${I.acting}${x.acting} ${I.buzz}${x.buzz}</span>`;
  else if (t === 'W') { st = `<span class="m">${I.money}${x.cost}</span><span>${I.quality}${x.quality}</span>`; title = `${x.title} · 원작 ${x.origin}`; }
  else if (t === 'I') { st = `<span class="m">${I.money}+${x.payout}</span>`; title = `다음 작품 · ${x.next_drama_condition}`; }
  else if (t === 'C') { st = `<span class="m">${I.money}${x.price}</span><span style="font-size:12px">${esc(x.kind)}</span>`; title = x.effect; }
  const attr = o.pick ? `data-pick="${id}"` : `data-card="${id}"`;
  return `<button class="mr ${x.deck === 'star' ? 'star' : ''} ${o.pick ? 'pick' : ''}" ${attr}><i class="gb" style="background:${band(x.genres)}"></i><div class="rb"><div class="rn"><b>${esc(x.name)}</b>${x.hallyu ? '<span class="k">한류</span>' : ''}${x.required_fame != null ? `<span class="rq">인지도 ${x.required_fame}</span>` : ''}</div><div class="rt">${esc(title)}</div>${o.sub ? `<div class="rs">${o.sub}</div>` : ''}</div><div class="st">${st}</div></button>`;
}

/* ── slots & zones ── */
function mslot(zone, idx, occ, label = '') {
  const st = slotState(G, zone, idx);
  if (occ != null) return st.ok && st.coord ? `<button class="ms can" data-zone="${zone}" data-idx='${JSON.stringify(idx)}' style="border-color:${pcol(occ)}"><i style="width:12px;height:12px;border-radius:50%;background:${pcol(occ)}"></i>＋1</button>` : `<span class="ms occ" style="background:${pcol(occ)}" title="${esc(pnm(occ))}"></span>`;
  if (st.ok) return `<button class="ms can" data-zone="${zone}" data-idx='${JSON.stringify(idx)}'>${label || '＋'}</button>`;
  const lock = zone === 'star' && /인지도 \d+ 필요/.test(st.why);
  return `<button class="ms no" data-why="${esc(st.why)}">${lock ? '🔒 ' : ''}${label || '—'}</button>`;
}
const zn = (t, sub, slots, extra = '', cls = '') => `<section class="zn ${cls}"><header><b>${t}</b><span>${sub}</span></header><div class="zb"><div class="slots">${slots}</div>${extra}</div></section>`;
const cl = n => `${I.money}${n ? '+' + n : '0'}`;


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
    return `<div style="background:#fff;border:1.5px solid #132454;border-radius:6px;padding:8px 10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(C(o).name)}</b><span style="font-size:12px">1위 +10 · 2위 +6 · 3위 +3</span></div><div style="font-size:12px;color:#5C5A55">${esc(C(o).criterion)} · 중간 시상식 때 절반 점수</div><div style="font-size:12px;margin-top:4px">${rows.map(r => `<span style="margin-right:8px;${r.x.id === p.id ? 'font-weight:800' : ''}">${esc(r.x.name)} ${r.v}</span>`).join('')}</div><div style="font-size:12px;color:#624267;font-weight:700">내 순위 ${me + 1}위</div></div>`; }).join('');
  const lv3 = Object.keys(DEPTS).filter(id => lvl(p, DEPTS[id].key) >= 3).length, ms = Object.values(p.career || {}).filter(k => k >= 5).length, ex = [p.excl, p.excl2].filter(Boolean), gr = ex.filter(x => C(x).deck === 'growth').length, spn = (p.sponsors || []).reduce((t, x) => t + Math.max(E.spMin || 0, spEnd(G, p, x)), 0);
  const end = [[`남은 자산 ${E.moneyPer}당 +1 (최대 ${E.moneyMax})`, Math.min(E.moneyMax, Math.floor(p.money / E.moneyPer))], [`부서 Lv3 1개당 +${E.deptLv3}`, lv3 * E.deptLv3], [`장르 거장 1개당 +${E.master}`, ms * E.master], [`전속 보유 1장당 +${E.excl}`, ex.length * E.excl], [`성장 배우 보유 +${E.grown}`, gr * E.grown], ['스폰서 종료 보너스', spn]];
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:10px">${ob}</div><div style="background:#fff;border:1px solid #D6CFBE;border-radius:6px;padding:8px 10px"><b style="font-size:14px">종료 보너스 · 지금 끝나면</b> <b style="color:#624267">+${end.reduce((t, x) => t + x[1], 0)}</b><div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:12.5px;margin-top:4px">${end.map(([t, v]) => `<span>${t}</span><b>+${v}</b>`).join('')}</div></div>`; }
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
  return sec('공개 목표 · 종료 보너스', '종료 때 순위로 명성 · 중간 시상식 때 절반', objHTML(p)) + sec('스폰서 · 인지도 활용', `인지도 ${p.aware} · 스폰서 ${(p.sponsors || []).length}/${RULES.sponsorAt.length}`, sponsorHTML(p)) + sec('시청률 등급', '작품성 + 화제성 → 등급 → 배급사 표 한 칸', gradeHTML(p)) + sec('제작 부서', '부서 강화 칸 · 일꾼 1 + 자산 · Lv3까지', deptHTML(p)) + sec('장르 커리어 트랙', '그 장르로 방영할 때마다 1칸 · 노란 테두리가 단계 시작 칸', rows)
    + sec('업적 · 먼저 달성하면 획득', `이번 게임 공개 ${(G.ach || []).length}장`, `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">${ach}</div>`)
    + sec('시상식', '명성 보너스', cer); }
/* ── pages ── */
function pAction() {
  const b = G.board, p = cur(G);
  let h = `<div class="hint wide"><span>＋ 칸을 눌러 일꾼 배치</span><span>회색 칸 → 이유</span></div>`;
  h += issueBadge();
  const fa = freeActions(G, p); if (fa.length) h += `<div class="mbx wide"><span class="lab">제작진 추가 액션 · 일꾼 없이</span>${fa.map(a => `<button class="optbtn" data-free="${a.id}" style="border-color:var(--money)"><span>${esc(a.label)}</span><span style="color:var(--money)">＋</span></button>`).join('')}</div>`;
  h += zn('작가 계약', '계약비 + 칸 비용', b.writer.map((o, i) => mslot('writer', i, o, cl(RULES.slotCost[i]))).join(''));
  h += zn('배우 캐스팅', '계약비 + 칸 비용', b.actor.map((o, i) => mslot('actor', i, o, cl(RULES.slotCost[i]))).join(''));
  h += zn('대스타', `개인 칸 · 인지도 ${RULES.starUnlock}`, G.players.map(x => mslot('star', x.id, b.star[x.id], x.id === p.id ? '내 칸' : esc(x.name))).join(''));
  h += zn('투자 유치', '1건까지', b.invest.map((o, i) => mslot('invest', i, o)).join(''), '', 'res');
  h += zn('제작진 고용', '최대 3명', b.crew.map((o, i) => mslot('crew', i, o)).join(''), '', 'res');
  h += zn('홍보', '2칸', b.promo.map((o, i) => mslot('promo', i, o)).join(''), `<div class="opts"><span>${I.money}2 → ${I.aware}+1</span><span>${I.money}4 → ${I.aware}+3</span></div>`, 'act');
  h += zn('자금 확보', '무제한', b.fund.map(o => `<span class="ms occ" style="background:${pcol(o)}"></span>`).join('') + mslot('fund', 0, null), `<div class="opts"><span>${I.money}+2</span><span>${I.money}5 → ${I.fame}+1</span><span>${I.money}6 → 지표 +1</span></div>`, 'act');
  h += `<div class="hint wide" style="margin-top:6px"><span><b style="color:var(--ink);font-size:15px">방영</b> · 준비 칸에 작가 + 배우</span><span>${p.prep.writer && p.prep.actor ? '준비 완료 ' + gradeChip(p) : '준비 ' + [p.prep.writer, p.prep.actor].filter(Boolean).length + '/2'}</span></div>`;
  h += G.dists.map(did => { const d = C(did); const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
    return zn(esc(d.name), esc(d.category), b.air[did].map((o, k) => mslot('air', [did, k], o, '방영')).join(''),
      `<dl class="fm"><dt>조건</dt><dd>${esc(f.condition)}</dd><dt>${I.fame}명성</dt><dd>${esc(f.fame)}</dd><dt>${I.aware}인지도</dt><dd>${esc(f.awareness)}</dd><dt>${I.money}자산</dt><dd>${esc(f.money)}</dd></dl><div class="md">${esc(d.modifier)}</div>`); }).join('');
  return h;
}
function pMe() {
  const p = cur(G), d = C(p.dir), mk = { 3: 'OTT', 5: '스타', 6: '지상파' };
  return `<div class="mbx wide" style="border-top:4px solid #624267">${growthHTML(p)}</div><div class="mbx" style="border-top:4px solid ${p.color}"><div class="hint"><span class="lab">감독 · ${d.id}</span><span style="color:${p.color};font-weight:800">${esc(p.name)}</span></div><b style="font-size:18px">${esc(d.concept)} <span style="font-size:13px;color:var(--muted);font-weight:600">${esc(d.name)}</span></b><p>${esc(d.ability)}</p>${dirTag(p)}</div>
  <div class="res3"><div><span class="lab">자산</span><b style="color:var(--money)">${p.money}</b></div><div><span class="lab">명성</span><b>${p.fame}</b></div><div><span class="lab">인지도</span><b style="color:var(--aware)">${p.aware}</b></div></div>
  <div class="mgrp"><h4>준비 칸 <span class="lab">작가 · 배우</span></h4>${mrow(p.prep.writer, { empty: '작가 없음' })}${mrow(p.prep.actor, { empty: '배우 없음' })}</div>${p.dir === 'D12' ? `<div class="mgrp"><h4>준비 칸 2 <span class="lab">멀티 프로젝트</span></h4>${mrow((p.prep2 || {}).writer, { empty: '작가 없음' })}${mrow((p.prep2 || {}).actor, { empty: '배우 없음' })}</div>` : ''}
  <div class="mgrp"><h4>전속 <span class="lab">${p.excl2 ? '2칸 · 시즌제 · 같은 장르일 때만' : '1칸 · 재기용 시 칸 비용만'}</span></h4>${mrow(p.excl)}${p.excl2 ? mrow(p.excl2) : ''}</div>
  
  <div class="mgrp"><h4>투자 계약</h4>${mrow(p.inv)}</div>
  <div class="mbx"><span class="lab">인지도 트랙 · ${p.aware}</span><div class="cells">${Array.from({ length: 10 }, (_, i) => `<i class="${i < p.aware ? 'f' : ''}"></i>`).join('')}</div><div class="cmk">${Array.from({ length: 10 }, (_, i) => `<span>${mk[i + 1] || ''}</span>`).join('')}</div></div>
  <div class="mbx"><span class="lab">방영 기록 · ${p.rec.length}/8</span><div class="recs">${p.rec.length ? p.rec.map(g => `<span style="background:var(${GENRE[g] || '--g-thriller'})">${esc(g)}</span>`).join('') : '<span style="color:var(--muted);padding:0">아직 없음</span>'}</div></div>`;
}
function pMarket() {
  const tn = C(G.trend.now), tx = C(G.trend.next), p = cur(G);
  const tr = (t, l) => t ? `<div class="mtr"><span class="lab">${l}</span><b>${esc(t.trend)}</b><p>${esc(t.trend_effect)}</p><p style="color:var(--muted)">이슈 · ${esc(t.issue)}${t.issue_negative ? ' ⚠' : ''}</p></div>` : '';
  const g = (t, k, n) => `<div class="mgrp"><h4>${t}<span class="lab">${n}</span></h4>${G.market[k].map(id => mrow(id)).join('')}</div>`;
  return tr(tn, '이번 라운드 트렌드') + tr(tx, '다음 라운드') + g('배우', 'actor', `덱 ${G.decks.actor.draw.length}`) + g('작가', 'writer', `덱 ${G.decks.writer.draw.length}`) +
    g('스타', 'star', p.aware >= RULES.starUnlock ? '해금' : `🔒 인지도 ${RULES.starUnlock}`) + g('투자사', 'investor', `덱 ${G.decks.investor.draw.length}`) + g('제작 부서', 'crew', `Lv3까지`);
}
function pOpp() {
  const p = cur(G);
  return G.players.filter(x => x.id !== p.id).map(x => { const d = C(x.dir), nm = id => id ? esc(C(id).name) : '—';
    return `<div class="mbx" style="border-top:4px solid ${x.color}"><div class="hint"><b style="font-size:17px;color:var(--ink)">${esc(x.name)}</b><span class="lab">${esc(d.concept)}</span></div>
      <div class="res3 sm"><div><span class="lab">명성</span><b>${x.fame}</b></div><div><span class="lab">인지도</span><b style="color:var(--aware)">${x.aware}</b></div><div><span class="lab">자산</span><b style="color:var(--money)">${x.money}</b></div></div>
      <p>준비 · 작가 ${nm(x.prep.writer)} · 배우 ${nm(x.prep.actor)}</p><p>전속 ${nm(x.excl)}${x.excl2 ? ' · ' + nm(x.excl2) : ''} · 제작진 ${x.crews.length} · 방영 ${x.rec.length} · 일꾼 ${workersLeft(G, x)}/${workerCap(x)}</p>${x.inv ? `<p>투자 · ${esc(C(x.inv).name)} (${esc(C(x.inv).next_drama_condition)})</p>` : ''}</div>`; }).join('');
}
function pLog() {
  const L = G.log.map((e, i) => ({ ...e, i })).reverse(); let lastR = null;
  return `<div class="wide">` + L.map(e => { const hd = e.r !== lastR ? `<div class="rdh">ROUND ${e.r}</div>` : ''; lastR = e.r; const open = UI.open.has(e.i);
    return hd + `<div class="ev ${e.calc ? 'set' : ''}" data-log="${e.i}"><i style="background:${e.who === 'sys' ? 'var(--ink)' : pcol(e.who)}"></i><div>${e.who === 'sys' ? '' : `<span class="who2">${esc(pnm(e.who))}</span> · `}${esc(e.text)}${e.calc ? ` <b>${open ? '▾' : '▸ 계산'}</b>` : ''}${e.calc && open ? `<div class="calc">${e.calc.map(s => `<div>${s.n}. ${s.lines.map(esc).join(' / ')} <b>${esc(s.v)}</b></div>`).join('')}</div>` : ''}</div></div>`; }).join('') + `</div>`;
}

/* ── overlays ── */
function sheet(html) { UI.over = `<div class="bk"><div class="sheet"><div class="grab"></div>${html}</div></div>`; renderOvl(); }
function botTurnNow() { if (!G || G.over) return false; if (G.phase === 'TrendPick') return G.players[G.trend.picker].bot; if (G.phase === 'Settle') return !!(G.pending && G.players[G.pending.pid].bot); if (G.phase === 'Action') return cur(G).bot; return false; }
function whoNow() { return G.phase === 'TrendPick' ? G.players[G.trend.picker] : G.phase === 'Settle' ? G.players[G.pending.pid] : cur(G); }
function trendFull() {
  const bot = G.players[G.trend.picker].bot;
  return `<div class="full"><header><span class="lab">ROUND ${G.round} · 트렌드 선택</span><h2>${esc(pnm(G.trend.picker))}가 3장 중 1장을 고릅니다</h2></header><div class="sc">${G.trend.choices.map(id => { const t = C(id);
    return `<button class="tcard" data-trend="${id}" ${bot ? 'disabled' : ''}><span class="lab">TREND · ${id}</span><b>${esc(t.trend)}</b><p>${esc(t.trend_effect)}</p><div class="iss ${t.issue_negative ? 'neg' : ''}"><span class="lab">ISSUE · ${esc(t.issue_kind)}${t.issue_negative ? ' · ⚠ 부정' : ''}</span><b>${esc(t.issue)}</b><p>${esc(t.issue_effect)}</p></div></button>`; }).join('')}
    <div class="hint wide"><span>고른 카드는 다음 라운드 칸으로 · 이슈는 바로 해결</span></div></div></div>`;
}
function settleFull() {
  const S = G.pending, p = G.players[S.pid], d = C(S.did), bot = p.bot;
  const nm = ['작품성', '화제성', '주사위', '배급사 공식', '고정 보너스', '투자 판정', '재화 반영', '작품 정리'];
  const rows = nm.map((n, i) => { const s = S.steps[i];
    if (i === 2 && !S.rolled) return `<div class="stp dice"><div class="h"><span class="n">3</span><b>주사위</b><span class="v">대기</span></div><div class="ls">${S.dice.map(x => `<span>🎲 ${esc(x.src)}</span>`).join('')}</div></div>`;
    if (!s || (!S.rolled && i > 2)) return `<div class="stp wait"><div class="h"><span class="n">${i + 1}</span><b>${n}</b><span class="v">—</span></div></div>`;
    if (i === 7) return `<div class="stp"><div class="h"><span class="n">8</span><b>작품 정리 · 전속</b><span class="v">선택</span></div>${p.excl ? `<div class="ls"><span>현재 전속 ${esc(C(p.excl).name)} 교체됨</span></div>` : ''}</div>`;
    return `<div class="stp ${i === 2 ? 'dice' : ''}"><div class="h"><span class="n">${i + 1}</span><b>${n}</b><span class="v">${esc(s.v)}</span></div><div class="ls">${s.t.map(x => `<span>${esc(x[0])}${x[1] ? ` +${x[1]}` : ''}</span>`).join('')}</div></div>`; }).join('');
  const tot = S.rolled ? `<div class="brk wide"><span>명성</span><b>+${S.res.fame}</b><span>자산</span><b>+${S.res.money}</b><span>인지도</span><b>+${S.res.aware}</b><span>편성표 · K-콘텐츠</span><b>+${S.ind.sched} · +${S.ind.kc}</b></div>` : '';
  const foot = bot ? '' : !S.rolled ? `<button class="btn pri" data-act="roll">🎲 주사위 굴리기${G.dev.dice ? ` (고정 ${G.dev.dice})` : ''}</button>` :
    `<span class="lab" style="width:100%">전속으로 남길 카드</span><button class="btn" data-keep="writer" style="font-size:14px">작가<br>${esc(C(S.w).name)}</button><button class="btn" data-keep="actor" style="font-size:14px">배우<br>${esc(C(S.a).name)}</button>${P(G, S.pid).dir === 'D07' && C(S.w).deck !== 'self' ? '<button class="btn" data-keep="both">둘 다 전속 · 시즌제</button>' : ''}<button class="btn" data-keep="none" style="font-size:14px">없음</button>`;
  return `<div class="full"><header><span class="lab">방영 정산 · ${esc(p.name)} · ${esc(d.name)} · ${esc(S.g)}</span><h2>${esc(C(S.w).name)} × ${esc(C(S.a).name)}</h2></header><div class="sc">${rows}${tot}${S.notes.length ? `<div class="hint wide"><span>메모 · ${S.notes.map(esc).join(' / ')}</span></div>` : ''}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
}
function bonusSheet() { const p = P(G, G.bonus.pid), sel = UI.bsel;
  if (G.bonus.type === 'SP') return `<div class="bk"><div class="sheet"><div class="grab"></div><span class="lab">인지도 ${p.aware} · ${(p.spTier || 0) + 1}번째 스폰서 칸</span><h3>스폰서 1장 계약</h3>${bonusChoices(G).map(id => `<button class="optbtn" data-bonus="${id}" style="flex-direction:column;align-items:flex-start;gap:3px;text-align:left"><b>${esc(C(id).name)} · ${esc(C(id).title)}</b><span style="font-size:13px">${esc(C(id).effect)}</span></button>`).join('')}<button class="btn" data-bonus="">건너뛰기</button></div></div>`;
  if (sel) { const cost = placeCost(G, p, 'writer', 0, sel, 'market');
    return `<div class="bk"><div class="sheet"><div class="grab"></div><span class="lab">시즌2 기획팀 · 계약 확인</span><h3>${esc(C(sel).name)} · ${esc(C(sel).title)}</h3><div class="cardwrap">${fullCard(sel)}</div><div class="brk"><span>계약비</span><b>자산 −${cost}</b><span>칸 비용 · 일꾼</span><b>없음</b><span>남는 자산</span><b>${p.money - cost}</b></div><div class="bar2"><button class="btn" data-bsel="">← 목록</button><button class="btn pri" data-bonus="${sel}">계약</button></div></div></div>`; }
  return `<div class="bk"><div class="sheet"><div class="grab"></div><span class="lab">시즌2 기획팀 · 일꾼 없이 · 칸 비용 없음 · 눌러서 상세</span><h3>작가 1명 바로 계약</h3>${bonusChoices(G).map(id => mrow(id, { pick: true, sub: `총 ${I.money}${placeCost(G, p, 'writer', 0, id, 'market')}` }).replace('data-pick=', 'data-bsel=')).join('')}<button class="btn" data-bonus="">건너뛰기</button></div></div>`; }
function renderOvl() {
  let h = '';
  if (G && !G.over) {
    if (G.bonus && !P(G, G.bonus.pid).bot) h += bonusSheet(); else
    if (G.phase === 'TrendPick') h += trendFull(); else if (G.phase === 'Settle' && G.pending) h += settleFull(); else h += UI.over;
    if (botTurnNow()) { const w = whoNow(); h += `<div class="botbar" style="background:${w.color}">${esc(w.name)} 생각 중…</div>`; }
  }
  if (UI.toast) h += `<div class="toast">${esc(UI.toast)}</div>`;
  $('ovl').innerHTML = h;
}

/* ── choices ── */
function eligible(zone, idx) { const p = cur(G);
  if (zone === 'writer' || zone === 'actor') { const ids = G.market[zone].filter(id => id && C(id).cost + RULES.slotCost[idx] <= p.money); extraPicks(G, p, zone, idx).forEach(id => ids.includes(id) || ids.push(id)); if (p.excl && (C(p.excl).quality != null) === (zone === 'writer') && placeCost(G, p, zone, idx, p.excl, 'excl') <= p.money) ids.push(p.excl); return ids; }
  if (zone === 'star') return G.market.star.filter(id => id && C(id).required_fame <= p.aware && C(id).cost <= p.money);
  if (zone === 'invest') return G.market.investor.filter(Boolean);
  if (zone === 'crew') return G.market.crew.filter(id => id && C(id).price <= p.money);
  return []; }
const ZT = { writer: '작가 계약', actor: '배우 캐스팅', star: '대스타 계약', invest: '투자 유치', crew: '제작진 고용' };
function onSlot(zone, idx) {
  const p = cur(G); UI.ctx = { zone, idx };
  if (zone === 'promo') return sheet(`<h3>홍보</h3>${[0, 1].map(o => { const c = [2, 4][o], a = [1, 3][o]; return `<button class="optbtn" data-opt="${o}" ${p.money < c ? 'disabled' : ''}><span>자산 ${c} → 인지도 +${a}</span><span>${p.money} → ${p.money - c}</span></button>`; }).join('')}${RULES.awareSpend.map((A, k) => `<button class="optbtn" data-opt="${k + 2}" ${p.aware < A.cost ? 'disabled' : ''}><span>${A.name} · 인지도 ${A.cost} → ${A.text}</span><span>인지도 ${p.aware} → ${p.aware - A.cost}</span></button>`).join('')}<button class="btn" data-act="close">취소</button>`);
  if (zone === 'fund') return sheet(`<h3>자금 확보</h3>${[['자산 +2', 0, true], ['자산 5 → 명성 +1', 1, p.money >= 5], ['자산 6 → 편성표 +1 · 명성 +1', 2, p.money >= 6 && G.sched < G.schedMax], ['자산 6 → K-콘텐츠 +1 · 명성 +1', 3, p.money >= 6 && G.kc < G.kcMax]].map(([t, v, en]) => `<button class="optbtn" data-opt="${v}" ${en ? '' : 'disabled'}><span>${t}</span></button>`).join('')}<button class="btn" data-act="close">취소</button>`);
  if (zone === 'air') return airSheet(idx);
  const ids = eligible(zone, idx); if (!ids.length) return toast('고를 수 있는 카드가 없습니다');
  const sub = id => { if (zone === 'invest') return `${I.money}+${C(id).payout} 받음`; if (zone === 'crew') return `${I.money}−${C(id).price}`; const from = srcOf(G, p, id); return `총 ${I.money}${placeCost(G, p, zone, idx, id, from)}${from === 'excl' ? ' · 전속 재기용' : ''}`; };
  sheet(`<h3>${ZT[zone]}</h3><span class="lab">카드를 눌러 선택${zone === 'writer' || zone === 'actor' ? ` · 칸 비용 +${RULES.slotCost[idx]} 포함` : ''}</span>${ids.map(id => mrow(id, { pick: true, sub: sub(id) })).join('')}<button class="btn" data-act="close">취소</button>`);
}
function onPick(id) {
  const { zone, idx } = UI.ctx, p = cur(G), x = C(id), from = srcOf(G, p, id);
  let body = ''; UI.ctx.choice = { card: id, from };
  if (zone === 'invest') body = `<div class="brk"><span>투자금</span><b>자산 +${x.payout}</b><span>다음 작품</span><b>${esc(x.next_drama_condition)}</b><span>달성</span><b>${esc(x.success_bonus)}</b><span>실패</span><b style="color:var(--warn)">${esc(x.failure_penalty)}</b></div>`;
  else if (zone === 'crew') body = `<div class="brk"><span>가격</span><b>자산 −${x.price}</b><span class="tot">남는 자산</span><b class="tot">${p.money - x.price}</b></div>` + (p.crews.length >= 3 ? `<span class="lab">3칸이 꽉 찼습니다 · 내보낼 제작진</span>${p.crews.map((c, i) => `<label class="optbtn" style="padding:11px 14px"><span><input type="radio" name="rep" value="${i}" ${i ? '' : 'checked'}> ${esc(C(c).name)}</span></label>`).join('')}` : '');
  else { const cost = placeCost(G, p, zone, idx, id, from), kind = x.quality != null ? 'writer' : 'actor', out = p.prep[kind];
    body = `<div class="brk"><span>계약비${from === 'excl' ? ' (전속)' : from === 'poach' ? ' (전속 빼앗기)' : ''}</span><b>${from === 'excl' ? 0 : x.cost}</b>${zone !== 'star' ? `<span>칸 비용</span><b>+${Math.max(0, cost - (from === 'excl' ? 0 : x.cost))}</b>` : ''}<span class="tot">총비용</span><b class="tot">자산 −${cost}</b><span>남는 자산</span><b>${p.money - cost}</b></div>${out ? `<div class="warn">준비 칸의 ${esc(C(out).name)}이 밀려나 버려집니다</div>` : ''}`; }
  sheet(`<span class="lab">${ZT[zone]} · 확인</span><h3>${esc(x.name)}${x.title ? ' · ' + esc(x.title) : ''}</h3><div class="cardwrap">${fullCard(id)}</div>${body}<div class="bar2"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">확정</button></div>`);
}
function airSheet(idx) {
  const did = idx[0]; const di = distInfo(did), f = { condition: di.cond, fame: di.f.fame, awareness: di.f.aware, money: di.f.money };
  const p = cur(G), d = C(idx[0]), w = C(p.prep.writer), a = C(p.prep.actor), inv = p.inv ? C(p.inv) : null;
  UI.ctx = { zone: 'air', idx, choice: {} };
  sheet(`<span class="lab">${esc(d.category)} · ${esc(d.concept)}</span><h3>${esc(d.name)} 방영</h3><div class="brk"><span>작품</span><b>${esc(w.name)} × ${esc(a.name)}</b><span>예상 작품성</span><b>${previewQuality(G, p)} (주사위 제외)</b>${(() => { const pr = previewRating(G, p), t = RULES.gradeTab[d.category]; return pr ? `<span>예상 등급</span><b>${pr.q} + ${pr.b} = ${pr.r} → <span style="color:${GCOL[pr.gi]}">${pr.grade}</span></b><span>예상 보상</span><b>명성 ${t.f[pr.gi]} · 자산 ${t.m[pr.gi]} · 인지도 ${t.a[pr.gi]}</b>` : ''; })()}${distCond(G, p, idx[0]).map(c => `<span>조건</span><b style="color:${c.ok ? 'var(--money)' : 'var(--warn)'}">${esc(c.why.replace(' 필요', ''))} ${c.ok ? '✓' : '✗'}</b>`).join('')}${inv ? `<span>투자</span><b>${esc(inv.next_drama_condition)}</b>` : ''}</div><div class="md">${esc(d.modifier)}</div><div class="bar2"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="confirm">방영 확정</button></div>`);
  if (p.dir === 'D03') { UI.over = UI.over.replace('<div class="brk">', boostSel(p) + '<div class="brk">'); renderOvl(); }
}
function doPlace(zone, idx, choice) { const r = place(G, zone, idx, choice); UI.over = ''; UI.ctx = null; if (!r.ok) toast(r.why); save(); render(); }
function menu() { sheet(`<h3>메뉴</h3><button class="optbtn" data-act="undo" ${G.undo ? '' : 'disabled'}><span>↶ 되돌리기</span><span class="lab">직전 일꾼 1개</span></button><button class="optbtn" data-act="speed"><span>봇 속도</span><span>${UI.botDelay > 100 ? '보통 ▶' : '빠름 ▶▶'}</span></button><button class="optbtn" data-act="new"><span>새 게임</span></button><a class="optbtn" href="index.html?desktop=1" style="text-decoration:none"><span>데스크톱 화면으로</span><span>→</span></a><button class="btn" data-act="close">닫기</button>`); }

/* ── setup & results ── */
function dirOpts(seed) { const g = { rng: hashSeed(seed + '#dir') }; const ids = shuffle(g, J.directors.map(d => d.id)); return Array.from({ length: 5 }, (_, i) => [ids[i * 2], ids[i * 2 + 1]]); }
function freshSetup() { const seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); UI.setup = { n: 4, len: 'std', seed, pl: PNAME.map((name, i) => ({ name, c: i, dir: null, bot: i > 0 })), opts: dirOpts(seed) }; }
function renderSetup() {
  const S = UI.setup, has = !!localStorage.getItem(SAVE_KEY), pl = S.pl.slice(0, S.n), ready = pl.every(p => p.dir);
  $('scr').innerHTML = `<div class="full"><header><span class="lab">FILM MAKING · HOTSEAT · MOBILE</span><h2>준비</h2></header><div class="sc">
    ${has ? '<button class="btn wide" data-act="continue">저장된 게임 이어하기</button>' : ''}
    <div class="wide"><span class="lab">게임 길이</span><div class="seg" style="margin-top:6px;grid-template-columns:repeat(3,1fr)">${LENS.map(([k, l]) => `<button class="${S.len === k ? 'on' : ''}" data-len="${k}" style="font-size:15px">${l}</button>`).join('')}</div></div>
    <div class="wide"><span class="lab">인원</span><div class="seg" style="margin-top:6px">${[2, 3, 4, 5].map(n => `<button class="${n === S.n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div></div>
    ${pl.map((p, i) => `<div class="prow"><input value="${esc(p.name)}" data-name="${i}"><button class="tg ${p.bot ? 'on' : ''}" data-bot="${i}">${p.bot ? '봇' : '사람'}</button><div class="cols">${PCOL.map((c, ci) => `<i style="background:${c}" class="${p.c === ci ? 'on' : pl.some(q => q.c === ci) ? 'taken' : ''}" data-pi="${i}" data-c="${ci}"></i>`).join('')}</div></div>`).join('')}
    <div class="wide"><span class="lab">시드 · 같은 시드 = 같은 게임</span><div class="seedrow" style="margin-top:6px"><input id="seed" value="${esc(S.seed)}"><button class="btn" data-act="reseed" style="padding:10px 14px">새로</button></div></div>
    <div class="hint wide"><span class="lab" style="align-self:center">감독 · 2장 중 1장</span><button class="tg" data-act="autodir">자동 선택</button></div>
    ${pl.map((p, i) => `<div><b style="color:${PCOL[p.c]}">${esc(p.name)}${p.bot ? ' · 봇' : ''}</b><div class="dopt">${S.opts[i].map(id => { const d = C(id); return `<button class="dcard ${p.dir === id ? 'on' : ''}" style="--pc:${PCOL[p.c]}" data-pd="${i}" data-d="${id}"><b>${esc(d.concept)}</b><span>시작 · ${esc(d.start_bonus)}</span><span>${esc(d.ability)}</span></button>`; }).join('')}</div></div>`).join('')}
    <div class="hint wide"><span>감독 능력 ${RULES.dirImpl.length}/12 적용 · 공개 목표·시상식은 아직 없음</span></div>
  </div><footer><button class="btn pri" data-act="start" ${ready ? '' : 'disabled'}>게임 시작 → (${pl.filter(p => p.dir).length}/${S.n})</button></footer></div>`;
}
function renderResults() {
  const rk = [...G.players].sort((a, b) => b.fame - a.fame);
  const SRC = [['work', '작품', '#111'], ['ind', '업계 지표', '#555553'], ['aware', '인지도', '#1E88E5'], ['award', '시상식', '#C9A227'], ['obj', '목표', '#8A8A86'], ['end', '종료', '#C2410C']];
  const max = Math.max(1, ...G.players.map(p => Object.values(p.src).reduce((a, b) => a + Math.max(0, b), 0)));
  $('scr').innerHTML = `<div class="full"><header><span class="lab">GAME OVER · ${G.round} ROUNDS · ${esc(G.seed)}</span><h2>결과</h2></header><div class="sc">
    ${rk.map((p, i) => `<div class="rrow ${i ? '' : 'w'}"><span class="pos">${i + 1}</span><div><div class="nm"><i style="background:${p.color}"></i>${esc(p.name)}</div><div class="sub">${esc(C(p.dir).concept)} · 방영 ${p.rec.length} · 인지도 ${p.aware}</div></div><span class="sc2">${I.fame}${p.fame}</span></div>`).join('')}
    <div class="mbx wide"><span class="lab">명성 출처 · ${SRC.map(s => s[1]).join(' · ')}</span>${rk.map(p => { const t = Object.values(p.src).reduce((a, b) => a + Math.max(0, b), 0); return `<div style="display:grid;grid-template-columns:56px 1fr 32px;gap:8px;align-items:center;font-size:13px;font-weight:800"><span>${esc(p.name)}</span><div class="sbar" style="width:${Math.max(4, t / max * 100)}%">${SRC.map(s => p.src[s[0]] > 0 ? `<div style="flex:${p.src[s[0]]};background:${s[2]}">${p.src[s[0]] >= 4 ? p.src[s[0]] : ''}</div>` : '').join('')}</div><span style="text-align:right">${t}</span></div>`; }).join('')}</div>
    <div class="res3 wide"><div><span class="lab">1위−꼴찌</span><b>${rk[0].fame - rk[rk.length - 1].fame}</b></div><div><span class="lab">1인당 방영</span><b>${(G.airings.length / G.n).toFixed(1)}</b></div><div><span class="lab">라운드</span><b>${G.round}</b></div></div>
    <div class="wide" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${['games.csv', 'players.csv', 'airings.csv'].map(f => `<button class="btn" data-csv="${f}" style="font-size:14px">${f}</button>`).join('')}<button class="btn" data-act="logjson" style="font-size:14px">로그 .json</button></div>
  </div><footer><button class="btn pri" data-act="new">새 게임</button></footer></div>`;
}
function download(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }

/* ── render ── */
function setPage(i, html) { const el = $('p' + i), s = el.scrollTop; el.innerHTML = html; el.scrollTop = s; }
function renderTop() { const p = cur(G), v = viewer();
  $('top').innerHTML = `<div class="t1"><span class="rd">R${G.round}</span><span class="ph">${PH[G.phase] || G.phase}</span><span class="who" style="background:${p.color}">${esc(p.name)} 차례 · 일꾼 ${workersLeft(G, p)}</span><button class="ib" data-act="menu" aria-label="메뉴">⋯</button></div>
  <div class="t2"><i class="me" style="background:${v.color}"></i><span style="color:var(--money)">${I.money}${v.money}</span><span>${I.fame}${v.fame}</span><span style="color:var(--aware)">${I.aware}${v.aware}</span><span class="tk"><span>편성 ${G.sched}/${G.schedMax}</span><span>K ${G.kc}/${G.kcMax}</span></span></div>`; }
function renderNav() { $('nav').innerHTML = PAGES.map((n, i) => `<button class="${i === UI.page ? 'on' : ''}" data-page="${i}">${n}</button>`).join(''); }
function render() {
  if (!G || G.over) { $('app').style.display = 'none'; $('ovl').innerHTML = ''; return G ? renderResults() : renderSetup(); }
  $('scr').innerHTML = ''; $('app').style.display = '';
  renderTop(); renderNav(); [pAction, pMe, pMarket, pOpp, pLog].forEach((f, i) => setPage(i, f())); renderOvl(); scheduleBot();
}
function scheduleBot() { clearTimeout(scheduleBot.h); if (!botTurnNow()) return;
  scheduleBot.h = setTimeout(() => { if (!botTurnNow()) return; const r = botStep(G); if (r && r.ok === false) { const f = place(G, 'fund', 0, { opt: 0 }); if (!f.ok) console.warn('bot stuck', r.why); } G.undo = null; UI.over = ''; save(); render(); }, UI.botDelay); }
function goPage(i) { const el = $('pages'); UI.page = i; renderNav(); el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); }

/* ── events ── */
document.addEventListener('click', e => {
  const t = e.target, q = s => t.closest(s); let el;
  if (!G || G.over) {
    const S = UI.setup;
    if ((el = q('[data-csv]'))) return download(el.dataset.csv, exportCSV(G)[el.dataset.csv]);
    if (q('[data-act="logjson"]')) return download('log.json', JSON.stringify(G.log, null, 1), 'application/json');
    if (q('[data-act="new"]')) { localStorage.removeItem(SAVE_KEY); G = null; freshSetup(); return render(); }
    if (!S) return;
    if ((el = q('[data-n]'))) { S.n = +el.dataset.n; return renderSetup(); }
    if ((el = q('[data-len]'))) { S.len = el.dataset.len; return renderSetup(); }
    if ((el = q('[data-bot]'))) { const p = S.pl[+el.dataset.bot]; p.bot = !p.bot; return renderSetup(); }
    if ((el = q('i[data-c]')) && !el.classList.contains('taken')) { S.pl[+el.dataset.pi].c = +el.dataset.c; return renderSetup(); }
    if ((el = q('[data-pd]'))) { S.pl[+el.dataset.pd].dir = el.dataset.d; return renderSetup(); }
    if (q('[data-act="autodir"]')) { S.pl.forEach((p, i) => (p.dir = S.opts[i][0])); return renderSetup(); }
    if (q('[data-act="reseed"]')) { S.seed = 'FM-' + Math.random().toString(36).slice(2, 8).toUpperCase(); S.opts = dirOpts(S.seed); S.pl.forEach(p => (p.dir = null)); return renderSetup(); }
    if (q('[data-act="continue"]')) { G = JSON.parse(localStorage.getItem(SAVE_KEY)); return render(); }
    if (q('[data-act="start"]')) { G = newGame(J, { seed: S.seed, length: S.len, players: S.pl.slice(0, S.n).map(p => ({ name: p.name + (p.bot ? ' 🤖' : ''), color: PCOL[p.c], dir: p.dir, bot: p.bot })) }); save(); return render(); }
    return;
  }
  if (t.classList && t.classList.contains('bk')) { UI.over = ''; UI.ctx = null; return renderOvl(); }
  if ((el = q('[data-page]'))) return goPage(+el.dataset.page);
  if (q('[data-act="close"]')) { UI.over = ''; UI.ctx = null; return renderOvl(); }
  if (q('[data-act="menu"]')) return menu();
  if (q('[data-act="speed"]')) { UI.botDelay = UI.botDelay > 100 ? 60 : 700; UI.over = ''; return render(); }
  if (q('[data-act="new"]')) { if (confirm('진행 중인 게임을 버리고 새로 시작할까요?')) { localStorage.removeItem(SAVE_KEY); G = null; UI.over = ''; freshSetup(); render(); } return; }
  if (q('[data-act="undo"]')) { const S = undo(G); if (S) { G = S; UI.over = ''; save(); render(); } return; }
  if ((el = q('.ev.set'))) { const i = +el.dataset.log; UI.open.has(i) ? UI.open.delete(i) : UI.open.add(i); return setPage(4, pLog()); }
  if ((el = q('[data-card]')) && !q('.sheet') && !q('[data-bonus]')) return sheet(`<div class="cardwrap">${fullCard(el.dataset.card)}</div><button class="btn" data-act="close">닫기</button>`);
  if (botTurnNow()) return;
  if ((el = q('[data-free]'))) { const r = useFree(G, el.dataset.free); if (!r.ok) toast(r.why); save(); return render(); }
  if ((el = q('[data-bsel]'))) { UI.bsel = el.dataset.bsel || null; return renderOvl(); }
  if ((el = q('[data-bonus]'))) { UI.bsel = null; const r = bonusWriter(G, el.dataset.bonus || null); if (r && r.ok === false) toast(r.why); save(); return render(); }
  if ((el = q('[data-trend]'))) { pickTrend(G, el.dataset.trend); save(); return render(); }
  if (q('[data-act="roll"]')) { settleRoll(G); save(); return render(); }
  if ((el = q('[data-keep]'))) { settleFinish(G, el.dataset.keep === 'none' ? null : el.dataset.keep); save(); return render(); }
  if ((el = q('.ms.no'))) return toast(el.dataset.why);
  if ((el = q('.ms.can'))) return onSlot(el.dataset.zone, JSON.parse(el.dataset.idx));
  if ((el = q('[data-pick]'))) return onPick(el.dataset.pick);
  if (q('[data-act="confirm"]')) { const c = UI.ctx; if (c.zone === 'air') { const bs = document.getElementById('boost'); if (bs) c.choice.boost = +bs.value; } if (c.zone === 'crew') { const r = document.querySelector('input[name="rep"]:checked'); if (r) c.choice.replace = +r.value; } return doPlace(c.zone, c.idx, c.choice); }
  if ((el = q('[data-opt]'))) { const o = +el.dataset.opt, { zone, idx } = UI.ctx; return doPlace(zone, idx, zone === 'fund' ? { opt: o > 2 ? 2 : o, track: o === 3 ? 'kc' : 'sched' } : { opt: o }); }
});
document.addEventListener('input', e => { const S = UI.setup; if (!S) return; const i = e.target.dataset && e.target.dataset.name; if (i != null) S.pl[+i].name = e.target.value;
  if (e.target.id === 'seed') { S.seed = e.target.value; S.opts = dirOpts(e.target.value || 'x'); S.pl.forEach(p => (p.dir = null)); clearTimeout(renderSetup.h); renderSetup.h = setTimeout(() => { const pos = e.target.selectionStart; renderSetup(); const s = $('seed'); s.focus(); s.setSelectionRange(pos, pos); }, 500); } });

(async () => {
  $('pages').addEventListener('scroll', () => { const el = $('pages'), i = Math.round(el.scrollLeft / el.clientWidth); if (i !== UI.page) { UI.page = i; renderNav(); } }, { passive: true });
  addEventListener('resize', () => { const el = $('pages'); el.scrollLeft = UI.page * el.clientWidth; });
  try { J = await (await fetch('cards.json')).json(); } catch (e) { $('scr').innerHTML = `<div class="toast">cards.json을 불러오지 못했습니다 · ${esc(e.message)}</div>`; return; }
  loadDB(J); freshSetup();
  const saved = localStorage.getItem(SAVE_KEY); if (saved && /resume=1/.test(location.search)) G = JSON.parse(saved);
  render();
})();
