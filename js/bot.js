/* FILM MAKING mockup — greedy bot. Uses only rules.js; no DOM. One call = one decision. */
/* v1.1 · three bot styles: spec(장르 특화) · spread(분산·전 채널) · money(자산 엔진) */
function botScoreAir(G, p, did) {
  const d = C(did), a = C(p.prep.actor), w = C(p.prep.writer), q = previewQuality(G, p), { g } = workGenre(w, a, p);
  const k = (p.career || {})[g] || 0, gi = gradeOf(q + a.buzz + careerAt(k).b), t = RULES.gradeTab[d.category];
  if (p.style === 'money') return t.f[gi] * 2 + t.m[gi] * 2.2 + t.a[gi];
  let s = t.f[gi] * 3 + t.m[gi] + t.a[gi] * 1.5;
  if (p.style === 'spread' && !(p.cats || []).includes(d.category)) s += 6;
  return s;
}
function botMain(p) { const e = Object.entries(p.career || {}).sort((x, y) => y[1] - x[1])[0]; return e ? e[0] : null; }
function botGenres(p) { const w = p.prep.writer && C(p.prep.writer), a = p.prep.actor && C(p.prep.actor); return (w ? w.genres : a ? a.genres : []) || []; }
function botStep(G) {
  if (G.phase === 'TrendPick') {
    const p = P(G, G.trend.picker), gs = botGenres(p);
    const best = G.trend.choices.map(id => ({ id, s: gs.some(g => C(id).trend_effect.startsWith(g)) ? 2 : C(id).issue_negative ? -1 : 0 })).sort((x, y) => y.s - x.s)[0];
    return pickTrend(G, best.id);
  }
  if (G.phase === 'Settle') {
    const S = G.pending; if (!S.rolled) return settleRoll(G);
    const a = C(S.a), w = C(S.w); if (P(G, S.pid).dir === 'D07' && w.deck !== 'self') return settleFinish(G, 'both'); return settleFinish(G, a.grow_to || a.acting >= w.quality - 1 ? 'actor' : 'writer');
  }
  const p = cur(G), b = G.board, can = (z, i) => slotState(G, z, i).ok;
  // 0a. C14 bonus writer pick
  if (G.bonus && G.bonus.type === 'SP') { const q = P(G, G.bonus.pid), mg = botMain(q), car = q.career || {};
    const sc = id => { const s = C(id); if (s.k === 'genre') return s.genres.some(g => g === mg) ? 9 : s.genres.some(g => car[g]) ? 4 : 1; if (s.k === 'none') return 5; if (s.k === 'any') return 6; if (s.k === 'cat') return s.cats.some(c => (q.cats || []).includes(c)) ? 6 : 3; return 4; };
    const best = bonusChoices(G).sort((x, y) => sc(y) - sc(x))[0]; return bonusWriter(G, best || null); }
  if (G.bonus) { const ag = p.prep.actor ? C(p.prep.actor).genres || [] : []; const best = bonusChoices(G).map(id => ({ id, v: C(id).quality + (C(id).genres.some(g => ag.includes(g)) ? 2.5 : 0) - placeCost(G, p, 'writer', 0, id, 'market') * 0.45 })).sort((x, y) => y.v - x.v)[0];
    return bonusWriter(G, best && best.v > 1 ? best.id : null); }
  // 0b. free crew actions
  const fa = freeActions(G, p); if (fa.length) return useFree(G, fa[0].id);
  // 1. air if ready
  if (p.prep.writer && p.prep.actor) {
    const opts = []; G.dists.forEach(d => b.air[d].forEach((o, k) => { if (can('air', [d, k])) opts.push({ i: [d, k], s: botScoreAir(G, p, d) }); }));
    if (opts.length) { opts.sort((x, y) => y.s - x.s); return place(G, 'air', opts[0].i, { boost: p.dir === 'D03' ? Math.max(0, Math.min(9, Math.floor((p.money - 3) / 3) * 3)) : 0 }); }
  }
  // 2. fill the missing half of the prep pair
  const second = false;   // 방영 못 하는 상태면 두 번째 세트 준비
  for (const zone of ['writer', 'actor']) {
    if (p.prep[zone] && !(second && !(p.prep2 || {})[zone])) continue;
    const other = (second ? (p.prep2 || {}) : p.prep)[zone === 'writer' ? 'actor' : 'writer'], og = other ? C(other).genres : [];
    let best = null;
    const consider = (z, i, id, from) => { const x = C(id); if ((x.quality != null) !== (zone === 'writer')) return; const cost = placeCost(G, p, z, i, id, from); if (cost > p.money) return;
      let val = (zone === 'writer' ? x.quality : x.acting + x.buzz * 0.7) + ((x.genres || []).some(g => og.includes(g) || g === '모든 장르') ? 2.5 : 0) + (x.hallyu ? 0.8 : 0) - cost * 0.45;
      const car = p.career || {}, mg = botMain(p), xg = x.genres || [];
      if (p.style === 'spec' && mg && (xg.includes(mg) || xg.includes('모든 장르'))) val += 1.5 + 1.1 * Math.min(car[mg], 6);
      if (p.style === 'spread' && xg.some(g => !car[g])) val += 1.5;
      if (p.style === 'money') val += (x.prem || 0) * 2.2 + cost * 0.2;
      if (!best || val > best.val) best = { z, i, choice: { card: id, from }, val }; };
    b[zone].forEach((o, i) => { if (!can(zone, i)) return; G.market[zone].filter(Boolean).forEach(id => consider(zone, i, id, 'market')); if (p.excl) consider(zone, i, p.excl, 'excl'); extraPicks(G, p, zone, i).forEach(id => consider(zone, i, id, srcOf(G, p, id))); });
    if (can('star', p.id)) G.market.star.filter(id => id && C(id).required_fame <= p.aware).forEach(id => consider('star', p.id, id, 'market'));
    if (best) return place(G, best.z, best.i, best.choice);
  }
  // 4. v1.3 · 부서 강화 (성향별 우선순위)
  { const ORDER = { spec: ['CPROD', 'CCAST', 'CPLAN', 'CPROMO', 'CFIN'], money: ['CFIN', 'CPLAN', 'CCAST', 'CPROD', 'CPROMO'], spread: ['CPROMO', 'CPROD', 'CCAST', 'CPLAN', 'CFIN'], base: ['CPROD', 'CFIN', 'CCAST', 'CPLAN', 'CPROMO'] }[p.style] || ['CPROD', 'CCAST', 'CFIN', 'CPLAN', 'CPROMO'];
    const i = b.crew.findIndex((o, k) => can('crew', k));
    if (i >= 0) { const id = ORDER.find(id => deptCost(G, p, id) < 99 && deptCost(G, p, id) <= p.money - 1); if (id) return place(G, 'crew', i, { card: id }); } }
  // 3. investment
  if (!p.inv) { const i = b.invest.findIndex((o, k) => can('invest', k)); if (i >= 0) {
    const mine = G.airings.filter(x => x.player === p.name), best = mine.length ? Math.max(...mine.slice(-3).map(x => GRADES.indexOf(x.grade))) : 1, mg = botMain(p);
    const likely = c => c.split(' · ').every(part => { let mm; if ((mm = part.match(/^(B|A|S|SS)등급 이상$/))) return best >= GRADES.indexOf(mm[1]) && p.money >= RULES.prodCost[GRADES.indexOf(mm[1])];
      if (/또는|^(로맨스|범죄|사극|판타지|코미디|스릴러)$/.test(part)) return !!mg && part.includes(mg); if ((mm = part.match(/^(.+) 배급사$/))) return mm[1].split('·').some(x => (p.cats || []).includes(x));
      if ((mm = part.match(/^화제성 (\d+) 이상$/))) return best >= 3; if (/다음 라운드/.test(part)) return !!(p.prep.writer && p.prep.actor); return false; });
    const sc = id => { const v = C(id), ok = likely(v.next_drama_condition), fail = +((v.failure_penalty || '').match(/[−-](\d+)/) || [0, 3])[1]; return ok ? v.payout + (v.tier || 1) * 1.5 : v.payout * 0.25 - fail * 1.2; };
    const need = p.money < 9 || best >= 3;
    const id = G.market.investor.filter(x => x && invAllowed(G, p, x)).sort((x, y) => sc(y) - sc(x))[0];
    if (id && need && sc(id) > 2) return place(G, 'invest', i, { card: id }); } }
  // 4b. v1.4 · 인지도 소모 (넘치는 인지도 활용)
  if (p.aware >= 14) { const i = b.promo.findIndex((o, k) => can('promo', k)); if (i >= 0) return place(G, 'promo', i, { opt: p.money < 4 ? 3 : 2 }); }
  // 5. awareness
  if (p.aware < 6) { const i = b.promo.findIndex((o, k) => can('promo', k)); if (i >= 0 && p.money >= 2) return place(G, 'promo', i, { opt: p.money >= 7 ? 1 : 0 }); }
  // 6. money / tracks
  if (p.money >= 8) { const track = G.kc < G.kcMax ? 'kc' : G.sched < G.schedMax ? 'sched' : null; if (track) return place(G, 'fund', 0, { opt: 2, track }); }
  return place(G, 'fund', 0, { opt: 0 });
}
