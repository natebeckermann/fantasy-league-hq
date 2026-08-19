let historyTab='seasons',reportTab='current',historyLoaded=false,historyLoading=false;
let HIST=[];
function setHistoryTab(id){historyTab=id;render();window.scrollTo({top:0,behavior:'smooth'})}
function setReportTab(id){reportTab=id;render();window.scrollTo({top:0,behavior:'smooth'})}
window.setHistoryTab=setHistoryTab;window.setReportTab=setReportTab;

async function loadHistoricalSeason(league){
  const lid=league.league_id;
  const [users,rosters,winners,losers]=await Promise.all([
    safe(`/league/${lid}/users`,[]),safe(`/league/${lid}/rosters`,[]),safe(`/league/${lid}/winners_bracket`,[]),safe(`/league/${lid}/losers_bracket`,[])
  ]);
  const uname=id=>{const r=rosters.find(x=>Number(x.roster_id)===Number(id));const u=users.find(x=>x.user_id===r?.owner_id);return u?.metadata?.team_name||u?.display_name||`Team ${id}`};
  let champ=null,runner=null;
  if(winners.length){const final=[...winners].sort((a,b)=>(b.r||0)-(a.r||0))[0];if(final?.w){champ=uname(final.w);runner=uname(Number(final.t1)===Number(final.w)?final.t2:final.t1)}}
  const standings=[...rosters].sort((a,b)=>(b.settings?.wins||0)-(a.settings?.wins||0)||Number(b.settings?.fpts||0)-Number(a.settings?.fpts||0));
  return {league,users,rosters,winners,losers,champ,runner,standings,uname};
}
async function ensureHistory(){
  if(historyLoaded||historyLoading)return;
  historyLoading=true;
  const leagues=[S.league,...S.history].filter(Boolean);
  HIST=await Promise.all(leagues.map(loadHistoricalSeason));
  historyLoaded=true;historyLoading=false;
  if(S.view==='history')render();
}
function allTimeRows(){
  const map=new Map;
  HIST.forEach(season=>season.rosters.forEach(r=>{const u=season.users.find(x=>x.user_id===r.owner_id);const key=u?.user_id||`r${r.roster_id}`;const n=u?.display_name||u?.metadata?.team_name||season.uname(r.roster_id);if(!map.has(key))map.set(key,{key,name:n,seasons:0,w:0,l:0,t:0,pf:0,titles:0,seconds:0});const x=map.get(key),s=r.settings||{};x.seasons++;x.w+=Number(s.wins||0);x.l+=Number(s.losses||0);x.t+=Number(s.ties||0);x.pf+=Number(s.fpts||0)+Number(s.fpts_decimal||0)/100;if(season.champ===season.uname(r.roster_id))x.titles++;if(season.runner===season.uname(r.roster_id))x.seconds++}));
  return [...map.values()].sort((a,b)=>b.titles-a.titles||b.w-a.w||b.pf-a.pf);
}
function seasonsPanel(){
  if(!historyLoaded)return '<div class="card"><strong>Loading league history from Sleeper…</strong><p class="muted">Following the linked league IDs across prior seasons.</p></div>';
  return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">LEAGUE TIMELINE</div><h2>Champions & Seasons</h2></div><p class="muted">Season-by-season results reconstructed from Sleeper's historical league and playoff data.</p></div><div class="history-season-grid">${HIST.map((x,i)=>{const leader=x.standings[0];return `<div class="card season-card"><div class="season-year">${esc(x.league.season||'Season')}</div><div class="champion-line"><span>🏆</span><div><small>Champion</small><strong>${esc(x.champ||'Season in progress / unavailable')}</strong></div></div>${x.runner?`<div class="history-meta"><span>Runner-up</span><strong>${esc(x.runner)}</strong></div>`:''}<div class="history-meta"><span>Best regular season</span><strong>${leader?esc(x.uname(leader.roster_id))+' · '+rec(leader):'—'}</strong></div><div class="history-meta"><span>Teams</span><strong>${x.rosters.length}</strong></div></div>`}).join('')}</div></div>`
}
function recordsPanel(){
  if(!historyLoaded)return seasonsPanel();
  const rows=allTimeRows();
  return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">FRANCHISE LEDGER</div><h2>All-Time Records</h2></div><p class="muted">Regular-season records are aggregated across the historical Sleeper league chain.</p></div><div class="card table-wrap"><table class="table"><thead><tr><th>#</th><th>Owner</th><th>Titles</th><th>Seasons</th><th>Record</th><th>Win %</th><th>PF</th></tr></thead><tbody>${rows.map((x,i)=>{const games=x.w+x.l+x.t,pct=games?((x.w+x.t*.5)/games*100).toFixed(1):'0.0';return `<tr><td class="rank">${i+1}</td><td><strong>${esc(x.name)}</strong></td><td>${x.titles?`🏆 ${x.titles}`:'—'}</td><td>${x.seasons}</td><td>${x.w}-${x.l}${x.t?'-'+x.t:''}</td><td>${pct}%</td><td>${x.pf.toFixed(1)}</td></tr>`}).join('')}</tbody></table></div></div>`
}
function draftWinnersPanel(){
  const complete=S.draftBoards.filter(x=>x.draft.status==='complete'&&(x.picks||[]).length);
  return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">RETROSPECTIVE VALUE</div><h2>Draft Winners</h2></div><p class="muted">A quick historical leaderboard using the same current-value grading model from Draft Center.</p></div><div class="history-season-grid">${complete.map(b=>{const g=draftGrades(b),w=g[0];return `<div class="card season-card"><div class="season-year">${esc(b.draft.season||'Draft')}</div>${w?`<div class="champion-line"><span>★</span><div><small>Current draft winner</small><strong>${esc(name(roster(w.rid)))}</strong></div></div><div class="history-meta"><span>Grade</span><strong>${w.grade}</strong></div><div class="history-meta"><span>Current value</span><strong>${fmt(w.total)}</strong></div>`:'<p class="muted">No grade available.</p>'}</div>`}).join('')||'<div class="card muted">No completed drafts available.</div>'}</div><p class="fineprint">These are hindsight/current-market grades, not judgments of what was knowable on draft day.</p></div>`
}
function historyView(){
  setTimeout(ensureHistory,0);
  const tabs=[{id:'seasons',label:'Champions & Seasons'},{id:'records',label:'All-Time Records'},{id:'drafts',label:'Draft Winners'}];
  const panel=historyTab==='records'?recordsPanel():historyTab==='drafts'?draftWinnersPanel():seasonsPanel();
  return `<div class="grid grid-3 section-summary">${card('Seasons Linked',S.history.length+1,'Sleeper league chain')}${card('Completed Titles',historyLoaded?HIST.filter(x=>x.champ).length:'…','Playoff bracket results')}${card('Historical Drafts',S.draftBoards.filter(x=>(x.picks||[]).length).length,'Draft boards found')}</div>${innerNav(tabs,historyTab,'setHistoryTab')}${panel}`
}

