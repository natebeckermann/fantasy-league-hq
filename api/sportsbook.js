const BOOKS=['draftkings','fanduel','betmgm','caesars'];
const PROP_STATS=new Set(['passing_yards','passing_touchdowns','passing_completions','passing_attempts','rushing_yards','receiving_yards','receptions','touchdowns','passing_rushing_yards','passing_rushing_touchdowns','passing_rushing_receiving_yards','passing_rushing_receiving_touchdowns']);
function displayTeam(t){return t?.names?.long||t?.names?.display||t?.name||t?.teamName||'TBD'}
function cleanBook(v){return{odds:v?.odds??v?.bookOdds??null,line:v?.overUnder??v?.spread??v?.bookOverUnder??v?.bookSpread??null,available:v?.available!==false,link:v?.link||v?.deeplink||null}}
function bookmakerMap(raw={}){const out={};for(const [k,v] of Object.entries(raw||{})){const id=String(k).toLowerCase().replace(/[^a-z0-9]/g,'');const match=BOOKS.find(b=>b.replace(/[^a-z0-9]/g,'')===id);if(match&&v)out[match]=cleanBook(v)}return out}
function normalizeOdd(o,players){const by=bookmakerMap(o?.byBookmaker||{});const pid=o?.playerID||o?.statEntityID;const p=players?.[pid];const stat=o?.statID||String(o?.oddID||'').split('-')[0]||'';const side=o?.sideID||String(o?.oddID||'').split('-').slice(-1)[0]||'';return{oddID:o?.oddID,marketName:o?.marketName||'',statID:stat,playerID:pid||null,playerName:p?.name||p?.names?.display||o?.playerName||null,side,consensusOdds:o?.bookOdds||o?.fairOdds||null,consensusLine:o?.bookOverUnder??o?.fairOverUnder??o?.overUnder??o?.spread??null,byBookmaker:by}}
function isPlayerProp(x){return !!x.playerID||PROP_STATS.has(x.statID)||/player/i.test(x.marketName||'')}
function apiUrl(bookmakerID){const url=new URL('https://api.sportsgameodds.com/v2/events');url.searchParams.set('leagueID','NFL');url.searchParams.set('oddsPresent','true');url.searchParams.set('started','false');url.searchParams.set('limit','18');url.searchParams.set('bookmakerID',bookmakerID);url.searchParams.set('includeAltLines','false');return url}
async function pull(key,bookmakerID){const r=await fetch(apiUrl(bookmakerID),{headers:{'x-api-key':key,'accept':'application/json'}});const data=await r.json();if(!r.ok||data?.success===false)throw new Error(data?.error||`Upstream ${r.status}`);return data.data||[]}
function mergeRawEvents(groups){const events=new Map;for(const list of groups){for(const e of list||[]){const id=e.eventID;if(!id)continue;if(!events.has(id))events.set(id,{...e,odds:{...(e.odds||{})},players:{...(e.players||{})}});else{const cur=events.get(id);cur.players={...(cur.players||{}),...(e.players||{})};for(const [oid,o] of Object.entries(e.odds||{})){if(!cur.odds[oid])cur.odds[oid]={...o,byBookmaker:{...(o.byBookmaker||{})}};else cur.odds[oid]={...cur.odds[oid],...o,byBookmaker:{...(cur.odds[oid].byBookmaker||{}),...(o.byBookmaker||{})}}}}}}return[...events.values()]}
function booksSeen(rawEvents){const seen=new Set;for(const e of rawEvents||[])for(const o of Object.values(e.odds||{}))for(const k of Object.keys(o?.byBookmaker||{})){const id=String(k).toLowerCase().replace(/[^a-z0-9]/g,'');const match=BOOKS.find(b=>b.replace(/[^a-z0-9]/g,'')===id);if(match)seen.add(match)}return seen}
export default async function handler(req,res){
  const key=process.env.SPORTSGAMEODDS_API_KEY;
  if(!key)return res.status(200).json({configured:false,events:[],message:'Sportsbook feed is ready; commissioner API key has not been added yet.'});
  try{
    const combined=await pull(key,BOOKS.join(','));
    const seen=booksSeen(combined),missing=BOOKS.filter(b=>!seen.has(b));
    let fallback=[],fallbackErrors={};
    if(missing.length){const settled=await Promise.allSettled(missing.map(b=>pull(key,b)));settled.forEach((r,i)=>{if(r.status==='fulfilled')fallback.push(r.value);else fallbackErrors[missing[i]]=r.reason?.message||'Fallback pull failed'})}
    const rawEvents=mergeRawEvents([combined,...fallback]);
    const returned=[...booksSeen(rawEvents)];
    const events=rawEvents.map(e=>{const odds=Object.values(e.odds||{}).map(o=>normalizeOdd(o,e.players||{})).filter(o=>Object.keys(o.byBookmaker).length);return{eventID:e.eventID,startTime:e.startTime||e.info?.startTime||null,home:displayTeam(e.teams?.home),away:displayTeam(e.teams?.away),links:e.links?.bookmakers||{},gameLines:odds.filter(o=>!isPlayerProp(o)).slice(0,20),props:odds.filter(isPlayerProp)}}).filter(e=>e.gameLines.length||e.props.length);
    res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=600');
    res.status(200).json({configured:true,updatedAt:new Date().toISOString(),books:BOOKS,booksReturned:returned,missingBooks:BOOKS.filter(b=>!returned.includes(b)),fallbackErrors,events});
  }catch(e){res.status(502).json({configured:true,events:[],error:e.message||'Could not load sportsbook data'})}
}
