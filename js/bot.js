/* FILM MAKING mockup — greedy bot. Uses only rules.js; no DOM. One call = one decision. */
function botScoreAir(G, p, did) {
  const d = C(did), f = BASE.find(x => x.category === d.category), a = C(p.prep.actor);
  const q = previewQuality(G, p), b = a.buzz;
  return evalExpr(f.fame, q, b) * 3 + evalExpr(f.money, q, b) + evalExpr(f.awareness, q, b) * 1.5;
}
function botGenres(p) { const w = p.prep.writer && C(p.prep.writer), a = p.prep.actor && C(p.prep.actor); return (w ? w.genres : a ? a.genres : []) || []; }
function botStep(G) {
  if (G.phase === 'TrendPick') {
    const p = P(G, G.trend.picker), gs = botGenres(p);
    const best = G.trend.choices.map(id => ({ id, s: gs.some(g => C(id).trend_effect.startsWith(g)) ? 2 : C(id).issue_negative ? -1 : 0 })).sort((x, y) => y.s - x.s)[0];
    return pickTrend(G, best.id);
  }
  if (G.phase === 'Settle') {
    const S = G.pending; if (!S.rolled) return settleRoll(G);
    const a = C(S.a), w = C(S.w); return settleFinish(G, a.grow_to || a.acting >= w.quality - 1 ? 'actor' : 'writer');
  }
  const p = cur(G), b = G.board, can = (z, i) => slotState(G, z, i).ok;
  // 1. air if ready
  if (p.prep.writer && p.prep.actor) {
    const opts = []; G.dists.forEach(d => b.air[d].forEach((o, k) => { if (can('air', [d, k])) opts.push({ i: [d, k], s: botScoreAir(G, p, d) }); }));
    if (opts.length) { opts.sort((x, y) => y.s - x.s); return place(G, 'air', opts[0].i, {}); }
  }
  // 2. fill the missing half of the prep pair
  for (const zone of ['writer', 'actor']) {
    if (p.prep[zone]) continue;
    const other = p.prep[zone === 'writer' ? 'actor' : 'writer'], og = other ? C(other).genres : [];
    let best = null;
    const consider = (z, i, id, from) => { const x = C(id); if ((x.quality != null) !== (zone === 'writer')) return; const cost = placeCost(G, p, z, i, id, from); if (cost > p.money) return;
      const val = (zone === 'writer' ? x.quality : x.acting + x.buzz * 0.7) + ((x.genres || []).some(g => og.includes(g) || g === '모든 장르') ? 2.5 : 0) + (x.hallyu ? 0.8 : 0) - cost * 0.45;
      if (!best || val > best.val) best = { z, i, choice: { card: id, from }, val }; };
    b[zone].forEach((o, i) => { if (!can(zone, i)) return; G.market[zone].filter(Boolean).forEach(id => consider(zone, i, id, 'market')); if (p.excl) consider(zone, i, p.excl, 'excl'); });
    if (can('star', p.id)) G.market.star.filter(id => id && C(id).required_fame <= p.aware).forEach(id => consider('star', p.id, id, 'market'));
    if (best) return place(G, best.z, best.i, best.choice);
  }
  // 3. investment
  if (!p.inv) { const i = b.invest.findIndex((o, k) => can('invest', k)); if (i >= 0) { const id = G.market.investor.filter(Boolean).sort((x, y) => C(y).payout - C(x).payout)[0]; if (id) return place(G, 'invest', i, { card: id }); } }
  // 4. crew that fits the genre
  if (p.crews.length < 3 && p.money >= 5) { const i = b.crew.findIndex((o, k) => can('crew', k)); const gs = botGenres(p);
    if (i >= 0) { const id = G.market.crew.filter(id => id && C(id).kind === '상시' && C(id).price <= p.money - 1).sort((x, y) => { const f = c => (/모든 작품/.test(C(c).effect) || gs.some(g => C(c).effect.includes(g)) ? 2 : 0) - C(c).price * 0.1; return f(y) - f(x); })[0]; if (id) return place(G, 'crew', i, { card: id, replace: 0 }); } }
  // 5. awareness
  if (p.aware < 6) { const i = b.promo.findIndex((o, k) => can('promo', k)); if (i >= 0 && p.money >= 2) return place(G, 'promo', i, { opt: p.money >= 7 ? 1 : 0 }); }
  // 6. money / tracks
  if (p.money >= 8) { const track = G.kc < G.kcMax ? 'kc' : G.sched < G.schedMax ? 'sched' : null; if (track) return place(G, 'fund', 0, { opt: 2, track }); }
  return place(G, 'fund', 0, { opt: 0 });
}
