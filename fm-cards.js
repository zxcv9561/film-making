/* FILM MAKING — shared card components (actorCard, writerCard, directorCard, crewCard, investorCard, trendCard, objectiveCard, distTile, icons I, GENRE). */
const GENRE={ '로맨스':'--g-romance','범죄':'--g-crime','사극':'--g-period','판타지':'--g-fantasy','코미디':'--g-comedy','스릴러':'--g-thriller' };
const LIGHT_GENRE=new Set(['코미디']);
const I={
  money:'<svg class="ico" viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="8" rx="1.5" fill="none" stroke="#2B7A4B" stroke-width="1.8"/><circle cx="8" cy="8" r="2" fill="#2B7A4B"/></svg>',
  fame:'<svg class="ico" viewBox="0 0 16 16"><path d="M4 2h8v3a4 4 0 0 1-8 0Z" fill="#C9A227"/><path d="M4 3H2v1a2 2 0 0 0 2 2M12 3h2v1a2 2 0 0 1-2 2" fill="none" stroke="#C9A227" stroke-width="1.4"/><rect x="7" y="8.5" width="2" height="3" fill="#C9A227"/><rect x="4.5" y="11.5" width="7" height="2.5" rx=".5" fill="#C9A227"/></svg>',
  aware:'<svg class="ico" viewBox="0 0 16 16"><path d="M2 6h3l6-3.5v11L5 10H2Z" fill="#1E88E5"/><path d="M5 10l1.2 4h2L7.2 10" fill="#1E88E5"/><path d="M13 6.2a2.5 2.5 0 0 1 0 3.6" fill="none" stroke="#1E88E5" stroke-width="1.5" stroke-linecap="round"/></svg>',
  acting:'<svg class="ico" viewBox="0 0 16 16"><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="#111"/></svg>',
  buzz:'<svg class="ico" viewBox="0 0 16 16"><path d="M9.5 1 3 9h4.2L6 15l7-8.4H8.6Z" fill="#111"/></svg>',
  quality:'<svg class="ico" viewBox="0 0 16 16"><path d="M3 1.5h10v13l-5-3.2-5 3.2Z" fill="#111"/></svg>',
};
const DIST_ICON={
  '지상파':'<svg viewBox="0 0 40 40"><path d="M20 16v20M12 36h16" stroke="#111" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="14" r="3" fill="#111"/><path d="M12 6a11 11 0 0 0 0 16M28 6a11 11 0 0 1 0 16M16 9.5a6 6 0 0 0 0 9M24 9.5a6 6 0 0 1 0 9" fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round"/></svg>',
  '케이블':'<svg viewBox="0 0 40 40"><rect x="7" y="9" width="26" height="17" rx="2" fill="none" stroke="#111" stroke-width="3"/><path d="M14 33h12M20 26v7" stroke="#111" stroke-width="3" stroke-linecap="round"/></svg>',
  'OTT':'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#111" stroke-width="3"/><path d="M16 13l11 7-11 7Z" fill="#111"/></svg>',
  '웹':'<svg viewBox="0 0 40 40"><rect x="5" y="8" width="30" height="24" rx="2" fill="none" stroke="#111" stroke-width="3"/><path d="M5 14h30" stroke="#111" stroke-width="3"/><circle cx="9.5" cy="11" r="1.2" fill="#111"/><circle cx="13.5" cy="11" r="1.2" fill="#111"/></svg>',
  '해외':'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#111" stroke-width="3"/><ellipse cx="20" cy="20" rx="6.5" ry="15" fill="none" stroke="#111" stroke-width="2.4"/><path d="M5 20h30M8 12h24M8 28h24" stroke="#111" stroke-width="2.2"/></svg>',
};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function art(genres){
  const gs=(genres||[]).filter(Boolean);
  if(!gs.length) return `<div class="art none"><span class="ph">PHOTO</span></div>`;
  let bg;
  if(gs[0]==='모든 장르'){
    const keys=Object.values(GENRE);bg=`linear-gradient(90deg,${keys.map((k,i)=>`var(${k}) ${i*100/6}% ${(i+1)*100/6}%`).join(',')})`;
  } else if(gs.length===1) bg=`var(${GENRE[gs[0]]||'--g-thriller'})`;
  else bg=`linear-gradient(90deg,var(${GENRE[gs[0]]}) 0 50%,var(${GENRE[gs[1]]}) 50% 100%)`;
  const dark=gs.length===1&&LIGHT_GENRE.has(gs[0]);
  return `<div class="art" style="background:${bg}"><span class="ph" ${dark?'style="color:rgba(0,0,0,.5)"':''}>PHOTO</span><div class="chips">${gs.map(g=>`<span class="chip ${LIGHT_GENRE.has(g)?'dark':''}">${esc(g)}</span>`).join('')}</div></div>`;
}
function stat(cls,icon,k,v){return `<div class="stat ${cls}"><span class="k">${icon}${k}</span><span class="v">${esc(v)}</span></div>`;}
function effBlock(e){ if(!e) return ''; const dice=String(e).startsWith('🎲'); return `<div class="eff ${dice?'dice':''}">${esc(e)}</div>`; }

