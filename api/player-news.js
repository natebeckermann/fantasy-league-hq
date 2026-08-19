function decode(s=''){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(xml,t){const m=xml.match(new RegExp(`<${t}(?: [^>]*)?>([\\s\\S]*?)<\\/${t}>`,'i'));return m?decode(m[1].trim()):''}
export default async function handler(req,res){
  try{
    const q=String(req.query.q||'NFL player').slice(0,120);
    const url='https://news.google.com/rss/search?q='+encodeURIComponent(`${q} NFL fantasy football`)+"&hl=en-US&gl=US&ceid=US:en";
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 LeagueHQ/1.0'}});
    if(!r.ok)throw new Error('News upstream '+r.status);
    const xml=await r.text();
    const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,8).map(m=>{const x=m[1];return{title:tag(x,'title'),link:tag(x,'link'),published:tag(x,'pubDate'),source:tag(x,'source')}}).filter(x=>x.title&&x.link);
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({query:q,items});
  }catch(e){res.status(500).json({error:'Could not load player news',items:[]})}
}
