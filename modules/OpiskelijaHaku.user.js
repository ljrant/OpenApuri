// ==UserScript==
// @name         OpiskelijaHaku
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.2.0
// @description  Opiskelijoiden työjärjestysten opintojaksot ja opettajat
// @match        https://*.inschool.fi/profiles/students*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// ==/UserScript==
(() => {
'use strict';
if(!/^\/profiles\/students\/?$/.test(location.pathname)||document.getElementById('oh-tab'))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const clean=s=>String(s||'').trim().replace(/\s+/g,' '),norm=s=>clean(s).toLocaleLowerCase('fi');
const studentRe=/^\/profiles\/students\/(\d+)\/?$/,teacherRe=/^\/profiles\/teachers\/(\d+)\/?$/;
const pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),fi=d=>d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear();
const parseDate=v=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(v||'');if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null};
const weekStart=d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const css=make('style');css.textContent='#oh-panel{padding:16px;min-height:300px}#oh-panel *{box-sizing:border-box}#oh-panel .oh-fields{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#oh-panel label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:145px}#oh-panel input,#oh-panel textarea{border:1px solid #aab9c5;border-radius:4px;padding:8px;width:100%}#oh-panel textarea{min-height:100px}#oh-panel button{padding:7px 11px;margin:4px;border:1px solid #abc;background:#fff;border-radius:4px;cursor:pointer}#oh-panel button:disabled{opacity:.5}#oh-panel .oh-action{background:#176393;color:white}#oh-panel .oh-scroll{overflow:auto}#oh-panel table{width:100%;border-collapse:collapse}#oh-panel th,#oh-panel td{text-align:left;padding:8px;border-bottom:1px solid #dae1e6;vertical-align:top}#oh-panel th{background:#edf2f6}#oh-panel .oh-pill{display:inline-block;background:#eef5fa;padding:3px 6px;margin:3px;border-radius:4px}#oh-panel .oh-help{color:#576b79;font-size:12px;white-space:pre-wrap}@media(max-width:650px){#oh-panel label{min-width:100%}}';
css.textContent+='#oh-panel .oh-chooser{max-width:650px;margin:10px 0}#oh-panel .oh-choices{max-height:250px;overflow:auto;border:1px solid #b5c6d1;border-radius:5px;padding:4px;background:#fff}#oh-panel .oh-choice{display:block;width:100%;text-align:left;margin:0;padding:7px;border:0;border-bottom:1px solid #edf0f2;border-radius:0;background:#fff;color:#234b63}#oh-panel .oh-choice:hover{background:#eaf5fb}#oh-panel .oh-choice.oh-chosen{background:#dff0e5;color:#204b31;font-weight:600}#oh-panel .oh-time-toggle{display:flex;align-items:center;gap:8px;margin:8px 0;flex-direction:row;width:max-content;cursor:pointer}#oh-panel [hidden]{display:none!important}';document.head.append(css);
const tabs=$('main#main-content ul.nav.nav-tabs-primary'),native=$('main#main-content .panel.tab-content');if(!tabs||!native){console.warn('[OpiskelijaHaku] Välilehtipalkkia ei löydy');return}
const li=make('li');li.id='oh-tab';const link=make('a','', 'OpiskelijaHaku');link.href='#opiskelijahaku';link.setAttribute('role','tab');li.append(link);tabs.insertBefore(li,$('.tabdrop',tabs));
const panel=make('section');panel.id='oh-panel';panel.hidden=true;native.insertAdjacentElement('afterend',panel);
let active=false,abort=null,rows=[],picked=new Map(),directory=new Map(),directoryLoading=false,directoryLoaded=false;
function changeTab(enabled){active=enabled;panel.hidden=!enabled;native.style.display=enabled?'none':'';li.classList.toggle('active',enabled);link.setAttribute('aria-selected',String(enabled))}
link.onclick=e=>{e.preventDefault();$('li.active',tabs).forEach(n=>n.classList.remove('active'));changeTab(true);if(!directoryLoaded&&!directoryLoading)readDirectory();else renderChoices()};
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
readNames(document);
function renderChoices(){
choices.replaceChildren();
const q=norm(filter.value);
const matches=[...directory.values()].filter(p=>norm(p.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'fi'));
const visible=matches.slice(0,160);
if(!visible.length){choices.append(make('div','oh-help',directoryLoading?'Opiskelijoita ladataan…':'Ei osumia.'));return}
const fragment=document.createDocumentFragment();
for(const person of visible){
const b=make('button','oh-choice'+(picked.has(person.id)?' oh-chosen':''),(picked.has(person.id)?'✓  ':'')+person.name);
b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(picked.has(person.id)));
b.onclick=()=>{if(picked.has(person.id))picked.delete(person.id);else if(picked.size<20)picked.set(person.id,person);else{say('Enintään 20 opiskelijaa kerrallaan.',true);return}renderPicked();renderChoices()};
fragment.append(b);
}
choices.append(fragment);
directoryStatus.textContent=(directoryLoading?'Ladataan: ':'Luettelossa: ')+directory.size+' opiskelijaa · osumia '+matches.length+(matches.length>visible.length?' (näytetään 160 ensimmäistä)':'');
}
filter.addEventListener('input',renderChoices);
async function readDirectory(){
if(directoryLoading)return;
directoryLoading=true;refresh.disabled=true;renderChoices();say('Ladataan Wilman opiskelijaluetteloa…');
try{
const urls=new Map();
for(const a of $('main#main-content ul.nav.nav-tabs-primary a[href]')){
let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}
if(u.origin===location.origin&&/^\/profiles\/students\/[^/]+\/?$/.test(u.pathname)&&!studentRe.test(u.pathname))urls.set(u.href,u);
}
// The alphabetical filter links are located inside the content pane on "Kaikki" too.
for(const a of $('main#main-content a[href]')){
let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}
if(u.origin===location.origin&&/^\/profiles\/students\/[^/]+\/?$/.test(u.pathname)&&!studentRe.test(u.pathname))urls.set(u.href,u);
}
const queue=[...urls.values()].slice(0,38);let at=0,finished=0,failed=0;
async function worker(){while(at<queue.length){const u=queue[at++];try{const r=await fetch(u.href,{credentials:'same-origin'});if(!r.ok)throw Error('HTTP '+r.status);readNames(new DOMParser().parseFromString(await r.text(),'text/html'))}catch(e){failed++;console.warn('[OpiskelijaHaku] Opiskelijaluetteloa ei saatu:',e)}finished++;renderChoices();directoryStatus.textContent='Luettelot '+finished+'/'+queue.length+' · opiskelijoita '+directory.size}}
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
const doc=new DOMParser().parseFromString(html,'text/html');if(!$('#schedule-container',doc))throw Error('Työjärjestystä ei löytynyt');const out=[];
for(const block of $$('#schedule .block',doc)){
const course=clean($(':scope > span.class',block)?.textContent);if(!course)continue;
const moment=blockMoment(block,week);
if(moment.date&&(moment.date<from||moment.date>to))continue;
if(clockRange){
if(!moment.time){parseSchedule.unknownTimes=(parseSchedule.unknownTimes||0)+1;continue}
if(moment.time.end<=clockRange.start||moment.time.start>=clockRange.end)continue;
}
const teachers=new Map();for(const a of $$('a.teachers[href]',block)){let u;try{u=new URL(a.href,location.href)}catch{continue}const m=teacherRe.exec(u.pathname);if(!m||u.origin!==location.origin)continue;teachers.set(m[1],{id:m[1],name:clean(a.getAttribute('title')||a.textContent)})}
out.push({person,course,teachers:[...teachers.values()],week:iso(week),partial:!moment.date&&(week<from||new Date(week.getTime()+6*86400000)>to)});
}
return out;
}
async function runPool(tasks,signal,update){let next=0,done=0;const output=new Array(tasks.length);async function worker(){while(next<tasks.length&&!signal.aborted){const i=next++;try{output[i]={rows:await tasks[i]()}}catch(e){output[i]={error:e.message}}update(++done,tasks.length)}}await Promise.all(Array.from({length:Math.min(3,tasks.length)},worker));return output}
search.onclick=async()=>{
if(abort)return;const from=parseDate(start.value),to=parseDate(end.value);
const clockRange=useTime.checked?{start:fromTime.value,end:toTime.value}:null;
if(clockRange){if(!/^\d\d:\d\d$/.test(clockRange.start)||!/^\d\d:\d\d$/.test(clockRange.end)||clockRange.start>=clockRange.end){say('Tarkista kellonaikarajaus. Päättymisajan on oltava alkamisajan jälkeen.',true);return}clockRange.start=+clockRange.start.slice(0,2)*60+(+clockRange.start.slice(3));clockRange.end=+clockRange.end.slice(0,2)*60+(+clockRange.end.slice(3))}
parseSchedule.unknownTimes=0;if(!from||!to||from>to){say('Virheellinen ajanjakso.',true);return}if(!picked.size){say('Valitse opiskelijat ensin.',true);return}if((to-from)/86400000>111){say('Enintään 16 viikon ajanjakso.',true);return}if(picked.size>20){say('Enintään 20 opiskelijaa kerrallaan.',true);return}
const dates=[];for(let d=weekStart(from);d<=to;d.setDate(d.getDate()+7))dates.push(new Date(d));
if(dates.length*picked.size>120){say('Rajaa hakua: enintään 120 työjärjestyshakua kerralla.',true);return}
abort=new AbortController();const signal=abort.signal;search.disabled=true;cancel.disabled=false;results.replaceChildren();
const tasks=[...picked.values()].flatMap(p=>dates.map(d=>async()=>{const u=new URL('/profiles/students/'+p.id+'/schedule',location.origin);u.searchParams.set('date',fi(d));const response=await fetch(u,{credentials:'same-origin',signal});if(!response.ok)throw Error('HTTP '+response.status);return parseSchedule(await response.text(),p,d,from,to,clockRange)}));
try{
const output=await runPool(tasks,signal,(n,total)=>say('Haettu '+n+'/'+total+' työjärjestystä…'));
const errors=output.filter(x=>x?.error).length,combined=new Map();
for(const o of output){if(!o?.rows)continue;for(const x of o.rows){const key=x.person.id+'|'+norm(x.course)+'|'+x.teachers.map(t=>t.id).sort().join(',');if(!combined.has(key))combined.set(key,{...x,weeks:new Set(),partial:false});const item=combined.get(key);item.weeks.add(x.week);item.partial ||=x.partial}}
rows=[...combined.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,'fi')||a.course.localeCompare(b.course,'fi'));renderResults();say((signal.aborted?'Keskeytetty. ':'Valmis. ')+rows.length+' opintojaksoriviä, '+errors+' epäonnistunutta hakua.'+(errors?' Tulos voi olla puutteellinen.':'')+(parseSchedule.unknownTimes?' '+parseSchedule.unknownTimes+' merkintää jätettiin pois, koska kellonaikaa ei voitu tunnistaa.':''),!!errors);
}catch(e){say('Hakuvirhe: '+e.message,true)}finally{abort=null;search.disabled=false;cancel.disabled=true}
};
function compose(list,type){
const persons=[...new Map(list.map(p=>[p.id,p])).values()];
if(!persons.length){say('Ei vastaanottajia.',true);return}
if(type==='students'){
const u=new URL('/messages/compose',location.origin);for(const p of persons)u.searchParams.append('r_student',p.id);window.open(u.href,'_blank','noopener');return
}
localStorage.setItem('wilmatools.composeRequest.v1',JSON.stringify({subject:'',body:'',recipientsNames:persons.map(p=>p.name),recipientRule:'opettajat',createdAt:Date.now()}));
window.open(location.origin+'/messages/compose#wt-library','_blank','noopener');
}
function renderResults(){
results.replaceChildren();if(!rows.length){results.append(make('p','','Opintojaksoja ei löytynyt.'));return}
const controls=make('div'),students=make('button','','Viesti valituille opiskelijoille'),teachers=make('button','','Viesti opettajille');controls.append(students,teachers);results.append(controls);
const table=make('table'),thead=make('thead'),head=make('tr');['Valitse','Opiskelija','Opintojakso / ryhmä','Opettajat','Viikkoja'].forEach(x=>head.append(make('th','',x)));thead.append(head);table.append(thead);
const body=make('tbody'),selected=new Set(rows.map((_,i)=>i));
rows.forEach((r,i)=>{const tr=make('tr'),cell=make('td'),cb=make('input');cb.type='checkbox';cb.checked=true;cb.setAttribute('aria-label','Valitse opintojaksorivi');cb.onchange=()=>cb.checked?selected.add(i):selected.delete(i);cell.append(cb);tr.append(cell,make('td','',r.person.name),make('td','',r.course));const tcell=make('td');if(!r.teachers.length)tcell.textContent='Opettaja ei ilmene';for(const teacher of r.teachers){const a=make('a','',teacher.name);a.href='/profiles/teachers/'+teacher.id;a.target='_blank';a.rel='noopener';tcell.append(a,document.createTextNode(' '))}tr.append(tcell,make('td','',String(r.weeks.size)+(r.partial?'*':'')));body.append(tr)});
table.append(body);results.append(table,make('p','oh-help','* Ajanjakson ensimmäinen tai viimeinen työjärjestysviikko saattaa sisältää myös rajauksen ulkopuolisia päiviä. Tarkista vastaavuus Wilmassa.'));
const chosen=()=>[...selected].map(i=>rows[i]);students.onclick=()=>compose(chosen().map(r=>r.person),'students');teachers.onclick=()=>compose(chosen().flatMap(r=>r.teachers),'teachers');
}
renderPicked();renderChoices();
})();