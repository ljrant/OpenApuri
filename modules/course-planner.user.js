// ==UserScript==
// @name         OpenApuri Kurssisuunnitelma (erillinen lähde)
// @namespace    https://github.com/ljrant/OpenApuri
// @version      1.0.0
// @description  Lukuvuoden kurssikokonaisuudet, muokkaus ja Excel-/Google Sheets -vienti.
// @match        https://*.inschool.fi/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// OpenApuri · Kurssisuunnitelma 1.0.0
// Based on Wilma Teacher Planner 14.0.0 provided by the user.
// This module is bundled; it does not require a separate userscript.
(() => {
  'use strict';
  if (window.top!==window.self || window.__openApuriCoursePlanner) return;
  const MODULE='planner', PREFIX='wilma-teacher-planner-v14:'+location.origin+':';
  const K={weeks:PREFIX+'week-cache',periods:PREFIX+'period-cache',moves:PREFIX+'manual-assignments',names:PREFIX+'manual-logical-names',settings:PREFIX+'settings'};
  const p2=x=>String(x).padStart(2,'0'), iso=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
  const date=x=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(x||'');if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return iso(d)===x?d:null};
  const shift=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const monday=d=>shift(d,-((d.getDay()+6)%7));
  const dayName=s=>date(s)?.toLocaleDateString('fi-FI',{weekday:'short'})||'';
  const wilmaDate=d=>p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear();
  const clean=x=>String(x??'').replace(/[\u00a0\u2009]/g,' ').replace(/\s+/g,' ').trim();
  const uniq=xs=>[...new Set(xs.filter(Boolean))], vals=x=>Array.isArray(x)?x:x&&typeof x==='object'?Object.values(x):x==null?[]:[x];
  const safe=(key,otherwise)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??otherwise}catch{return otherwise}};
  const save=(key,v)=>localStorage.setItem(key,JSON.stringify(v));
  const enabled=()=>{try{return JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').planner!==false}catch{return true}};
  const defaultYear=()=>{const now=new Date(),y=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;return {start:y+'-08-01',end:(y+1)+'-07-31'}};
  const year=defaultYear();
  let prefs={includeWeekends:true,showRooms:true,showPalkki:false,...safe(K.settings,{})};
  let cache=safe(K.weeks,{}),periodCache=safe(K.periods,null),moves=safe(K.moves,{}),names=safe(K.names,[]);
  if(!moves||typeof moves!=='object'||Array.isArray(moves))moves={};
  if(!Array.isArray(names))names=[];
  if(!cache||typeof cache!=='object')cache={};
  let periods=[],major=[],rows=[],courses=[],clusters=[],logical=[],builtRange=null,busy=false,open=false,ui=null;
  const style=document.createElement('style');
  style.textContent=[
    '#oa-planner-card{margin:14px 0;padding:16px 18px;border-radius:9px;background:var(--oa-surface,#f5fbf8);border:1px solid var(--oa-border,#9cd7c5);border-left:4px solid var(--oa-primary,#147c6e);color:var(--oa-text,#173c48);font:14px system-ui}',
    '#oa-planner-card h2{margin:0 0 7px;font:600 17px system-ui;color:var(--oa-primary-dark,#075b50)}',
    '#oa-planner-card p{margin:0 0 10px}#oa-planner-card button,#oa-planner-open{border:0;border-radius:6px;padding:9px 14px;background:var(--oa-primary,#147c6e);color:white;cursor:pointer;font:600 13px system-ui}',
    '#oa-planner-overlay[hidden]{display:none!important}#oa-planner-overlay{position:fixed;inset:0;z-index:2147483100;background:#142d3280;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}',
    '#oa-planner{width:min(980px,96vw);max-height:94vh;display:flex;flex-direction:column;border:1px solid var(--oa-border,#9cd7c5);background:white;border-radius:12px;box-shadow:0 18px 48px #0004;color:var(--oa-text,#173c48);font:13px/1.45 system-ui;overflow:hidden}',
    '#oa-planner *{box-sizing:border-box}#oa-planner header{display:flex;align-items:center;gap:14px;justify-content:space-between;padding:14px 18px;background:var(--oa-surface-accent,#e0f5eb);border-bottom:2px solid var(--oa-border,#9cd7c5);position:relative}',
    '#oa-planner header h2{font:600 19px system-ui;color:var(--oa-primary-dark,#075b50);margin:0}#oa-planner header img{width:40px;height:40px;object-fit:contain}',
    '#oa-planner .oa-planner-tabs{display:flex;gap:4px;padding:9px 14px 0;border-bottom:1px solid var(--oa-border,#9cd7c5)}',
    '#oa-planner .oa-planner-tabs button{background:transparent;color:var(--oa-primary-dark,#075b50);border:0;border-bottom:3px solid transparent;border-radius:0;padding:9px 14px;font-weight:600;cursor:pointer}',
    '#oa-planner .oa-planner-tabs button[aria-selected=true]{background:var(--oa-surface,#f5fbf8);border-bottom-color:var(--oa-primary,#147c6e)}',
    '#oa-planner .oa-planner-content{overflow:auto;padding:16px 18px;min-height:130px}#oa-planner [data-pane][hidden]{display:none!important}',
    '#oa-planner label{display:block;margin:9px 0 4px;font-weight:600}#oa-planner input[type=date],#oa-planner input[type=text],#oa-planner select{width:100%;max-width:100%;padding:8px;border:1px solid var(--oa-border,#9cd7c5);border-radius:5px;background:#fff;color:inherit}',
    '#oa-planner input[type=checkbox]{margin-right:8px}#oa-planner button{cursor:pointer;font:600 13px system-ui}',
    '#oa-planner .oa-action{display:inline-block;margin:8px 6px 4px 0;border:1px solid var(--oa-primary,#147c6e);border-radius:6px;padding:9px 13px;background:var(--oa-primary,#147c6e);color:white}',
    '#oa-planner .oa-action.secondary{background:#fff;color:var(--oa-primary-dark,#075b50);border-color:var(--oa-border,#9cd7c5)}',
    '#oa-planner .oa-action:disabled{opacity:.5;cursor:wait}#oa-planner .oa-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
    '#oa-planner .oa-course-list{border:1px solid var(--oa-border,#9cd7c5);border-radius:7px;overflow:auto;max-height:40vh;margin:10px 0}',
    '#oa-planner .oa-course-item{padding:11px 13px;border-bottom:1px solid var(--oa-border,#9cd7c5)}#oa-planner .oa-course-item:last-child{border-bottom:0}',
    '#oa-planner .oa-course-item strong{display:block;color:var(--oa-primary-dark,#075b50)}#oa-planner .oa-sub{font-size:12px;color:var(--oa-muted,#52716c);white-space:pre-wrap}',
    '#oa-planner .oa-course-controls{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;margin:7px 0;align-items:end}',
    '#oa-planner #oa-planner-status{margin:0;border-top:1px solid var(--oa-border,#9cd7c5);background:var(--oa-surface,#f5fbf8);padding:8px 18px;white-space:pre-line;max-height:92px;overflow:auto;font-size:12px}',
    '#oa-planner .oa-note{padding:10px 12px;background:var(--oa-surface,#f5fbf8);border-radius:6px;margin:10px 0}#oa-planner .oa-error{color:#9d2828}',
    '#oa-planner .oa-close{font-size:22px;border:0;background:transparent;color:var(--oa-primary-dark,#075b50);padding:4px 10px}',
    '@media(max-width:620px){#oa-planner .oa-fields,#oa-planner .oa-course-controls{grid-template-columns:1fr}#oa-planner .oa-planner-content{padding:10px}}'
  ].join('\n');
  const mountStyle=()=>{if(!style.isConnected)(document.head||document.documentElement).append(style)};
  const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;if(cls)x.className=cls;return x};
  const warn=msg=>{console.warn('[OpenApuri Kurssisuunnitelma]',msg);if(ui)ui.querySelector('#oa-planner-status').textContent=String(msg)};
  const stat=msg=>{if(ui)ui.querySelector('#oa-planner-status').textContent=String(msg)};
  const l=(selector)=>ui.querySelector(selector);
  const normalizeCourse=x=>clean(x).toUpperCase().replace(/\*\.[A-Z0-9]+/g,' ').replace(/\.[FG]\b/g,' ').replace(/\b(HL|SL|TOK)\s*\d+\b/g,'$1 #').replace(/\b\d+\b/g,'#').replace(/[\[\](){}:,;_+\-/]/g,' ').replace(/\s+/g,' ');
  const similarity=(a,b)=>{const A=new Set(normalizeCourse(a).split(' ').filter(Boolean)),B=new Set(normalizeCourse(b).split(' ').filter(Boolean));return Math.min(A.size,B.size)?[...A].filter(x=>B.has(x)).length/Math.min(A.size,B.size):0};
  const bi=x=>{const n=clean(x).toUpperCase();return !/^BI0?[23]\.\d+\b/.test(n)&&/^BI0?[23](?:\b|\.IB\d*\b)/.test(n)};
  const family=x=>{const n=clean(x).toUpperCase(),v=n.match(/\bBI\s*(HL|SL)\s*(\d+)\b/),t=n.match(/\bTOK\s*(\d+)\b/);if(bi(n))return 'BI02 / BI03 Biology';if(v)return (+v[2]<=(v[1]==='HL'?5:3)?'DP1 Biology':'DP2 Biology');if(t)return +t[1]<=4?'DP1 TOK':'DP2 TOK';return ''};
  const courseKey=r=>r.GroupId?'gid:'+r.GroupId:'name:'+r.Course+'|'+r.CourseLong;
  function extractEvents(html){
    const marker=html.indexOf('var eventsJSON');if(marker<0)throw Error('Wilman eventsJSON-tietoja ei löytynyt.');
    const at=html.indexOf('Events',marker),open=html.indexOf('[',at);if(at<0||open<0)throw Error('Wilman tapahtumaluetteloa ei löytynyt.');
    let depth=0,inside=false,escaped=false;
    for(let i=open;i<html.length;i++){const c=html[i];if(inside){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inside=false;}else if(c==='"')inside=true;else if(c==='[')depth++;else if(c===']'&&!--depth){const raw=html.slice(open,i+1);try{return JSON.parse(raw)}catch{return JSON.parse(raw.replace(/\\\*/g,'*').replace(/\\\//g,'/'))}}}
    throw Error('Wilman lukujärjestysdata on puutteellinen.');
  }
  async function page(d){
    const url=new URL('/schedule',location.origin);url.searchParams.set('date',wilmaDate(d));
    const response=await fetch(url.href,{credentials:'same-origin',cache:'no-store'});
    if(!response.ok||new URL(response.url).origin!==location.origin)throw Error('Wilma vastasi HTTP '+response.status);
    return response.text();
  }
  function periodRange(text){
    const full=[...clean(text).matchAll(/(\d{1,2})\.(\d{1,2})\.?\s*(20\d{2})/g)];
    if(full.length>=2)return {start:iso(new Date(+full[0][3],+full[0][2]-1,+full[0][1],12)),end:iso(new Date(+full[1][3],+full[1][2]-1,+full[1][1],12))};
    const years=[...text.matchAll(/\b(20\d{2})\b/g)],short=[...text.matchAll(/(\d{1,2})\.(\d{1,2})\./g)];
    if(years.length&&short.length>=2){const ey=+years.at(-1)[1],sy=+short[0][2]>+short[1][2]?ey-1:ey;return {start:iso(new Date(sy,+short[0][2]-1,+short[0][1],12)),end:iso(new Date(ey,+short[1][2]-1,+short[1][1],12))}}
    return {start:'',end:''};
  }
  function periodsFromDoc(doc){
    const found=[];
    for(const link of doc.querySelectorAll('a[href*="/schedule"],a[href^="?date="]')){
      const context=clean([link.textContent,link.title,link.getAttribute('aria-label'),link.parentElement?.textContent,link.parentElement?.parentElement?.textContent].filter(Boolean).join(' '));
      const pm=context.match(/\bperiod(?:i)?\s*(\d+)/i);if(!pm)continue;
      const number=+pm[1],range=periodRange(context),raw=clean(link.textContent),match=context.match(/\bperiod(?:i)?\s*\d+(?:\s*[AB])?(?:\s+päättöviikko(?:\s+\d+)?)?/i);
      let hrefDate='';try{const u=new URL(link.href,location.origin),d=u.searchParams.get('date'),m=d?.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);if(m)hrefDate=iso(new Date(+m[3],+m[2]-1,+m[1],12))}catch{}
      const name=/\bperiod(?:i)?\s*\d+/i.test(raw)?raw:clean(match?.[0])||'Period '+number;
      found.push({id:[name,range.start,range.end,hrefDate].join('|'),name,number,...range,hrefDate});
    }
    return found;
  }
  function makeMajor(){
    const map=new Map();for(const p of periods){if(!map.has(p.number))map.set(p.number,[]);map.get(p.number).push(p)}
    major=[...map].map(([number,parts])=>({number,name:'Period '+number,parts,start:parts.map(p=>p.start).filter(Boolean).sort()[0]||'',end:parts.map(p=>p.end).filter(Boolean).sort().at(-1)||''})).sort((a,b)=>a.number-b.number);
  }
  async function discover(start,end,force){
    if(!force&&periodCache&&Date.now()-periodCache.time<86400000&&periodCache.start===start&&periodCache.end===end){periods=periodCache.data;makeMajor();return}
    const found=new Map(),add=items=>{for(const p of items)if(!found.has(p.id))found.set(p.id,p)};
    const current=document.querySelector('a[href*="/schedule"]')?document:null;if(current)add(periodsFromDoc(current));
    const first=date(start),last=date(end);if(!first||!last)throw Error('Tarkista lukuvuoden päivämäärät.');
    const probes=[];for(let x=new Date(first.getFullYear(),first.getMonth(),1,12);x<=last;x=new Date(x.getFullYear(),x.getMonth()+1,1,12))probes.push(x);
    for(let i=0;i<probes.length;i++){stat('Haetaan Wilman periodeja '+(i+1)+'/'+probes.length);try{const doc=new DOMParser().parseFromString(await page(probes[i]),'text/html');add(periodsFromDoc(doc))}catch(e){console.warn('[Kurssisuunnitelma] Periodeja ei löytynyt tältä kuukaudelta:',e)}}
    periods=[...found.values()].filter(p=>!p.start||(p.start>=start&&p.start<=end)).sort((a,b)=>(a.start||a.hrefDate||'9999').localeCompare(b.start||b.hrefDate||'9999'));
    periodCache={time:Date.now(),start,end,data:periods};try{save(K.periods,periodCache)}catch{}
    makeMajor();
  }
  const mainPeriod=x=>major.find(p=>p.start&&p.end&&x>=p.start&&x<=p.end)?.name||'';
  function parseWeek(day,events){
    const out=[];
    for(const ev of events){
      const dm=String(ev.Date||'').match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/),d=dm?new Date(+dm[3],+dm[2]-1,+dm[1],12):shift(day,Math.max(0,Math.min(6,Math.floor(Number(ev.X1||0)/10000))));
      const dt=iso(d),txt=vals(ev.Text).map(x=>{const raw=clean(x),m=raw.match(/^(\d+)\s*:\s*(.+)$/);return {raw,palkki:m?.[1]||'',course:m?clean(m[2]):raw}});
      const longer=vals(ev.LongText).map(clean),ids=vals(ev.ArvKirjaNro),rooms=uniq(vals(ev.Huoneet).map(v=>clean(v).replace(/^H:\s*/,''))),teachers=uniq(vals(ev.Opet).flatMap(v=>clean(v).replace(/^O:\s*/,'').split(',').map(clean))),n=Math.max(txt.length,longer.length,ids.length,1);
      const time=n=>p2(Math.floor(Number(n||0)/60))+':'+p2(Number(n||0)%60);
      for(let i=0;i<n;i++){const label=txt[i]||txt[0]||{raw:clean(ev.Tyyppi)||'Nimetön',course:clean(ev.Tyyppi)||'Nimetön',palkki:''};
        out.push({Date:dt,Weekday:dayName(dt),Period:mainPeriod(dt),Start:time(ev.Start),End:time(ev.End),Palkki:label.palkki,Course:label.course,WilmaRawLabel:label.raw,CourseLong:longer[i]||longer[0]||'',GroupId:String(ids[i]||ids[0]||''),Classes:clean(ev.Lk),Rooms:rooms.join(', '),Teachers:teachers.join(', '),EventType:clean(ev.Tyyppi)});
      }
    }
    return out;
  }
  async function scan(start,end,force){
    const all=[];for(let d=monday(date(start)),i=0;d<=date(end);d=shift(d,7),i++){
      const key=iso(d);let events;const hit=cache[key];if(!force&&hit&&Date.now()-hit.time<43200000&&Array.isArray(hit.events))events=hit.events;
      else{events=extractEvents(await page(d));cache[key]={time:Date.now(),events};try{save(K.weeks,cache)}catch(e){console.warn('Viikkovälimuisti täynnä',e)}}
      all.push(...parseWeek(d,events));stat('Haetaan lukujärjestystä '+(i+1)+' / '+(Math.floor((date(end)-monday(date(start)))/604800000)+1)+' · '+key);
    }
    rows=all.filter(r=>r.Date>=start&&r.Date<=end);
    const found=new Map();for(const r of rows){const key=courseKey(r);if(!found.has(key))found.set(key,{key,course:r.Course,longName:r.CourseLong,groupId:r.GroupId,periods:new Set(),palkit:new Set(),lessonRows:0});const c=found.get(key);c.lessonRows++;if(r.Period)c.periods.add(r.Period);if(r.Palkki)c.palkit.add(r.Palkki)}
    courses=[...found.values()].map(x=>({...x,periods:[...x.periods],palkit:[...x.palkit]})).sort((a,b)=>a.course.localeCompare(b.course,'fi'));
    builtRange={start,end};
  }
  function clusterMembers(periodName,periodNumber,keys,source,palkki,byCourse){
    const members=uniq(keys).flatMap(key=>{const c=courses.find(x=>x.key===key);return c?[{key,course:c,rows:byCourse.get(key)||[]}]:[]});
    return {period:periodName,periodNumber,source,palkki:palkki||'',members,courseKeys:members.map(x=>x.key),courseNames:uniq(members.map(x=>x.course.course)),longNames:uniq(members.map(x=>x.course.longName))};
  }
  function buildClusters(){
    const initial=[];
    for(const period of major){
      const byCourse=new Map();for(const r of rows.filter(r=>r.Period===period.name)){const k=courseKey(r);if(!byCourse.has(k))byCourse.set(k,[]);byCourse.get(k).push(r)}
      const byPalkki=new Map(),without=[];
      for(const [key,rs] of byCourse){const ps=uniq(rs.map(r=>r.Palkki));if(!ps.length)without.push(key);else for(const p of ps){if(!byPalkki.has(p))byPalkki.set(p,[]);byPalkki.get(p).push(key)}}
      for(const [p,keys]of byPalkki)initial.push(clusterMembers(period.name,period.number,keys,'Wilma Palkki',p,byCourse));
      // Same timetable slots without Palkki as a fallback.
      const parent=new Map(without.map(k=>[k,k]));const root=k=>{while(parent.get(k)!==k)k=parent.get(k);return k};
      for(let i=0;i<without.length;i++)for(let j=i+1;j<without.length;j++){
        const A=new Set((byCourse.get(without[i])||[]).map(r=>r.Date+'|'+r.Start+'|'+r.End)),B=new Set((byCourse.get(without[j])||[]).map(r=>r.Date+'|'+r.Start+'|'+r.End)),overlap=[...A].filter(x=>B.has(x)).length;
        if(overlap>=2&&overlap/Math.min(A.size,B.size)>=.8)parent.set(root(without[j]),root(without[i]));
      }
      const groups=new Map();for(const k of without){const rt=root(k);if(!groups.has(rt))groups.set(rt,[]);groups.get(rt).push(k)}
      for(const ks of groups.values())initial.push(clusterMembers(period.name,period.number,ks,ks.length>1?'Matching timetable slots':'Individual','',byCourse));
    }
    const grouped=new Map();for(const c of initial){if(!grouped.has(c.periodNumber))grouped.set(c.periodNumber,[]);grouped.get(c.periodNumber).push(c)}
    clusters=[];for(const list of grouped.values()){
      const biology=list.filter(c=>c.courseNames.some(bi)),others=list.filter(c=>!c.courseNames.some(bi));
      if(biology.length){const first=biology[0];clusters.push({...first,source:'BI02 + BI03 same-period rule',members:biology.flatMap(x=>x.members),courseKeys:uniq(biology.flatMap(x=>x.courseKeys)),courseNames:uniq(biology.flatMap(x=>x.courseNames)),longNames:uniq(biology.flatMap(x=>x.longNames))})}
      clusters.push(...others);
    }
    clusters.sort((a,b)=>a.periodNumber-b.periodNumber||String(a.palkki).localeCompare(String(b.palkki),'fi',{numeric:true}));
  }
  const clusterFamily=c=>{const fs=uniq([...c.courseNames,...c.longNames].map(family));return fs.length===1?fs[0]:''};
  const score=(a,b)=>{const A=clusterFamily(a),B=clusterFamily(b);if(A||B)return A&&A===B?1:0;let best=0;for(const x of [...a.courseNames,...a.longNames])for(const y of [...b.courseNames,...b.longNames])best=Math.max(best,similarity(x,y));return best};
  function autoLogical(){
    buildClusters();const grouped=new Map();for(const c of clusters){if(!grouped.has(c.periodNumber))grouped.set(c.periodNumber,[]);grouped.get(c.periodNumber).push(c)}
    const periodsSorted=[...grouped.keys()].sort((a,b)=>a-b);if(!periodsSorted.length){logical=[];return}
    const chains=grouped.get(periodsSorted[0]).map(c=>[c]);
    for(let i=1;i<periodsSorted.length;i++){
      const candidates=[],now=grouped.get(periodsSorted[i]);chains.forEach((chain,ci)=>{const prev=chain.at(-1);if(prev.periodNumber!==periodsSorted[i-1])return;now.forEach((c,ni)=>{const v=score(prev,c);if(v>=.6)candidates.push({ci,ni,v})})});
      candidates.sort((a,b)=>b.v-a.v);const usedC=new Set(),usedN=new Set();
      for(const x of candidates)if(!usedC.has(x.ci)&&!usedN.has(x.ni)){chains[x.ci].push(now[x.ni]);usedC.add(x.ci);usedN.add(x.ni)}
      now.forEach((c,ni)=>{if(!usedN.has(ni))chains.push([c])});
    }
    logical=chains.map(chain=>{const fs=uniq(chain.map(clusterFamily)),long=uniq(chain.flatMap(c=>c.longNames));return {name:fs.length===1?fs[0]:long.length===1?long[0]:chain[0].courseNames[0]||'Kurssi',courseKeys:uniq(chain.flatMap(c=>c.courseKeys)),clusters:chain}}).sort((a,b)=>a.name.localeCompare(b.name,'fi'));
  }
  const automatic=key=>logical.find(l=>l.courseKeys.includes(key))?.name||courses.find(c=>c.key===key)?.course||'';
  const effective=key=>clean(moves[key])||automatic(key);
  function groups(){
    const g=new Map();for(const c of courses){const name=effective(c.key)||c.course;if(!g.has(name))g.set(name,{name,raw:[]});g.get(name).raw.push(c)}
    for(const name of names)if(!g.has(name))g.set(name,{name,raw:[]});
    return [...g.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
  }
  function persist(){save(K.moves,moves);save(K.names,names)}
  function collapse(){
    const result=new Map();for(const r of rows){const name=effective(courseKey(r))||r.Course,k=[r.Date,r.Start,r.End,name].join('|');
      if(!result.has(k))result.set(k,{...r,LogicalCourse:name});else{const x=result.get(k);for(const col of ['Course','Rooms','Palkki','Classes'])x[col]=uniq([x[col],r[col]]).join(col==='Classes'?' / ':col==='Course'?' + ':', ')}}
    return [...result.values()].sort((a,b)=>a.Date.localeCompare(b.Date)||a.Start.localeCompare(b.Start)||a.LogicalCourse.localeCompare(b.LogicalCourse,'fi'));
  }
  function buildModel(start,end){
    const lessons=collapse(),courseNames=uniq(lessons.map(r=>r.LogicalCourse)).sort((a,b)=>a.localeCompare(b,'fi')),byCourse=new Map();
    for(const n of courseNames){const matches=lessons.filter(r=>r.LogicalCourse===n);byCourse.set(n,matches.map((r,i)=>({...r,LessonNumber:i+1,TotalLessons:matches.length,LessonDisplay:r.Start+'–'+r.End+(prefs.showRooms&&r.Rooms?' | '+r.Rooms:'')+(prefs.showPalkki&&r.Palkki?' | P'+r.Palkki:'')})))}
    const days=[];for(let d=date(start);d<=date(end);d=shift(d,1))if(prefs.includeWeekends||d.getDay()%6!==0)days.push(iso(d));
    return {courseNames,byCourse,lessons,days};
  }
  // Demand-load SheetJS only when export is requested, so OpenApuri continues
  // working if a CDN is unavailable; no @require on the full bundle.
  let xlsxPromise=null;
  async function getXLSX(){
    if(window.XLSX?.utils)return window.XLSX;
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';script.async=true;
      script.onload=()=>window.XLSX?.utils?resolve(window.XLSX):reject(Error('Excel-kirjasto ei latautunut.'));
      script.onerror=()=>reject(Error('Excel-kirjaston lataus estettiin. Tarkista selaimen sisältöestot.'));
      (document.head||document.documentElement).append(script);
    }).catch(e=>{xlsxPromise=null;throw e});return xlsxPromise;
  }
  function safeSheet(name){return clean(name).replace(/[:\\/?*\[\]]/g,' ').slice(0,31)||'Kurssi'}
  function exportWorkbook(X,start,end,google){
    const model=buildModel(start,end),wb=X.utils.book_new(),sheetNames={},used=new Set(['Full Year Overview','Daily Notes & Events','Lessons','Course Mapping','Periods','Guide']);
    wb.Workbook={CalcPr:{calcMode:'auto',fullCalcOnLoad:true,forceFullCalc:true}};
    const sheet=(title,headers,lines,widths,height=32)=>{
      const ws=X.utils.aoa_to_sheet([headers,...lines]);ws['!cols']=widths.map(w=>({wch:w}));
      ws['!rows']=[{hpt:25},...lines.map(()=>({hpt:height}))];if(ws['!ref'])ws['!autofilter']={ref:ws['!ref']};
      X.utils.book_append_sheet(wb,ws,title);return ws;
    };
    const formula=(ws,address,value)=>{ws[address]={t:'s',v:'',f:value}};
    const dailyHeaders=['Date','Weekday','Period','Other school events','Deadlines','Notes'];
    sheet('Daily Notes & Events',dailyHeaders,model.days.map(d=>[d,dayName(d),mainPeriod(d),'','','']),[12,10,12,40,32,42]);
    const shared=(cell,col)=>'IFERROR(VLOOKUP('+cell+",'Daily Notes & Events'!$A:$F,"+col+',FALSE),"")';
    for(const name of model.courseNames){const base=safeSheet(name);let value=base,i=2;while(used.has(value)){const suffix=' '+i++;value=base.slice(0,31-suffix.length)+suffix}used.add(value);sheetNames[name]=value}
    for(const name of model.courseNames){
      const data=model.byCourse.get(name),lines=data.map(r=>[r.LessonNumber,r.TotalLessons,r.Date,r.Weekday,r.Period,r.LessonDisplay,'','','','','','']);
      const ws=sheet(sheetNames[name],['Lesson #','Total lessons','Date','Weekday','Period','Lesson time / room','Content / lesson plan','Homework / follow-up','Other school events','Deadlines','Daily notes','Course notes'],lines,[10,13,12,10,12,28,42,32,38,30,38,42],40);
      for(let i=2;i<=lines.length+1;i++)for(const [col,index]of [['I',4],['J',5],['K',6]])formula(ws,col+i,shared('C'+i,index));
    }
    const overviewHeaders=['Date','Weekday','Period',...model.courseNames,'Other school events','Deadlines','Notes'];
    const ws=sheet('Full Year Overview',overviewHeaders,model.days.map(d=>[d,dayName(d),mainPeriod(d),...model.courseNames.map(()=>''),'','','']),[12,10,12,...model.courseNames.map(()=>40),38,30,40],52);
    const sheetRef=n=>"'"+sheetNames[n].replace(/'/g,"''")+"'";
    for(let row=2;row<=model.days.length+1;row++){
      model.courseNames.forEach((n,i)=>{
        const ref=sheetRef(n),dateCell='A'+row,cell=X.utils.encode_cell({r:row-1,c:i+3});
        const f='IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER("Lesson "&'+ref+'!$A$2:$A$1000&"/"&'+ref+'!$B$2:$B$1000&" | "&'+ref+'!$F$2:$F$1000&IF('+ref+'!$G$2:$G$1000<>""," | "&'+ref+'!$G$2:$G$1000,""),'+ref+'!$C$2:$C$1000='+dateCell+')),"")';
        formula(ws,cell,f);
      });
      for(let i=0;i<3;i++)formula(ws,X.utils.encode_cell({r:row-1,c:model.courseNames.length+3+i}),shared('A'+row,4+i));
    }
    sheet('Lessons',['Date','Weekday','Period','Start','End','Logical course','Palkki','Wilma course','Class','Teacher','Room'],model.lessons.map(r=>[r.Date,r.Weekday,r.Period,r.Start,r.End,r.LogicalCourse,r.Palkki,r.Course,r.Classes,r.Teachers,r.Rooms]),[12,10,12,10,10,30,12,32,20,28,20],26);
    sheet('Course Mapping',['Effective logical course','Automatic logical course','Manual override','Wilma course','Wilma long name','Wilma group ID','Periods','Palkki'],courses.map(c=>[effective(c.key),automatic(c.key),moves[c.key]||'',c.course,c.longName,c.groupId,c.periods.join(', '),c.palkit.join(', ')]),[30,30,30,30,34,18,28,16],28);
    sheet('Periods',['Main period','Wilma period','Start','End'],major.flatMap(p=>p.parts.map(part=>[p.name,part.name,part.start,part.end])),[16,36,14,14],24);
    const guide=[['Kurssiryhmitys','Kurssit tunnistetaan periodeittain Palkki-tunnisteesta ja yhdistetään peräkkäisillä periodeilla.'],['Manuaaliset muutokset','Kurssin siirrot ja nimeäminen tallentuvat selaimeen ja ohittavat automaattisen tunnistuksen.'],['Vuosinäkymä','Yksi sarake per looginen kurssi, solussa oppituntinumero ja aika sekä kurssivälilehdellä muokattu sisältö.'],['Päivittäiset tapahtumat','Yhteiset merkinnät tehdään Daily Notes & Events -välilehdelle.'],['BI02 + BI03','Yhdistetään saman periodin sisällä; BI02.5 käsitellään erikseen.'],['DP1/DP2 Biology','BI HL 1–5 / BI SL 1–3 ja BI HL 6+ / BI SL 4+.'],['DP1/DP2 TOK','TOK 1–4 ja TOK 5+.'],['Google Sheets',google?'Tuo tiedosto Google Driveen ja avaa Google Sheetsissä.':'Vaihtoehtoinen vienti tekee Google Sheets -yhteensopivan XLSX-tiedoston.']];
    sheet('Guide',['Item','How to use it'],guide,[30,105],42);
    X.writeFile(wb,'OpenApuri_kurssisuunnitelma_'+(google?'GoogleSheets_':'')+start+'_'+end+'.xlsx');
    return model.courseNames.length;
  }
  function mountUI(){
    mountStyle();if(ui)return ui;
    const overlay=el('div');overlay.id='oa-planner-overlay';overlay.hidden=true;
    overlay.innerHTML='<section id="oa-planner" role="dialog" aria-modal="true" aria-labelledby="oa-planner-title">'+
    '<header><h2 id="oa-planner-title">Kurssisuunnitelma</h2><div style="display:flex;align-items:center;gap:12px"><img src="https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png" alt="OpenApuri"><button class="oa-close" type="button" aria-label="Sulje">×</button></div></header>'+
    '<nav class="oa-planner-tabs" aria-label="Kurssisuunnitelman toiminnot"><button data-tab="build" aria-selected="true">Muodosta</button><button data-tab="edit" aria-selected="false">Kurssit</button><button data-tab="export" aria-selected="false">Vie suunnitelma</button></nav>'+
    '<div class="oa-planner-content">'+
    '<section data-pane="build"><div class="oa-fields"><label>Lukuvuoden alku<input id="oa-planner-start" type="date"></label><label>Lukuvuoden loppu<input id="oa-planner-end" type="date"></label></div>'+
    '<p class="oa-note">Kurssit tunnistetaan Wilman lukujärjestyksestä: periodi + Palkki, BI02/BI03-yhdistäminen ja kurssien jatkuminen periodeilta toisille. Ryhmittelyä voi muokata ennen vientiä.</p>'+
    '<button class="oa-action" id="oa-planner-build">Muodosta kurssit</button><label><input type="checkbox" id="oa-planner-fresh">Lataa uudet tiedot Wilmasta välimuistin sijaan</label>'+
    '<button class="oa-action secondary" id="oa-planner-periods">Päivitä periodit</button></section>'+
    '<section data-pane="edit" hidden><p class="oa-note">Yhdistä, nimeä uudelleen tai siirrä Wilman kurssit haluamiesi loogisten kurssien alle. Muutokset tallentuvat selaimeen.</p>'+
    '<div class="oa-fields"><label>Uusi kurssikokonaisuus<input id="oa-planner-new" type="text" maxlength="120" placeholder="Esim. DP1 Biology"></label><div><button class="oa-action" id="oa-planner-add">Luo kurssi</button></div></div>'+
    '<h3>Kurssikokonaisuudet</h3><div class="oa-course-list" id="oa-planner-groups">Muodosta kurssit ensin.</div>'+
    '<h3>Wilman kurssit</h3><div class="oa-course-list" id="oa-planner-raw">Muodosta kurssit ensin.</div>'+
    '<button class="oa-action secondary" id="oa-planner-reset">Palauta kaikki automaattiset ryhmittelyt</button></section>'+
    '<section data-pane="export" hidden><p class="oa-note">Excel-tiedosto sisältää koko lukuvuoden näkymän, kurssikohtaiset oppitunnit, muistiinpanot, periodit ja kurssikartoituksen.</p>'+
    '<label><input type="checkbox" id="oa-planner-weekends">Sisällytä viikonloput päivänäkymään</label>'+
    '<label><input type="checkbox" id="oa-planner-rooms">Näytä opetustilat</label>'+
    '<label><input type="checkbox" id="oa-planner-palkki">Näytä Palkki</label>'+
    '<button class="oa-action" id="oa-planner-excel">Vie Excel-tiedosto</button><button class="oa-action secondary" id="oa-planner-google">Vie Google Sheets -yhteensopiva tiedosto</button>'+
    '<button class="oa-action secondary" id="oa-planner-clear">Tyhjennä lukujärjestyksen välimuisti</button></section></div>'+
    '<p id="oa-planner-status" role="status" aria-live="polite">Valmis. Muodosta kurssit tai avaa aiemmin tallennettu kurssikartoitus.</p></section>';
    document.body.append(overlay);ui=overlay;
    l('#oa-planner-start').value=year.start;l('#oa-planner-end').value=year.end;
    l('#oa-planner-weekends').checked=!!prefs.includeWeekends;l('#oa-planner-rooms').checked=!!prefs.showRooms;l('#oa-planner-palkki').checked=!!prefs.showPalkki;
    function tab(name){for(const x of ui.querySelectorAll('[data-tab]'))x.setAttribute('aria-selected',String(x.dataset.tab===name));for(const x of ui.querySelectorAll('[data-pane]'))x.hidden=x.dataset.pane!==name}
    for(const x of ui.querySelectorAll('[data-tab]'))x.onclick=()=>tab(x.dataset.tab);
    const close=()=>{overlay.hidden=true;open=false};l('.oa-close').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});
    const range=()=>{const start=l('#oa-planner-start').value,end=l('#oa-planner-end').value;if(!date(start)||!date(end)||start>end)throw Error('Virheellinen lukuvuoden aikaväli.');if((date(end)-date(start))/86400000>500)throw Error('Valitse enintään 500 päivän jakso.');return {start,end}};
    const run=async(fn)=>{if(busy)return;busy=true;for(const b of ui.querySelectorAll('.oa-action'))b.disabled=true;try{await fn()}catch(e){console.error('[Kurssisuunnitelma]',e);stat('Virhe: '+e.message)}finally{busy=false;for(const b of ui.querySelectorAll('.oa-action'))b.disabled=false}};
    function render(){
      const list=l('#oa-planner-groups'),raw=l('#oa-planner-raw');list.replaceChildren();raw.replaceChildren();
      if(!courses.length){list.textContent='Muodosta kurssit ensin.';raw.textContent='Muodosta kurssit ensin.';return}
      const gs=groups(),collapsed=collapse();
      for(const g of gs){
        const card=el('article',undefined,'oa-course-item'),title=el('strong',g.name+' · '+g.raw.length+' Wilma-kurssia · '+collapsed.filter(x=>x.LogicalCourse===g.name).length+' oppituntia'),detail=el('p',g.raw.map(x=>x.course+(x.longName?' – '+x.longName:'')).join('\n')||'Tyhjä kurssikokonaisuus','oa-sub');
        const name=el('input');name.type='text';name.value=g.name;name.maxLength=120;name.setAttribute('aria-label','Kurssin uusi nimi');
        const rename=el('button','Nimeä uudelleen','oa-action secondary');rename.onclick=()=>{const target=clean(name.value);if(!target)return;for(const item of g.raw)moves[item.key]=target;names=uniq([...names.filter(n=>n!==g.name),target]).sort();persist();render();stat('Kurssi nimetty uudelleen: '+g.name+' → '+target)};
        card.append(title,detail,name,rename);
        if(!g.raw.length&&names.includes(g.name)){const remove=el('button','Poista tyhjä','oa-action secondary');remove.onclick=()=>{names=names.filter(x=>x!==g.name);persist();render()};card.append(remove)}
        list.append(card);
      }
      const destinations=gs.map(x=>x.name);
      for(const c of courses){
        const card=el('article',undefined,'oa-course-item');
        card.append(el('strong',c.course),el('div',[c.longName,c.periods.join(', '),c.palkit.length?'Palkki: '+c.palkit.join(', '):'',c.groupId?'Wilma: '+c.groupId:''].filter(Boolean).join(' · '),'oa-sub'));
        const row=el('div',undefined,'oa-course-controls'),select=el('select');select.setAttribute('aria-label','Kurssikokonaisuus: '+c.course);
        for(const name of destinations){const option=el('option',name);option.value=name;select.append(option)}select.value=effective(c.key);
        const move=el('button','Siirrä','oa-action');move.onclick=()=>{moves[c.key]=select.value;names=uniq([...names,select.value]);persist();render();stat(c.course+' → '+select.value)};
        const reset=el('button','Palauta','oa-action secondary');reset.onclick=()=>{delete moves[c.key];persist();render()};
        row.append(select,move,reset);card.append(row);raw.append(card);
      }
    }
    l('#oa-planner-build').onclick=()=>run(async()=>{
      const {start,end}=range();await discover(start,end,l('#oa-planner-fresh').checked);await scan(start,end,l('#oa-planner-fresh').checked);autoLogical();render();stat('Kurssit muodostettu: '+courses.length+' Wilman kurssia, '+groups().filter(g=>g.raw.length).length+' kurssikokonaisuutta, '+rows.length+' lukujärjestysriviä.');tab('edit');
    });
    l('#oa-planner-periods').onclick=()=>run(async()=>{const {start,end}=range();await discover(start,end,true);stat('Periodeja löytyi '+major.length+': '+major.map(x=>x.name+' '+x.start+'–'+x.end).join(', '))});
    l('#oa-planner-add').onclick=()=>{const name=clean(l('#oa-planner-new').value);if(!name)return;names=uniq([...names,name]).sort();persist();l('#oa-planner-new').value='';render();stat('Uusi kurssikokonaisuus: '+name)};
    l('#oa-planner-reset').onclick=()=>{if(!confirm('Palautetaanko kaikki kurssien käsin tehdyt sijoittelut?'))return;moves={};persist();render();stat('Automaattinen ryhmittely palautettu.')};
    const doExport=google=>run(async()=>{
      const {start,end}=range();
      prefs={includeWeekends:l('#oa-planner-weekends').checked,showRooms:l('#oa-planner-rooms').checked,showPalkki:l('#oa-planner-palkki').checked};save(K.settings,prefs);
      if(!builtRange||builtRange.start!==start||builtRange.end!==end){await discover(start,end,false);await scan(start,end,false);autoLogical();render()}
      stat('Ladataan Excel-kirjastoa ja muodostetaan tiedostoa…');
      const x=await getXLSX(),count=exportWorkbook(x,start,end,google);stat('Viety '+count+' kurssikokonaisuutta. Tarkista tarvittaessa Excelin tai Google Sheetsin kaavat.');
    });
    l('#oa-planner-excel').onclick=()=>doExport(false);l('#oa-planner-google').onclick=()=>doExport(true);
    l('#oa-planner-clear').onclick=()=>{cache={};localStorage.removeItem(K.weeks);stat('Lukujärjestyksen välimuisti tyhjennetty.')};
    render();return overlay;
  }
  function launch(){
    if(!enabled()){window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'planner'}}));return}
    const overlay=mountUI();overlay.hidden=false;open=true;l('.oa-close').focus();
  }
  function home(){
    if(!enabled()||!/^\/?$/.test(location.pathname)||document.getElementById('oa-planner-card'))return;
    const root=document.querySelector('main#main-content')||document.querySelector('main')||document.querySelector('#main-content');if(!root)return;
    mountStyle();const card=el('section',undefined);card.id='oa-planner-card';
    card.append(el('h2','Kurssisuunnitelma'),el('p','Muodosta lukuvuoden opetuskurssit Wilman lukujärjestyksestä, yhdistä ja nimeä kurssit sekä vie vuosittainen suunnitelma Exceliin.'));
    const btn=el('button','Avaa kurssisuunnitelma');btn.type='button';btn.onclick=launch;card.append(btn);root.prepend(card);
  }
  window.addEventListener('openapuri:open-course-planner',launch);
  const onReady=()=>{window.__openApuriCoursePlanner=true;home();if(location.hash==='#openapuri-kurssisuunnitelma')launch()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
  // Late Wilma homepage content support. No background network scan.
  if(/^\/?$/.test(location.pathname)){let n=0;const timer=setInterval(()=>{home();if(document.getElementById('oa-planner-card')||++n>=15)clearInterval(timer)},500)}
})();