function reportStats(){
  const pr=powerRankings(),st=standings(),tr=S.tx.filter(t=>t.type==='trade'&&t.status==='complete');
  return {leader:st[0],power:pr[0],trade:tr[0],movers:[...(S.movers||[])].sort((a,b)=>Number(b.trend_7d||b.change||0)-Number(a.trend_7d||a.change||0))};
}
function currentReportPanel(){
  const x=reportStats(),wk=S.league.settings?.leg||1,season=S.league.season||2026,topMover=x.movers[0],down=[...x.movers].sort((a,b)=>Number(a.trend_7d||a.change||0)-Number(b.trend_7d||b.change||0))[0];
  return `<div class="section-panel"><div class="newsletter-sheet card"><div class="newsletter-mast"><div><div class="eyebrow">TUESDAY LEAGUE REPORT · PREVIEW</div><h2>${esc(S.league.name||'League HQ')} — Week ${wk}</h2><p class="muted">${season} season · Generated from the league's live dashboard data</p></div><div class="newsletter-mark">LH</div></div><div class="newsletter-grid"><div class="report-story hero-story"><div class="story-kicker">LEAGUE LEADER</div><h3>${x.leader?esc(name(x.leader)):'Season not started'}</h3><p>${x.leader?`${rec(x.leader)} record with ${pts(x.leader)} points for.`:'Standings will populate when games begin.'}</p></div><div class="report-story"><div class="story-kicker">DYNASTY POWER #1</div><h3>${x.power?esc(name(x.power.r)):'—'}</h3><p>${x.power?`${fmt(x.power.total)} in combined roster and draft assets.`:'Market values unavailable.'}</p></div><div class="report-story"><div class="story-kicker">STOCK UP</div><h3>${topMover?esc(topMover.name||pname(String(topMover.sleeper_id||topMover.player_id||''))):'Market Watch'}</h3><p>${topMover?`Dynasty market movement: +${fmt(topMover.trend_7d||topMover.change||0)}.`:'Value movers will appear here.'}</p></div><div class="report-story"><div class="story-kicker">STOCK DOWN</div><h3>${down?esc(down.name||pname(String(down.sleeper_id||down.player_id||''))):'Market Watch'}</h3><p>${down?`Dynasty market movement: ${fmt(down.trend_7d||down.change||0)}.`:'Value movers will appear here.'}</p></div></div><div class="report-section"><h3>What the Tuesday email will include</h3><div class="report-chip-grid"><span>Weekly results & standings</span><span>Power ranking movement</span><span>Biggest upset / bad beat</span><span>Trades & waiver activity</span><span>Dynasty value movers</span><span>2027 prospect stock</span><span>Next-week matchup preview</span><span>Player prop watchlist</span></div></div><p class="fineprint">This is the live report template. During the season, weekly matchup and transaction data will fill in the award sections automatically.</p></div></div>`
}
function archivePanel(){
  const season=S.league.season||2026,wk=Number(S.league.settings?.leg||1);
  const weeks=Array.from({length:Math.max(1,wk)},(_,i)=>i+1).reverse();
  return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">REPORT LIBRARY</div><h2>${season} Archive</h2></div><p class="muted">Weekly editions will remain here so league members can revisit the season.</p></div><div class="grid grid-2">${weeks.map(w=>`<div class="card archive-card"><div><div class="eyebrow">${season} SEASON</div><strong>Week ${w} League Report</strong></div><span class="badge">${w===wk?'CURRENT TEMPLATE':'ARCHIVE SLOT'}</span></div>`).join('')}</div><p class="fineprint">Historical emails are not backfilled yet; archive slots begin storing finalized issues once automated delivery is connected.</p></div>`
}
function savedPrefs(){try{return JSON.parse(localStorage.getItem('leagueHQNewsletter')||'{}')}catch{return{}}}
function preferencesPanel(){const p=savedPrefs();return `<div class="section-panel"><div class="panel-heading"><div><div class="eyebrow">OPT-IN SETTINGS</div><h2>Newsletter Preferences</h2></div><p class="muted">Choose what you want to receive. These preferences are saved on this device until the email-delivery backend is connected.</p></div><div class="card newsletter-form"><label>Email address<input id="newsEmail" class="search-input" type="email" placeholder="you@example.com" value="${esc(p.email||'')}"></label><div class="check-grid"><label><input id="prefWeekly" type="checkbox" ${p.weekly!==false?'checked':''}> Tuesday League Report</label><label><input id="prefTrades" type="checkbox" ${p.trades?'checked':''}> Trade alerts</label><label><input id="prefDraft" type="checkbox" ${p.draft?'checked':''}> Draft & prospect news</label><label><input id="prefAnnouncements" type="checkbox" ${p.announcements?'checked':''}> League announcements</label></div><button class="save-pref" onclick="saveNewsletterPrefs()">Save preferences</button><div id="prefStatus" class="muted pref-status"></div></div><div class="card notice"><h3>Email delivery status</h3><p class="muted">The report generator and opt-in interface are built. Actual outbound email still needs a transactional email provider/API key; the site will not claim someone is subscribed until that backend exists.</p></div></div>`}
function saveNewsletterPrefs(){const email=$('#newsEmail')?.value.trim()||'';if(email&&!/^\S+@\S+\.\S+$/.test(email)){const s=$('#prefStatus');if(s)s.textContent='Enter a valid email address.';return}const p={email,weekly:!!$('#prefWeekly')?.checked,trades:!!$('#prefTrades')?.checked,draft:!!$('#prefDraft')?.checked,announcements:!!$('#prefAnnouncements')?.checked};localStorage.setItem('leagueHQNewsletter',JSON.stringify(p));const s=$('#prefStatus');if(s)s.textContent='Preferences saved on this device.'}
window.saveNewsletterPrefs=saveNewsletterPrefs;
function reportsView(){const tabs=[{id:'current',label:'Current Tuesday Report'},{id:'archive',label:'Report Archive'},{id:'preferences',label:'Newsletter Preferences'}];const panel=reportTab==='archive'?archivePanel():reportTab==='preferences'?preferencesPanel():currentReportPanel();return `<div class="grid grid-3 section-summary">${card('Delivery Day','Tuesday','Weekly during season')}${card('Report Status','Template Live','Email backend next')}${card('Archive Season',S.league.season||2026,'Weekly issues')}</div>${innerNav(tabs,reportTab,'setReportTab')}${panel}`}

const historyReportsBaseRender=render;
render=function(){
  if(S.view==='history'){$('#pageTitle').textContent='League History';root.innerHTML=historyView();return}
  if(S.view==='reports'){$('#pageTitle').textContent='League Reports';root.innerHTML=reportsView();return}
  historyReportsBaseRender();
};
window.render=render;
