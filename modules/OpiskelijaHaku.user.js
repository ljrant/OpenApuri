// ==UserScript==
// @name         OpiskelijaHaku
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.4.2
// @description  Opiskelijoiden työjärjestysten opintojaksot ja opettajat
// @match        https://*.inschool.fi/profiles/students*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// ==/UserScript==
(() => {
'use strict';
// Prevent duplicated tool initialization inside the hidden schedule viewer.
if(window.top!==window.self)return;
const directoryPage=/^\/profiles\/students\/?$/.test(location.pathname);
if(!/^\/profiles\/students(?:\/|$)/.test(location.pathname)||document.getElementById('oh-tab'))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const norm=s=>clean(s).normalize('NFKC').toLocaleLowerCase('fi-FI');
const nameMatches=(name,query)=>{
  const words=norm(query).replace(/[,]+/g,' ').split(/\s+/).filter(Boolean);
  if(!words.length)return true;
  const parts=norm(name).replace(/[,]+/g,' ').split(/\s+/).filter(Boolean);
  return words.every(w=>parts.some(p=>p.startsWith(w)));
};
const studentRe=/^\/profiles\/students\/(\d+)\/?$/,teacherRe=/^\/profiles\/teachers\/(\d+)\/?$/;
const pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),fi=d=>d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear();
const parseDate=v=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(v||'');if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null};
const weekStart=d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const css=make('style');css.textContent='#oh-panel{padding:16px;min-height:300px}#oh-panel *{box-sizing:border-box}#oh-panel .oh-fields{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#oh-panel label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:145px}#oh-panel input,#oh-panel textarea{border:1px solid #aab9c5;border-radius:4px;padding:8px;width:100%}#oh-panel textarea{min-height:100px}#oh-panel button{padding:7px 11px;margin:4px;border:1px solid #abc;background:#fff;border-radius:4px;cursor:pointer}#oh-panel button:disabled{opacity:.5}#oh-panel .oh-action{background:#176393;color:white}#oh-panel .oh-scroll{overflow:auto}#oh-panel table{width:100%;border-collapse:collapse}#oh-panel th,#oh-panel td{text-align:left;padding:8px;border-bottom:1px solid #dae1e6;vertical-align:top}#oh-panel th{background:#edf2f6}#oh-panel .oh-pill{display:inline-block;background:#eef5fa;padding:3px 6px;margin:3px;border-radius:4px}#oh-panel .oh-help{color:#576b79;font-size:12px;white-space:pre-wrap}@media(max-width:650px){#oh-panel label{min-width:100%}}';
css.textContent+='#oh-panel .oh-chooser{max-width:650px;margin:10px 0}#oh-panel .oh-choices{max-height:250px;overflow:auto;border:1px solid #b5c6d1;border-radius:5px;padding:4px;background:#fff}#oh-panel .oh-choice{display:block;width:100%;text-align:left;margin:0;padding:7px;border:0;border-bottom:1px solid #edf0f2;border-radius:0;background:#fff;color:#234b63}#oh-panel .oh-choice:hover{background:#eaf5fb}#oh-panel .oh-choice.oh-chosen{background:#dff0e5;color:#204b31;font-weight:600}#oh-panel .oh-time-toggle{display:flex;align-items:center;gap:8px;margin:8px 0;flex-direction:row;width:max-content;cursor:pointer}#oh-panel [hidden]{display:none!important}';document.head.append(css);
const tabs=$('main#main-content ul.nav.nav-tabs-primary')||$('ul.nav.nav-tabs-primary');
if(!tabs){console.warn('[OpiskelijaHaku] Välilehtipalkkia ei löydy');return}
const li=make('li');li.id='oh-tab';
const link=make('a','','OpiskelijaHaku');
link.href=directoryPage?'#opiskelijahaku':'/profiles/students/#opiskelijahaku';
link.setAttribute('role','tab');li.append(link);
tabs.insertBefore(li,$('.tabdrop',tabs));
if(!directoryPage)return; // Student profiles: keep Wilma's own tabs and navigate to the search.
const native=$('main#main-content .panel.tab-content')||$('.panel.tab-content');
if(!native){li.remove();console.warn('[OpiskelijaHaku] Sisältöpaneelia ei löydy');return}
const panel=make('section');panel.id='oh-panel';panel.hidden=true;native.insertAdjacentElement('afterend',panel);
let active=false,abort=null,rows=[],picked=new Map(),directory=new Map(),directoryLoading=false,directoryLoaded=false;
function changeTab(enabled){active=enabled;panel.hidden=!enabled;native.style.display=enabled?'none':'';li.classList.toggle('active',enabled);link.setAttribute('aria-selected',String(enabled))}
link.onclick=e=>{e.preventDefault();$$('li.active',tabs).forEach(n=>n.classList.remove('active'));changeTab(true);renderChoices()};
tabs.addEventListener('click',e=>{if(!e.target.closest('#oh-tab')&&e.target.closest('a'))changeTab(false)});
panel.append(make('h2','','OpiskelijaHaku'),make('p','oh-help','Suodata Wilman opiskelijaluetteloa nimellä ja valitse opiskelijat napsauttamalla. Voit valita useita opiskelijoita.'));
const chooser=make('div','oh-chooser'),chooserLabel=make('label'),filter=make('input');
filter.type='search';filter.placeholder='Hae opiskelijaa nimellä…';filter.autocomplete='off';
chooserLabel.append(make('strong','','Etsi opiskelijaa'),filter);chooser.append(chooserLabel);
const chooserActions=make('div'),refresh=make('button','','Päivitä opiskelijaluettelo'),directoryStatus=make('span','oh-help','');
chooserActions.append(refresh,directoryStatus);chooser.append(chooserActions);
const choices=make('div','oh-choices');choices.setAttribute('role','listbox');choices.setAttribute('aria-multiselectable','true');chooser.append(choices);panel.append(chooser);
const form=make('div','oh-fields');
const startLabel=make('label'),start=make('input');start.type='date';start.value=iso(new Date);startLabel.append(make('strong','','Alkaen'),start);
const endLabel=make('label'),end=make('input');end.type='date';const endDate=new Date;endDate.setDate(endDate.getDate()+13);end.value=iso(endDate);endLabel.append(make('strong','','Päättyen'),end);const timeLabel=make('label'),useTime=make('input');useTime.type='checkbox';useTime.style.width='auto';const timeText=make('span','','Rajaa myös kellonaikaan (valinnainen)');timeLabel.append(useTime,timeText);timeLabel.className='oh-time-toggle';
const clock=make('div','oh-fields');clock.hidden=true;const fromLabel=make('label'),fromTime=make('input');fromTime.type='time';fromTime.value='08:00';fromLabel.append(make('strong','','Alkaen klo'),fromTime);
const toLabel=make('label'),toTime=make('input');toTime.type='time';toTime.value='16:00';toLabel.append(make('strong','','Päättyen klo'),toTime);clock.append(fromLabel,toLabel);useTime.onchange=()=>{clock.hidden=!useTime.checked};
form.append(startLabel,endLabel);panel.append(form,timeLabel,clock);
const actions=make('div'),search=make('button','oh-action','Hae työjärjestykset'),cancel=make('button','','Keskeytä'),reset=make('button','','Tyhjennä valinnat');cancel.disabled=true;actions.append(search,cancel,reset);panel.append(actions);
const selection=make('div'),status=make('p','oh-help'),results=make('div','oh-scroll');panel.append(selection,status,results);
const say=(m,error)=>{status.textContent=m;status.style.color=error?'#9e2828':'#345d76'};
function readNames(doc){for(const a of $$('a[href]',doc)){let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}if(u.origin!==location.origin)continue;const m=studentRe.exec(u.pathname);if(!m)continue;const n=clean(a.textContent);if(n.length>2&&n.length<120)directory.set(m[1],{id:m[1],name:n})}}
// Do not seed the picker from the default 'Ohjaamasi tai valvomasi opiskelijat' overview.
// Names are loaded explicitly from the directory's full-list / alphabetical views.
function renderChoices(){
choices.replaceChildren();
const q=norm(filter.value);
const matches=[...directory.values()].filter(p=>nameMatches(p.name,q)).sort((a,b)=>a.name.localeCompare(b.name,'fi'));
const visible=matches.slice(0,80);
if(!visible.length){choices.append(make('div','oh-help',directoryLoading?'Opiskelijaluetteloa ladataan…':directoryLoaded?'Ei osumia.':'Opiskelijaluetteloa ei ole vielä ladattu. Kirjoita hakusana tai paina Päivitä opiskelijaluettelo.'));return}
const fragment=document.createDocumentFragment();
for(const person of visible){
const b=make('button','oh-choice'+(picked.has(person.id)?' oh-chosen':''),(picked.has(person.id)?'✓  ':'')+person.name);
b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(picked.has(person.id)));
b.onclick=()=>{if(picked.has(person.id))picked.delete(person.id);else if(picked.size<20)picked.set(person.id,person);else{say('Enintään 20 opiskelijaa kerrallaan.',true);return}renderPicked();renderChoices()};
fragment.append(b);
}
choices.append(fragment);
directoryStatus.textContent=(directoryLoading?'Ladataan: ':'Luettelossa: ')+directory.size+' opiskelijaa · osumia '+matches.length+(matches.length>visible.length?' (näytetään 80 ensimmäistä)':'');
}
filter.addEventListener('input',()=>{renderChoices();if(!directoryLoaded&&!directoryLoading)readDirectory()});
async function readDirectory(){
if(directoryLoading)return;
directoryLoading=true;refresh.disabled=true;renderChoices();say('Ladataan Wilman opiskelijaluetteloa…');
try{
const urls=new Map();
const directoryLinks=$$('main#main-content a[href]').filter(a=>!a.closest('#oh-panel'));
for(const a of directoryLinks){
  let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}
  if(u.origin!==location.origin||studentRe.test(u.pathname))continue;
  const isAlphabetical=/^\/profiles\/students\/[a-zåäö](?:\/)?$/i.test(u.pathname);
  const isAllTab=norm(a.textContent)==='kaikki'&&/^\/profiles\/students\/?$/.test(u.pathname);
  if(isAlphabetical||isAllTab)urls.set(u.href,u);
}
// Some Wilma instances use a separate /all directory route.
for(const a of directoryLinks){
  let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}
  if(u.origin===location.origin&&/^\/profiles\/students\/all\/?$/i.test(u.pathname))urls.set(u.href,u);
}
const queue=[...urls.values()].slice(0,38);
if(!queue.length){say('Kaikki- tai aakkosluettelon linkkejä ei löytynyt. Ohjaamasi tai valvomasi opiskelijat -osion nimiä ei lisätä automaattisesti.',true);return}
let at=0,finished=0,failed=0;
async function worker(){while(at<queue.length){const u=queue[at++];try{const r=await fetch(u.href,{credentials:'same-origin'});if(!r.ok)throw Error('HTTP '+r.status);readNames(new DOMParser().parseFromString(await r.text(),'text/html'))}catch(e){failed++;console.warn('[OpiskelijaHaku] Opiskelijaluetteloa ei saatu:',e)}finished++;directoryStatus.textContent='Luettelot '+finished+'/'+queue.length+' · opiskelijoita '+directory.size;if(finished%4===0)renderChoices()}}
await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
directoryLoaded=true;renderChoices();say('Opiskelijaluettelo ladattu: '+directory.size+' opiskelijaa.'+(failed?' '+failed+' sivua ei voitu hakea.':''));
}catch(e){say('Luettelon lataus epäonnistui: '+e.message,true)}
finally{directoryLoading=false;refresh.disabled=false;renderChoices()}
}
refresh.onclick=()=>{directoryLoaded=false;readDirectory()};