function actorCard(a,map){
  const deck=a.deck==='star'?'star':a.deck==='growth'?'growth':'';
  const deckLab=a.deck==='star'?'STAR DECK':a.deck==='growth'?'GROWTH':'ACTOR';
  let grow='';
  if(a.grow_to){
    if(String(a.grow_to).startsWith('←')){
      const src=map[String(a.grow_to).replace('←','').trim()];
      grow=`<div class="grow"><span class="g">GROWN FROM</span>${esc(a.grow_to)}${src?` · ${esc(src.title)}`:''}</div>`;
    } else {
      const gid=String(a.grow_to).split(' ')[0];const tgt=map[gid];
      const extra=String(a.grow_to).slice(gid.length).trim();
      grow=`<div class="grow"><span class="g">→ ${esc(gid)}</span>방영하면 [${esc(tgt?tgt.title:gid)}]으로 교체${extra?`<span class="x">${esc(extra)}</span>`:''}</div>`;
    }
  }
  return `<div class="card ${deck}">
    <div class="chead"><span class="tp">${deckLab} · 배우</span><span class="flags">${a.required_fame!=null?`<span class="tag fame">필요 인지도 ${a.required_fame}</span>`:''}${a.hallyu?'<span class="tag inv">한류</span>':''}</span></div>
    <div class="ctitle person"><div class="k">${esc(a.title)}</div><div class="t">${esc(a.name)}</div><div class="n">${esc(a.career)} · ${esc(a.type)}</div></div>
    ${art(a.genres)}
    <div class="stats">${stat('money',I.money,'계약비',a.cost)}${stat('',I.acting,'연기력',a.acting)}${stat('',I.buzz,'화제성',a.buzz)}</div>
    <div class="body">${effBlock(a.effect)}${grow}<div class="flav">${esc(a.flavor)}</div><div class="quote">“${esc(a.quote)}”</div></div>
    <div class="cfoot"><b>${esc(a.id)}</b><span>FILM MAKING</span></div>
  </div>`;
}
function writerCard(w){
  const star=w.deck==='star';
  return `<div class="card ${star?'star':''}">
    <div class="chead"><span class="tp">${star?'STAR DECK':'WRITER'} · 작가</span><span class="flags">${w.required_fame!=null?`<span class="tag fame">필요 인지도 ${w.required_fame}</span>`:''}${w.hallyu?'<span class="tag inv">한류</span>':''}</span></div>
    <div class="ctitle person"><div class="k">${esc(w.title)}</div><div class="t">${esc(w.name)}</div><div class="n">${esc(w.career)} · 대표작 ${esc(w.signature_work)}</div></div>
    ${art(w.genres)}
    <div class="stats" style="grid-template-columns:1fr 1fr 1fr">${stat('money',I.money,'계약비',w.cost)}${stat('',I.quality,'작품성',w.quality)}<div class="stat"><span class="k">원작</span><span class="v" style="font-size:15px;padding-top:4px">${esc(w.origin)}</span></div></div>
    <div class="body">${effBlock(w.effect)}<div class="flav">${esc(w.flavor)}</div><div class="quote">“${esc(w.quote)}”</div></div>
    <div class="cfoot"><b>${esc(w.id)}</b><span>FILM MAKING</span></div>
  </div>`;
}
function directorCard(d){
  return `<div class="dir">
    <div class="left"><span class="tp">DIRECTOR · 감독</span><div class="cn">${esc(d.concept)}</div><div class="nm">${esc(d.name)}</div><div class="sw2">대표작 ${esc(d.signature_work)}</div><div class="ph">PORTRAIT</div><span class="id">${esc(d.id)}</span></div>
    <div class="right">
      <div class="sb"><span class="k">시작 보너스</span>${esc(d.start_bonus)}</div>
      <div class="ab">${esc(d.ability)}</div>
      <div class="rs"><span class="k">제약</span>${esc(d.restriction)}</div>
      <div class="fq"><div class="flav">${esc(d.flavor)}</div><div class="quote">“${esc(d.quote)}”</div></div>
    </div>
  </div>`;
}
function crewCard(c){
  const kinds=['상시','연계','추가 액션','변환'];
  return `<div class="card plain">
    <div class="chead"><span class="tp">CREW · 제작진</span><span class="tag inv">${esc(c.kind)}</span></div>
    <div class="ctitle"><div class="t">${esc(c.name)}</div></div>
    <div class="kind-row">${kinds.map(k=>`<span class="${k===c.kind?'on':''}">${k}</span>`).join('')}</div>
    <div class="big"><span class="v" style="color:var(--money)">${esc(c.price)}</span><span class="k">${I.money}가격 · 자산</span></div>
    <div class="body"><div class="eff" style="font-size:13px">${esc(c.effect)}</div></div>
    <div class="cfoot"><b>${esc(c.id)}</b><span>FILM MAKING</span></div>
  </div>`;
}
function investorCard(v){
  return `<div class="card plain">
    <div class="chead"><span class="tp">INVESTOR · 투자사</span><span></span></div>
    <div class="ctitle"><div class="t">${esc(v.name)}</div></div>
    <div class="big"><span class="v" style="color:var(--money)">${esc(v.payout)}</span><span class="k">${I.money}투자금 · 자산</span></div>
    <div class="body">
      <dl class="kv">
        <dt>계약 조건</dt><dd>${esc(v.contract_condition)}</dd>
        <dt>다음 작품</dt><dd>${esc(v.next_drama_condition)}</dd>
        <dt>달성</dt><dd>${esc(v.success_bonus)}</dd>
        <dt>실패</dt><dd class="pen">${esc(v.failure_penalty)}</dd>
      </dl>
    </div>
    <div class="cfoot"><b>${esc(v.id)}</b><span>FILM MAKING</span></div>
  </div>`;
}
function trendCard(t){
  const neg=!!t.issue_negative;
  return `<div class="card">
    <div class="tr-top"><div class="tr-lab"><span>TREND · 트렌드</span><span>${esc(t.id)}</span></div><div class="tr-name">${esc(t.trend)}</div><div class="tr-eff">${esc(t.trend_effect)}</div></div>
    <div class="tr-bot ${neg?'neg':'pos'}"><div class="tr-lab"><span>ISSUE · 이슈</span><span style="display:flex;gap:4px">${neg?'<span class="warnmark">⚠ 부정</span>':''}<span class="kindtag">${esc(t.issue_kind)}</span></span></div><div class="tr-name">${esc(t.issue)}</div><div class="tr-eff">${esc(t.issue_effect)}</div></div>
  </div>`;
}
function objectiveCard(o){
  return `<div class="card plain">
    <div class="chead"><span class="tp">OBJECTIVE · 공개 목표</span><span></span></div>
    <div class="ctitle"><div class="t" style="font-size:22px">${esc(o.name)}</div></div>
    <div class="body" style="gap:12px;padding-top:12px">
      <dl class="kv"><dt>판정 기준</dt><dd>${esc(o.criterion)}</dd></dl>
      <div style="display:flex;align-items:center;gap:8px;background:var(--surface);padding:9px 10px;border-radius:3px"><span style="width:20px;height:20px;display:flex">${I.fame.replace('class="ico"','class="ico" style="width:20px;height:20px"')}</span><span style="font-size:13px;font-weight:700">${esc(o.reward)}</span></div>
    </div>
    <div class="cfoot"><b>${esc(o.id)}</b><span>FILM MAKING</span></div>
  </div>`;
}
function distTile(b,base){
  const f=base.find(x=>x.category===b.category)||{};
  return `<div class="dist">
    <div class="badge">${DIST_ICON[b.category]||''}<span>${esc(b.category)}</span></div>
    <div class="main">
      <div class="hd"><div><span class="nm">${esc(b.name)}</span> <span class="cc">${esc(b.concept)}</span></div><span class="id">${esc(b.id)}</span></div>
      <div class="formula">
        <div><div class="k">조건</div><div class="v">${esc(f.condition)}</div></div>
        <div><div class="k">${I.fame}명성</div><div class="v">${esc(f.fame)}</div></div>
        <div><div class="k">${I.aware}인지도</div><div class="v">${esc(f.awareness)}</div></div>
        <div><div class="k">${I.money}자산</div><div class="v">${esc(f.money)}</div></div>
      </div>
      <div class="mod"><span class="k">기본 공식 대비</span>${esc(b.modifier)}</div>
    </div>
  </div>`;
}
function sec(no,title,keys,note,inner){return `<section class="sec"><div class="sec-h"><span class="no">${no}</span><h2>${title}</h2><span class="keys">${keys}</span></div>${note?`<p class="note">${note}</p>`:''}<div class="row">${inner}</div></section>`;}
const slot=(cap,html)=>`<div class="slot"><span class="cap">${cap}</span>${html}</div>`;

function legend(){
  const g=Object.entries(GENRE).map(([k,v])=>`<span class="it"><i class="sw" style="background:var(${v})"></i>${k}</span>`).join('');
  const r=`<span class="it">${I.money}자산</span><span class="it">${I.fame}명성</span><span class="it">${I.aware}인지도</span>`;
  const s=`<span class="it">${I.acting}연기력</span><span class="it">${I.buzz}화제성</span><span class="it">${I.quality}작품성</span>`;
  const d=`<span class="it"><i class="sw" style="border:1px solid var(--line)"></i>일반</span><span class="it"><i class="sw" style="border:2px solid var(--fame)"></i>스타 덱</span><span class="it"><i class="sw" style="border:2px solid var(--ink);background:var(--surface)"></i>성장</span>`;
  return `<div class="lg"><h4>장르 · 그래픽 영역 색</h4><div class="items">${g}</div></div><div class="lg"><h4>재화 · 아이콘 + 색</h4><div class="items">${r}</div></div><div class="lg"><h4>카드 수치 · 아이콘 형태</h4><div class="items">${s}</div></div><div class="lg"><h4>덱 구분 · 테두리</h4><div class="items">${d}</div></div>`;
}
