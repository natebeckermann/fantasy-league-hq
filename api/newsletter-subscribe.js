const RESEND='https://api.resend.com';
const SEGMENTS={weekly:'League HQ - Tuesday Report',trades:'League HQ - Trade Alerts',draft:'League HQ - Draft & Prospect News',announcements:'League HQ - Announcements'};
function headers(){return {'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','User-Agent':'LeagueHQ/1.0'}}
async function rr(path,opts={}){const r=await fetch(RESEND+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok)throw Object.assign(new Error(data.message||`Resend ${r.status}`),{status:r.status,data});return data}
async function ensureSegments(){const list=await rr('/segments');const out={};for(const [key,label] of Object.entries(SEGMENTS)){let s=(list.data||[]).find(x=>x.name===label);if(!s)s=await rr('/segments',{method:'POST',body:JSON.stringify({name:label})});out[key]=s.id}return out}
async function getContact(email){try{return await rr('/contacts/'+encodeURIComponent(email))}catch(e){if(e.status===404)return null;throw e}}
async function add(email,seg){try{await rr(`/contacts/${encodeURIComponent(email)}/segments/${seg}`,{method:'POST'})}catch(e){if(e.status!==409)throw e}}
async function remove(email,seg){try{await rr(`/contacts/${encodeURIComponent(email)}/segments/${seg}`,{method:'DELETE'})}catch(e){if(e.status!==404)throw e}}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  if(!process.env.RESEND_API_KEY)return res.status(503).json({error:'Newsletter email service is not configured yet.'});
  const {email,weekly=true,trades=false,draft=false,announcements=false}=req.body||{};
  const clean=String(email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(clean))return res.status(400).json({error:'Enter a valid email address.'});
  try{
    const segs=await ensureSegments();let contact=await getContact(clean);
    if(!contact){contact=await rr('/contacts',{method:'POST',body:JSON.stringify({email:clean,unsubscribed:false})})}
    const prefs={weekly:!!weekly,trades:!!trades,draft:!!draft,announcements:!!announcements};
    for(const [k,on] of Object.entries(prefs)){if(on)await add(clean,segs[k]);else await remove(clean,segs[k])}
    return res.status(200).json({ok:true,email:clean,prefs});
  }catch(e){console.error(e);return res.status(500).json({error:'Could not save newsletter preferences.'})}
}
