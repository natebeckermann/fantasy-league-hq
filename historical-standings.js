let historicalStandingsLoaded=false,historicalStandingsLoading=false,historicalStandingsError='',historicalStandingsData=[],expandedStandingsSeason=null,standingsChartFocus={};
async function ensureHistoricalStandings(){
  if(historicalStandingsLoaded||historicalStandingsLoading)return;
  historicalStandingsLoading=true;historicalStandingsError='';
  try{
    if(typeof ensureHistory==='function')await ensureHistory();
    const seasons=HIST||[];
    historicalStandingsData=await Promise.all(seasons.map(loadSeasonStandingsMovement));
    historicalStandingsLoaded=true;
  }catch(e){historicalStandingsError=e?.message||'Could not load historical standings';historicalStandingsData=[]}
  historicalStandingsLoading=false;if(S.view==='history'&&historyTab==='standings')render();
}
window.ensureHistoricalStandings=ensureHistoricalStandings;
async function loadSeasonStandingsMovement(h){
  const league=h.league||{},lid=league.league_id,season=String(league.season||'Season');
  const playoffStart=Number(league.settings?.playoff_week_start||0),leg=Number(league.settings?.leg||0);
  const maxRegular=playoffStart>1?playoffStart-1:Math.max(leg,1);
  const weeks=await Promise.all(Array.from({length:maxRegular},(_,i)=>safe(`/league/${lid}/matchups/${i+1}`,[])));
  const rosterIds=h.rosters.map(r=>Number(r.roster_id));
  const state=new Map(rosterIds.map(rid=>[rid,{rid,w:0,l:0,t:0,pf:0}]));
  const points=[];
  weeks.forEach((matchups,wi)=>{
    const valid=(matchups||[]).filter(m=>state.has(Number(m.roster_id)));
    const groups={};valid.forEach(m=>(groups[m.matchup_id]??=[]).push(m));
    valid.forEach(m=>{const x=state.get(Number(m.roster_id));x.pf+=Number(m.points||0)});
    Object.values(groups).filter(g=>g.length===2).forEach(([a,b])=>{const A=state.get(Number(a.roster_id)),B=state.get(Number(b.roster_id)),ap=Number(a.points||0),bp=Number(b.points||0);if(ap>bp){A.w++;B.l++}else if(bp>ap){B.w++;A.l++}else{A.t++;B.t++}});
    const ranked=[...state.values()].sort((a,b)=>b.w-a.w||b.t-a.t||b.pf-a.pf||a.rid-b.rid);
    const rankMap=new Map(ranked.map((x,i)=>[x.rid,i+1]));
    points.push({label:`W${wi+1}`,week:wi+1,ranks:Object.fromEntries(rosterIds.map(rid=>[rid,rankMap.get(rid)]))});
  });
  const finalRanks=finalPlacementMap(h);
  if(finalRanks.size){points.push({label:'Final',week:maxRegular+1,final:true,ranks:Object.fromEntries(rosterIds.map(rid=>[rid,finalRanks.get(rid)||null]))})}
  const finalOrder=rosterIds.map(rid=>({rid,rank:finalRanks.get(rid)||999})).sort((a,b)=>a.rank-b.rank);
  return{season,lid,h,points,finalOrder,maxRegular};
}
function finalPlacementMap(h){
  const out=new Map,all=[...(h.winners||[]),...(h.losers||[])];
  all.forEach(g=>{const p=Number(g.p||0);if(!p)return;if(g.w)out.set(Number(g.w),p);const loser=Number(g.t1)===Number(g.w)?Number(g.t2):Number(g.t1);if(loser)out.set(loser,p+1)});
  if(h.champ){const champRoster=h.rosters.find(r=>h.uname(r.roster_id)===h.champ);if(champRoster)out.set(Number(champRoster.roster_id),1)}
  if(h.runner){const runner=h.rosters.find(r=>h.uname(r.roster_id)===h.runner);if(runner)out.set(Number(runner.roster_id),2)}
  const used=new Set(out.values()),remaining=[...h.standings].filter(r=>!out.has(Number(r.roster_id)));
  let next=1;remaining.forEach(r=>{while(used.has(next))next++;out.set(Number(r.roster_id),next);used.add(next);next++});
  return out;
}
function toggleStandingsSeason(season){expandedStandingsSeason=expandedStandingsSeason===String(season)?null:String(season);render();setTimeout(()=>{if(expandedStandingsSeason)drawStandingsChart(expandedStandingsSeason)},0)}
window.toggleStandingsSeason=toggleStandingsSeason;
function toggleStandingsChartExpand(season){const el=document.getElementById(`standings-chart-wrap-${season}`);if(!el)return;el.classList.toggle('standings-chart-fullscreen');document.body.classList.toggle('chart-modal-open',el.classList.contains('standings-chart-fullscreen'));setTimeout(()=>drawStandingsChart(String(season)),40)}
window.toggleStandingsChartExpand=toggleStandingsChartExpand;
function focusStandingsTeam(season,rid){const key=String(season);standingsChartFocus[key]=standingsChartFocus[key]===Number(rid)?null:Number(rid);drawStandingsChart(key)}
window.focusStandingsTeam=focusStandingsTeam;
function historicalStandingsPanel(){
  setTimeout(ensureHistoricalStandings,0);
  if(historicalStandingsLoading||!historicalStandingsLoaded)return'<div class="card"><strong>Building week-by-week standings history…</strong><p class="muted">League HQ is reconstructing cumulative standings from every Sleeper matchup week.</p></div>';
  if(historicalStandingsError)return `<div class="card notice">${esc(historicalStandingsError)}</div>`;
  const seasons=[...historicalStandingsData].sort((a,b)=>Number(b.season)-Number(a.season));
  return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">WEEK-BY-WEEK MOVEMENT</div><h2>Standings History</h2></div><p class="muted">Expand a season to see where every franchise ranked after each week. Completed seasons finish with playoff placement, so the champion ends at #1.</p></div><div class="standings-season-list">${seasons.map(s=>historicalSeasonCard(s)).join('')}</div></div>`;
}
function historicalSeasonCard(s){
  const open=expandedStandingsSeason===String(s.season),final=s.finalOrder.filter(x=>x.rank<999),champ=final[0];
  return `<div class="card standings-season-card ${open?'open':''}"><button class="standings-season-summary" onclick="toggleStandingsSeason('${esc(s.season)}')"><div><div class="season-year">${esc(s.season)}</div><small>${s.points.filter(x=>!x.final).length} regular-season weeks${s.points.some(x=>x.final)?' · playoff finish included':''}</small></div><div class="standings-final-preview">${final.slice(0,5).map(x=>`<span><b>#${x.rank}</b> ${esc(s.h.uname(x.rid))}</span>`).join('')}</div><div class="standings-expand-icon">${open?'−':'+'}</div></button>${open?`<div class="standings-season-detail"><div class="standings-final-grid">${final.map(x=>`<div><span>#${x.rank}</span><strong>${esc(s.h.uname(x.rid))}</strong></div>`).join('')}</div><div id="standings-chart-wrap-${esc(s.season)}" class="standings-chart-wrap"><div class="standings-chart-toolbar"><div><strong>${esc(s.season)} Standings Movement</strong><small>Click a team in the legend to isolate/highlight it.</small></div><button onclick="toggleStandingsChartExpand('${esc(s.season)}')">⛶ Expand</button></div><div class="standings-chart-scroll"><svg id="standings-chart-${esc(s.season)}" class="standings-chart" role="img" aria-label="${esc(s.season)} week by week standings chart"></svg></div><div id="standings-legend-${esc(s.season)}" class="standings-chart-legend"></div></div></div>`:''}</div>`;
}
function drawStandingsChart(season){
  const s=historicalStandingsData.find(x=>String(x.season)===String(season)),svg=document.getElementById(`standings-chart-${season}`),legend=document.getElementById(`standings-legend-${season}`);if(!s||!svg||!legend)return;
  const n=s.h.rosters.length,pts=s.points;if(!pts.length){svg.innerHTML='<text x="20" y="40">No weekly standings data available.</text>';return}
  const width=Math.max(900,pts.length*78+160),height=Math.max(500,n*36+130),m={l:72,r:42,t:35,b:65},innerW=width-m.l-m.r,innerH=height-m.t-m.b;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.minWidth=`${width}px`;
  const css=getComputedStyle(document.documentElement),muted=css.getPropertyValue('--muted').trim()||'#8190a5',line=css.getPropertyValue('--line').trim()||'#263449',text=css.getPropertyValue('--text').trim()||'#fff';
  const colors=['#67e8a5','#60a5fa','#f59e0b','#f472b6','#a78bfa','#22d3ee','#fb7185','#84cc16','#f97316','#c084fc','#2dd4bf','#eab308','#38bdf8','#f43f5e'];
  const x=i=>m.l+(pts.length===1?innerW/2:i*innerW/(pts.length-1)),y=rank=>m.t+(Number(rank)-1)*innerH/Math.max(1,n-1),focus=standingsChartFocus[String(season)];
  let out=`<rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>`;
  for(let r=1;r<=n;r++){const yy=y(r);out+=`<line x1="${m.l}" x2="${width-m.r}" y1="${yy}" y2="${yy}" stroke="${line}" stroke-width="1"/><text x="${m.l-18}" y="${yy+4}" fill="${muted}" text-anchor="end" font-size="12">#${r}</text>`}
  pts.forEach((p,i)=>{const xx=x(i);out+=`<line x1="${xx}" x2="${xx}" y1="${m.t}" y2="${height-m.b}" stroke="${line}" stroke-width=".7" opacity=".45"/><text x="${xx}" y="${height-m.b+28}" fill="${muted}" text-anchor="middle" font-size="12">${p.label}</text>`});
  s.h.rosters.forEach((r,idx)=>{const rid=Number(r.roster_id),coords=pts.map((p,i)=>p.ranks[rid]?`${x(i)},${y(p.ranks[rid])}`:null).filter(Boolean),active=!focus||focus===rid,stroke=colors[idx%colors.length];if(coords.length<1)return;out+=`<polyline points="${coords.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${focus===rid?5:3}" opacity="${active?1:.12}" stroke-linejoin="round" stroke-linecap="round"/>`;pts.forEach((p,i)=>{const rank=p.ranks[rid];if(!rank)return;out+=`<circle cx="${x(i)}" cy="${y(rank)}" r="${focus===rid?6:4}" fill="${stroke}" opacity="${active?1:.12}"><title>${esc(s.h.uname(rid))} · ${p.label}: #${rank}</title></circle>`})});
  svg.innerHTML=out;
  legend.innerHTML=s.h.rosters.map((r,idx)=>{const rid=Number(r.roster_id),active=!focus||focus===rid;return `<button class="standings-legend-item ${focus===rid?'active':''}" style="opacity:${active?1:.35}" onclick="focusStandingsTeam('${esc(season)}',${rid})"><i style="background:${colors[idx%colors.length]}"></i>${esc(s.h.uname(rid))}</button>`}).join('');
}
const historyStandingsBaseHistoryView=historyView;
historyView=function(){setTimeout(ensureHistory,0);const tabs=[{id:'seasons',label:'Champions & Seasons'},{id:'standings',label:'Standings History'},{id:'records',label:'All-Time Records'},{id:'drafts',label:'Draft Winners'}];let panel=historyTab==='standings'?historicalStandingsPanel():historyTab==='records'?recordsPanel():historyTab==='drafts'?draftWinnersPanel():seasonsPanel();return `<div class="grid grid-3 section-summary">${card('Seasons Linked',S.history.length+1,'Sleeper league chain')}${card('Completed Titles',historyLoaded?HIST.filter(x=>x.champ).length:'…','Playoff results')}${card('Standings Timeline','Week by Week','Expandable season charts')}</div>${innerNav(tabs,historyTab,'setHistoryTab')}${panel}`};
const historicalStandingsBaseRender=render;render=function(){historicalStandingsBaseRender();if(S.view==='history'&&historyTab==='standings'&&expandedStandingsSeason)setTimeout(()=>drawStandingsChart(expandedStandingsSeason),0)};window.render=render;
