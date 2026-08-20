function safeMilestonesActivityPanel(){try{if(typeof storyMilestonesPanel==='function')return storyMilestonesPanel()}catch(e){console.warn('Milestones unavailable',e)}return '<div class="card muted">Milestones are temporarily unavailable, but the rest of League Activity is working normally.</div>'}
activityView=function(){
  try{
    const rows=typeof activityRows==='function'?activityRows():[],waivers=rows.filter(t=>t.type==='waiver').length,trades=rows.filter(t=>t.type==='trade').length,fa=rows.filter(t=>t.type==='free_agent').length;
    const tabs=[{id:'recent',label:'Recent Activity'},{id:'milestones',label:'Milestones'},{id:'waivers',label:'Waiver / FAAB'},{id:'trades',label:'Trade Activity'},{id:'managers',label:'Manager Activity'}];
    let panel;
    if(activityTab==='milestones')panel=safeMilestonesActivityPanel();
    else if(activityTab==='waivers')panel=waiverPanel();
    else if(activityTab==='trades')panel=tradeActivityPanel();
    else if(activityTab==='managers')panel=managerPanel();
    else panel=recentPanel();
    return `<div class="grid grid-4 section-summary">${card('Transactions',rows.length,'Current season')}${card('Trades',trades,'Completed')}${card('Waivers',waivers,'Claims')}${card('Free Agents',fa,'Immediate adds')}</div>${innerNav(tabs,activityTab,'setActivityTab')}${panel}`;
  }catch(e){
    console.error('League Activity render failed',e);
    return `<div class="card notice"><h2>League Activity</h2><p class="muted">The activity feed hit a display error. The underlying Sleeper data connection is still active.</p><button class="save-pref" onclick="activityTab='recent';render()">Retry Recent Activity</button></div>`;
  }
};
window.activityView=activityView;
