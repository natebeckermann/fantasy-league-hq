const BOOKS=['draftkings','fanduel','betmgm','caesars'];
const PROP_STATS=new Set(['passing_yards','passing_touchdowns','passing_completions','passing_attempts','rushing_yards','receiving_yards','receptions','touchdowns','passing_rushing_yards','passing_rushing_touchdowns','passing_rushing_receiving_yards','passing_rushing_receiving_touchdowns']);
function displayTeam(t){return t?.names?.long||t?.names?.display||t?.name||t?.teamName||'TBD'}
function cleanBook(v){return{odds:v?.odds||v?.bookOdds||null,line:v?.overUnder??v?.spread??v?.bookOverUnder??v?.bookSpread??null,available:v?.available!==false,link:v?.link||v?.deeplink||null}}
function normalizeOdd(o,players){const by={};for(const b of BOOKS){const v=o?.byBookmaker?.[b];if(v&&v.available!==false)by[b]=cleanBook(v)}const pid=o?.playerID||o?.statEntityID;const p=players?.[pid];const stat=o?.statID||String(o?.oddID||'').split('-')[0]||'';const side=o?.sideID||String(o?.oddID||'').split('-').slice(-1)[0]||'';return{oddID:o?.oddID,marketName:o?.marketName||'',statID:stat,playerID:pid||null,playerName:p?.name||p?.names?.display||o?.playerName||null,side,consensusOdds:o?.bookOdds||o?.fairOdds||null,consensusLine:o?.bookOverUnder??o?.fairOverUnder??o?.overUnder??o?.spread??null,byBookmaker:by}}
function isPlayerProp(x){return !!x.playerID||PROP_STATS.has(x.statID)||/player/i.test(x.marketName||'')}
export default async function handler(req,res){
  const key=process.env.SPORTSGAMEODDS_API_KEY;
  if(!key)return res.status(200).json({configured:false,events:[],message:'Sportsbook feed is ready; commissioner API key has not been added yet.'});
  try{
    const url=new URL('https://api.sportsgameodds.com/v2/events');
    url.searchParams.set('leagueID','NFL');url.searchParams.set('oddsAvailable','true');url.searchParams.set('started','false');url.searchParams.set('limit','18');url.searchParams.set('bookmakerID',BOOKS.join(','));url.searchParams.set('includeAltLines','false');
    const r=await fetch(url,{headers:{'x-api-key':key,'accept':'application/json'}});const data=await r.json();
    if(!r.ok||data?.success===false)throw new Error(data?.error||`Upstream ${r.status}`);
    const events=(data.data||[]).map(e=>{const odds=Object.values(e.odds||{}).map(o=>normalizeOdd(o,e.players||{})).filter(o=>Object.keys(o.byBookmaker).length);return{eventID:e.eventID,startTime:e.startTime||e.info?.startTime||null,home:displayTeam(e.teams?.home),away:displayTeam(e.teams?.away),links:e.links?.bookmakers||{},gameLines:odds.filter(o=>!isPlayerProp(o)).slice(0,20),props:odds.filter(isPlayerProp)}});
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
    res.status(200).json({configured:true,updatedAt:new Date().toISOString(),books:BOOKS,events});
  }catch(e){res.status(502).json({configured:true,events:[],error:e.message||'Could not load sportsbook data'})}
}