function renderPicked(){selection.replaceChildren(make('strong','','Valitut opiskelijat ('+picked.size+')'));const line=make('div');for(const p of picked.values()){const pill=make('span','oh-pill',p.name+' ');const remove=make('button','','×');remove.title='Poista';remove.onclick=()=>{picked.delete(p.id);renderPicked();renderChoices()};pill.append(remove);line.append(pill)}selection.append(line)}
cancel.onclick=()=>abort?.abort();
reset.onclick=()=>{picked.clear();rows=[];filter.value='';results.replaceChildren();renderPicked();renderChoices();say('Valinnat tyhjennetty.')};
function blockMoment(block,week){
const source=[block.querySelector('h3.sr-only')?.textContent,block.getAttribute('data-original-title'),block.getAttribute('title')].filter(Boolean).join(' ');
const dateMatch=source.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
let date=null;
if(dateMatch){const d=new Date(+dateMatch[3],+dateMatch[2]-1,+dateMatch[1],12);if(d.getFullYear()===+dateMatch[3]&&d.getMonth()===+dateMatch[2]-1&&d.getDate()===+dateMatch[1])date=d}
const times=[...source.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)].map(m=>+m[1]*60+(+m[2]));
return {date,time:times.length>=2?{start:times[0],end:times[1]}:null};
}
function parseSchedule(html,person,week,from,to,clockRange){
const doc=typeof html==='string'?new DOMParser().parseFromString(html,'text/html'):html;
const schedule=$('#schedule-container',doc)||$('#schedule',doc);
if(!schedule)throw Error('Työjärjestyksen sisältö puuttuu haetusta sivusta (mahdollinen käyttöoikeus- tai kirjautumisongelma).');
const blocks=$$('.block',schedule);
if(!blocks.length)throw Error('NO_SCHEDULE_BLOCKS');
const out=[];let foundCourses=0,ignoredByDate=0,ignoredByTime=0;
for(const block of blocks){
// .class is the timetable group, NOT the course. Wilma shows the
// course in the first span of .info; its title may contain the full name.
const info=$(':scope > .info',block);
const subject=info?.querySelector(':scope > span:not(.sr-only)');
const shortCourse=clean(subject?.textContent);
const longCourse=clean(subject?.getAttribute('title'));
const genericTitle=/^(opintojakso|kurssi|course|oppiaine|subject|näytä|avaa)$/i;
const course=longCourse&&!genericTitle.test(longCourse)&&longCourse.length>=shortCourse.length?longCourse:shortCourse;
if(!course)continue;
const group=clean($(':scope > .class',block)?.textContent);
foundCourses++;
const moment=blockMoment(block,week);
if(moment.date&&(moment.date<from||moment.date>to)){ignoredByDate++;continue}
if(clockRange){
if(!moment.time){parseSchedule.unknownTimes=(parseSchedule.unknownTimes||0)+1;ignoredByTime++;continue}
if(moment.time.end<=clockRange.start||moment.time.start>=clockRange.end){ignoredByTime++;continue}
}
const teachers=new Map();for(const a of $$('a.teachers[href]',block)){let u;try{u=new URL(a.href,location.href)}catch{continue}const m=teacherRe.exec(u.pathname);if(!m||u.origin!==location.origin)continue;teachers.set(m[1],{id:m[1],name:clean(a.getAttribute('title')||a.textContent)})}
out.push({person,course,group,teachers:[...teachers.values()],week:iso(week),partial:!moment.date&&(week<from||new Date(week.getTime()+6*86400000)>to)});
}
if(blocks.length&&foundCourses===0)throw Error('Työjärjestysmerkintöjä löytyi, mutta opintojaksotietoa ei tunnistettu.');
// Genuine empty results are possible after applying date/time filters.
return {rows:out,stats:{blocks:blocks.length,courses:foundCourses,ignoredByDate,ignoredByTime}};
}
async function renderedSchedule(url,signal){
  // Wilma may create timetable blocks client-side after the HTML has loaded.
  // The iframe executes Wilma's own scripts and is never used to bypass permissions.
  return new Promise((resolve,reject)=>{
    const iframe=document.createElement('iframe');
    iframe.setAttribute('aria-hidden','true');
    iframe.tabIndex=-1;
    iframe.style.cssText='position:fixed;left:-20000px;top:0;width:1100px;height:800px;visibility:hidden;pointer-events:none;border:0';
    let done=false,checkTimer=null,timeout=null,loaded=false;
    const cleanup=()=>{
      if(checkTimer)clearInterval(checkTimer);
      if(timeout)clearTimeout(timeout);
      signal.removeEventListener('abort',onAbort);
      iframe.remove();
    };
    const finish=(err,doc)=>{
      if(done)return;
      done=true;
      if(err)reject(err);else resolve(doc);
      cleanup();
    };
    const onAbort=()=>finish(new Error('Haku keskeytettiin.'));
    if(signal.aborted){reject(new Error('Haku keskeytettiin.'));return}
    signal.addEventListener('abort',onAbort,{once:true});
    iframe.addEventListener('load',()=>{loaded=true});
    iframe.addEventListener('error',()=>finish(new Error('Työjärjestyssivun avaaminen ei onnistunut.')));
    timeout=setTimeout(()=>{
      let d;try{d=iframe.contentDocument}catch{}
      if(d?.querySelector('#schedule-container'))finish(null,d);
      else finish(new Error('Työjärjestystä ei saatu ladattua Wilman sivulta.'));
    },8500);
    checkTimer=setInterval(()=>{
      let d;try{d=iframe.contentDocument}catch{return}
      if(!d)return;
      if(d.querySelector('#schedule .block'))finish(null,d);
      else if(loaded&&!d.querySelector('#schedule-container'))finish(new Error('Työjärjestys ei näy ladatulla sivulla.'));
    },180);
    iframe.src=url.href;
    document.body.append(iframe);
  });
}
async function runPool(tasks,signal,update){let next=0,done=0;const output=new Array(tasks.length);async function worker(){while(next<tasks.length&&!signal.aborted){const i=next++;try{const result=await tasks[i]();output[i]={rows:result.rows,stats:result.stats}}catch(e){output[i]={error:e.message}}update(++done,tasks.length)}}await Promise.all(Array.from({length:Math.min(3,tasks.length)},worker));return output}
search.onclick=async()=>{
if(abort)return;const from=parseDate(start.value),to=parseDate(end.value);
const clockRange=useTime.checked?{start:fromTime.value,end:toTime.value}:null;
if(clockRange){if(!/^\d\d:\d\d$/.test(clockRange.start)||!/^\d\d:\d\d$/.test(clockRange.end)||clockRange.start>=clockRange.end){say('Tarkista kellonaikarajaus. Päättymisajan on oltava alkamisajan jälkeen.',true);return}clockRange.start=+clockRange.start.slice(0,2)*60+(+clockRange.start.slice(3));clockRange.end=+clockRange.end.slice(0,2)*60+(+clockRange.end.slice(3))}
parseSchedule.unknownTimes=0;if(!from||!to||from>to){say('Virheellinen ajanjakso.',true);return}if(!picked.size){say('Valitse opiskelijat ensin.',true);return}if((to-from)/86400000>111){say('Enintään 16 viikon ajanjakso.',true);return}if(picked.size>20){say('Enintään 20 opiskelijaa kerrallaan.',true);return}
const dates=[];for(let d=weekStart(from);d<=to;d.setDate(d.getDate()+7))dates.push(new Date(d));
if(dates.length*picked.size>120){say('Rajaa hakua: enintään 120 työjärjestyshakua kerralla.',true);return}
abort=new AbortController();const signal=abort.signal;search.disabled=true;cancel.disabled=false;results.replaceChildren();
const tasks=[...picked.values()].flatMap(p=>dates.map(d=>async()=>{
const u=new URL('/profiles/students/'+p.id+'/schedule',location.origin);u.searchParams.set('date',fi(d));
const response=await fetch(u,{credentials:'same-origin',signal});
if(!response.ok)throw Error('HTTP '+response.status);
const html=await response.text();
try{return parseSchedule(html,p,d,from,to,clockRange)}
catch(e){
  if(e.message!=='NO_SCHEDULE_BLOCKS')throw e;
  const doc=await renderedSchedule(u,signal);
  try{return parseSchedule(doc,p,d,from,to,clockRange)}
  catch(inner){
    if(inner.message==='NO_SCHEDULE_BLOCKS')return {rows:[],stats:{blocks:0,courses:0,ignoredByDate:0,ignoredByTime:0}};
    throw inner;
  }
}
}));
try{
const output=await runPool(tasks,signal,(n,total)=>say('Haettu '+n+'/'+total+' työjärjestystä…'));
const failed=output.filter(x=>x?.error);
const errors=failed.length,combined=new Map();
const totalBlocks=output.reduce((n,o)=>n+(o?.stats?.blocks||0),0);
const totalCourses=output.reduce((n,o)=>n+(o?.stats?.courses||0),0);
for(const o of output){if(!o?.rows)continue;for(const x of o.rows){const key=x.person.id+'|'+norm(x.course);if(!combined.has(key))combined.set(key,{...x,teachers:[],teacherIds:new Set(),groups:new Set(),weeks:new Set(),partial:false});
const item=combined.get(key);item.weeks.add(x.week);item.partial ||=x.partial;
if(x.group)item.groups.add(x.group);
for(const t of x.teachers)if(!item.teacherIds.has(t.id)){item.teacherIds.add(t.id);item.teachers.push(t)}}}
rows=[...combined.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,'fi')||a.course.localeCompare(b.course,'fi'));
renderResults();
const firstError=failed[0]?.error||'';
say((signal.aborted?'Keskeytetty. ':'Valmis. ')+rows.length+' opintojaksoa, työjärjestysmerkintöjä '+totalBlocks+', tunnistettuja opintojaksoja '+totalCourses+', epäonnistuneita viikkohakuja '+errors+'.'+(firstError?' Esimerkkivirhe: '+firstError:'')+(parseSchedule.unknownTimes?' '+parseSchedule.unknownTimes+' merkintää ilman tunnistettavaa kellonaikaa.':''),errors>0||totalBlocks===0);
}catch(e){say('Hakuvirhe: '+e.message,true)}finally{abort=null;search.disabled=false;cancel.disabled=true}
};
function compose(list,type){
  const persons=[...new Map(list.map(p=>[String(p.id),p])).values()]
    .filter(p=>/^\d+$/.test(String(p.id)));
  if(!persons.length){say('Ei vastaanottajia.',true);return}
  const param=type==='teachers'?'r_teacher':type==='students'?'r_student':null;
  if(!param){say('Tuntematon vastaanottajatyyppi.',true);return}
  const url=new URL('/messages/compose',location.origin);
  persons.forEach(p=>url.searchParams.append(param,String(p.id)));
  window.open(url.href,'_blank','noopener');
}
function renderResults(){
results.replaceChildren();
if(!rows.length){results.append(make('p','oh-help','Opintojaksoja ei löytynyt. Tarkista hakutilanteesta myös mahdolliset latausvirheet.'));return}
const actions=make('div'),students=make('button','','Viesti opiskelijoille'),teachers=make('button','','Viesti opettajille');actions.append(students,teachers);results.append(actions);
const byStudent=new Map();
rows.forEach((r,i)=>{if(!byStudent.has(r.person.id))byStudent.set(r.person.id,{person:r.person,items:[]});byStudent.get(r.person.id).items.push({r,i})});
const selected=new Set(rows.map((_,i)=>i));
for(const {person,items} of byStudent.values()){
  const section=make('section','oh-student-group'),heading=make('h3','',person.name+' · '+items.length+' opintojaksoa');
  heading.style.cssText='font-size:16px;margin:12px 0 5px;font-weight:600';
  section.append(heading);
  const table=make('table'),thead=make('thead'),tr=make('tr');
  ['','Opintojakso','Opettaja(t)'].forEach(x=>tr.append(make('th','',x)));
  thead.append(tr);table.append(thead);
  const body=make('tbody');
  for(const {r,i} of items){
    const row=make('tr'),pick=make('td'),cb=make('input');cb.type='checkbox';cb.checked=true;cb.setAttribute('aria-label','Valitse '+r.course);
    cb.onchange=()=>cb.checked?selected.add(i):selected.delete(i);pick.append(cb);
    row.append(pick,make('td','',r.course));
    const teacherCell=make('td');
    if(!r.teachers.length)teacherCell.textContent='Ei opettajatietoa';
    else for(const teacher of r.teachers){
      const a=make('a','',teacher.name);a.href='/profiles/teachers/'+teacher.id;a.target='_blank';a.rel='noopener';teacherCell.append(a,document.createTextNode(' '));
    }
    row.append(teacherCell);body.append(row);
  }
  table.append(body);section.append(table);results.append(section);
}
results.append(make('p','oh-help','Opintojakso näkyy opiskelijaa kohden vain kerran. Ryhmämerkintöjä ei esitetä opintojakson niminä. Ajanjakson reunaviikot voivat sisältää myös sen ulkopuolisia opetuspäiviä.'));
const chosen=()=>[...selected].map(i=>rows[i]).filter(Boolean);
students.onclick=()=>compose(chosen().map(r=>r.person),'students');
teachers.onclick=()=>compose(chosen().flatMap(r=>r.teachers),'teachers');
}

renderPicked();renderChoices();
if(location.hash==='#opiskelijahaku')link.click();
})();