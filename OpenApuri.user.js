// ==UserScript==
// @name         OpenApuri
// @namespace    https://github.com/ljrant/OpenApuri
// @version      1.0.16
// @description  OpenApuri: yksi asennus, Wilman työkalut, värikoodatut lisänäkymät ja moduuliasetukset
// @match        https://*.inschool.fi/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuri.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuri.user.js
// ==/UserScript==

(() => {
'use strict';
const embeddedSearch=window.top!==window.self&&new URLSearchParams(location.search).get('oh_embed')==='1'&&/^\/profiles\/students\/?$/.test(location.pathname);
if(window.top!==window.self&&!embeddedSearch)return;
if(window.__openApuriBundleV1)return;
window.__openApuriBundleV1=true;
const currentPath=location.pathname;
const afterDom=callback=>{
 const run=()=>{try{callback()}catch(error){console.error('[OpenApuri] Moduulin käynnistys epäonnistui:',error)}};
 if(document.readyState==='complete'||document.readyState==='interactive')run();
 else document.addEventListener('DOMContentLoaded',run,{once:true});
};
const immediately=callback=>{try{callback()}catch(error){console.error('[OpenApuri] Luonnosmoduulin käynnistys epäonnistui:',error)}};
if(!embeddedSearch&&currentPath.startsWith('/messages/compose')){
 immediately(()=>{(function () {
    'use strict';
// Per-module state controlled by OpenApuri's in-app settings menu.
try {if(JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').draftsChrome===false)return;}catch{}

// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

    // Only activate the intended browser variant, avoiding two simultaneous autosavers.
    const ua = navigator.userAgent;
    if ( /Android|iPhone|iPad|iPod/i.test(ua) || !/Chrome|Chromium/i.test(ua) || /Edg\//i.test(ua)) return;
    if(window.__openApuriChromeDrafts)return;
    window.__openApuriChromeDrafts=true;

    // Drafts are sensitive: stored only on this origin in localStorage; clear after sending.
    const STORAGE_KEY = 'wilma-compose-autosave:' + location.hostname + location.pathname;
    const HISTORY_KEY='openapuri.draftHistory.v1', TEMPLATE_KEY='openapuri.messageTemplates.v1', REQUEST_KEY='openapuri.composeRequest.v1';

    const SEL = {
        subject: 'input#wff-Subject',
        bodyTextarea: 'textarea#wff-BodyText',
        recipientsCell: 'div#messages-recipients-cell',
        recipientsOpen: 'button#recipients-open',
        recipientsSearchInput: 'input#recipients-search-input',
        recipientsSearchResults: 'div#recipients-search-results',

        recipientButtons: [
            'button.recipient-block',
            'button.student-block',
            'button.guardian-block',
            'button.teacher-block',
            'button.personnel-block',
            'button.recipient-block.student-block.margin-right',
            'div#recipients-search-results button.recipient-block',
            'div#recipients-search-results button.student-block',
            'div#recipients-search-results button.guardian-block'
        ].join(','),

        sendButton: 'input[name="addsavebtn"]',
        draftButton: 'input[name="draftbtn"]',
        cancelButton: 'input[name="cancelbtn"]'
    };

    let initialized = false;
    let saveTimer = null;
    let lastSavedJson = '';

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function ensureUi() {
        if (!document.documentElement) return;

        if (!$('#wilma-as-style')) {
            const style = document.createElement('style');
            style.id = 'wilma-as-style';
            style.textContent = `
                #wilma-as-indicator {
                    position: fixed !important;
                    left: auto !important;
                    right: 14px !important;
                    top: 14px !important;
                    max-width: min(420px, calc(100vw - 28px)) !important;
                    z-index: 2147483647 !important;
                    background: #7a4b00 !important;
                    color: #fff !important;
                    padding: 8px 10px !important;
                    border-radius: 8px !important;
                    font: 13px/1.3 sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                    pointer-events: auto !important;
                }

                #wilma-as-indicator.ok {
                    background: #155724 !important;
                }

                #wilma-as-indicator.error {
                    background: #721c24 !important;
                }

                #wilma-as-panel {
                    position: fixed !important;
                    left: auto !important;
                    right: 14px !important;
                    bottom: 14px !important;
                    width: min(440px, calc(100vw - 28px)) !important;
                    z-index: 2147483646 !important;
                    background: rgba(0,0,0,.88) !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 8px !important;
                    font: 13px sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                }

                #wilma-as-panel button {
                    font-size: 13px !important;
                    margin: 3px !important;
                    padding: 6px 8px !important;
                }
            `;
            document.documentElement.appendChild(style);
        }

        if (!$('#wilma-as-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'wilma-as-indicator';
            indicator.textContent = 'Wilma Autosaver: script injected, waiting...';
            document.documentElement.appendChild(indicator);
        }
    }

    function setIndicator(text, state) {
        ensureUi();

        const el = $('#wilma-as-indicator');
        if (!el) return;

        el.classList.remove('ok', 'error');
        if (state) el.classList.add(state);

        el.textContent = text;
        el.style.display='none';
    }

    function createPanel() {
        ensureUi();

        if ($('#wilma-as-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wilma-as-panel';
        panel.innerHTML = `
            <div><strong>Wilma Autosaver</strong></div>
            <div id="wilma-as-info">No saved draft checked yet.</div>
            <button type="button" id="wilma-as-save">Save now</button>
            <button type="button" id="wilma-as-restore">Restore</button>
            <button type="button" id="wilma-as-refresh-recipients">Refresh recipients</button>
            <button type="button" id="wilma-as-clear">Clear</button>
            <button type="button" id="wilma-as-hide">Hide</button>
        `;

        document.documentElement.appendChild(panel);

        $('#wilma-as-save').addEventListener('click', () => saveDraft('manual'));

        $('#wilma-as-restore').addEventListener('click', async () => {
            await restoreSavedDraft(true);
        });

        $('#wilma-as-refresh-recipients').addEventListener('click', async () => {
            const draft = loadDraft();

            if (!draft || !draft.recipients) {
                setIndicator('Wilma Autosaver: no saved recipients to refresh', 'error');
                return;
            }

            await restoreRecipients(draft.recipients);
        });

        $('#wilma-as-clear').addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            lastSavedJson = '';
            setIndicator('Wilma Autosaver: saved draft cleared', 'ok');
            updateInfo();
        });

        $('#wilma-as-hide').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        panel.style.display = 'none';
        updateInfo();
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return tmp.textContent || tmp.innerText || '';
    }

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function dispatchBasicEvents(el) {
        if (!el) return;

        ['input', 'change', 'click', 'keyup', 'keydown', 'blur', 'focusout'].forEach(type => {
            try {
                el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
            } catch (err) {
                console.warn('[Wilma Autosaver] Event failed:', type, err);
            }
        });
    }

    function getCkeditorInstance() {
        try {
            if (!window.CKEDITOR || !window.CKEDITOR.instances) return null;

            if (window.CKEDITOR.instances['wff-BodyText']) {
                return window.CKEDITOR.instances['wff-BodyText'];
            }

            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            return Object.values(window.CKEDITOR.instances).find(instance => {
                return instance.element && instance.element.$ === textarea;
            }) || null;
        } catch (err) {
            return null;
        }
    }

    function getCkeditorIframeDocument() {
        try {
            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            const wrapper =
                $('#cke_wff-BodyText') ||
                textarea.closest('.form-group')?.querySelector('.cke');

            const iframe =
                wrapper?.querySelector('iframe') ||
                $('iframe.cke_wysiwyg_frame');

            if (!iframe) return null;

            return iframe.contentDocument || iframe.contentWindow.document;
        } catch (err) {
            return null;
        }
    }

    function getBodyHtml() {
        const editor = getCkeditorInstance();

        if (editor && typeof editor.getData === 'function') {
            const html = editor.getData() || '';
            if (html.trim()) return html;
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body) {
            const html = iframeDoc.body.innerHTML || '';
            if (html.trim()) return html;
        }

        const textarea = $(SEL.bodyTextarea);
        return textarea ? textarea.value || '' : '';
    }

    function setBodyHtml(html) {
      const raw=String(html||'');
      const value=/<[a-z][\s\S]*>/i.test(raw)?raw:raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');
      const textarea=$(SEL.bodyTextarea);
      const token=Symbol('openapuri-editor-write');
      setBodyHtml.pending=token;
      let tries=0;
      const attempt=()=>{
        if(setBodyHtml.pending!==token)return true;
        const editor=getCkeditorInstance();
        if(!editor||editor.status!=='ready'||typeof editor.setData!=='function')return false;
        try{
          // CKEditor 4 setData is asynchronous. Never mutate its iframe or source
          // textarea while setData runs: both can break the editor's editable state.
          editor.setData(value,{
            callback:function(){
              if(setBodyHtml.pending!==token)return;
              try{
                editor.updateElement();
                editor.fire('change');
                const actual=editor.getData();
                if(!actual.trim()&&value.trim())console.warn('[OpenApuri] Editor returned empty content after setData');
              }catch(e){console.warn('[OpenApuri] CKEditor post-load check:',e)}
              setBodyHtml.pending=null;
            },
            noSnapshot:false
          });
          return true;
        }catch(e){console.warn('[OpenApuri] CKEditor setData:',e);return false}
      };
      if(attempt())return;
      const wait=setInterval(()=>{
        if(setBodyHtml.pending!==token||attempt()){clearInterval(wait);return}
        if(++tries>=60){
          clearInterval(wait);
          const instance=getCkeditorInstance();
          console.warn('[OpenApuri] Editor diagnostic:',{hasCKEditor:!!window.CKEDITOR,instanceNames:Object.keys(window.CKEDITOR?.instances||{}),status:instance?.status||'missing',hasSetData:typeof instance?.setData==='function'});
          alert('Viestitekstin lataus epäonnistui. Avaa konsoli ja lähetä OpenApuri Editor diagnostic -tulos.');
        }
      },250);
    }

    function getRecipientButtonSignature(button) {
        return {
            text: normalizeText(button.innerText || button.textContent || ''),
            title: normalizeText(button.getAttribute('title') || ''),
            ariaLabel: normalizeText(button.getAttribute('aria-label') || ''),
            value: normalizeText(button.value || ''),
            name: normalizeText(button.getAttribute('name') || ''),
            className: normalizeText(button.className || '')
        };
    }

    function getRecipientsSnapshot() {
        const cell = $(SEL.recipientsCell);

        if (!cell) {
            return {
                html: '',
                text: '',
                inputs: [],
                visualItems: []
            };
        }

        const inputs = $all('input[type="hidden"]', cell).map(input => ({
            name: input.name || '',
            value: input.value || '',
            title: input.getAttribute('title') || ''
        }));

        const visualItems = $all('.recipient-item, span, button, input[type="hidden"]', cell).map(el => ({
            tag: el.tagName || '',
            text: (el.innerText || el.textContent || '').trim(),
            title: el.getAttribute('title') || '',
            name: el.getAttribute('name') || '',
            value: el.value || '',
            className: el.className || ''
        })).filter(item => {
            return item.text || item.title || item.name || item.value;
        });

        return {
            html: cell.innerHTML || '',
            text: (cell.innerText || cell.textContent || '').trim(),
            inputs,
            visualItems
        };
    }

    function recipientSnapshotTokens(snapshot) {
        const tokens = new Set();

        function add(value) {
            const normalized = normalizeText(value);
            if (normalized) tokens.add(normalized);
        }

        (snapshot.inputs || []).forEach(input => {
            add(input.name);
            add(input.value);
            add(input.title);
        });

        (snapshot.visualItems || []).forEach(item => {
            add(item.text);
            add(item.title);
            add(item.name);
            add(item.value);
        });

        add(snapshot.text);

        return tokens;
    }

    function buttonMatchesRecipientSnapshot(button, snapshot) {
        const tokens = recipientSnapshotTokens(snapshot);
        const sig = getRecipientButtonSignature(button);

        const haystack = [
            sig.text,
            sig.title,
            sig.ariaLabel,
            sig.value,
            sig.name,
            sig.className
        ].filter(Boolean);

        for (const h of haystack) {
            if (tokens.has(h)) return true;

            for (const t of tokens) {
                if (!t) continue;

                /*
                  Avoid matching overly generic values such as "r_student",
                  "student-block", "kaikki", etc.
                */
                if (t.length < 5) continue;
                if (['r_student', 'r_guardian', 'r_teacher', 'kaikki'].includes(t)) continue;

                if (h.includes(t) || t.includes(h)) {
                    return true;
                }
            }
        }

        return false;
    }

    async function openRecipientsPanel() {
        const openButton = $(SEL.recipientsOpen);

        if (!openButton) {
            setIndicator('Wilma Autosaver: recipients-open button not found', 'error');
            return false;
        }

        openButton.click();
        await sleep(900);
        return true;
    }

    function clickVisibleMatchingRecipientButtons(snapshot) {
        const buttons = $all(SEL.recipientButtons);
        let clicked = 0;

        for (const button of buttons) {
            if (!buttonMatchesRecipientSnapshot(button, snapshot)) continue;

            const beforeClass = button.className || '';

            try {
                button.click();
                clicked += 1;
                dispatchBasicEvents(button);

                console.log('[Wilma Autosaver] clicked matching recipient button', {
                    text: button.innerText || button.textContent || '',
                    title: button.getAttribute('title') || '',
                    beforeClass,
                    afterClass: button.className || ''
                });
            } catch (err) {
                console.warn('[Wilma Autosaver] could not click recipient button:', err);
            }
        }

        return clicked;
    }

    function getSearchTermsFromSnapshot(snapshot) {
        const terms = [];

        function addTerm(value) {
            const v = String(value || '').replace(/\s+/g, ' ').trim();
            if (!v) return;

            /*
              Skip technical values that are unlikely to work in the visible search box.
            */
            if (v.includes('=')) return;
            if (v.startsWith('r_')) return;
            if (v.length < 3) return;

            terms.push(v);
        }

        addTerm(snapshot.text);

        (snapshot.visualItems || []).forEach(item => {
            addTerm(item.text);
            addTerm(item.title);
        });

        /*
          Deduplicate and keep only a few. On strict privacy captures, visible
          names may not be available. In that case this list may be empty.
        */
        return Array.from(new Set(terms)).slice(0, 5);
    }

    async function searchAndClickRecipients(snapshot) {
        const searchInput = $(SEL.recipientsSearchInput);
        if (!searchInput) return 0;

        const terms = getSearchTermsFromSnapshot(snapshot);
        let totalClicked = 0;

        for (const term of terms) {
            searchInput.value = term;
            dispatchBasicEvents(searchInput);

            /*
              Some Wilma recipient search UIs react better to real-ish keyboard events.
            */
            try {
                searchInput.dispatchEvent(new KeyboardEvent('keyup', {
                    bubbles: true,
                    cancelable: true,
                    key: term.slice(-1) || 'a'
                }));
            } catch (err) {
                // Ignore.
            }

            await sleep(1000);

            const clicked = clickVisibleMatchingRecipientButtons(snapshot);
            totalClicked += clicked;

            if (clicked > 0) {
                await sleep(400);
            }
        }

        return totalClicked;
    }

    async function clickSummaryOrCloseButtons() {
        const buttons = Array.from(document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], a[role="button"]'
        ));

        const preferred = buttons.filter(btn => {
            const text = normalizeText(
                btn.innerText ||
                btn.textContent ||
                btn.value ||
                btn.getAttribute('aria-label') ||
                btn.getAttribute('title') ||
                ''
            );

            return (
                text.includes('vastaanottajien yhteenveto') ||
                text.includes('yhteenveto') ||
                text.includes('valmis') ||
                text.includes('sulje') ||
                text === 'ok'
            );
        });

        let clicked = 0;

        for (const btn of preferred) {
            try {
                btn.click();
                clicked += 1;
                await sleep(250);
            } catch (err) {
                console.warn('[Wilma Autosaver] summary/close click failed:', err);
            }
        }

        return clicked;
    }

    async function restoreRecipients(snapshot) {
        if (!snapshot || (!snapshot.html && !(snapshot.inputs || []).length)) {
            setIndicator('Wilma Autosaver: no recipient snapshot to restore', 'error');
            return false;
        }

        await openRecipientsPanel();

        /*
          Step 1: try the proper Wilma route first — click matching visible recipient buttons.
          This is what should update Wilma's own visual/React state.
        */
        let clicked = clickVisibleMatchingRecipientButtons(snapshot);

        /*
          Step 2: if nothing matched, try searching by saved visible text/title,
          then click matching search result buttons.
        */
        if (clicked === 0) {
            clicked += await searchAndClickRecipients(snapshot);
        }

        await sleep(500);

        // Recipient selection is best-effort: do not block restoration on Wilma's
        // internal hidden-field representation or demand a second confirmation.
        updateInfo();
        return clicked>0;
    }

    function collectDraft() {
        const subject = $(SEL.subject);
        const bodyHtml = getBodyHtml();
        const recipients = getRecipientsSnapshot();
        const recipientQuery=[...new URLSearchParams(location.search)]
          .filter(([k,v])=>['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(k)&&/^\d+$/.test(v))
          .map(([k,v])=>k+'='+v);
        // Preserve independently verifiable recipient ids in Wilma's own
        // hidden fields, even if Wilma has removed the URL query.
        for(const field of recipients.inputs||[]){
          const key=String(field.name||'');
          const value=String(field.value||'');
          if(['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(key)&&/^\d+$/.test(value)){
            recipientQuery.push(key+'='+value);
          }
          if(/^r_(?:student|teacher|personnel|guardian|class|classguardian)=\d+$/.test(value)){
            recipientQuery.push(value);
          }
        }
        const normalizedRecipientQuery=[...new Set(recipientQuery)];
        // When Wilma strips query arguments after selection, infer only uniquely
        // identified whole-class chips; never infer individual people.
        if(!normalizedRecipientQuery.length){
          const labels=new Set([...(recipients.visualItems||[])].flatMap(x=>[x.title,x.text]).map(x=>String(x||'').trim()).filter(Boolean));
          for(const disclosure of document.querySelectorAll('a.disclosure[href^="#collapse-school-classes-"]')){
            const id=(disclosure.getAttribute('href')||'').match(/^#collapse-school-classes-(\d+)-/);
            const name=disclosure.textContent.trim();
            if(!id||!name)continue;
            if(labels.has(name))normalizedRecipientQuery.push('r_class='+id[1]);
            if(labels.has(name+':n huoltajat'))normalizedRecipientQuery.push('r_classguardian='+id[1]);
          }
        }

        return {
            version: 5,
            savedAt: new Date().toISOString(),
            url: location.href,
            subject: subject ? subject.value || '' : '',
            bodyHtml,
            recipients,
            recipientQuery:normalizedRecipientQuery.map(x=>x.replace(/^[?&]/,''))
        };
    }

    function isMeaningfulDraft(draft) {
        return Boolean(
            (draft.subject || '').trim() ||
            stripHtml(draft.bodyHtml || '').trim() ||
            draft.recipients?.text ||
            draft.recipients?.inputs?.length ||
            draft.recipients?.visualItems?.length
        );
    }

    function safeRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
    function safeReadSession(key,fallback){try{return JSON.parse(sessionStorage.getItem(key)||'null')||fallback}catch{return fallback}}
    function listHistory(){return safeRead(HISTORY_KEY,[]).filter(x=>x&&typeof x.subject==='string').slice(0,35)}
    function historySave(draft){
      const history=listHistory();
      const stamp=Date.now();
      const signature=JSON.stringify([draft.subject,draft.bodyHtml,draft.recipientQuery,draft.recipients?.inputs,draft.recipients?.text]);
      const newest=history[0];
      if(newest&&newest.signature===signature)return;
      // Keep one current entry for the active message and retain older message
      // subjects as separate entries; previous draft versions remain in the
      // main autosave slot until explicitly replaced.
      const key=String(draft.subject||'').trim().toLocaleLowerCase('fi')||'(nimetön)';
      const rest=history.filter(x=>(String(x.subject||'').trim().toLocaleLowerCase('fi')||'(nimetön)')!==key);
      rest.unshift({id:stamp,time:stamp,signature,subject:draft.subject,bodyHtml:draft.bodyHtml,recipients:draft.recipients,recipientQuery:draft.recipientQuery||[]});
      localStorage.setItem(HISTORY_KEY,JSON.stringify(rest.slice(0,35)));
      window.dispatchEvent(new Event('openapuri:drafts-changed'));
    }
    // WMT/TXT v1: shareable templates only. No snapshots or draft history exported.
    function parseOpt(v){return v==='true'?true:v==='false'?false:null}
    function sanitizeTemplateHtml(input){const box=document.createElement('div');box.innerHTML=String(input||'');box.querySelectorAll('script,iframe,object,embed,form,meta,base,link').forEach(x=>x.remove());box.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes])if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*(?:javascript|data):/i.test(a.value)))el.removeAttribute(a.name)});return box.innerHTML}
    const templateCats=t=>Array.isArray(t.categories)&&t.categories.length?t.categories:(t.category||'Yleinen').split(';').map(x=>x.trim()).filter(Boolean);
    function exportWmt(items){
      const clean=x=>String(x||'').replace(/\r/g,'').replace(/\n/g,' ');
      return '# OpenApuri Templates v1\n\n'+items.map(t=>{
        const fields=[['id',t.id||''],['nimi',t.title],['kategoria',templateCats(t).join('; ')],['vastaanottajat',t.recipientRule||'ei_valintaa'],['aihe',t.subject||''],['viestityyppi',t.messageMode||'group'],['ryhmat',(t.recipientGroups||[]).join('; ')],['henkilot',(t.recipientIndividuals||[]).join('; ')],['sisalto_html',t.bodyHtml?encodeURIComponent(t.bodyHtml):''],['nayta_vastaanottajien_nimet',t.options?.showRecipients===true?'true':t.options?.showRecipients===false?'false':''],['nayta_vastaukset',t.options?.collatedReplies===true?'true':t.options?.collatedReplies===false?'false':''],['tekstiviesti',t.options?.sms===true?'true':t.options?.sms===false?'false':''],['sahkoposti',t.options?.email===true?'true':t.options?.email===false?'false':''],['ajastus',t.options?.scheduled===true?'true':t.options?.scheduled===false?'false':''],['lahetyspaiva',t.options?.sendDate||''],['lahetysaika',t.options?.sendTime||'']];
        return '[POHJA]\n'+fields.map(([k,v])=>k+': '+clean(v)).join('\n')+'\n\n'+String(t.body||'').replace(/\r/g,'').replace(/^\[\/POHJA\]$/gm,'[ /POHJA ]')+'\n[/POHJA]';
      }).join('\n\n')+'\n';
    }
    function importWmt(content){
      const raw=String(content||'').replace(/\r\n?/g,'\n');
      if(!raw.startsWith('# OpenApuri Templates v1'))throw Error('Tuntematon tiedostomuoto');
      const blocks=[...raw.matchAll(/^\[POHJA\]\n([\s\S]*?)^\[\/POHJA\]\s*$/gm)];
      if(!blocks.length)throw Error('Viestipohjia ei löytynyt');
      if(blocks.length>150)throw Error('Liian monta pohjaa');
      return blocks.map((block,index)=>{
        const divider=block[1].indexOf('\n\n');if(divider<0)throw Error('Pohjan sisältö puuttuu: '+(index+1));
        const meta={};
        for(const line of block[1].slice(0,divider).split('\n')){
          const m=line.match(/^([a-z_]+):\s*(.*)$/);if(!m)throw Error('Virheellinen otsake: '+line);
          meta[m[1]]=m[2];
        }
        if(!meta.nimi)throw Error('Pohjan nimi puuttuu');
        return {id:meta.id||'',title:meta.nimi,category:(meta.kategoria||'Yleinen').split(';')[0].trim(),categories:(meta.kategoria||'Yleinen').split(';').map(x=>x.trim()).filter(Boolean),bodyHtml:meta.sisalto_html?decodeURIComponent(meta.sisalto_html):'',recipientRule:meta.vastaanottajat||'ei_valintaa',messageMode:meta.viestityyppi==='single'?'single':'group',recipientGroups:(meta.ryhmat||'').split(';').map(x=>x.trim()).filter(Boolean),recipientIndividuals:(meta.henkilot||'').split(';').map(x=>x.trim()).filter(Boolean),options:{showRecipients:parseOpt(meta.nayta_vastaanottajien_nimet),collatedReplies:parseOpt(meta.nayta_vastaukset),sms:parseOpt(meta.tekstiviesti),email:parseOpt(meta.sahkoposti),scheduled:parseOpt(meta.ajastus),sendDate:meta.lahetyspaiva||'',sendTime:meta.lahetysaika||''},subject:meta.aihe||'',body:block[1].slice(divider+2).replace(/\n$/,'')};
      });
    }
    function exportFile(items){
      if(!items.length){alert('Valitse vähintään yksi viestipohja.');return}
      const blob=new Blob([exportWmt(items)],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=items.length===1?'openapuri-'+String(items[0].id||items[0].title||'pohja').toLowerCase().replace(/[^a-z0-9äöå-]+/g,'-').slice(0,50)+'.wmt.txt':'openapuri-viestipohjat.wmt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    }
    function expandTemplate(source,values){
      return String(source||'').replace(/\{([a-z_]+(?::[a-z0-9_-]+)?)\}/gi,(match,key)=>{
        if(Object.prototype.hasOwnProperty.call(values,key))return values[key];
        const answer=prompt('Täydennä muuttuja '+match,'');
        if(answer===null)throw Error('Käyttö peruttu');
        values[key]=answer;return answer;
      });
    }
    async function selectClassRecipients(classId,type){
      if(!/^\d+$/.test(String(classId)))return {ok:false,missing:['luokan tunniste']};
      await openRecipientsPanel();
      const findPanel=()=>[...document.querySelectorAll('[id^="collapse-school-classes-"]')].find(el=>new RegExp('^collapse-school-classes-'+classId+'-').test(el.id));
      const panel=findPanel();
      if(!panel)return {ok:false,missing:['luokan vastaanottajapaneeli']};
      const disclosure=document.querySelector('a.disclosure[href="#'+panel.id+'"]');
      if(disclosure&&(disclosure.classList.contains('collapsed')||!panel.classList.contains('in')))disclosure.click();
      await sleep(300);
      const kinds=type==='both'?['Opiskelijat','Huoltajat']:type==='guardians'?['Huoltajat']:['Opiskelijat'];
      const missing=[];
      for(const kind of kinds){
        const buttons=[...panel.querySelectorAll('button.recipient-block')].filter(b=>b.textContent.trim()===kind&&!b.disabled&&!b.classList.contains('disabled'));
        if(buttons.length!==1){missing.push(kind);continue}
        const button=buttons[0];
        if(button.getAttribute('aria-pressed')!=='true'&&!button.classList.contains('active')){button.click();await sleep(250)}
        if(button.getAttribute('aria-pressed')!=='true'&&!button.classList.contains('active'))missing.push(kind);
      }
      return {ok:missing.length===0,missing};
    }
    async function selectRecipientsByNames(names){
      const targets=[...new Set((names||[]).map(x=>String(x).trim()).filter(Boolean))];
      if(!targets.length)return {selected:[],missing:[]};
      await openRecipientsPanel();
      const selected=[],missing=[];
      for(const name of targets){
        const search=$(SEL.recipientsSearchInput);
        if(!search){missing.push(name);continue}
        search.value=name;dispatchBasicEvents(search);
        await sleep(700);
        const normalize=x=>normalizeText(x||'');
        const exact=normalize(name);
        const candidates=$all(SEL.recipientButtons,document).filter(b=>{
          if(!b.getClientRects().length||b.closest('#wt-message-library'))return false;
          const sig=getRecipientButtonSignature(b);
          return [sig.text,sig.title,sig.ariaLabel].some(x=>normalize(x)===exact);
        });
        if(candidates.length!==1){missing.push(name);continue}
        candidates[0].click();await sleep(240);selected.push(name);
      }
      await clickSummaryOrCloseButtons();
      const snapshot=getRecipientsSnapshot(),visible=normalizeText(snapshot.text||'');
      return {selected:selected.filter(x=>visible.includes(normalizeText(x))),missing:[...new Set([...missing,...selected.filter(x=>!visible.includes(normalizeText(x)))])]};
    }
    async function selectTeachersFromProfiles(teachers){
      // Timetable teacher labels are sometimes short abbreviations; use their
      // stable profile IDs if Wilma exposes these IDs on the actual picker.
      const targets=[...new Map((teachers||[]).filter(t=>/^\d+$/.test(String(t?.id||''))).map(t=>[String(t.id),t])).values()];
      if(!targets.length)return {ok:false,missing:['Opettajien profiilitunnisteet puuttuvat']};
      if(!await openRecipientsPanel())return {ok:false,missing:['Wilman vastaanottajavalitsinta ei voitu avata']};
      const missing=[];
      for(const teacher of targets){
        const id=String(teacher.id),name=String(teacher.name||'').trim();
        const search=$(SEL.recipientsSearchInput);
        if(search){
          // Use a real input event to notify Wilma's reactive search logic.
          const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
          if(setter)setter.call(search,name.length>=5?name:id);
          else search.value=name.length>=5?name:id;
          search.dispatchEvent(new Event('input',{bubbles:true}));
          search.dispatchEvent(new Event('change',{bubbles:true}));
          await sleep(850);
        }
        const buttons=$all(SEL.recipientButtons).filter(b=>b.getClientRects().length&&!b.closest('#wt-message-library')&&
          (b.matches('.teacher-block,.personnel-block')||b.closest('#recipients-search-results')));
        const matches=buttons.filter(b=>{
          // Never use numeric substring matching: only a whole teacher ID
          // in a recipient-specific attribute or a teacher profile link.
          const attrs=['data-recipient-id','data-teacher-id','data-person-id','data-id','value'];
          const byId=attrs.some(k=>{
            const v=b.getAttribute(k)||'';
            return v===id||v==='r_teacher_'+id||v==='r_teacher-'+id;
          });
          const link=b.querySelector('a[href*="/profiles/teachers/"]');
          const byLink=link&&new RegExp('/profiles/teachers/'+id+'(?:/|$)').test(link.getAttribute('href')||'');
          if(byId||byLink)return true;
          const sig=getRecipientButtonSignature(b);
          const fullName=normalizeText(name);
          return name.length>=5&&[sig.text,sig.title,sig.ariaLabel].some(v=>v===fullName);
        });
        if(matches.length!==1){missing.push(name||'Opettaja '+id);continue}
        matches[0].click();
        await sleep(250);
      }
      if(!missing.length)await clickSummaryOrCloseButtons();
      // Selection happens through Wilma controls, not by injecting fields.
      const snapshot=getRecipientsSnapshot();
      if(!snapshot.text&&!snapshot.inputs.length){
        return {ok:false,missing:targets.map(t=>t.name||'Opettaja '+t.id)};
      }
      return {ok:missing.length===0,missing};
    }
    function getTemplates(){return safeRead(TEMPLATE_KEY,[]).filter(x=>x&&typeof x.title==='string').slice(0,150)}
    async function selectTemplateGroups(item){
      const groups=item.recipientGroups||[],missing=[];
      for(const group of groups){
        const matches=[...document.querySelectorAll('a.disclosure[href^="#collapse-school-classes-"]')].filter(a=>a.textContent.trim()===group);
        if(matches.length!==1){missing.push(group);continue}
        const id=(matches[0].getAttribute('href')||'').match(/^#collapse-school-classes-(\d+)-/);
        if(!id){missing.push(group);continue}
        const kind=item.recipientRule==='valittujen_huoltajat'?'guardians':item.recipientRule==='valitut_opiskelijat_ja_huoltajat'?'both':'students';
        const result=await selectClassRecipients(id[1],kind);
        if(!result.ok)missing.push(group+' ('+result.missing.join(', ')+')');
      }
      const persons=item.recipientIndividuals||[];
      if(persons.length){const res=await selectRecipientsByNames(persons);missing.push(...res.missing)}
      return {ok:missing.length===0,missing};
    }
    function applyMessageOptions(options){
      if(!options)return;
      const flags=[['showRecipients','wff-ShowRecipients'],['collatedReplies','wff-CollatedReplies'],['sms','wff-AlwaysSMS'],['email','wff-AlwaysEMail'],['scheduled','wff-TimedSend']];
      for(const [key,id] of flags){const input=document.getElementById(id);const desired=options[key];if(!input||input.disabled||typeof desired!=='boolean')continue;if(input.checked!==desired)input.click()}
      if(options.scheduled!==true)return;
      for(const [key,id] of [['sendDate','wff-SendDate'],['sendTime','wff-SendTime']]){
        const input=document.getElementById(id);if(!input||input.disabled||!options[key])continue;
        input.value=options[key];dispatchBasicEvents(input);
      }
    }
    function useTemplate(item){
      const vals={paivamaara:new Date().toLocaleDateString('fi-FI')};
      if(item.messageMode==='group'&&/\{(?:etunimi|opiskelijan_nimi|huoltajan_nimi)\}/i.test((item.subject||'')+' '+(item.body||''))){alert('Ryhmäviesti sisältää yksittäisen vastaanottajan muuttujia. Valitse henkilökohtainen viesti tai muokkaa pohjaa.');return}
      try{
        const subject=expandTemplate(item.subject||'',vals),body=expandTemplate(item.body||'',vals);
        applySaved({subject,bodyHtml:item.bodyHtml?expandTemplate(sanitizeTemplateHtml(item.bodyHtml),vals):body},false);
        applyMessageOptions(item.options);
        if(item.recipientRule==='yhdistelma'&&((item.recipientGroups||[]).length||(item.recipientIndividuals||[]).length)){
          selectTemplateGroups(item).then(result=>{
            const missing=result.missing;
            // No separate confirmation gate: Wilma recipient controls remain the source of truth.
            if(missing.length)console.warn('[OpenApuri] Ryhmän vastaanottajavalinta jäi kesken:',missing);
          }).catch(()=>alert('Tarkista ryhmä- ja henkilövastaanottajat Wilmassa.'));
        }else if(item.recipients){restoreRecipients(item.recipients).catch(err=>console.warn('[OpenApuri] Pohjan vastaanottajat:',err))}
      }catch(err){if(err.message!=='Käyttö peruttu')alert(err.message)}
    }
    const NATIVE_RECIPIENT_PARAMS=new Set(['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian']);
    function draftRecipientParams(item){
      const params=new URLSearchParams();
      for(const raw of item?.recipientQuery||[]){
        const [key,value]=String(raw).split('=');
        if(NATIVE_RECIPIENT_PARAMS.has(key)&&/^\d+$/.test(value||''))params.append(key,value);
      }
      return params;
    }
    function switchToDraft(draft){
      if(!draft)return;
      // A new compose document is essential: Wilma's recipient picker does not
      // expose a reliable clear-all operation. Never leave prior draft recipients.
      const params=draftRecipientParams(draft);
      const target='/messages/compose'+([...params].length?'?'+params.toString():'');
      localStorage.setItem('openapuri.draftRestore.v1',JSON.stringify({
        subject:String(draft.subject||''),
        bodyHtml:String(draft.bodyHtml||draft.body||''),
        recipients:[...params].length?null:(draft.recipients||null),
        createdAt:Date.now(),
        replaceRecipients:true
      }));
      // Pause autosave of the outgoing draft while navigating.
      if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
      location.assign(target);
    }
    function applySaved(item,withRecipients){
      if(!item)return;
      // Templates and drafts both use the same editor setter.
      const field=$(SEL.subject);
      if(field){field.value=item.subject||'';field.dispatchEvent(new Event('input',{bubbles:true}));}
      setBodyHtml(item.bodyHtml||item.body||'');
      if(!withRecipients)return;
      if(Array.isArray(item.recipientQuery)&&item.recipientQuery.length){
        const params=new URLSearchParams();
        for(const pair of item.recipientQuery){const [k,v]=pair.split('=');if(['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(k)&&/^\d+$/.test(v||''))params.append(k,v)}
        if([...params].length){
          // Preserve exact native Wilma recipient parameters, including multiples.
          // Do not reload endlessly if this compose page already has those recipients.
          const current=new URLSearchParams(location.search);
          const currentValues=[...current].filter(([k,v])=>['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(k)&&/^\d+$/.test(v));
          const wanted=[...params];
          if(JSON.stringify(currentValues.sort())===JSON.stringify(wanted.sort()))return;
          // Carry the content over the navigation so Wilma can add recipients natively.
          localStorage.setItem('openapuri.draftRestore.v1',JSON.stringify({subject:item.subject||'',bodyHtml:item.bodyHtml||item.body||'',createdAt:Date.now()}));
          location.assign('/messages/compose?'+params.toString());return;
        }
      }
      if(item.recipients)restoreRecipients(item.recipients).catch(err=>console.warn('[OpenApuri] Vastaanottajien palautus:',err));
    }
    function library(){
      const existing=document.getElementById('wt-message-library');if(existing){existing.hidden=false;existing.scrollIntoView({block:'nearest'});return}
      const aside=document.createElement('section');aside.id='wt-message-library';aside.setAttribute('aria-label','Viestikirjasto');
      aside.style.cssText='position:relative;flex:1 1 340px;min-width:280px;max-width:640px;background:var(--oa-surface,#f5fbf8);color:var(--oa-text,#173c48);border:1px solid var(--oa-border,#9cd7c5);border-radius:6px;padding:16px;max-height:78vh;overflow:auto;font:14px/1.45 system-ui;box-sizing:border-box';
      const messagePeeker=document.createElement('button');messagePeeker.type='button';messagePeeker.className='oa-message-peeker';messagePeeker.title='OpenApuri · Viestiasetukset';messagePeeker.setAttribute('aria-label','Avaa viestityökalujen asetukset');messagePeeker.style.cssText='position:absolute;right:14px;top:-20px;width:44px;height:46px;border:0;background:transparent;padding:0;cursor:pointer;z-index:40';const messagePeekerImage=document.createElement('img');messagePeekerImage.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';messagePeekerImage.alt='';messagePeekerImage.style.cssText='width:44px;height:46px;object-fit:contain;pointer-events:none';messagePeeker.append(messagePeekerImage);messagePeeker.onclick=event=>{event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'draftsChrome'}}))};const messageHeader=document.createElement('header');messageHeader.className='oa-message-header';messageHeader.textContent='OpenApuri · Viestityökalut';messageHeader.append(messagePeeker);aside.append(messageHeader);
      const form=$(SEL.subject)?.closest('form');
      // NEVER reparent Wilma's form: CKEditor iframe loses its document/selection
      // when the form is detached and reinserted after editor initialization.
      if(form&&form.parentElement){
        const parent=form.parentElement;
        aside.style.cssText+=';min-width:0;width:100%;max-width:none;';
        parent.insertBefore(aside,form.nextSibling);
        const scope='wt-compose-grid-'+Math.random().toString(36).slice(2);
        parent.classList.add(scope);
        const style=document.createElement('style');
        style.textContent='.'+scope+'{display:grid!important;grid-template-columns:minmax(0,1.3fr) minmax(310px,1fr);column-gap:12px;align-items:start}.'+scope+' > :not(form):not(#wt-message-library){grid-column:1/-1}.'+scope+' > form{grid-column:1;min-width:0;width:100%}.'+scope+' > #wt-message-library{grid-column:2;grid-row:auto;min-width:0} @media(max-width:850px){.'+scope+'{grid-template-columns:minmax(0,1fr)!important}.'+scope+' > form,.'+scope+' > #wt-message-library{grid-column:1!important}}';
        document.head.append(style);
        const duplicate=document.getElementById('wt-message-toolbar');if(duplicate)duplicate.remove();
      }else document.querySelector('main#main-content')?.prepend(aside);
      let tab=location.hash==='#wt-library'?'drafts':'templates',category='Kaikki',edit=-1,recipientStatus='',exportSelected=new Set(),pendingTemplate=null;
      const navigation=document.createElement('nav');navigation.setAttribute('aria-label','OpenApuri');navigation.id='wt-library-tabs';
      for(const [key,name] of [['templates','Viestipohjat'],['drafts','Tallennetut luonnokset']]){
        const control=document.createElement('button');control.type='button';control.textContent=name;control.dataset.tab=key;
        control.onclick=()=>{tab=key;aside.hidden=false;draw()};
        navigation.append(control);
      }
      navigation.style.cssText='display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #ccc;padding:0 0 8px;margin-bottom:8px';
      const refreshNavigation=()=>navigation.querySelectorAll('button').forEach(x=>{x.setAttribute('aria-selected',String(x.dataset.tab===tab));x.style.cssText='border:0;background:transparent;padding:6px;color:#245675;cursor:pointer;border-bottom:2px solid '+(x.dataset.tab===tab?'var(--oa-primary,#147c6e)':'transparent')});

      const sent=safeRead('openapuri.sentTemplateImport.v1',null);
      if(sent&&Number.isFinite(sent.createdAt)&&Date.now()-sent.createdAt<15*60*1000){
        pendingTemplate={title:String(sent.subject||'Vanhasta viestistä').slice(0,120),subject:String(sent.subject||''),body:String(sent.body||''),bodyHtml:String(sent.bodyHtml||''),category:'Yleinen',recipientRule:'ei_valintaa',messageMode:'group',recipients:null};
        localStorage.removeItem('openapuri.sentTemplateImport.v1');
        tab='templates';
      }
      window.addEventListener('openapuri:library-tab',event=>{tab=event.detail==='drafts'?'drafts':'templates';edit=-1;draw()});
      window.addEventListener('openapuri:compose-to-template',()=>{const current=collectDraft();pendingTemplate={title:String(current.subject||'Uusi viestipohja'),subject:current.subject||'',body:current.bodyHtml||current.body||'',category:'Yleinen',recipientRule:'ei_valintaa',messageMode:'group',recipients:null};edit=-1;tab='templates';aside.hidden=false;editor()});
      const b=(name,fn)=>{const x=document.createElement('button');x.type='button';x.textContent=name;x.onclick=fn;x.style.cssText='border:1px solid #b9cbd9;background:#eff6fb;border-radius:6px;padding:7px;margin:4px;color:#234968;cursor:pointer;font:inherit';return x};
      const label=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
      function draw(){
       aside.replaceChildren();aside.append(navigation);refreshNavigation();const header=label('h2','Viestikirjasto');header.style.margin='0 0 10px';aside.append(header);
       if(tab==='drafts'){
        const seenSubjects=new Set();
        const drafts=listHistory().filter(item=>{const key=String(item.subject||'').trim().toLocaleLowerCase('fi')||'(nimetön)';if(seenSubjects.has(key))return false;seenSubjects.add(key);return true});
        const latest=loadDraft();
        if(latest&&!drafts.some(x=>x.subject===latest.subject))drafts.unshift({...latest,time:latest.savedAt||new Date().toISOString(),_latest:true});
        const heading=label('label','Valitse luonnos');heading.style.cssText='display:block;font-weight:600;margin:12px 0 4px';
        const select=document.createElement('select');select.style.cssText='width:100%;max-width:100%;padding:8px;border:1px solid #b9cbd9;border-radius:5px';
        const placeholder=label('option','Valitse tallenne…');placeholder.value='';select.append(placeholder);
        drafts.forEach((item,i)=>{const date=new Date(item.time||item.savedAt);const when=Number.isNaN(date.getTime())?'':date.toLocaleString('fi-FI');const option=label('option',(item._latest?'Viimeisin automaattitallenne':'Luonnos')+' · '+(item.subject||'Nimetön')+' · '+when);option.value=String(i);select.append(option)});
        select.onchange=()=>{if(select.value==='')return;const draft=drafts[Number(select.value)];if(!draft)return;switchToDraft(draft)};
        aside.append(heading,select);
        const count=label('p',drafts.length+' tallennetta. Valinta vaihtaa myös vastaanottajat. Wilma avaa viestin uudelleen, jotta edellisen luonnoksen vastaanottajat eivät jää valituiksi.');count.style.cssText='font-size:12px;color:#607080;margin:8px 0';aside.append(count);
       }else{
        const data=getTemplates(),cats=['Kaikki',...new Set(data.flatMap(templateCats))].sort((a,b)=>a==='Kaikki'?-1:b==='Kaikki'?1:a.localeCompare(b,'fi'));
        const search=label('input','');search.type='search';search.placeholder='Hae viestipohjia…';search.setAttribute('aria-label','Hae viestipohjia');search.style.cssText='width:100%;padding:8px;margin:6px 0;border:1px solid #b9cbd9;border-radius:5px';
        const categoryChoice=document.createElement('select');categoryChoice.style.cssText='width:100%;padding:8px;margin:5px 0;border:1px solid #b9cbd9;border-radius:5px';
        for(const c of cats){const op=label('option',c);op.value=c;categoryChoice.append(op)}
        categoryChoice.value=cats.includes(category)?category:'Kaikki';
        const templateChoice=document.createElement('select');templateChoice.style.cssText='width:100%;padding:8px;margin:5px 0;border:1px solid #b9cbd9;border-radius:5px';
        const picked=label('div','');picked.style.cssText='font-size:12px;color:#536979;margin:5px 0';
        const tree=()=>{
          category=categoryChoice.value;
          templateChoice.replaceChildren();
          const first=label('option','Valitse viestipohja…');first.value='';templateChoice.append(first);
          const q=search.value.trim().toLocaleLowerCase('fi');
          const groups=category==='Kaikki'?cats.filter(x=>x!=='Kaikki'):[category];
          const shown=new Set();
          for(const group of groups){
            const matches=data.map((t,i)=>({t,i})).filter(({t,i})=>!shown.has(i)&&templateCats(t).includes(group)&&(!q||(t.title+' '+(t.subject||'')+' '+templateCats(t).join(' ')).toLocaleLowerCase('fi').includes(q)));
            if(!matches.length)continue;
            const node=document.createElement('optgroup');node.label=group;
            for(const {t,i} of matches){const op=label('option',t.title);op.value=String(i);node.append(op);shown.add(i)}
            templateChoice.append(node);
          }
          picked.textContent=shown.size+' viestipohjaa';
        };
        search.oninput=tree;categoryChoice.onchange=tree;
        const editSelected=b('Muokkaa valittua',()=>{if(templateChoice.value==='')return;edit=Number(templateChoice.value);editor()});editSelected.disabled=true;
        templateChoice.onchange=()=>{editSelected.disabled=templateChoice.value==='';if(templateChoice.value==='')return;const item=data[Number(templateChoice.value)];if(item)useTemplate(item)};
        aside.append(search,categoryChoice,templateChoice,editSelected,picked);
        tree();
        const manage=label('details','');const caption=label('summary','Viestipohjien hallinta');caption.style.cssText='cursor:pointer;margin:12px 0;color:#315c7a;font-weight:600';manage.append(caption);aside.append(manage);
        manage.append(b('Uusi viestipohja',()=>{edit=-1;editor()}));
        manage.append(b('Vie kaikki .wmt.txt',()=>exportFile(data)));
        manage.append(b('Vie valitut ('+exportSelected.size+')',()=>exportFile(data.filter((x,i)=>exportSelected.has(i)))));
        const upload=document.createElement('input');upload.type='file';upload.accept='.txt,text/plain';upload.style.maxWidth='100%';
        upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;
          try{if(file.size>500000)throw Error('Tiedosto on liian suuri');const incoming=importWmt(await file.text());
            if(!confirm('Tuotavat viestipohjat ('+incoming.length+'):\n'+incoming.map(x=>x.title+' ['+x.category+']').join('\n').slice(0,1300)+'\n\nTuodaanko nämä pohjat?'))return;
            const all=getTemplates();let replaced=0,added=0;
            for(const item of incoming){
              const identity=x=>(x.id&&x.id.trim())?('id:'+x.id.trim()):('name:'+x.title.trim().toLocaleLowerCase('fi')+'|'+(x.category||'Yleinen').trim().toLocaleLowerCase('fi'));
              const key=identity(item),existing=all.findIndex(x=>identity(x)===key);
              if(existing>=0){
                if(confirm('Viestipohja "'+item.title+'" on jo olemassa. Korvataanko vanha versio?')){all[existing]={...item,recipients:null};replaced++}
              }else if(all.length<150){all.push({...item,recipients:null});added++}
            }
            localStorage.setItem(TEMPLATE_KEY,JSON.stringify(all));exportSelected.clear();alert('Tuotu uusia: '+added+'. Päivitetty: '+replaced+'.');draw();
          }catch(err){alert('Tuonti epäonnistui: '+err.message)}
        };manage.append(upload);
        data.forEach((item,i)=>{if(category!=='Kaikki'&&!templateCats(item).includes(category))return;const row=label('div','');row.style.cssText='border-bottom:1px solid #ddd;padding:10px 0';row.append(label('strong',item.title),label('div',templateCats(item).join(', ')));const tick=document.createElement('input');tick.type='checkbox';tick.checked=exportSelected.has(i);tick.onchange=()=>{if(tick.checked)exportSelected.add(i);else exportSelected.delete(i);draw()};row.prepend(tick);row.append(b('Käytä',()=>useTemplate(item)),b('Vie .txt',()=>exportFile([item])),b('Muokkaa',()=>{edit=i;editor()}),b('Poista',()=>{if(confirm('Poistetaanko pohja?')){data.splice(i,1);exportSelected.clear();localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data));draw()}}));manage.append(row)});
       }
       const names=safeReadSession('openapuri.recipientReminder.v1',[]);
       if(names.length){const note=label('div','Valitse Wilmassa vastaanottajat: '+names.join(', '));note.style.cssText='padding:9px;background:#fff6da;border:1px solid #e3cd91;border-radius:6px';aside.append(note);aside.append(b('Vastaanottajat tarkistettu',()=>{sessionStorage.removeItem('openapuri.recipientReminder.v1');draw()}))}
       if(recipientStatus){const receipt=label('p',recipientStatus);receipt.style.cssText='padding:8px;background:#fff7e5;border-radius:5px;color:#69501e';aside.append(receipt)}
       const hint=label('p','Tallenteet säilyvät vain tässä selaimessa.');hint.style.color='#687987';aside.append(hint)
      }
      function editor(){
       aside.replaceChildren();aside.append(navigation);refreshNavigation();aside.append(label('h2','Viestipohja'));
       const item=getTemplates()[edit]||pendingTemplate||{title:'',category:'Yleinen',subject:'',body:'',recipientRule:'valitut_opiskelijat',recipients:null};
       const fields={};for(const [key,name,multi]of [['title','Nimi',false],['category','Kategoriat (erota puolipisteellä)',false],['subject','Aihe',false],['body','Viesti',true]]){
        const l=label('label',name);l.style.cssText='display:block;margin:10px 0';const inp=document.createElement(multi?'textarea':'input');if(multi)inp.rows=7;inp.value=key==='category'?templateCats(item).join('; '):item[key]||'';inp.style.cssText='display:block;width:100%;padding:8px;box-sizing:border-box;border:1px solid #bacbd7';l.append(inp);aside.append(l);fields[key]=inp;
       }
       // Use a rich, in-page editor so formatting remains editable, not raw HTML text.
       const rich=label('div','');rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-label','Viestipohjan muotoiltu sisältö');rich.style.cssText='min-height:145px;border:1px solid #bacbd7;background:#fff;padding:10px;margin:6px 0 12px;white-space:normal;overflow-wrap:anywhere';rich.innerHTML=sanitizeTemplateHtml(item.bodyHtml||'');
       if(!item.bodyHtml)rich.textContent=item.body||'';
       fields.body.closest('label').style.display='none';aside.insertBefore(rich,fields.body.closest('label').nextSibling);
       const help=label('div','Muuttujat merkitään aaltosulkeilla: {etunimi}, {opiskelijan_nimi}, {opettajan_nimi}, {paivamaara}, {linkki:ohje}. Kirjoita sama muuttuja aiheeseen tai tekstiin. Käytettäessä tuntemattoman muuttujan arvo kysytään. Yhteisviestissä ei täytetä automaattisesti yksittäisen opiskelijan etunimeä.');help.style.cssText='padding:10px;background:#eef5fb;border-radius:7px;white-space:normal;font-size:12px';aside.append(help);
       const role=label('label','Vastaanottajatapa');role.style.cssText='display:block;margin:10px 0';const choice=document.createElement('select');
       for(const [value,name] of [['ei_valintaa','Valitaan Wilmassa käsin'],['valitut_opiskelijat','Valitut opiskelijat'],['valittujen_huoltajat','Valittujen opiskelijoiden huoltajat'],['valitut_opiskelijat_ja_huoltajat','Opiskelijat ja huoltajat'],['pohjaan_tallennetut','Pohjaan tallennetut vastaanottajat'],['yhdistelma','Ryhmiä ja yksittäisiä henkilöitä']]){
        const option=label('option',name);option.value=value;choice.append(option);
       }
       choice.value=item.recipientRule||'ei_valintaa';role.append(choice);aside.append(role);
       const modeLabel=label('label','Viestityyppi');modeLabel.style.cssText='display:block;margin:10px 0';const mode=document.createElement('select');
       for(const [value,name] of [['single','Yksittäinen henkilökohtainen viesti'],['group','Yhteinen ryhmäviesti']]){const option=label('option',name);option.value=value;mode.append(option)}
       mode.value=item.messageMode||'group';modeLabel.append(mode);aside.append(modeLabel);const recipientFields={};for(const [key,name] of [['recipientGroups','Ryhmät / luokat (yksi per rivi)'],['recipientIndividuals','Yksittäiset henkilöt (yksi per rivi)']]){const field=label('label',name);field.style.cssText='display:block;margin:9px 0';const input=document.createElement('textarea');input.rows=3;input.value=(item[key]||[]).join('\n');input.style.cssText='display:block;width:100%;box-sizing:border-box;border:1px solid #bacbd7;padding:7px';field.append(input);aside.append(field);recipientFields[key]=input;}
       const optBox=label('fieldset','');optBox.style.cssText='border:1px solid #c8d7e3;padding:10px;margin:10px 0';optBox.append(label('legend','Wilman lisäasetukset ja ajastus'));const optionControls={};
       for(const [key,name] of [['showRecipients','Näytä vastaanottajien nimet'],['collatedReplies','Näytä vastaanottajien vastaukset'],['sms','Lähetä myös tekstiviestinä'],['email','Lähetä myös sähköpostina'],['scheduled','Ajasta lähetys']]){
        const line=label('label',' '+name);line.style.cssText='display:block;margin:7px 0';const input=document.createElement('select');for(const [value,title] of [['','Säilytä Wilman oletus'],['true','Kyllä'],['false','Ei']]){const op=label('option',title);op.value=value;input.append(op)}const saved=item.options?.[key];input.value=saved===true?'true':saved===false?'false':'';line.prepend(input);optBox.append(line);optionControls[key]=input;
       }
       for(const [key,name,example] of [['sendDate','Lähetyspäivä','pp.kk.vvvv'],['sendTime','Lähetysaika','tt:mm']]){const line=label('label',name);line.style.cssText='display:block;margin:7px 0';const input=document.createElement('input');input.type='text';input.placeholder=example;input.value=item.options?.[key]||'';input.style.cssText='display:block;width:100%;padding:6px;box-sizing:border-box';line.append(input);optBox.append(line);optionControls[key]=input}
       aside.append(optBox);
       const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!item.recipients;
       const rec=label('label',' Tallenna myös nykyiset vastaanottajat');rec.prepend(chk);aside.append(rec);
       aside.append(b('Tallenna',()=>{const all=getTemplates();const next={id:item.id||'',title:fields.title.value.trim(),category:(fields.category.value.split(';')[0]||'Yleinen').trim(),categories:fields.category.value.split(';').map(x=>x.trim()).filter(Boolean),bodyHtml:sanitizeTemplateHtml(rich.innerHTML),subject:fields.subject.value,body:rich.innerText||rich.textContent||'',options:{showRecipients:parseOpt(optionControls.showRecipients.value),collatedReplies:parseOpt(optionControls.collatedReplies.value),sms:parseOpt(optionControls.sms.value),email:parseOpt(optionControls.email.value),scheduled:parseOpt(optionControls.scheduled.value),sendDate:optionControls.sendDate.value.trim(),sendTime:optionControls.sendTime.value.trim()},recipientRule:choice.value,messageMode:mode.value,recipientGroups:recipientFields.recipientGroups.value.split('\n').map(x=>x.trim()).filter(Boolean),recipientIndividuals:recipientFields.recipientIndividuals.value.split('\n').map(x=>x.trim()).filter(Boolean),recipients:chk.checked?(edit>=0&&item.recipients?item.recipients:getRecipientsSnapshot()):null};if(!next.title)return;if(edit<0)all.push(next);else all[edit]=next;pendingTemplate=null;localStorage.setItem(TEMPLATE_KEY,JSON.stringify(all));draw()}),b('Takaisin',draw));
      }
      if(pendingTemplate)editor();else draw();
      window.addEventListener('openapuri:drafts-changed',()=>{if(!aside.hidden&&tab==='drafts')draw()});

    }
    function addLibraryEntry(){
      if(document.getElementById('wt-library-entry'))return;
      // The unified Viestikirjasto is already visible beside the editor.
      document.getElementById('wt-library-entry')?.remove();
      library();
      const savedRestore=safeRead('openapuri.draftRestore.v1',null);
      if(savedRestore&&Date.now()-savedRestore.createdAt<120000){
        localStorage.removeItem('openapuri.draftRestore.v1');
        applySaved(savedRestore,false);
        // Native URL parameters are preferred. Historical snapshots are
        // restored only on a freshly cleared compose page.
        if(savedRestore.replaceRecipients&&savedRestore.recipients){
          restoreRecipients(savedRestore.recipients).catch(e=>console.warn('[OpenApuri] Draft recipients:',e));
        }
      }
      const request=safeRead(REQUEST_KEY,null);
      if(request&&Date.now()-request.createdAt<120000){
        localStorage.removeItem(REQUEST_KEY);
        if(request.subject||request.body||request.bodyHtml){
          const current=collectDraft();
          // Native recipient parameters can populate recipient chips before the
          // requested text is applied; check the editor, not recipient chips.
          if(!String(current.subject||'').trim()&&!stripHtml(current.bodyHtml||'').trim()){
            const safe=document.createElement('div');safe.textContent=String(request.body||'');
            const body=String(request.body||'');
            const html=body?safe.innerHTML.replace(/\r?\n/g,'<br>'):String(request.bodyHtml||'');
            applySaved({subject:String(request.subject||''),bodyHtml:html},false);
          }
        }
        if(request.savedRecipients&&!new URLSearchParams(location.search).toString()){
          // OpiskelijaHaku opened a fresh blank compose page for a historical
          // draft without native IDs. Restore its saved recipient snapshot here.
          restoreRecipients(request.savedRecipients).then(ok=>{
            if(!ok){
              const warning=document.createElement('p');
              warning.textContent='Luonnoksen vastaanottajia ei voitu palauttaa automaattisesti. Valitse ne käsin ennen lähettämistä.';
              warning.style.cssText='padding:8px;color:#9a4e13';
              ($(SEL.recipientsCell)?.parentElement||document.body).prepend(warning);
            }
          }).catch(e=>console.warn('[OpenApuri] Snapshot recipient restore failed:',e));
        }
        if(Array.isArray(request.missingRecipients)&&request.missingRecipients.length){
          const note=document.createElement('aside');
          note.id='wt-missing-recipients';
          note.style.cssText='padding:9px 12px;margin:12px 0;border-left:3px solid #ae792e;background:#fff9ee;color:#543c18;font:13px/1.45 system-ui';
          const strong=document.createElement('strong');strong.textContent='Huomautus vastaanottajista';
          const p=document.createElement('p');p.style.margin='4px 0 0';
          p.textContent='Seuraavia vastaanottajia ei voitu lisätä: '+request.missingRecipients.join('; ')+'. Voit täydentää ne käsin. Tarkista vastaanottajat ennen lähettämistä.';
          note.append(strong,p);
          const cell=$(SEL.recipientsCell);
          (cell?.parentElement||document.querySelector('main#main-content')||document.body).prepend(note);
        }
        const task=request.recipientClassId
          ?selectClassRecipients(request.recipientClassId,request.recipientType)
          :request.recipientRule==='opettajat'&&Array.isArray(request.recipientTeachers)&&request.recipientTeachers.length
            ?selectTeachersFromProfiles(request.recipientTeachers)
            :request.recipientRule==='opettajat'&&Array.isArray(request.recipientsNames)&&request.recipientsNames.length
              ?selectRecipientsByNames(request.recipientsNames).then(result=>({ok:result.missing.length===0,missing:result.missing}))
              :Promise.resolve({ok:true,missing:[]});
        task.then(result=>{
          if(!result.ok){
            library();const pane=document.getElementById('wt-message-library');
            if(pane){const note=document.createElement('p');note.textContent='Valintaa ei voitu vahvistaa: '+result.missing.join(', ')+'. Tarkista vastaanottajat Wilmassa.';pane.prepend(note)}
          }
        }).catch(err=>console.warn('[OpenApuri] Recipient selection failed:',err));
      }
      window.addEventListener('openapuri:show-library',event=>{if(event.detail?.section==='message'){const lib=document.getElementById('wt-message-library');if(lib){lib.hidden=false;const sections=[...lib.children].filter(el=>el.id!=='wt-message-toolbar');sections.forEach(el=>el.hidden=true)}return}library();window.dispatchEvent(new CustomEvent('openapuri:library-tab',{detail:event.detail?.section}))});
      window.addEventListener('openapuri:save-compose-template',()=>{library();window.dispatchEvent(new Event('openapuri:compose-to-template'))});
      window.addEventListener('openapuri:open-library',()=>{const lib=document.getElementById('wt-message-library');if(lib)lib.hidden=false;else library()});
    }
    function saveDraft(reason) {
        if(setBodyHtml.pending)return;
        try {
            const draft = collectDraft();
            const previous=loadDraft();
            // A temporarily blank editor must not erase an existing populated body.
            if(previous&&stripHtml(previous.bodyHtml||'').trim()&&!stripHtml(draft.bodyHtml||'').trim()&&draft.subject===previous.subject&&reason==='periodic')return;

            if (!isMeaningfulDraft(draft)) {
                setIndicator('Wilma Autosaver: running, nothing to save yet', 'ok');
                return;
            }

            const json = JSON.stringify(draft);

            if (JSON.stringify([draft.subject,draft.bodyHtml,draft.recipients,draft.recipientQuery])===lastSavedJson) {
                return;
            }

            localStorage.setItem(STORAGE_KEY, json);
            historySave(draft);
            lastSavedJson = JSON.stringify([draft.subject,draft.bodyHtml,draft.recipients,draft.recipientQuery]);

            const bodyLen = stripHtml(draft.bodyHtml).trim().length;
            const recCount = draft.recipients.inputs.length;
            const visualCount = draft.recipients.visualItems.length;

            setIndicator(
                `Wilma Autosaver: saved ${new Date().toLocaleTimeString()} | recipients ${recCount}/${visualCount} | body ${bodyLen} chars`,
                'ok'
            );

            updateInfo();
        } catch (err) {
            setIndicator('Wilma Autosaver save error: ' + err.message, 'error');
        }
    }

    function loadDraft() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            setIndicator('Wilma Autosaver load error: ' + err.message, 'error');
            return null;
        }
    }

    async function restoreSavedDraft(force) {
        const draft = loadDraft();

        if (!draft) {
            setIndicator('Wilma Autosaver: no saved draft found', 'error');
            return;
        }

        if (force) {
            const ok = confirm('Restore saved local draft over current page content?');
            if (!ok) return;
        }

        switchToDraft(draft);
        const bodyLen=stripHtml(draft.bodyHtml||'').trim().length;
        setIndicator('Wilma Autosaver: restored draft | body '+bodyLen+' chars','ok');
        updateInfo();
    }

    function updateInfo() {
        const info = $('#wilma-as-info');
        if (!info) return;

        const draft = loadDraft();

        if (!draft) {
            info.textContent = 'No saved local draft.';
            return;
        }

        const saved = draft.savedAt
            ? new Date(draft.savedAt).toLocaleString()
            : 'unknown time';

        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;
        const visibleRecText = (draft.recipients?.text || '').trim();
        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const subject = draft.subject ? ` | ${draft.subject.slice(0, 40)}` : '';

        info.textContent =
            `Saved: ${saved}` +
            ` | hidden recipients: ${recCount}` +
            ` | visual items: ${visualCount}` +
            ` | visible text: ${visibleRecText ? 'yes' : 'no'}` +
            ` | body: ${bodyLen} chars${subject}`;
    }

    function pageLooksEmpty() {
        const draft = collectDraft();
        return !isMeaningfulDraft(draft);
    }

    async function offerRestoreIfEmpty() {
        const draft = loadDraft();

        if (!draft) {
            updateInfo();
            return;
        }

        if (!pageLooksEmpty()) {
            updateInfo();
            return;
        }

        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;

        const ok = confirm(
            `Wilma Autosaver found a saved local draft.\n\n` +
            `Hidden recipients: ${recCount}\n` +
            `Visual recipient items: ${visualCount}\n` +
            `Message length: ${bodyLen} chars\n\n` +
            `Restore it?`
        );

        if (ok) {
            await restoreSavedDraft(false);
        }
    }

    function attachListeners() {
        const subject = $(SEL.subject);
        if (subject && !subject.dataset.wilmaAsWatched) {
            subject.dataset.wilmaAsWatched = '1';
            subject.addEventListener('input', () => scheduleSave('subject'));
            subject.addEventListener('change', () => scheduleSave('subject'));
        }

        const textarea = $(SEL.bodyTextarea);
        if (textarea && !textarea.dataset.wilmaAsWatched) {
            textarea.dataset.wilmaAsWatched = '1';
            textarea.addEventListener('input', () => scheduleSave('textarea'));
            textarea.addEventListener('change', () => scheduleSave('textarea'));
        }

        const cell = $(SEL.recipientsCell);
        if (cell && !cell.dataset.wilmaAsWatched) {
            cell.dataset.wilmaAsWatched = '1';

            const observer = new MutationObserver(() => scheduleSave('recipients'));
            observer.observe(cell, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }

        const editor = getCkeditorInstance();
        if (editor && !editor._wilmaAsWatched) {
            editor._wilmaAsWatched = true;

            editor.on('change', () => scheduleSave('ckeditor'));
            editor.on('key', () => scheduleSave('ckeditor'));
            editor.on('blur', () => saveDraft('ckeditor blur'));
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body && !iframeDoc.body.dataset.wilmaAsWatched) {
            iframeDoc.body.dataset.wilmaAsWatched = '1';

            iframeDoc.body.addEventListener('input', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('keyup', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('paste', () => scheduleSave('iframe'));

            const observer = new MutationObserver(() => scheduleSave('iframe mutation'));
            observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        const send = $(SEL.sendButton);
        if (send && !send.dataset.wilmaAsWatched) {
            send.dataset.wilmaAsWatched = '1';
            send.addEventListener('click', () => saveDraft('before send'), true);
        }

        const draft = $(SEL.draftButton);
        if (draft && !draft.dataset.wilmaAsWatched) {
            draft.dataset.wilmaAsWatched = '1';
            draft.addEventListener('click', () => saveDraft('before Wilma draft'), true);
        }

        const cancel = $(SEL.cancelButton);
        if (cancel && !cancel.dataset.wilmaAsWatched) {
            cancel.dataset.wilmaAsWatched = '1';
            cancel.addEventListener('click', () => saveDraft('before cancel'), true);
        }
    }

    function scheduleSave(reason) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveDraft(reason), 350);
    }

    async function init() {
        ensureUi();
        setIndicator('Wilma Autosaver: injected, looking for compose fields...', null);

        let tries = 0;

        const timer = setInterval(async () => {
            tries += 1;

            const hasSubject = Boolean($(SEL.subject));
            const hasBody = Boolean($(SEL.bodyTextarea));
            const hasRecipients = Boolean($(SEL.recipientsCell));
            const hasIframe = Boolean(getCkeditorIframeDocument());
            const hasCke = Boolean(getCkeditorInstance());

            if (!hasSubject || !hasBody) {
                setIndicator(
                    `Wilma Autosaver: waiting ${tries}s | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                    null
                );

                if (tries >= 45) {
                    clearInterval(timer);
                    setIndicator(
                        `Wilma Autosaver: failed to find fields | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                        'error'
                    );
                }

                return;
            }

            if (!initialized) {
                initialized = true;
                addLibraryEntry();

                setIndicator(
                    `Wilma Autosaver: running | recipients=${hasRecipients} ckeditor=${hasCke} iframe=${hasIframe}`,
                    'ok'
                );

                // Restoration is always user-initiated from the library.
            }

            attachListeners();

            // Save CKEditor content periodically too: some Wilma editor changes
            // do not emit the events observed by the userscript.
            if(tries%8===0&&getCkeditorInstance()?.status==='ready')saveDraft('periodic');

            updateInfo();
        }, 1000);
    }

    // The desktop toolbar can reopen the local controls without changing save/restore logic.
    window.addEventListener('openapuri:open-autosaver', () => {const lib=document.getElementById('wt-message-library');if(lib)lib.hidden=false;else library()});
    ready(init);
})();});
 immediately(()=>{(function () {
    'use strict';
// Per-module state controlled by OpenApuri's in-app settings menu.
try {if(JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').draftsAndroid===false)return;}catch{}

    // Only activate the intended browser variant, avoiding two simultaneous autosavers.
    const ua = navigator.userAgent;
    if (!(/Android/i.test(ua) && /Firefox|Fennec/i.test(ua))) return;
    if(window.__openApuriAndroidDrafts)return;
    window.__openApuriAndroidDrafts=true;

    // Drafts are sensitive: stored only on this origin in localStorage; clear after sending.
    const STORAGE_KEY = 'wilma-compose-autosave:' + location.hostname + location.pathname;

    const SEL = {
        subject: 'input#wff-Subject',
        bodyTextarea: 'textarea#wff-BodyText',
        recipientsCell: 'div#messages-recipients-cell',
        recipientsOpen: 'button#recipients-open',
        recipientsSearchInput: 'input#recipients-search-input',
        recipientsSearchResults: 'div#recipients-search-results',

        recipientButtons: [
            'button.recipient-block',
            'button.student-block',
            'button.guardian-block',
            'button.teacher-block',
            'button.personnel-block',
            'button.recipient-block.student-block.margin-right',
            'div#recipients-search-results button.recipient-block',
            'div#recipients-search-results button.student-block',
            'div#recipients-search-results button.guardian-block'
        ].join(','),

        sendButton: 'input[name="addsavebtn"]',
        draftButton: 'input[name="draftbtn"]',
        cancelButton: 'input[name="cancelbtn"]'
    };

    let initialized = false;
    let saveTimer = null;
    let lastSavedJson = '';

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function ensureUi() {
        if (!document.documentElement) return;

        if (!$('#wilma-as-style')) {
            const style = document.createElement('style');
            style.id = 'wilma-as-style';
            style.textContent = `
                #wilma-as-indicator {
                    position: fixed !important;
                    left: 6px !important;
                    right: 6px !important;
                    top: 6px !important;
                    z-index: 2147483647 !important;
                    background: #7a4b00 !important;
                    color: #fff !important;
                    padding: 8px 10px !important;
                    border-radius: 8px !important;
                    font: 13px/1.3 sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                    pointer-events: auto !important;
                }

                #wilma-as-indicator.ok {
                    background: #155724 !important;
                }

                #wilma-as-indicator.error {
                    background: #721c24 !important;
                }

                #wilma-as-panel {
                    position: fixed !important;
                    left: 6px !important;
                    right: 6px !important;
                    bottom: 6px !important;
                    z-index: 2147483646 !important;
                    background: rgba(0,0,0,.88) !important;
                    color: white !important;
                    padding: 8px !important;
                    border-radius: 8px !important;
                    font: 13px sans-serif !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,.4) !important;
                }

                #wilma-as-panel button {
                    font-size: 13px !important;
                    margin: 3px !important;
                    padding: 6px 8px !important;
                }
            `;
            document.documentElement.appendChild(style);
        }

        if (!$('#wilma-as-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'wilma-as-indicator';
            indicator.textContent = 'Wilma Autosaver: script injected, waiting...';
            document.documentElement.appendChild(indicator);
        }
    }

    function setIndicator(text, state) {
        ensureUi();

        const el = $('#wilma-as-indicator');
        if (!el) return;

        el.classList.remove('ok', 'error');
        if (state) el.classList.add(state);

        el.textContent = text;
    }

    function createPanel() {
        ensureUi();

        if ($('#wilma-as-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wilma-as-panel';
        panel.innerHTML = `
            <div><strong>Wilma Autosaver</strong></div>
            <div id="wilma-as-info">No saved draft checked yet.</div>
            <button type="button" id="wilma-as-save">Save now</button>
            <button type="button" id="wilma-as-restore">Restore</button>
            <button type="button" id="wilma-as-refresh-recipients">Refresh recipients</button>
            <button type="button" id="wilma-as-clear">Clear</button>
            <button type="button" id="wilma-as-hide">Hide</button>
        `;

        document.documentElement.appendChild(panel);

        $('#wilma-as-save').addEventListener('click', () => saveDraft('manual'));

        $('#wilma-as-restore').addEventListener('click', async () => {
            await restoreSavedDraft(true);
        });

        $('#wilma-as-refresh-recipients').addEventListener('click', async () => {
            const draft = loadDraft();

            if (!draft || !draft.recipients) {
                setIndicator('Wilma Autosaver: no saved recipients to refresh', 'error');
                return;
            }

            await restoreRecipients(draft.recipients);
        });

        $('#wilma-as-clear').addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            lastSavedJson = '';
            setIndicator('Wilma Autosaver: saved draft cleared', 'ok');
            updateInfo();
        });

        $('#wilma-as-hide').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        updateInfo();
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return tmp.textContent || tmp.innerText || '';
    }

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function dispatchBasicEvents(el) {
        if (!el) return;

        ['input', 'change', 'click', 'keyup', 'keydown', 'blur', 'focusout'].forEach(type => {
            try {
                el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
            } catch (err) {
                console.warn('[Wilma Autosaver] Event failed:', type, err);
            }
        });
    }

    function getCkeditorInstance() {
        try {
            if (!window.CKEDITOR || !window.CKEDITOR.instances) return null;

            if (window.CKEDITOR.instances['wff-BodyText']) {
                return window.CKEDITOR.instances['wff-BodyText'];
            }

            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            return Object.values(window.CKEDITOR.instances).find(instance => {
                return instance.element && instance.element.$ === textarea;
            }) || null;
        } catch (err) {
            return null;
        }
    }

    function getCkeditorIframeDocument() {
        try {
            const textarea = $(SEL.bodyTextarea);
            if (!textarea) return null;

            const wrapper =
                $('#cke_wff-BodyText') ||
                textarea.closest('.form-group')?.querySelector('.cke');

            const iframe =
                wrapper?.querySelector('iframe') ||
                $('iframe.cke_wysiwyg_frame');

            if (!iframe) return null;

            return iframe.contentDocument || iframe.contentWindow.document;
        } catch (err) {
            return null;
        }
    }

    function getBodyHtml() {
        const editor = getCkeditorInstance();

        if (editor && typeof editor.getData === 'function') {
            const html = editor.getData() || '';
            if (html.trim()) return html;
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body) {
            const html = iframeDoc.body.innerHTML || '';
            if (html.trim()) return html;
        }

        const textarea = $(SEL.bodyTextarea);
        return textarea ? textarea.value || '' : '';
    }

    function setBodyHtml(html) {
        const editor = getCkeditorInstance();

        if (editor && typeof editor.setData === 'function') {
            editor.setData(html || '', {
                callback: function () {
                    if (typeof editor.updateElement === 'function') {
                        editor.updateElement();
                    }

                    const textarea = $(SEL.bodyTextarea);
                    if (textarea) {
                        textarea.value = html || '';
                        dispatchBasicEvents(textarea);
                    }
                }
            });
            return;
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.innerHTML = html || '';
            dispatchBasicEvents(iframeDoc.body);
            return;
        }

        const textarea = $(SEL.bodyTextarea);
        if (textarea) {
            textarea.value = html || '';
            dispatchBasicEvents(textarea);
        }
    }

    function getRecipientButtonSignature(button) {
        return {
            text: normalizeText(button.innerText || button.textContent || ''),
            title: normalizeText(button.getAttribute('title') || ''),
            ariaLabel: normalizeText(button.getAttribute('aria-label') || ''),
            value: normalizeText(button.value || ''),
            name: normalizeText(button.getAttribute('name') || ''),
            className: normalizeText(button.className || '')
        };
    }

    function getRecipientsSnapshot() {
        const cell = $(SEL.recipientsCell);

        if (!cell) {
            return {
                html: '',
                text: '',
                inputs: [],
                visualItems: []
            };
        }

        const inputs = $all('input[type="hidden"]', cell).map(input => ({
            name: input.name || '',
            value: input.value || '',
            title: input.getAttribute('title') || ''
        }));

        const visualItems = $all('.recipient-item, span, button, input[type="hidden"]', cell).map(el => ({
            tag: el.tagName || '',
            text: (el.innerText || el.textContent || '').trim(),
            title: el.getAttribute('title') || '',
            name: el.getAttribute('name') || '',
            value: el.value || '',
            className: el.className || ''
        })).filter(item => {
            return item.text || item.title || item.name || item.value;
        });

        return {
            html: cell.innerHTML || '',
            text: (cell.innerText || cell.textContent || '').trim(),
            inputs,
            visualItems
        };
    }

    function recipientSnapshotTokens(snapshot) {
        const tokens = new Set();

        function add(value) {
            const normalized = normalizeText(value);
            if (normalized) tokens.add(normalized);
        }

        (snapshot.inputs || []).forEach(input => {
            add(input.name);
            add(input.value);
            add(input.title);
        });

        (snapshot.visualItems || []).forEach(item => {
            add(item.text);
            add(item.title);
            add(item.name);
            add(item.value);
        });

        add(snapshot.text);

        return tokens;
    }

    function buttonMatchesRecipientSnapshot(button, snapshot) {
        const tokens = recipientSnapshotTokens(snapshot);
        const sig = getRecipientButtonSignature(button);

        const haystack = [
            sig.text,
            sig.title,
            sig.ariaLabel,
            sig.value,
            sig.name,
            sig.className
        ].filter(Boolean);

        for (const h of haystack) {
            if (tokens.has(h)) return true;

            for (const t of tokens) {
                if (!t) continue;

                /*
                  Avoid matching overly generic values such as "r_student",
                  "student-block", "kaikki", etc.
                */
                if (t.length < 5) continue;
                if (['r_student', 'r_guardian', 'r_teacher', 'kaikki'].includes(t)) continue;

                if (h.includes(t) || t.includes(h)) {
                    return true;
                }
            }
        }

        return false;
    }

    async function openRecipientsPanel() {
        const openButton = $(SEL.recipientsOpen);

        if (!openButton) {
            setIndicator('Wilma Autosaver: recipients-open button not found', 'error');
            return false;
        }

        openButton.click();
        await sleep(900);
        return true;
    }

    function clickVisibleMatchingRecipientButtons(snapshot) {
        const buttons = $all(SEL.recipientButtons);
        let clicked = 0;

        for (const button of buttons) {
            if (!buttonMatchesRecipientSnapshot(button, snapshot)) continue;

            const beforeClass = button.className || '';

            try {
                button.click();
                clicked += 1;
                dispatchBasicEvents(button);

                console.log('[Wilma Autosaver] clicked matching recipient button', {
                    text: button.innerText || button.textContent || '',
                    title: button.getAttribute('title') || '',
                    beforeClass,
                    afterClass: button.className || ''
                });
            } catch (err) {
                console.warn('[Wilma Autosaver] could not click recipient button:', err);
            }
        }

        return clicked;
    }

    function getSearchTermsFromSnapshot(snapshot) {
        const terms = [];

        function addTerm(value) {
            const v = String(value || '').replace(/\s+/g, ' ').trim();
            if (!v) return;

            /*
              Skip technical values that are unlikely to work in the visible search box.
            */
            if (v.includes('=')) return;
            if (v.startsWith('r_')) return;
            if (v.length < 3) return;

            terms.push(v);
        }

        addTerm(snapshot.text);

        (snapshot.visualItems || []).forEach(item => {
            addTerm(item.text);
            addTerm(item.title);
        });

        /*
          Deduplicate and keep only a few. On strict privacy captures, visible
          names may not be available. In that case this list may be empty.
        */
        return Array.from(new Set(terms)).slice(0, 5);
    }

    async function searchAndClickRecipients(snapshot) {
        const searchInput = $(SEL.recipientsSearchInput);
        if (!searchInput) return 0;

        const terms = getSearchTermsFromSnapshot(snapshot);
        let totalClicked = 0;

        for (const term of terms) {
            searchInput.value = term;
            dispatchBasicEvents(searchInput);

            /*
              Some Wilma recipient search UIs react better to real-ish keyboard events.
            */
            try {
                searchInput.dispatchEvent(new KeyboardEvent('keyup', {
                    bubbles: true,
                    cancelable: true,
                    key: term.slice(-1) || 'a'
                }));
            } catch (err) {
                // Ignore.
            }

            await sleep(1000);

            const clicked = clickVisibleMatchingRecipientButtons(snapshot);
            totalClicked += clicked;

            if (clicked > 0) {
                await sleep(400);
            }
        }

        return totalClicked;
    }

    async function clickSummaryOrCloseButtons() {
        const buttons = Array.from(document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], a[role="button"]'
        ));

        const preferred = buttons.filter(btn => {
            const text = normalizeText(
                btn.innerText ||
                btn.textContent ||
                btn.value ||
                btn.getAttribute('aria-label') ||
                btn.getAttribute('title') ||
                ''
            );

            return (
                text.includes('vastaanottajien yhteenveto') ||
                text.includes('yhteenveto') ||
                text.includes('valmis') ||
                text.includes('sulje') ||
                text === 'ok'
            );
        });

        let clicked = 0;

        for (const btn of preferred) {
            try {
                btn.click();
                clicked += 1;
                await sleep(250);
            } catch (err) {
                console.warn('[Wilma Autosaver] summary/close click failed:', err);
            }
        }

        return clicked;
    }

    async function restoreRecipients(snapshot) {
        if (!snapshot || (!snapshot.html && !(snapshot.inputs || []).length)) {
            setIndicator('Wilma Autosaver: no recipient snapshot to restore', 'error');
            return false;
        }

        await openRecipientsPanel();

        /*
          Step 1: try the proper Wilma route first — click matching visible recipient buttons.
          This is what should update Wilma's own visual/React state.
        */
        let clicked = clickVisibleMatchingRecipientButtons(snapshot);

        /*
          Step 2: if nothing matched, try searching by saved visible text/title,
          then click matching search result buttons.
        */
        if (clicked === 0) {
            clicked += await searchAndClickRecipients(snapshot);
        }

        await sleep(500);

        /*
          Step 3: restore form-level hidden inputs/chips as backup.
          This is still useful if Wilma's visual state does not fully update.
        */
        const cell = $(SEL.recipientsCell);
        if (cell && snapshot.html) {
            cell.innerHTML = snapshot.html;
            dispatchBasicEvents(cell);

            $all('input[type="hidden"]', cell).forEach(input => {
                dispatchBasicEvents(input);
            });
        }

        await sleep(400);

        /*
          Step 4: try to force visual summary refresh.
        */
        const summaryClicks = await clickSummaryOrCloseButtons();

        await sleep(300);

        const visibleTextNow = cell
            ? (cell.innerText || cell.textContent || '').trim()
            : '';

        const hiddenInputsNow = cell
            ? $all('input[type="hidden"]', cell).length
            : 0;

        setIndicator(
            `Wilma Autosaver: recipients restore done | clicked=${clicked} | hidden=${hiddenInputsNow} | visible=${visibleTextNow ? 'yes' : 'no'} | summary=${summaryClicks}`,
            hiddenInputsNow || clicked ? 'ok' : 'error'
        );

        updateInfo();

        return Boolean(hiddenInputsNow || clicked);
    }

    function collectDraft() {
        const subject = $(SEL.subject);
        const bodyHtml = getBodyHtml();
        const recipients = getRecipientsSnapshot();

        return {
            version: 5,
            savedAt: new Date().toISOString(),
            url: location.href,
            subject: subject ? subject.value || '' : '',
            bodyHtml,
            recipients
        };
    }

    function isMeaningfulDraft(draft) {
        return Boolean(
            (draft.subject || '').trim() ||
            stripHtml(draft.bodyHtml || '').trim() ||
            draft.recipients?.text ||
            draft.recipients?.inputs?.length ||
            draft.recipients?.visualItems?.length
        );
    }

    function saveDraft(reason) {
        try {
            const draft = collectDraft();

            if (!isMeaningfulDraft(draft)) {
                setIndicator('Wilma Autosaver: running, nothing to save yet', 'ok');
                return;
            }

            const json = JSON.stringify(draft);

            if (json === lastSavedJson) {
                return;
            }

            localStorage.setItem(STORAGE_KEY, json);
            lastSavedJson = json;

            const bodyLen = stripHtml(draft.bodyHtml).trim().length;
            const recCount = draft.recipients.inputs.length;
            const visualCount = draft.recipients.visualItems.length;

            setIndicator(
                `Wilma Autosaver: saved ${new Date().toLocaleTimeString()} | recipients ${recCount}/${visualCount} | body ${bodyLen} chars`,
                'ok'
            );

            updateInfo();
        } catch (err) {
            setIndicator('Wilma Autosaver save error: ' + err.message, 'error');
        }
    }

    function loadDraft() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            setIndicator('Wilma Autosaver load error: ' + err.message, 'error');
            return null;
        }
    }

    async function restoreSavedDraft(force) {
        const draft = loadDraft();

        if (!draft) {
            setIndicator('Wilma Autosaver: no saved draft found', 'error');
            return;
        }

        if (force) {
            const ok = confirm('Restore saved local draft over current page content?');
            if (!ok) return;
        }

        await restoreRecipients(draft.recipients);

        const subject = $(SEL.subject);
        if (subject) {
            subject.value = draft.subject || '';
            dispatchBasicEvents(subject);
        }

        setBodyHtml(draft.bodyHtml || '');

        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        setIndicator(`Wilma Autosaver: restored draft | body ${bodyLen} chars`, 'ok');
        updateInfo();
    }

    function updateInfo() {
        const info = $('#wilma-as-info');
        if (!info) return;

        const draft = loadDraft();

        if (!draft) {
            info.textContent = 'No saved local draft.';
            return;
        }

        const saved = draft.savedAt
            ? new Date(draft.savedAt).toLocaleString()
            : 'unknown time';

        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;
        const visibleRecText = (draft.recipients?.text || '').trim();
        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const subject = draft.subject ? ` | ${draft.subject.slice(0, 40)}` : '';

        info.textContent =
            `Saved: ${saved}` +
            ` | hidden recipients: ${recCount}` +
            ` | visual items: ${visualCount}` +
            ` | visible text: ${visibleRecText ? 'yes' : 'no'}` +
            ` | body: ${bodyLen} chars${subject}`;
    }

    function pageLooksEmpty() {
        const draft = collectDraft();
        return !isMeaningfulDraft(draft);
    }

    async function offerRestoreIfEmpty() {
        const draft = loadDraft();

        if (!draft) {
            updateInfo();
            return;
        }

        if (!pageLooksEmpty()) {
            updateInfo();
            return;
        }

        const bodyLen = stripHtml(draft.bodyHtml || '').trim().length;
        const recCount = draft.recipients?.inputs?.length || 0;
        const visualCount = draft.recipients?.visualItems?.length || 0;

        const ok = confirm(
            `Wilma Autosaver found a saved local draft.\n\n` +
            `Hidden recipients: ${recCount}\n` +
            `Visual recipient items: ${visualCount}\n` +
            `Message length: ${bodyLen} chars\n\n` +
            `Restore it?`
        );

        if (ok) {
            await restoreSavedDraft(false);
        }
    }

    function attachListeners() {
        const subject = $(SEL.subject);
        if (subject && !subject.dataset.wilmaAsWatched) {
            subject.dataset.wilmaAsWatched = '1';
            subject.addEventListener('input', () => scheduleSave('subject'));
            subject.addEventListener('change', () => scheduleSave('subject'));
        }

        const textarea = $(SEL.bodyTextarea);
        if (textarea && !textarea.dataset.wilmaAsWatched) {
            textarea.dataset.wilmaAsWatched = '1';
            textarea.addEventListener('input', () => scheduleSave('textarea'));
            textarea.addEventListener('change', () => scheduleSave('textarea'));
        }

        const cell = $(SEL.recipientsCell);
        if (cell && !cell.dataset.wilmaAsWatched) {
            cell.dataset.wilmaAsWatched = '1';

            const observer = new MutationObserver(() => scheduleSave('recipients'));
            observer.observe(cell, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }

        const editor = getCkeditorInstance();
        if (editor && !editor._wilmaAsWatched) {
            editor._wilmaAsWatched = true;

            editor.on('change', () => scheduleSave('ckeditor'));
            editor.on('key', () => scheduleSave('ckeditor'));
            editor.on('blur', () => saveDraft('ckeditor blur'));
        }

        const iframeDoc = getCkeditorIframeDocument();
        if (iframeDoc && iframeDoc.body && !iframeDoc.body.dataset.wilmaAsWatched) {
            iframeDoc.body.dataset.wilmaAsWatched = '1';

            iframeDoc.body.addEventListener('input', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('keyup', () => scheduleSave('iframe'));
            iframeDoc.body.addEventListener('paste', () => scheduleSave('iframe'));

            const observer = new MutationObserver(() => scheduleSave('iframe mutation'));
            observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        const send = $(SEL.sendButton);
        if (send && !send.dataset.wilmaAsWatched) {
            send.dataset.wilmaAsWatched = '1';
            send.addEventListener('click', () => saveDraft('before send'), true);
        }

        const draft = $(SEL.draftButton);
        if (draft && !draft.dataset.wilmaAsWatched) {
            draft.dataset.wilmaAsWatched = '1';
            draft.addEventListener('click', () => saveDraft('before Wilma draft'), true);
        }

        const cancel = $(SEL.cancelButton);
        if (cancel && !cancel.dataset.wilmaAsWatched) {
            cancel.dataset.wilmaAsWatched = '1';
            cancel.addEventListener('click', () => saveDraft('before cancel'), true);
        }
    }

    function scheduleSave(reason) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveDraft(reason), 350);
    }

    async function init() {
        ensureUi();
        setIndicator('Wilma Autosaver: injected, looking for compose fields...', null);

        let tries = 0;

        const timer = setInterval(async () => {
            tries += 1;

            const hasSubject = Boolean($(SEL.subject));
            const hasBody = Boolean($(SEL.bodyTextarea));
            const hasRecipients = Boolean($(SEL.recipientsCell));
            const hasIframe = Boolean(getCkeditorIframeDocument());
            const hasCke = Boolean(getCkeditorInstance());

            if (!hasSubject || !hasBody) {
                setIndicator(
                    `Wilma Autosaver: waiting ${tries}s | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                    null
                );

                if (tries >= 45) {
                    clearInterval(timer);
                    setIndicator(
                        `Wilma Autosaver: failed to find fields | subject=${hasSubject} body=${hasBody} recipients=${hasRecipients}`,
                        'error'
                    );
                }

                return;
            }

            if (!initialized) {
                initialized = true;
                createPanel();

                setIndicator(
                    `Wilma Autosaver: running | recipients=${hasRecipients} ckeditor=${hasCke} iframe=${hasIframe}`,
                    'ok'
                );

                await offerRestoreIfEmpty();
            }

            attachListeners();

            if (tries % 2 === 0) {
                saveDraft('auto');
            }

            updateInfo();
        }, 1000);
    }

    ready(init);
})();});
}
if(!embeddedSearch)afterDom(()=>{(() => {
'use strict';
// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

if(window.__openApuriHub)return;
const oaMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
window.__openApuriHub=true;
const KEY='openapuri.settings',lastKey='openapuri.lastGradebook';
const t={fi:{tools:'Työkalut',progress:'Ryhmänohjaajan arviointinäkymä',autosave:'Viestiluonnosten tallennus',write:'Kirjoita viesti',templates:'Viestipohjat',drafts:'Tallennetut viestit',settings:'Asetukset',language:'Kieli',close:'Sulje',open:'Avaa',install:'Asenna moduuli',hint:'Työkalut otetaan käyttöön tai pois käytöstä Tampermonkeyssa.',unknown:'Avaa ensin opiskelijan opintosuoritussivu, jotta pikavalinta voidaan tallentaa.',home:'Pikavalinta ryhmänohjaajan arviointiin',notEnabled:'Moduuli ei ole tällä sivulla käytettävissä.'},en:{tools:'Tools',progress:'Homeroom grade overview',autosave:'Message draft autosaver',write:'Compose message',templates:'Message templates',drafts:'Saved drafts',settings:'Settings',language:'Language',close:'Close',open:'Open',install:'Install module',hint:'Enable and disable modules in Tampermonkey.',unknown:'First open a student gradebook so the shortcut can be saved.',home:'Homeroom grade overview shortcut',notEnabled:'Module is not available on this page.'}};
let lang='fi';try{lang=JSON.parse(localStorage.getItem(KEY)||'{}').lang==='en'?'en':'fi'}catch{}
const x=k=>t[lang][k],grade=/^\/profiles\/students\/\d+\/choices\/?$/;
const css=document.createElement('style');css.textContent=`
#wt-side-toggle{display:none!important}
#wt-side-panel{position:fixed;bottom:0;left:0;right:0;top:auto;z-index:10020;background:#f4f7f9;border-top:1px solid #cad5dc;box-shadow:0 -1px 5px #0001;padding:5px 14px;font:12px system-ui;color:#345;box-sizing:border-box;display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:31px}
#wt-side-panel button,#wt-side-panel select{font:inherit;border:0;background:transparent;color:#285779;padding:3px 7px;cursor:pointer;border-radius:4px}#wt-side-panel button:hover{background:#e3ebf2}
#wt-side-panel h2{font-size:12px;margin:0 9px 0 0;font-weight:600}#wt-side-panel .item{display:contents}
@media(max-width:640px){#wt-side-panel{position:static}}
`;document.head.append(css);
const btn=document.createElement('button');btn.id='wt-side-toggle';btn.hidden=true;
const panel=document.createElement('nav');panel.id='wt-side-panel';panel.setAttribute('aria-label','OpenApuri');document.body.append(panel);
const label=(tag,text)=>{const a=document.createElement(tag);a.textContent=text;return a};

const OA_LOGO='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriLogo.png';
const OA_PREFS_KEY='openapuri.modules.v1';
const OA_MODULES=[
 ['general','Yleiset','Kaikkien moduulien yhteiset asetukset'],
 ['progress','Opintoseuranta','Ryhmänohjaajan opintoseuranta'],
 ['search','OpiskelijaHaku','Opiskelijoiden ja henkilökunnan haku'],
 ['draftsChrome','Viestiluonnokset · Chrome','Viestien tallennus tietokoneella'],
 ['draftsAndroid','Viestiluonnokset · Android','Viestien tallennus Firefox Androidissa'],
 ['toolbar','Työkalupalkki','Wilman OpenApuri-toiminnot']
];
const oaRead=()=>{try{return JSON.parse(localStorage.getItem(OA_PREFS_KEY)||'{}')||{}}catch{return {}}};
const oaWrite=(id,value)=>{const d=oaRead();d[id]=value;localStorage.setItem(OA_PREFS_KEY,JSON.stringify(d))};
const oaGlobal=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
const oaElement=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const oaStyle=document.createElement('style');
oaStyle.textContent=`
/* OpenApuri design tokens: edit these values to retheme all OA UI.
   Use var(--oa-*) in existing and future OpenApuri cards, tabs and toolbars. */
:root{
 --oa-navy:#13475e;--oa-teal:#135f67;--oa-primary:#147c6e;
 --oa-primary-dark:#075b50;--oa-mint:#53d3bd;
 --oa-surface:#f5fbf8;--oa-surface-accent:#e0f5eb;
 --oa-border:#9cd7c5;--oa-text:#173c48;--oa-muted:#52716c;
}
/* Shared theme application. Keep native Wilma sprite backgrounds unchanged. */
#oa-dialog .oa-head,#oh-panel>h2,#wt-header{background:var(--oa-surface-accent)!important;color:var(--oa-primary-dark)!important;border-color:var(--oa-border)!important}
#oh-panel,#wt-panel,#oh-home{border-color:var(--oa-primary)!important}
#oh-tab>a,#wt-class-assessment-tab>a,#wt-class-issues-tab>a{color:var(--oa-primary-dark)!important}
#wt-message-library #wt-library-tabs{border-bottom-color:var(--oa-border)!important}
#wt-message-library #wt-library-tabs button{color:var(--oa-primary-dark)!important}
#wt-message-toolbar,#wt-message-library{color:var(--oa-text)!important;background:var(--oa-surface)!important;border-color:var(--oa-border)!important}
#wt-message-toolbar{position:relative!important;padding-right:70px!important;border-left:4px solid var(--oa-primary)!important;border-radius:6px!important}
#wt-message-toolbar [role="tab"],#wt-library-tabs button{color:var(--oa-primary-dark)!important}
#wt-message-toolbar [aria-selected="true"],#wt-library-tabs button[aria-selected="true"]{border-bottom-color:var(--oa-primary)!important;font-weight:700!important}
#wt-message-library{border-left:4px solid var(--oa-primary)!important}
#wt-message-library>.oa-message-header{position:relative!important;display:flex!important;align-items:center!important;min-height:54px!important;margin:-16px -16px 16px!important;padding:10px 70px 10px 16px!important;background:var(--oa-surface-accent)!important;border-bottom:2px solid var(--oa-border)!important;color:var(--oa-primary-dark)!important;font-weight:700!important}
#wt-message-library input,#wt-message-library select,#wt-message-library textarea{border-color:var(--oa-border)!important}
#wt-message-library button:not(.oa-peeker-settings){accent-color:var(--oa-primary)}
#wt-message-toolbar>.oa-message-peeker,#wt-message-library .oa-message-header>.oa-message-peeker{position:absolute!important;display:flex!important;align-items:center!important;justify-content:center!important;right:14px!important;top:auto!important;bottom:-6px!important;width:44px!important;height:46px!important;border:0!important;background:transparent!important;padding:0!important;cursor:pointer!important;z-index:40!important}
#wt-message-toolbar>.oa-message-peeker img,#wt-message-library .oa-message-header>.oa-message-peeker img{display:block!important;width:44px!important;height:46px!important;object-fit:contain!important;pointer-events:none!important}
#wt-message-toolbar>.oa-message-peeker:focus-visible,#wt-message-library .oa-message-header>.oa-message-peeker:focus-visible{outline:2px solid var(--oa-primary)!important;outline-offset:2px!important}
#oa-dialog[hidden]{display:none!important}
#oa-dialog{position:fixed;inset:0;z-index:2147483600;color:#243a4b;font:14px system-ui,sans-serif}
#oa-dialog .oa-shade{position:absolute;inset:0;background:#12263899}
#oa-dialog .oa-window{position:absolute;inset:0;margin:auto;width:min(820px,calc(100vw - 24px));height:min(650px,calc(100vh - 24px));background:white;border-radius:11px;box-shadow:0 12px 56px #0005;display:flex;flex-direction:column;overflow:hidden}
#oa-dialog .oa-head{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:#edf4f9;border-bottom:1px solid #d4e2eb;font-weight:700;font-size:18px}
#oa-dialog button{font:inherit;cursor:pointer}
#oa-dialog .oa-close{border:0;background:transparent;font-size:28px}
#oa-dialog .oa-grid{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0;flex:1}
#oa-dialog .oa-nav{padding:12px;background:#f7f9fb;display:flex;flex-direction:column;gap:5px;border-right:1px solid #dce5ec}
#oa-dialog .oa-nav button{padding:10px;border:0;border-radius:6px;text-align:left;background:transparent;color:#294e68}
#oa-dialog .oa-nav button[aria-current=page]{background:#dcecf7;font-weight:bold}
#oa-dialog .oa-content{padding:22px;overflow:auto}
#oa-dialog .oa-content h2{font-size:21px;margin:0 0 14px}
#oa-dialog .oa-content p{line-height:1.5}
#oa-dialog .oa-content label{display:flex;gap:10px;align-items:center;margin:16px 0}
#oa-dialog .oa-content input[type=checkbox]{width:19px;height:19px}
#oa-dialog .oa-content a{color:#146392}
#oa-dialog .oa-foot{background:#f7fafc;padding:10px 16px;font-size:12px;color:#526c80;border-top:1px solid #dce5ec}
#oa-launcher{display:inline-flex!important;align-items:center!important;vertical-align:middle;justify-content:center!important;border:0!important;background:transparent!important;cursor:pointer;border-radius:0!important;padding:0!important;flex:0 0 auto;line-height:1;height:40px!important;max-height:40px!important;box-sizing:border-box!important}
#oa-launcher:hover,#oa-launcher:focus-visible{background:#ffffff26!important;outline:2px solid #b6e9e0;outline-offset:1px}
#oa-launcher img{display:block!important;width:40px!important;height:40px!important;min-width:0!important;min-height:0!important;max-width:40px!important;max-height:40px!important;object-fit:contain;transform:scale(1.08);transform-origin:center}
#oa-brand-group{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;flex:0 0 auto!important;min-width:max-content;vertical-align:middle;max-height:44px!important;white-space:nowrap}
#oa-brand-group>.navbar-brand,#oa-brand-group>a:not(#oa-launcher){float:none!important;display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;width:max-content!important;min-width:0!important;max-width:none!important;padding-left:4px!important;padding-right:4px!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important}
#oa-brand-group>.navbar-brand img,#oa-brand-group>a:not(#oa-launcher) img{max-height:40px!important;width:auto!important;object-fit:contain}
#oa-brand-group{padding:0!important;margin:0!important}
#oa-brand-group #oa-launcher{margin-left:0!important;margin-right:0!important}
/* Tighten the logo area's inherited grid spacing, not the other native navbar items. */
#oa-brand-group:has(> .navbar-brand){margin-left:0!important}
.oa-active-header{background:#135a63!important;background-image:linear-gradient(105deg,#13475e,#135f67)!important;box-shadow:inset 0 -4px #53d3bd!important}
.oa-active-header #oa-brand-group{background:transparent!important}
#oa-dialog .oa-head{background:#e6f5f1!important;border-bottom:3px solid #168b80!important}
#oa-dialog .oa-nav button[aria-current=page]{background:#d8f4e9!important;color:#075b50!important}
#wt-side-panel{border-top:3px solid #26a899!important;background:#f0faf6!important}
#wt-message-toolbar{border-left:5px solid #168b80!important;background:#edf8f4!important}
#oh-home{border:2px solid #238d83!important;background:#fcfffd!important;box-shadow:0 3px 12px #066a5920!important}
#oh-home>.panel-heading{background:#e0f5eb!important;color:#075b50!important;border-bottom:2px solid #9cd7c5!important}
#oh-panel{border:2px solid #238d83!important;border-radius:8px!important;background:#f9fffc!important;padding:14px!important}
#oh-panel>h2{background:#e0f5eb!important;color:#075b50!important;margin:-14px -14px 12px!important;padding:13px 16px!important;border-bottom:2px solid #9cd7c5!important}
/* Native Wilma sprite geometry and green active outline remain untouched.
   A small mint marker inside the tab distinguishes OpenApuri from native tabs.
   Never tint the link/pseudo-element backgrounds: sprite transparency would
   reveal a rectangular block outside the sloped silhouette. */
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab>a{color:#096b5c!important;font-weight:600!important}
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab>a:hover{color:#075b50!important}
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab.active>a{color:#096b5c!important}
/* The monkey peeks from the lower edge of the active OpenApuri content header.
   Never put it in a tab, so inactive tabs cannot display monkeys. */
#oh-panel>h2,#wt-panel>#wt-header{position:relative!important;overflow:visible!important}
#oh-panel>h2>.oa-peeker-settings,#wt-header>.oa-peeker-settings{position:absolute!important;right:18px!important;bottom:-6px!important;top:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;width:45px!important;height:46px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;cursor:pointer!important;z-index:40!important}
#oh-panel>h2>.oa-peeker-settings img,#wt-header>.oa-peeker-settings img{display:block!important;width:45px!important;height:46px!important;object-fit:contain!important;pointer-events:none!important}
#oh-panel>h2>.oa-peeker-settings:hover,#wt-header>.oa-peeker-settings:hover{transform:translateY(-2px)!important}
#oh-panel>h2>.oa-peeker-settings:focus-visible,#wt-header>.oa-peeker-settings:focus-visible{outline:2px solid #087266!important;outline-offset:1px!important}
#wt-panel{border:2px solid #238d83!important}
#wt-header{background:#e0f5eb!important;color:#075b50!important;border-bottom:2px solid #9cd7c5!important}
#oh-panel .oh-recipient-panel{background:#eaf8f2!important;border:1px solid #7bbdaa!important}
#oh-panel .oh-action{background:#147c6e!important;color:#fff!important;border-color:#147c6e!important}
#wt-message-library{border-left:4px solid #168b80!important}
@media(max-width:600px){#oa-launcher{height:36px!important;max-height:36px!important}#oa-launcher img{width:36px!important;height:36px!important;max-width:36px!important;max-height:36px!important}#oa-brand-group{gap:2px!important}}
@media(max-width:600px){#oa-dialog .oa-grid{display:flex;flex-direction:column}#oa-dialog .oa-nav{flex-direction:row;overflow:auto;flex-shrink:0;border-right:0;border-bottom:1px solid #dce5ec}#oa-dialog .oa-nav button{white-space:nowrap}}
`;
document.head.append(oaStyle);
const oaDialog=oaElement('div');oaDialog.id='oa-dialog';oaDialog.hidden=true;
oaDialog.innerHTML='<div class="oa-shade"></div><section class="oa-window" role="dialog" aria-modal="true" aria-label="OpenApurin asetukset"><header class="oa-head"><span>OpenApuri · Asetukset</span><button class="oa-close" type="button" aria-label="Sulje">×</button></header><div class="oa-grid"><nav class="oa-nav" aria-label="Moduulien asetukset"></nav><div class="oa-content" tabindex="-1"></div></div><footer class="oa-foot">Asetukset tallentuvat Wilman selaintallennukseen. Muutokset tulevat voimaan viimeistään sivun päivityksen jälkeen.</footer></section>';
document.body.append(oaDialog);
let oaReturnFocus=null;
function oaRender(id){
 const nav=oaDialog.querySelector('.oa-nav'),main=oaDialog.querySelector('.oa-content');
 nav.replaceChildren();main.replaceChildren();
 for(const [key,title]of OA_MODULES){
  const button=oaElement('button',title);button.type='button';
  if(key===id)button.setAttribute('aria-current','page');
  button.onclick=()=>oaRender(key);nav.append(button);
 }
 const entry=OA_MODULES.find(x=>x[0]===id)||OA_MODULES[0];
 main.append(oaElement('h2',entry[1]),oaElement('p',entry[2]));
 const labeledToggle=(key,txt,checked,onchange)=>{
  const label=oaElement('label'),input=oaElement('input');input.type='checkbox';
  input.checked=checked;input.onchange=()=>onchange(input.checked);
  label.append(input,oaElement('span',txt));main.append(label);
 };
 const link=(txt,url)=>{
  const a=oaElement('a',txt);a.href=url;a.target='_blank';a.rel='noopener noreferrer';main.append(a);
 };
 const launch=(txt,url,moduleId)=>{
  const button=oaElement('button',txt);button.type='button';
  button.style.cssText='background:#176393;color:#fff;border:0;border-radius:6px;padding:10px 15px;margin:5px 0 12px;cursor:pointer;font-weight:600';
  button.onclick=()=>{
    if(moduleId&&oaRead()[moduleId]===false)oaWrite(moduleId,true);
    // Same-tab navigation is intentional: this is a module launcher.
    location.assign(url);
  };
  main.append(button);
 };
 if(id==='general'){
  const label=oaElement('label','Kieli');
  const select=oaElement('select');
  for(const [key,title]of [['fi','Suomi'],['en','English']]){
   const op=oaElement('option',title);op.value=key;select.append(op);
  }
  select.value=oaGlobal().lang==='en'?'en':'fi';
  select.onchange=()=>{lang=select.value;localStorage.setItem(KEY,JSON.stringify({...oaGlobal(),lang}));draw()};
  label.append(select);main.append(label);
 }else{
  labeledToggle(id,'Moduuli käytössä',oaRead()[id]!==false,v=>{oaWrite(id,v);if(id==='toolbar')draw()});
  if(id==='progress'){
   labeledToggle('progressEnabled','Opintoseuranta aktiivinen',oaGlobal().enabled!==false,v=>localStorage.setItem(KEY,JSON.stringify({...oaGlobal(),enabled:v})));
   main.append(oaElement('p','Opintoseurannan asetukset ja piilotettujen opintojaksojen valinnat säilyvät paikallisesti.'));
   launch('Avaa ryhmäluettelo','/groups','progress');
  }
  if(id==='search'){
   launch('Avaa OpiskelijaHaku Wilmassa','/profiles/students/#opiskelijahaku','search');
   main.append(oaElement('p','Haku avautuu suoraan Wilman opiskelijaluettelossa. Jos OpiskelijaHaku on poistettu käytöstä vain OpenApurin asetuksista, painike ottaa sen samalla takaisin käyttöön.'));
  }
  if(id==='draftsChrome'||id==='draftsAndroid'){
   main.append(oaElement('p','Luonnoksia muokataan Wilman viestikirjastossa. Niitä ei lähetetä erilliselle palvelimelle.'));
   launch('Avaa viestinkirjoitus','/messages/compose',id);
  }
  if(id==='toolbar')main.append(oaElement('p','Kuvake ja asetukset-valikko pysyvät käytössä, vaikka alapalkki piilotetaan.'));
 }
 main.focus();
}
function oaOpen(tab='general'){
 if(oaDialog.hidden)oaReturnFocus=document.activeElement;
 oaDialog.hidden=false;oaRender(tab);
 oaDialog.querySelector('.oa-close').focus();
}
function oaClose(){oaDialog.hidden=true;oaReturnFocus?.focus?.()}
oaDialog.querySelector('.oa-close').onclick=oaClose;
oaDialog.querySelector('.oa-shade').onclick=oaClose;
oaDialog.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();oaClose()}
 if(e.key==='Tab'){
  const focusables=[...oaDialog.querySelectorAll('button,a[href],select,input')].filter(el=>el.getClientRects().length);
  if(!focusables.length)return;
  if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables[focusables.length-1].focus()}
  else if(!e.shiftKey&&document.activeElement===focusables[focusables.length-1]){e.preventDefault();focusables[0].focus()}
 }
});
window.addEventListener('openapuri:open-settings',e=>oaOpen(e.detail?.tab||'general'));
const oaLauncher=oaElement('button');oaLauncher.id='oa-launcher';oaLauncher.type='button';oaLauncher.title='OpenApuri · Asetukset';
oaLauncher.setAttribute('aria-label','Avaa OpenApurin asetukset');
const oaImg=oaElement('img');oaImg.alt='OpenApuri';oaImg.src=OA_LOGO;oaLauncher.append(oaImg);
oaLauncher.onclick=()=>oaOpen();
function markActiveHeader(logo){
  // Color only the original top branding bar, leaving native content unchanged.
  let bar=logo.closest('header,nav.navbar,.navbar,#header,[role="banner"],.header');
  if(!bar)bar=logo.parentElement;
  let candidate=bar;
  for(let step=0;candidate&&step<5;step++,candidate=candidate.parentElement){
    if(candidate===document.body)break;
    if(candidate.getBoundingClientRect().width>=window.innerWidth*.72){bar=candidate;break}
  }
  if(bar&&bar!==document.body&&bar!==document.documentElement)bar.classList.add('oa-active-header');
}
function placeLauncher(){
  const logo=document.querySelector('header .navbar-brand,nav .navbar-brand,.navbar-header .navbar-brand,header a.brand,#header .logo,.navbar-brand');
  if(!logo)return false;
  // Find the visible Viestit/Messages navigation entry. The logos belong between
  // this entry and the application grid, not in the original branding column.
  const root=logo.closest('header,nav.navbar,.navbar,#header,[role="banner"],.header')||document.querySelector('header,nav.navbar,.navbar');
  if(!root)return false;
  const visible=el=>!!(el.getClientRects().length);
  const matches=[...root.querySelectorAll('a,button,[role="menuitem"]')].filter(el=>
    visible(el)&&/^(?:Viestit|Messages)(?:\s*\(\d+\))?$/i.test((el.textContent||'').trim()));
  // Some Wilma layouts place messages in a separate navbar node.
  const message=matches[0]||[...document.querySelectorAll('header a,nav a,.navbar a')].find(el=>
    visible(el)&&/^(?:Viestit|Messages)(?:\s*\(\d+\))?$/i.test((el.textContent||'').trim()));
  if(!message)return false;
  const navbar=message.closest('.navbar-nav,ul.nav,nav,header,.navbar,[role="navigation"]')||message.parentElement;
  if(!navbar)return false;
  // Insert immediately after the top-level messages item, preserving the native
  // nine-square app menu and avoiding changes to its click handlers.
  let item=message;
  while(item.parentElement&&item.parentElement!==navbar)item=item.parentElement;
  if(item===navbar||!item.parentElement)return false;
  let group=document.getElementById('oa-brand-group');
  if(!group){
    group=document.createElement(navbar.tagName==='UL'||navbar.tagName==='OL'?'li':'span');
    group.id='oa-brand-group';
  }
  item.before(group);
  group.append(logo);
  group.append(oaLauncher);
  oaLauncher.style.cssText='';
  markActiveHeader(group);
  return true;
}
if(!placeLauncher()){
  oaLauncher.style.cssText='position:fixed;top:8px;right:12px;background:#135a63;z-index:2147483000;border:1px solid #c6d8e3';
  document.body.append(oaLauncher);
  let tries=0;
  const interval=setInterval(()=>{if(placeLauncher()||++tries>30)clearInterval(interval)},500);
}

const savedGrade=()=>{const value=localStorage.getItem(lastKey)||'';return /^\/profiles\/students\/\d+\/choices(?:\/?|\/?\?.*)$/.test(value)?value:null};
const route=()=>grade.test(location.pathname)?location.pathname+'?view=gradebook':savedGrade();
function linkProgress(){if(/^\/profiles\/classes\/\d+\/?$/.test(location.pathname)){document.querySelector('#wt-class-assessment-tab a')?.click();return}location.assign('/')}

const TEMPLATE_KEY='openapuri.messageTemplates.v1';
function templates(){try{const a=JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'[]');return Array.isArray(a)?a.filter(v=>v&&typeof v.title==='string'&&typeof v.subject==='string'&&typeof v.body==='string').slice(0,50):[]}catch{return []}}
function saveTemplates(data){localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data))}
function openMessageLibrary(section){
 if(location.pathname.startsWith('/messages/compose')){
  panel.hidden=true;
  window.dispatchEvent(new Event('openapuri:open-library'));
  return;
 }
 location.assign('/messages/compose#wt-library'+(section==='templates'?'-templates':''));
}
function templateEditor(){openMessageLibrary('templates')}
function draftSidebar(){openMessageLibrary('drafts')}
function draw(){
 panel.replaceChildren();
 if(oaMobile){panel.style.display='none';return;}
 if(oaRead().toolbar===false){panel.style.display='none';return}else panel.style.display='';
 const heading=label('h2','OpenApuri');panel.append(heading);
 const commands=[
  [lang==='fi'?'OpiskelijaHaku':'Student search',()=>{if(oaRead().search===false)oaWrite('search',true);location.assign('/profiles/students/#opiskelijahaku')}],
  [lang==='fi'?'Kirjoita viesti':'Compose',()=>location.assign('/messages/compose')],
  [lang==='fi'?'Viestipohjat':'Templates',()=>templateEditor()],
  [lang==='fi'?'Luonnokset':'Drafts',()=>draftSidebar()]
 ];
 for(const [name,fn] of commands){const control=label('button',name);control.type='button';control.onclick=fn;panel.append(control)}
 const language=label('select','');
 for(const [code,name]of [['fi','FI'],['en','EN']]){const opt=label('option',name);opt.value=code;language.append(opt)}
 language.value=lang;language.setAttribute('aria-label','Kieli');
 language.onchange=()=>{lang=language.value;let settings={};try{settings=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}settings.lang=lang;localStorage.setItem(KEY,JSON.stringify(settings));draw()};
 panel.append(language);
 const settings=label('button',lang==='fi'?'Asetukset':'Settings');settings.type='button';settings.onclick=()=>oaOpen();panel.append(settings);
}
draw();
window.addEventListener('openapuri:open-templates',()=>templateEditor());
window.addEventListener('openapuri:open-drafts',()=>draftSidebar());

function safePath(a){try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin?u.pathname+u.search:null}catch{return null}}
function txt(s){return String(s||'').replace(/\s+/g,' ').trim()}
function makeLink(text,url){const a=label('a',text);a.href=url;a.style.cssText='display:inline-block;margin:2px 12px 3px 0;color:#125f91;text-decoration:underline';return a}
function makeAction(text,fn){const a=label('button',text);a.type='button';a.style.cssText='padding:0;margin:2px 12px 3px 0;border:0;background:transparent;color:#125f91;text-decoration:underline;font:inherit;cursor:pointer;text-align:left';a.onclick=fn;return a}
function getSection(title){
 const h=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(el=>txt(el.textContent).toLowerCase()===title.toLowerCase());if(!h)return null;
 for(let p=h.parentElement;p&&p!==document.body;p=p.parentElement){
  if(p.querySelectorAll('h1,h2,h3,h4,h5,h6').length>1)break;
  if(p.querySelector('a[href]')&&p.getBoundingClientRect().width>180)return p;
 }return h.parentElement;
}
function info(msg){alert(msg)}
async function groupDoc(url){
 const r=await fetch(url,{credentials:'same-origin',redirect:'follow',cache:'no-store'});
 const final=new URL(r.url);
 if(!r.ok||final.origin!==location.origin||!/^\/(?:groups|profiles\/classes)\/\d+(?:\/|$)/.test(final.pathname))throw Error('Ryhmäsivun haku epäonnistui');
 return new DOMParser().parseFromString(await r.text(),'text/html');
}
function studentNames(doc){
 const found=new Map();
 for(const a of doc.querySelectorAll('a[href]')){
   const href=safePath(a);const match=href&&href.match(/^\/profiles\/students\/(\d+)(?:\/|$|\?)/);
   const name=txt(a.textContent);
   if(match&&name&&name.length<120&&!found.has(match[1]))found.set(match[1],name);
 }
 return [...found.values()].sort((a,b)=>a.localeCompare(b,'fi'));
}
async function copyStudents(url){
 try{
  const names=studentNames(await groupDoc(url));
  if(!names.length)return info(lang==='fi'?'Opiskelijalinkkejä ei löydy ryhmäsivun HTML:stä.':'Student links were not found in the group page HTML.');
  const value=names.join('\n');
  try{await navigator.clipboard.writeText(value);info((lang==='fi'?'Kopioitu opiskelijaa: ':'Students copied: ')+names.length)}
  catch{prompt(lang==='fi'?'Kopioi nimilista':'Copy student names',value)}
 }catch(e){info(e.message)}
}
function groupMessageLinks(doc){
 const candidates={students:new Set(),guardians:new Set(),both:new Set(),group:new Set()};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);
  if(!path||!path.startsWith('/messages/compose'))continue;
  const name=txt(a.textContent).toLocaleLowerCase('fi');
  const single=/opiskelijalle|oppilaalle|huoltajalle|yksittäiselle|single student|single guardian|single parent/i.test(name);
  if(single)continue;
  // Student-specific rows frequently contain actions named "Viesti opiskelijoille".
  // Those actions must not be mistaken for class-wide Wilma links.
  const row=a.closest('tr,li,.student,.student-row');
  if(row&&row.querySelector('a[href*="/profiles/students/"]'))continue;
  const student=/opiskelijoille|opiskelijat|oppilaille|students\b/i.test(name);
  const guardian=/huoltajille|huoltajat|guardians\b|parents\b/i.test(name);
  if(student&&guardian)candidates.both.add(path);
  else if(student)candidates.students.add(path);
  else if(guardian)candidates.guardians.add(path);
  else if(/viesti ryhmälle|message group/i.test(name))candidates.group.add(path);
 }
 const links={students:null,guardians:null,both:null,group:null};
 for(const type of Object.keys(links)){
  const options=[...candidates[type]];
  // Several different recipient URLs for the same action = ambiguous.
  if(options.length===1)links[type]=options[0];
 }
 const groups=['students','guardians','both'];
 for(const type of groups){
  if(links[type]&&groups.some(other=>other!==type&&links[other]===links[type]))links[type]=null;
 }
 return links;
}
async function groupMessage(url,type){
 const match=String(url||'').match(/\/profiles\/classes\/(\d+)\/?/);
 if(match&&['students','guardians','both'].includes(type)){
  const params=new URLSearchParams();
  if(type==='students'||type==='both')params.set('r_class',match[1]);
  if(type==='guardians'||type==='both')params.set('r_classguardian',match[1]);
  location.assign('/messages/compose?'+params.toString());return;
 }
 try{
  const links=groupMessageLinks(await groupDoc(url)),target=links[type]||(type==='group'?links.group:null);
  if(target)location.assign(target);
  else info('Ryhmän viestilinkkiä ei löytynyt. Vastaanottajia ei valittu.');
 }catch(e){info(e.message)}
}
function gradingLinks(doc){
 const found={grading:null,attendance:null};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);if(!path)continue;
  if(/\/grading\/?(?:\?|$)/.test(path))found.grading=path;
  if(/\/attendance_edit\/?(?:\?|$)/.test(path))found.attendance=path;
 }return found;
}
function compactBlock(){const block=document.createElement('div');block.className='wt-inline-tools';block.style.cssText='margin:5px 0 4px;padding:6px 0;border-top:1px solid #dfe8ee;font:13px/1.5 system-ui';return block}
async function openHomeroomGrades(groupUrl){location.assign(groupUrl)}
function improveHomeroomLayout(home,tools,groupUrl){
 if(home.dataset.wtLayout==='yes')return;
 const heading=[...home.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h=>txt(h.textContent)==='Ohjausryhmäsi');
 const classLink=[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(!heading||!classLink)return;
 const links=[...home.querySelectorAll('a[href]')].filter(a=>!a.closest('#wt-home-tools'));
 const attendance=links.find(a=>/\/attendance_edit\/?(?:\?|$)/.test(safePath(a)||'')||/^Tuntimerkinnät$/i.test(txt(a.textContent)));
 const extras=links.filter(a=>a!==attendance&&/viikoittain|viikottain|yhteenvetona/i.test(txt(a.textContent)));
 const pending=links.find(a=>/^\/profiles\/classes\/\d+\/pending\/?(?:\?|$)/.test(safePath(a)||''));
 const layout=document.createElement('div');layout.id='wt-home-layout';layout.style.cssText='display:grid!important;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr)!important;gap:10px;align-items:start;margin:5px 0;width:100%;box-sizing:border-box';
 const left=document.createElement('div');left.style.cssText='min-width:0;display:flex;flex-direction:column;gap:6px';
 const top=document.createElement('div');top.style.cssText='display:flex;flex-wrap:wrap;align-items:baseline;gap:12px';
 const classLine=classLink.closest('h6')||classLink.parentElement;
 classLink.style.cssText='font:600 18px/1.3 system-ui,sans-serif;color:#155d92;text-decoration:underline';
 const copy=tools.querySelector('button');if(copy)top.append(copy);
 left.append(top);
 const right=document.createElement('div');right.style.cssText='min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding-left:10px;border-left:1px solid #e2e8ed';
 const grade=makeAction(lang==='fi'?'▣  Arviointinäkymä':'▣  Grade overview',()=>openHomeroomGrades(groupUrl));
 grade.style.cssText='font-weight:700;font-size:16px;color:#125a90;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer';
 right.append(grade);
 if(attendance){
  const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%';
  attendance.style.cssText='font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:5px';
  const ico=label('span','▤');ico.setAttribute('aria-hidden','true');ico.style.cssText='font:18px/1 system-ui;color:#155d92;text-decoration:none';attendance.prepend(ico);
  line.append(attendance);
  if(pending){
    const pendingContainer=pending.parentElement;
    pending.style.cssText='display:inline-block;float:none!important;margin:0!important;font-size:12px!important;white-space:nowrap';
    line.append(pending);
    if(pendingContainer&&pendingContainer.classList.contains('pull-right')){pendingContainer.style.display='none';const emptyRow=pendingContainer.parentElement;if(emptyRow&&emptyRow.matches('.margin-bottom.clearfix')&&!emptyRow.textContent.trim())emptyRow.style.display='none';}
  }
  right.append(line);
 }
 if(extras.length){const details=document.createElement('details');details.style.cssText='font-size:12px;color:#637789';const summary=label('summary',lang==='fi'?'Muut tuntimerkintänäkymät':'Other attendance views');details.append(summary);for(const a of extras){a.style.cssText='display:inline-block;margin:5px 9px 0 0;font-size:12px';details.append(a)}right.append(details)}
 const messages=tools.querySelector('div');if(messages){messages.style.cssText='display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center';left.append(messages)}
 layout.append(left,right);
 // Remove empty wrappers from Wilma's original layout after moving their links.
 if(classLine&&classLine!==heading&&classLine.parentElement)classLine.remove();
 heading.style.cssText='display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:5px';
 heading.append(classLink);
 tools.replaceChildren(layout);
 heading.insertAdjacentElement('afterend',tools);
 // Use a predictable full-width grid regardless of Wilma's original block styles.
 tools.style.display='block';tools.style.width='100%';
 console.info('[OpenApuri] Homeroom two-column layout v0.15.0 applied');
 tools.style.cssText='border:0;margin:0;padding:0;font:15px/1.4 system-ui';
 for(const a of tools.querySelectorAll('button,a')){if(!a.classList.contains('badge')){a.style.fontSize='15px';a.style.lineHeight='1.4'}}
 const style=document.createElement('style');style.textContent='#wt-home-tools button,#wt-home-tools a:not(.badge),#wt-course-links button,#wt-course-links a{font-family:system-ui,sans-serif!important;font-size:15px!important;line-height:1.45!important}#wt-course-links{font:15px/1.45 system-ui,sans-serif!important}#wt-home-tools .badge{font-size:12px!important}@media(max-width:560px){#wt-home-layout{grid-template-columns:1fr!important}#wt-home-layout>div:nth-child(2){border-left:0!important;border-top:1px solid #e2e8ed;padding:10px 0 0!important}}';home.append(style);
 home.dataset.wtLayout='yes';
}
function attachHome(){
 const home=getSection('Ohjausryhmäsi'),period=getSection('Ryhmät tässä jaksossa');
 const classAnchor=home&&[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(home&&classAnchor&&!home.querySelector('#wt-home-tools')){
  const url=safePath(classAnchor),tools=compactBlock();tools.id='wt-home-tools';
  // Original class title remains the navigable Wilma link.
  // Open the current teacher's actual homeroom; do not reuse an unrelated last student.
  tools.append(makeAction(lang==='fi'?'Kopioi opiskelijalista':'Copy student list',()=>copyStudents(url)));
  const messages=document.createElement('div');
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille':'Message students',()=>groupMessage(url,'students')));
  messages.append(makeAction(lang==='fi'?'Viesti huoltajille':'Message guardians',()=>groupMessage(url,'guardians')));
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille ja huoltajille':'Message students and guardians',()=>groupMessage(url,'both')));
  tools.append(messages);home.append(tools);
 }
 if(home&&classAnchor&&home.querySelector('#wt-home-tools')&&home.dataset.wtLayout!=='yes'){
  improveHomeroomLayout(home,home.querySelector('#wt-home-tools'),safePath(classAnchor));
 }
 if(!period)return;
 // Preserve every native Wilma course row, title, icon and link unchanged.
 // Add only an envelope icon after the existing action icons, once per group.
 const groups=new Map();
 for(const anchor of period.querySelectorAll('a[href]')){
   const href=safePath(anchor);
   if(href&&/^\/(?:groups|profiles\/classes)\/\d+\/?$/.test(href)&&!groups.has(href))groups.set(href,anchor);
 }
 for(const [groupUrl,anchor]of groups){
   let container=anchor.parentElement;
   let icons=null;
   for(let level=0;level<6&&container&&container!==period;level++,container=container.parentElement){
     const candidates=[...container.querySelectorAll('div,span,ul')].filter(el=>{
       if(el.querySelector('#wt-group-mail'))return false;
       const actions=[...el.querySelectorAll('a[href]')].filter(a=>a!==anchor&&(a.querySelector('svg,i,[class*="icon"]')||a.children.length===0&&!txt(a.textContent)));
       return actions.length>=3&&actions.length<=6&&el.querySelectorAll('a[href]').length<=8;
     });
     if(candidates.length){icons=candidates.sort((x,y)=>x.querySelectorAll('a[href]').length-y.querySelectorAll('a[href]').length)[0];break}
   }
   if(!icons||icons.querySelector('[data-wt-group-mail]'))continue;
   const mail=document.createElement('button');mail.type='button';mail.dataset.wtGroupMail='yes';
   mail.setAttribute('aria-label',lang==='fi'?'Viesti ryhmälle':'Message group');
   mail.title=lang==='fi'?'Viesti ryhmälle':'Message group';
   mail.style.cssText='display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;padding:0 3px;margin:0;border:0;background:transparent;color:#0096d6;cursor:pointer';
   mail.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
   mail.onclick=()=>groupMessage(groupUrl,'group');
   icons.append(mail);
 }

}
function swapTwoHomepageBoxes(){
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 const byTitle=t=>headings.find(h=>txt(h.textContent)===t);
 const notices=byTitle('Ilmoitukset'),groups=byTitle('Ryhmät tässä jaksossa');
 if(!notices||!groups)return;
 // Only swap two boxes sharing the same immediate parent. Never move a whole column or timetable.
 function card(h){
  for(let p=h;p&&p.parentElement&&p!==document.body;p=p.parentElement){
   if(p===document.body||p.contains(notices)&&p.contains(groups))break;
   if(p.matches('.panel,.card,.well,.widget,.box,.dashboard-widget'))return p;
  }
  return null;
 }
 const a=card(notices),b=card(groups);
 if(!a||!b||a===b||a.parentElement!==b.parentElement)return;
 if(b.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING){
  // Groups currently after notices: move just the groups box before notices.
  a.before(b);
 }
}



function oaMessagePeeker(host){
 if(!host||host.querySelector(':scope > .oa-message-peeker'))return;
 host.style.position='relative';
 const button=document.createElement('button');button.type='button';button.className='oa-message-peeker';
 button.title='OpenApuri · Viestiasetukset';button.setAttribute('aria-label','Avaa viestityökalujen asetukset');
 const img=document.createElement('img');img.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';img.alt='';
 button.append(img);
 button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'draftsChrome'}}))});
 host.prepend(button);
}
function installUnifiedMessageBar(){
 if(!/^\/messages\/(?:compose(?:\/)?|\d+\/?)$/.test(location.pathname))return;
 const main=document.querySelector('main#main-content');
 if(!main||document.getElementById('wt-message-toolbar'))return;
 if(/^\/messages\/compose\/?$/.test(location.pathname))return; // Viestikirjasto owns the unified compose navigation.
 const compose=/^\/messages\/compose\/?$/.test(location.pathname);
 const bar=document.createElement('section');bar.id='wt-message-toolbar';
 bar.setAttribute('aria-label','OpenApuri viestityökalut');
 oaMessagePeeker(bar);
 bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:7px 9px;margin:0 0 12px;background:var(--oa-surface);border:1px solid var(--oa-border);border-radius:5px;font:12px system-ui;color:#29465c;max-width:100%;box-sizing:border-box;';
 const brand=document.createElement('strong');brand.textContent='OpenApuri';brand.style.cssText='font-size:12px;margin-right:6px';bar.append(brand);
 const button=(name,action)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');b.style.cssText='background:transparent;color:var(--oa-primary-dark);border:0;border-bottom:2px solid transparent;padding:7px 11px;cursor:pointer;font:13px system-ui';b.addEventListener('click',action);bar.append(b);return b};
 bar.setAttribute('role','tablist');
 const activate=(name)=>{
  for(const b of bar.querySelectorAll('[role="tab"]')){
   const active=b.dataset.tab===name;b.setAttribute('aria-selected',String(active));
   b.style.borderBottomColor=active?'var(--oa-primary)':'transparent';
   b.style.fontWeight=active?'600':'400';
  }
  if(compose)window.dispatchEvent(new CustomEvent('openapuri:show-library',{detail:{section:name}}));
 };
 const message=button('Viesti',()=>activate('message'));message.dataset.tab='message';
 const templates=button('Viestipohjat',()=>{if(compose)activate('templates');else location.assign('/messages/compose#wt-library-templates')});templates.dataset.tab='templates';
 const drafts=button('Luonnokset',()=>{if(compose)activate('drafts');else location.assign('/messages/compose#wt-library')});drafts.dataset.tab='drafts';
 if(!compose){const save=button('Tallenna viestipohjaksi',()=>{
   const frame=document.querySelector('iframe#message-wrapper');
   const body=frame?.contentDocument?.querySelector('body > .ckeditor, body .ckeditor');
   if(!body||!body.textContent.trim()){alert('Viestisisältöä ei löydy. Odota viestin latautumista.');return}
   const h=main.querySelector('h1');
   const subject=(h?.textContent||'').trim().slice(0,250);
   localStorage.setItem('openapuri.sentTemplateImport.v1',JSON.stringify({subject,body:(body.innerText||body.textContent||'').trim(),bodyHtml:body.innerHTML,createdAt:Date.now()}));
   location.assign('/messages/compose#wt-library-templates');
  });save.setAttribute('role','button')}
 else{const save=button('Tallenna nykyinen pohjaksi',()=>{activate('templates');window.dispatchEvent(new CustomEvent('openapuri:save-compose-template'))});save.setAttribute('role','button')}
 const active=compose?(location.hash==='#wt-library'?'drafts':location.hash==='#wt-library-templates'?'templates':'message'):'message';
 for(const b of bar.querySelectorAll('[role="tab"]')){const yes=b.dataset.tab===active;b.setAttribute('aria-selected',String(yes));b.style.borderBottomColor=yes?'var(--oa-primary)':'transparent'}
 window.addEventListener('openapuri:library-closed',()=>{for(const b of bar.querySelectorAll('[role="tab"]')){const yes=b.dataset.tab==='message';b.setAttribute('aria-selected',String(yes));b.style.borderBottomColor=yes?'var(--oa-primary)':'transparent'}});
 main.insertAdjacentElement('afterbegin',bar);
}
if(/^\/messages\//.test(location.pathname)){
 panel.style.display='none';
 installUnifiedMessageBar();
 let checks=0;const wait=setInterval(()=>{installUnifiedMessageBar();if(++checks>25)clearInterval(wait)},450);
}
if(['/', '/index','/dashboard','/home'].includes(location.pathname)){
 attachHome();swapTwoHomepageBoxes();
 // Wilma can render the homepage blocks after DOMContentLoaded.
 let tries=0;
 const interval=setInterval(()=>{attachHome();swapTwoHomepageBoxes();if(++tries>=12)clearInterval(interval)},1000);
}
})();});
if(!embeddedSearch&&/^\/profiles\/classes\/\d+(?:\/|$)/.test(currentPath))
 afterDom(()=>{(() => {
'use strict';
// Per-module state controlled by OpenApuri's in-app settings menu.
try {if(JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').progress===false)return;}catch{}

// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

const classRoute=location.pathname.match(/^\/profiles\/classes\/(\d+)(?:\/|$)/);
if(!classRoute||window.__openapuri04)return;window.__openapuri04=true;
const classBase='/profiles/classes/'+classRoute[1];
const onClassMain=location.pathname.replace(/\/$/,'')===classBase;
const T={fi:{launch:'OpenApuri',title:'OpenApuri – Ryhmänohjaajan opintoseuranta',collect:'Kerää ryhmän tiedot',stop:'Pysäytä',close:'Sulje',matrix:'Opintojaksot',issues:'Huomiot',settings:'Asetukset',language:'Kieli',enabled:'Opintoseuranta käytössä',school:'Lukuvuosi',custom:'Oma aikaväli',all:'Kaikki päivämäärät',from:'Alkaen',to:'Päättyen',search:'Hae opiskelijaa tai opintojaksoa',hide:'Piilota opintojaksoja',export:'Vie CSV',student:'Opiskelija',course:'Opintojakso',grade:'Arvosana',issue:'Huomio',critical:'Vakava',low:'Alle 7',ready:'Opiskelijalinkkejä löytyi: {n}. Varmista, että ryhmä on oikea.',confirm:'Kerätäänkö {n} opiskelijan suoritukset? Tiedot pysyvät selaimessa.',reading:'Haetaan {i}/{n}…',finished:'Valmis: {n} suoritusta, {e} varoitusta. Vertaa tuloksia Wilman laajennettuun näkymään.',none:'Ei tietoja valitulla aikavälillä.',missing:'Ei merkintää',dateNote:'Päivämäärättömät suoritukset näkyvät vain Kaikki päivämäärät -valinnalla.',warning:'Huom. Näytä kaikki saattaa lisätä rivejä JavaScriptillä. Tarkista kattavuus ennen käyttöä.',found:'{n} opiskelijaa, {c} opintojaksoa, {r} suoritusta.',hideNote:'Poista valinta piilottaaksesi opintojakson.',settingsHelp:'Asetukset tallentuvat tähän selaimeen.'},
en:{launch:'OpenApuri',title:'OpenApuri – Homeroom course progress',collect:'Collect class',stop:'Stop',close:'Close',matrix:'Course matrix',issues:'Students with issues',settings:'Settings',language:'Language',enabled:'Enable progress module',school:'School year',custom:'Custom dates',all:'All dates',from:'From',to:'To',search:'Search student or course',hide:'Hide courses',export:'Export CSV',student:'Student',course:'Course',grade:'Grade',issue:'Issue',critical:'Critical',low:'Below 7',ready:'Found {n} student links. Verify the class.',confirm:'Collect records for {n} students? Data remains in your browser.',reading:'Reading {i}/{n}…',finished:'Finished: {n} records, {e} warnings. Compare with the expanded Wilma page.',none:'No records in this period.',missing:'No record',dateNote:'Undated records appear only under All dates.',warning:'Note: Show all may dynamically load extra rows. Verify completeness before using.',found:'{n} students, {c} courses, {r} records.',hideNote:'Uncheck to hide a course.',settingsHelp:'Settings are saved in this browser.'}};
const t=(k,v={})=>(T[cfg.lang][k]||k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
const tidy=x=>String(x??'').replace(/\s+/g,' ').trim(),p=/^\/profiles\/students\/(\d+)\/choices\/?$/;
const sy=()=>{let d=new Date();return d.getFullYear()-(d.getMonth()<7?1:0)};
const saved=(()=>{try{return JSON.parse(localStorage.getItem('openapuri.settings')||'{}')}catch{return {}}})();
const cfg={lang:saved.lang==='en'?'en':'fi',enabled:saved.enabled!==false,hidden:new Set(saved.hidden||[])};
const save=()=>localStorage.setItem('openapuri.settings',JSON.stringify({lang:cfg.lang,enabled:cfg.enabled,hidden:[...cfg.hidden]}));
const state={loaded:false,source:'dropdown',messageSubject:'',messageText:'',messageStudentIds:new Set(),people:[],rows:[],errors:[],mode:'matrix',nameDescending:false,period:'school',year:sy(),from:'',to:'',term:'',sort:'',busy:false,stop:false};
const isoDate=s=>{let m=tidy(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(!m)return /^\d{4}-\d{2}-\d{2}$/.test(tidy(s))?tidy(s):'';let d=new Date(+m[3],+m[2]-1,+m[1]);return d.getDate()===+m[1]&&d.getMonth()===+m[2]-1&&d.getFullYear()===+m[3]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
const colors={'4':['#b91c1c','#fff'],'5':['#e76f51','#fff'],'6':['#f4a261','#222'],'7':['#f6d365','#222'],'8':['#aad581','#222'],'9':['#55ae78','#fff'],'10':['#167347','#fff'],'P':['#4472c4','#fff'],'U':['#8053b8','#fff'],'K':['#bb3f8d','#fff']};
const color=(g,has)=>!has?['#e5e7eb','#333']:!g?['#fff1b8','#443300']:colors[g.toUpperCase()]||['#d69cde','#222'];
const messageStrings={
fi:{heading:'Viestit huomiota vaativille opiskelijoille',select:'Valitse',subject:'Aihe',body:'Viestipohja',prepare:'Kopioi viesti ja avaa Wilman viestit',info:'Viestit valmistellaan opiskelijakohtaisesti. Valitse vastaanottaja Wilmassa ja tarkista viesti ennen lähettämistä. Viestejä ei lähetetä automaattisesti.',empty:'Valitse ensin opiskelija.',noClipboard:'Leikepöydälle kopiointi ei onnistunut. Kopioi viesti käsin.',sampleSubject:'Opintojen eteneminen',sampleBody:'Hei {etunimi},\n\nHaluaisin keskustella opintojesi etenemisestä. Otathan yhteyttä, jotta voimme sopia jatkosta.\n\nYstävällisin terveisin,\nRyhmänohjaaja',selected:'Valittuja opiskelijoita: {n}',next:'Seuraava',open:'Avaa viestit',notice:'Viestin vastaanottajaa ei aseteta automaattisesti. Valitse Wilmassa oikea henkilö.'},
en:{heading:'Messages for students needing attention',select:'Select',subject:'Subject',body:'Message template',prepare:'Copy message and open Wilma messages',info:'Prepare messages for each student. Select the recipient in Wilma and review before sending. No automatic sending.',empty:'Select a student first.',noClipboard:'Could not copy to clipboard. Copy manually.',sampleSubject:'Course progress',sampleBody:'Hello {etunimi},\n\nI would like to discuss how your studies are progressing. Please get in touch so we can agree on next steps.\n\nBest regards,\nHomeroom teacher',selected:'Selected students: {n}',next:'Next',open:'Open messages',notice:'Recipients are not filled in automatically. Choose the correct person in Wilma.'}};
const mt=k=>messageStrings[cfg.lang][k];
const flag=g=>['4','U','K'].includes(g.toUpperCase())?'critical':['5','6'].includes(g)?'low':'';
function currentStudentName(){
  // Wilma breadcrumb: ... > group > student name [dropdown]. Never read names from grade tables.
  const current=location.pathname.match(p);
  if(!current)return '';
  const selectors=['li.dropdown:has(ul a[href*="/profiles/students/"]) > a','li.dropdown:has(ul a[href*="/profiles/students/"]) > button','[aria-label="breadcrumb"] li:last-child','ol.breadcrumb li:last-child','.breadcrumb li:last-child'];
  for(const selector of selectors){
    for(const node of document.querySelectorAll(selector)){
      const copy=node.cloneNode(true);
      copy.querySelectorAll('ul,svg,.caret,[aria-hidden="true"],button').forEach(x=>x.remove());
      const name=tidy(copy.textContent).replace(/[▾▼⌄]+$/,'').trim();
      if(name && name.length<120 && !/^(Opiskelijat|Students|Valinnat|Choices|Opinnot)$/i.test(name))return name;
    }
  }
  // The dropdown's direct anchor without href contains the selected student's name in some Wilma layouts.
  const list=[...document.querySelectorAll('li')].find(li=>li.querySelectorAll('a[href*="/profiles/students/"]').length>=2);
  if(list){const label=[...list.children].find(x=>x.matches('a:not([href]),button'));
    if(label){const copy=label.cloneNode(true);copy.querySelectorAll('span[aria-hidden],svg,.caret').forEach(x=>x.remove());const name=tidy(copy.textContent);if(name&&name.length<120)return name;}
  }
  return '';
}
async function discoverHomeroom(){
 const groupUrl=location.origin+location.pathname;
 const docs=[document];
 try{
  const response=await fetch(groupUrl,{credentials:'same-origin',cache:'no-store'});
  if(response.ok&&new URL(response.url).origin===location.origin&&new URL(response.url).pathname===location.pathname)docs.push(new DOMParser().parseFromString(await response.text(),'text/html'));
 }catch{}
 for(const doc of docs){
  const students=new Map();
  for(const a of doc.querySelectorAll('a[href]')){
   try{
    const u=new URL(a.getAttribute('href'),groupUrl);
    const m=u.origin===location.origin&&u.pathname.match(/^\/profiles\/students\/(\d+)(?:\/|$)/);
    const name=tidy(a.textContent);
    if(m&&name&&name.length<120&&!students.has(m[1]))students.set(m[1],{id:m[1],name,url:location.origin+'/profiles/students/'+m[1]+'/choices?view=gradebook'});
   }catch{}
  }
  if(students.size)return {people:[...students.values()],source:'homeroom'};
 }
 return {people:[],source:'homeroom'};
}
async function getPeople(){return discoverHomeroom()}
function discover(){
const lists=[...document.querySelectorAll('li')].map(li=>[...li.querySelectorAll('a[href]')].map(a=>{
try{const u=new URL(a.getAttribute('href'),location.href),m=u.origin===location.origin&&u.pathname.match(p);
return m?{id:m[1],name:tidy(a.textContent),url:u.origin+u.pathname+'?view=gradebook'}:null}catch{return null}
}).filter(Boolean));
lists.sort((a,b)=>new Set(b.map(x=>x.id)).size-new Set(a.map(x=>x.id)).size);
const people=new Map((lists[0]||[]).map(x=>[x.id,x]));
// Wilma's dropdown may list only the *other* students.
// Include the student whose gradebook is open, even when there is no dropdown link.
const current=location.pathname.match(p);
if(current&&!people.has(current[1])){
  const dropdown=(lists[0]||[]).length;
  // Do not guess the student's name from the page or expose their numeric ID.
  people.set(current[1],{id:current[1],
    name:currentStudentName() || (cfg.lang==='fi'?'Nykyinen opiskelija':'Current student'),
    url:location.origin+location.pathname+'?view=gradebook'});
  console.info('[OpenApuri] Current student added to dropdown list; please verify identity.',{dropdownLinks:dropdown,total:people.size});
}
return [...people.values()];
}
function parse(html,s){const doc=new DOMParser().parseFromString(html,'text/html');const table=[...doc.querySelectorAll('table')].find(a=>{const h=tidy([...a.querySelectorAll('th')].map(x=>x.textContent).join(' ')).toLowerCase();return h.includes('arvosana')&&(h.includes('ects')||h.includes('laajuus'))});if(!table)throw Error('Gradebook table not found');let group='',subject='',rows=[];for(const tr of table.querySelectorAll('tr')){const level=[...tr.classList].find(x=>/^level\d+$/.test(x)),c=[...tr.children].filter(x=>x.matches('td,th'));if(!level||c.length<3)continue;const name=tidy(c[0].textContent);if(!name)continue;if(level==='level1'){group=name;subject='';continue}if(level==='level2'){subject=name;continue}if(level!=='level3')continue;rows.push({id:s.id,student:s.name,name,group,subject,key:[group,subject,name].join('\u001f'),grade:tidy(c[1].textContent),ects:tidy(c[2].textContent),date:isoDate(c[3]?.textContent),teacher:tidy(c[4]?.textContent)})}return rows}
let root=null;const $=s=>root?.querySelector(s);const el=(tag,txt='',cls='')=>{const e=document.createElement(tag);e.textContent=txt;if(cls)e.className=cls;return e};
const style=document.createElement('style');style.textContent=`#wt-launch{position:fixed;right:16px;bottom:16px;z-index:2147483600;background:#17466f;color:white;padding:11px 16px;border:0;border-radius:9px;font-weight:700;cursor:pointer}#wt-collect,#wt-stop,#wt-status,#wt-note{display:none!important}#wt-screen{position:relative;width:100%;min-height:520px;background:transparent;font:14px system-ui,Arial;color:#17212b}#wt-panel{position:relative;display:flex;flex-direction:column;overflow:hidden;min-height:520px;max-height:82vh;border:1px solid #d4e0e8;border-radius:12px;background:#fff}#wt-header,#wt-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #ddd}#wt-header{background:#eef4fa}#wt-header strong{margin-right:auto;font-size:17px}#wt-panel button,#wt-panel select,#wt-panel input{font:inherit;padding:6px;border:1px solid #b6c3d1;border-radius:5px}#wt-status,#wt-note{padding:6px 16px;color:#4d5c69;font-size:12px}#wt-content{flex:1;overflow:auto;padding:10px 16px}#wt-content table{border-collapse:separate;border-spacing:0;font-size:12px}#wt-content th,#wt-content td{border:1px solid #d7dde2;padding:6px 8px;text-align:center}#wt-content th{position:sticky;top:0;z-index:2;background:#eaf0f6}#wt-content th:first-child,#wt-content td:first-child{position:sticky;left:0;z-index:3;text-align:left;min-width:145px;background:#fff}#wt-content th:first-child{z-index:4;background:#eaf0f6}.wt-heading{width:144px;min-width:144px;max-width:144px;white-space:normal;overflow-wrap:anywhere;word-break:normal;vertical-align:bottom;line-height:1.25;height:auto;min-height:65px;cursor:pointer}.wt-grade{font-weight:bold;min-width:38px}#wt-hide-list{max-height:145px;overflow:auto;padding:10px 18px;border-bottom:1px solid #ddd}#wt-hide-list label{display:block;margin:3px 0}#wt-content .wt-issues td{text-align:left}#wt-content .wt-issues .wt-grade{text-align:center}`;document.head.append(style);
try{localStorage.setItem('openapuri.lastGradebook',location.pathname+location.search)}catch{}
let assessmentHost=null,assessmentLoaded=false,originalContent=[],nativeContainer=null;
function tabStrip(){return document.querySelector('ul.nav.nav-tabs.nav-tabs-primary')}
function installAssessmentTab(){
 const tabs=tabStrip();
 if(!tabs||document.getElementById('wt-class-assessment-tab'))return;
 const item=document.createElement('li');item.id='wt-class-assessment-tab';item.classList.add('oa-added-tab');
 const link=el('a',cfg.lang==='fi'?'Arviointinäkymä':'Grade overview');
 link.href=classBase+'#wt-assessment';
 link.addEventListener('click',e=>{if(!onClassMain)return;e.preventDefault();e.stopPropagation();activateAssessment()});
 item.append(link);
 const issuesItem=document.createElement('li');issuesItem.id='wt-class-issues-tab';issuesItem.classList.add('oa-added-tab');
 const issuesLink=el('a',cfg.lang==='fi'?'Huomiot':'Issues');issuesLink.href=classBase+'#wt-issues';
 
 issuesLink.addEventListener('click',e=>{if(!onClassMain)return;e.preventDefault();e.stopPropagation();activateAssessment('issues')});
 issuesItem.append(issuesLink);
 const support=[...tabs.querySelectorAll('a')].find(a=>/Tuen tilastot|Support statistics/i.test(a.textContent));
 if(support){
  const dropdown=support.closest('li.dropdown');
  if(dropdown&&dropdown.parentElement===tabs)dropdown.after(item,issuesItem);else tabs.append(item,issuesItem);
 }else tabs.append(item,issuesItem);
 if(onClassMain)tabs.addEventListener('click',e=>{if(!e.target.closest('#wt-class-assessment-tab,#wt-class-issues-tab'))restoreNativeContent()},true);
}
function restoreNativeContent(){
 if(!assessmentHost)return;
 assessmentHost.hidden=true;
 for(const entry of originalContent){entry.node.style.display=entry.display}
 document.getElementById('wt-class-assessment-tab')?.classList.remove('active');
 document.getElementById('wt-class-issues-tab')?.classList.remove('active');
}
function activateAssessment(mode='matrix'){
 if(!onClassMain){location.assign(classBase+(mode==='issues'?'#wt-issues':'#wt-assessment'));return}
 state.mode=mode;
 installAssessmentTab();
 const tabs=tabStrip();if(!tabs)return;
 if(!assessmentHost){
  assessmentHost=el('section');assessmentHost.id='wt-assessment-host';
  assessmentHost.style.cssText='width:100%;min-height:460px;background:#fff;border-top:1px solid #d7e1e9;padding:0 0 16px';
  // Find Wilma's tab-content level, keeping the tab bar and its ancestors visible.
  let container=tabs.parentElement;
  for(let depth=0;depth<3&&container.parentElement;depth++){
   const other=[...container.children].filter(n=>n.nodeType===1&&!n.contains(tabs)&&n!==tabs&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE');
   if(other.length)break;
   container=container.parentElement;
  }
  nativeContainer=container;
  const barChild=[...container.children].find(n=>n===tabs||n.contains(tabs));
  if(!barChild)return;
  barChild.insertAdjacentElement('afterend',assessmentHost);
  originalContent=[...container.children].filter(n=>n!==assessmentHost&&n!==barChild&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(node=>({node,display:node.style.display}));
 }
 for(const entry of originalContent)entry.node.style.display='none';
 assessmentHost.hidden=false;
 tabs.querySelectorAll('li.active').forEach(n=>n.classList.remove('active'));
 document.getElementById('wt-class-assessment-tab')?.classList.toggle('active',mode==='matrix');
 document.getElementById('wt-class-issues-tab')?.classList.toggle('active',mode==='issues');
 if(!root)open();else render();
 if(!assessmentLoaded){assessmentLoaded=true;collect()}
}
installAssessmentTab();
let tabTries=0;const tabTimer=setInterval(()=>{
 installAssessmentTab();
 if(onClassMain&&['#wt-assessment','#wt-issues'].includes(location.hash)&&document.getElementById('wt-class-assessment-tab')&&!assessmentLoaded)activateAssessment(location.hash==='#wt-issues'?'issues':'matrix');
 if(++tabTries>=12)clearInterval(tabTimer)
},700);
function status(x){if($('#wt-status'))$('#wt-status').textContent=x}
function open(){state.people=[];root=el('div');root.id='wt-screen';root.innerHTML=`<div id="wt-panel" role="region" aria-label="OpenApuri"><div id="wt-header"><strong id="wt-title"></strong></div><div id="wt-toolbar"><label><select id="wt-period"><option value="school"></option><option value="custom"></option><option value="all"></option></select></label><label id="wt-year-label"><select id="wt-year"></select></label><label id="wt-from-label" hidden><span id="wt-from-caption"></span> <input id="wt-from" type="date"></label><label id="wt-to-label" hidden><span id="wt-to-caption"></span> <input id="wt-to" type="date"></label><input id="wt-search" type="search"><button id="wt-hide"></button><button id="wt-export"></button></div><div id="wt-hide-list" hidden></div><div id="wt-status"></div><div id="wt-note"></div><div id="wt-content"></div></div>`;assessmentHost.append(root);const progressPeeker=document.createElement('button');progressPeeker.type='button';progressPeeker.className='oa-peeker-settings';progressPeeker.title='OpenApuri · Asetukset';progressPeeker.setAttribute('aria-label','Avaa OpenApurin asetukset');progressPeeker.style.cssText='position:absolute;right:18px;bottom:-6px;top:auto;width:45px;height:46px;padding:0;margin:0;border:0;background:transparent;cursor:pointer;z-index:40;display:flex;align-items:center;justify-content:center';const progressPeekerImg=document.createElement('img');progressPeekerImg.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';progressPeekerImg.alt='';progressPeekerImg.style.cssText='display:block;width:45px;height:46px;object-fit:contain;pointer-events:none';progressPeeker.append(progressPeekerImg);progressPeeker.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'progress'}}))});const progressHeading=root.querySelector('#wt-header');progressHeading.style.position='relative';progressHeading.style.paddingRight='78px';progressHeading.append(progressPeeker);for(let y=sy()-7;y<=sy()+2;y++){const op=el('option',y+'–'+(y+1));op.value=y;$('#wt-year').append(op)}$('#wt-year').value=state.year;$('#wt-period').value=state.period;$('#wt-search').value=state.term;$('#wt-from').value=state.from;$('#wt-to').value=state.to;$('#wt-hide').onclick=()=>{$('#wt-hide-list').hidden=!$('#wt-hide-list').hidden};$('#wt-period').onchange=e=>{state.period=e.target.value;dateUI();render()};$('#wt-year').onchange=e=>{state.year=+e.target.value;render()};$('#wt-from').onchange=e=>{state.from=e.target.value;render()};$('#wt-to').onchange=e=>{state.to=e.target.value;render()};$('#wt-search').oninput=e=>{state.term=e.target.value;render()};$('#wt-export').onclick=download;translate();status(cfg.lang==='fi'?'Valmis hakemaan ryhmän tiedot.':'Ready to load group data.');render()}
function translate(){$('#wt-title').textContent=t('title');for(const [id,key] of [['hide','hide'],['export','export']])$('#wt-'+id).textContent=t(key);for(const [i,k] of [['school','school'],['custom','custom'],['all','all']])$('#wt-period').querySelector('[value="'+i+'"]').textContent=t(k);$('#wt-search').placeholder=t('search');$('#wt-from-caption').textContent=t('from');$('#wt-to-caption').textContent=t('to');$('#wt-note').textContent=t('warning')+' '+t('dateNote');dateUI()}
function dateUI(){$('#wt-year-label').hidden=state.period!=='school';$('#wt-from-label').hidden=state.period!=='custom';$('#wt-to-label').hidden=state.period!=='custom'}
function selected(){let a=state.rows.filter(r=>!cfg.hidden.has(r.key));if(state.period==='school')a=a.filter(r=>r.date&&r.date>=state.year+'-08-01'&&r.date<=(state.year+1)+'-07-31');if(state.period==='custom')a=a.filter(r=>r.date&&state.from&&state.to&&state.from<=state.to&&r.date>=state.from&&r.date<=state.to);if(state.term.trim()){let q=state.term.toLocaleLowerCase('fi');a=a.filter(r=>[r.student,r.name,r.group,r.subject].some(x=>x.toLocaleLowerCase('fi').includes(q)))}return a}
function renderHide(){const pane=$('#wt-hide-list');pane.replaceChildren(el('div',t('hideNote')));const cs=[...new Map(state.rows.map(r=>[r.key,r.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fi'));for(const [key,name]of cs){const l=el('label');const c=el('input');c.type='checkbox';c.checked=!cfg.hidden.has(key);c.onchange=()=>{c.checked?cfg.hidden.delete(key):cfg.hidden.add(key);save();render()};l.append(c,document.createTextNode(' '+name));l.title=key.replaceAll('\u001f',' / ');pane.append(l)}}
function openMessageEditor(available){
  if(document.getElementById('wt-message-editor'))return;
  const person=available.find(x=>state.messageStudentIds.has(x.id));
  if(!person){alert(mt('empty'));return}
  const overlay=el('div');overlay.id='wt-message-editor';
  overlay.style.cssText='position:fixed;inset:0;background:#0009;z-index:2147483630;display:grid;place-items:center;padding:15px';
  const card=el('section');card.style.cssText='width:min(650px,96vw);max-height:90vh;overflow:auto;background:white;color:#213547;padding:22px;border-radius:12px;box-shadow:0 20px 60px #0005;font:14px/1.5 system-ui';
  card.append(el('h2',cfg.lang==='fi'?'Viestipohjan muokkaus':'Message template editor'));
  card.append(el('p',person.name+' — '+(cfg.lang==='fi'?'viesti lähetetään vain Wilmassa manuaalisesti':'messages are sent manually in Wilma')));
  function field(label,value,multi){const wrapper=el('label',label);wrapper.style.cssText='display:block;margin:12px 0;font-weight:600';const input=el(multi?'textarea':'input');if(multi)input.rows=9;else input.type='text';input.value=value;input.style.cssText='display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #9cabb8;border-radius:6px;font:14px/1.5 system-ui;box-sizing:border-box';wrapper.append(input);card.append(wrapper);return input}
  const subject=field(mt('subject'),state.messageSubject||mt('sampleSubject'),false);
  const body=field(mt('body'),state.messageText||mt('sampleBody'),true);
  const hint=el('p',cfg.lang==='fi'?'Muuttujat: {etunimi} (opiskelijan etunimi). Sisältö tallennetaan vain tämän välilehden muistiin.':'Variable: {etunimi} (student first name). Text is kept in this tab only.');
  card.append(hint);
  const preview=el('pre');preview.style.cssText='white-space:pre-wrap;background:#f2f6f9;border:1px solid #d9e1e8;padding:12px;border-radius:6px;max-height:200px;overflow:auto';
  const build=()=>subject.value+'\n\n'+body.value.replaceAll('{etunimi}',person.name.split(/\s+/)[0]).replaceAll('{name}',person.name.split(/\s+/)[0]);
  const update=()=>{preview.textContent=build()};subject.oninput=update;body.oninput=update;update();
  card.append(el('h3',cfg.lang==='fi'?'Esikatselu':'Preview'),preview);
  const actions=el('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:9px;margin-top:14px';
  const keep=()=>{state.messageSubject=subject.value;state.messageText=body.value};
  const close=()=>{keep();overlay.remove()};
  const copy=el('button',cfg.lang==='fi'?'Kopioi ja avaa Wilman viestit':'Copy and open Wilma messages');
  copy.onclick=async()=>{keep();try{await navigator.clipboard.writeText(build())}catch{prompt(mt('noClipboard'),build());return}alert(mt('notice'));window.open(location.origin+'/messages/compose','_blank','noopener')};
  const cancel=el('button',cfg.lang==='fi'?'Sulje':'Close');cancel.onclick=close;
  actions.append(copy,cancel);card.append(actions);overlay.append(card);document.body.append(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
}
function render(){if(!root||state.busy||!state.loaded)return;$('#wt-export').disabled=!state.rows.length;renderHide();const box=$('#wt-content');box.replaceChildren();if(!cfg.enabled||!state.rows.length){box.append(el('p',t('none')));return}const rows=selected();if(state.mode==='issues'){const flagged=rows.filter(r=>flag(r.grade));box.append(el('p',t('found',{n:new Set(flagged.map(x=>x.id)).size,c:new Set(flagged.map(x=>x.key)).size,r:flagged.length})));const unique=[...new Map(flagged.map(r=>[r.id,{id:r.id,name:r.student}])).values()];
const msgbox=el('section');msgbox.style.cssText='max-width:760px;border:1px solid #cedde9;border-radius:9px;background:#f5f9fc;padding:12px;margin:10px 0;font:14px/1.45 system-ui';
msgbox.append(el('h3',cfg.lang==='fi'?'Viestit huomiota vaativille opiskelijoille':'Message students with concerning grades'));
const help=el('p',cfg.lang==='fi'?'Valitse opiskelijat ja tallennettu viestipohja. Vastaanottajat valitaan ja tarkistetaan Wilmassa ennen lähettämistä.':'Select students and a saved template. Recipients must be selected and verified in Wilma before sending.');msgbox.append(help);
const picks=el('div');picks.style.cssText='max-height:160px;overflow:auto;border:1px solid #d2dce5;background:#fff;border-radius:5px;padding:6px;margin-bottom:10px';
for(const person of unique){const item=el('label');item.style.cssText='display:inline-block;margin:5px 15px 5px 0';const cb=el('input');cb.type='checkbox';cb.checked=state.messageStudentIds.has(person.id);cb.onchange=()=>{if(cb.checked)state.messageStudentIds.add(person.id);else state.messageStudentIds.delete(person.id)};item.append(cb,document.createTextNode(' '+person.name));picks.append(item)}msgbox.append(picks);
const templateRow=el('div');templateRow.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center';
const templateSelect=el('select');templateSelect.style.cssText='min-width:180px;max-width:100%;padding:7px';
const options=[{title:cfg.lang==='fi'?'Oletusviesti':'Default message',subject:mt('sampleSubject'),body:mt('sampleBody')}];
try{const saved=JSON.parse(localStorage.getItem('openapuri.messageTemplates.v1')||'[]');if(Array.isArray(saved))for(const item of saved){if(typeof item?.title==='string'&&typeof item.subject==='string'&&typeof item.body==='string')options.push(item)}}catch{}
for(const [i,opt]of options.entries()){const o=el('option',opt.title);o.value=i;templateSelect.append(o)}
templateRow.append(templateSelect);
const go=el('button',cfg.lang==='fi'?'Valmistele Wilma-viesti':'Prepare Wilma message');go.onclick=async()=>{
 const people=unique.filter(p=>state.messageStudentIds.has(p.id));if(!people.length){alert(mt('empty'));return}
 const chosen=options[+templateSelect.value]||options[0];
 const body=people.length===1?chosen.body.replaceAll('{etunimi}',people[0].name.split(/\s+/)[0]).replaceAll('{name}',people[0].name.split(/\s+/)[0]):chosen.body.replaceAll('{etunimi}',cfg.lang==='fi'?'opiskelija':'student').replaceAll('{name}',cfg.lang==='fi'?'opiskelija':'student');
 const request={subject:chosen.subject,body,recipientsNames:people.map(p=>p.name),recipientIds:people.map(p=>p.id),recipientRule:chosen.recipientRule||'valitut_opiskelijat',createdAt:Date.now()};
 localStorage.setItem('openapuri.composeRequest.v1',JSON.stringify(request));
 window.open(location.origin+'/messages/compose#wt-library','_blank','noopener');
};templateRow.append(go);
const editor=el('button',cfg.lang==='fi'?'Muokkaa viestipohjia sivupaneelissa':'Manage templates in sidebar');editor.onclick=()=>window.open(location.origin+'/messages/compose#wt-library-templates','_blank','noopener');templateRow.append(editor);
msgbox.append(templateRow);box.append(msgbox);
const table=el('table');table.className='wt-issues';const h=el('tr');for(const v of ['student','course','grade','issue'])h.append(el('th',t(v)));table.append(h);flagged.sort((a,b)=>a.student.localeCompare(b.student,'fi')||a.name.localeCompare(b.name,'fi'));for(const r of flagged){const tr=el('tr');tr.append(el('td',r.student),el('td',r.name));const g=el('td',r.grade,'wt-grade'),[bg,fg]=color(r.grade,true);g.style.background=bg;g.style.color=fg;tr.append(g,el('td',t(flag(r.grade))));table.append(tr)}box.append(table);return}
const cols=[...new Map(rows.map(r=>[r.key,r.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fi'));const by=new Map();for(const r of rows){if(!by.has(r.id))by.set(r.id,new Map());by.get(r.id).set(r.key,r)}const people=state.people.filter(s=>by.has(s.id));people.sort((a,b)=>state.sort&&state.sort!=='student'?(by.get(a.id)?.get(state.sort)?.grade||'').localeCompare(by.get(b.id)?.get(state.sort)?.grade||'','fi',{numeric:true}):a.name.localeCompare(b.name,'fi',{numeric:true})*(state.nameDescending?-1:1));box.append(el('p',t('found',{n:people.length,c:cols.length,r:rows.length})));const table=el('table'),head=el('thead'),hr=el('tr');const studentHeading=el('th',t('student')+' ↕');studentHeading.style.cursor='pointer';studentHeading.tabIndex=0;studentHeading.title=cfg.lang==='fi'?'Järjestä opiskelijan nimen mukaan':'Sort by student name';const sortStudents=()=>{state.nameDescending=state.sort==='student'?!state.nameDescending:false;state.sort='student';render()};studentHeading.onclick=sortStudents;studentHeading.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sortStudents()}};hr.append(studentHeading);for(const [key,name]of cols){const th=el('th',name,'wt-heading');th.title=key.replaceAll('\u001f',' / ');th.tabIndex=0;th.onclick=()=>{state.sort=key;render()};th.onkeydown=e=>{if(e.key==='Enter'){state.sort=key;render()}};hr.append(th)}head.append(hr);table.append(head);const body=el('tbody');for(const s of people){const tr=el('tr');tr.append(el('td',s.name));for(const [key]of cols){const r=by.get(s.id)?.get(key),td=el('td',r?(r.grade||'…'):'—','wt-grade'),[bg,fg]=color(r?.grade||'',!!r);td.style.background=bg;td.style.color=fg;td.title=r?r.name+' | ECTS: '+r.ects:t('missing');tr.append(td)}body.append(tr)}table.append(body);box.append(table)}
async function collect(){
 if(state.busy||state.loaded)return;
 state.busy=true;state.stop=false;state.errors=[];
 const lookup=await getPeople();
 if(!root){state.busy=false;return}
 state.people=lookup.people;state.source=lookup.source;
 const count=state.people.length;
 const results=Array.from({length:count},()=>[]);
 let next=0;
 const worker=async()=>{
  while(!state.stop&&root){
   const i=next++;
   if(i>=count)break;
   const student=state.people[i];
   try{
    const res=await fetch(student.url,{credentials:'same-origin',redirect:'follow',cache:'no-store'});
    const finalUrl=new URL(res.url);
    if(!res.ok||finalUrl.origin!==location.origin||!p.test(finalUrl.pathname))throw Error('Unexpected HTTP response');
    const rows=parse(await res.text(),student);
    results[i]=rows;
    if(!rows.length)state.errors.push('Student '+(i+1)+': 0 courses');
   }catch(e){
    state.errors.push('Student '+(i+1)+': '+e.message);
   }
  }
 };
 await Promise.all(Array.from({length:Math.min(5,count)},()=>worker()));
 state.rows=results.flat();
 state.busy=false;state.loaded=true;
 if(state.errors.length)console.warn('[OpenApuri] Some gradebook data was unavailable; results may be incomplete.',{unavailable:state.errors.length,total:count});
 if(root)render();
}
function download(){const header=['Student','Course','Category','Subject','Grade','ECTS','Completion date','Teacher'];const cells=[header,...selected().map(r=>[r.student,r.name,r.group,r.subject,r.grade,r.ects,r.date,r.teacher])];const quote=v=>{let s=String(v??'');if(/^\s*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const csv='\ufeff'+cells.map(x=>x.map(quote).join(';')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=u;a.download='wilmatools_progress.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
})();
});
if(currentPath==='/'||/^\/profiles\/(?:students|teachers)(?:\/|$)/.test(currentPath))
 afterDom(()=>{(() => {
'use strict';
// Per-module state controlled by OpenApuri's in-app settings menu.
try {if(JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').search===false)return;}catch{}

// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

// Prevent duplicated tool initialization inside the hidden schedule viewer.
const embedPage=new URLSearchParams(location.search).get('oh_embed')==='1';
if(window.top!==window.self&&!embedPage)return;
const homePage=location.pathname==='/';
const directoryPage=/^\/profiles\/students\/?$/.test(location.pathname);
const profilesPage=/^\/profiles\/(students|teachers)(?:\/|$)/.test(location.pathname);
if(!homePage&&!profilesPage||document.getElementById('oh-tab')||document.getElementById('oh-home'))return;
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
if(homePage){
  // Use an existing home dashboard card grid when present; never pin a wide
  // panel above the other Wilma dashboard cards.
  const card=make('section','panel panel-default');card.id='oh-home';
  card.style.cssText='min-width:0;margin:0 0 12px;background:#fff;border:1px solid #d4dfe7;border-radius:5px';
  const heading=make('h3','panel-heading','Opiskelija- ja henkilökuntahaku');
  heading.style.cssText='margin:0;padding:11px 14px;font-size:17px';
  const body=make('div','panel-body');body.style.cssText='padding:12px';
  const controls=make('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  const q=make('input');q.type='search';q.placeholder='Hae opiskelijaa tai opettajaa…';
  q.setAttribute('aria-label','Hae opiskelijoita ja henkilökuntaa');
  q.style.cssText='flex:1 1 200px;min-width:0;padding:7px;border:1px solid #c4d3df;border-radius:4px';
  const go=make('button','','Hae');go.style.cssText='padding:7px 12px;background:#176393;color:white;border:0;border-radius:4px;cursor:pointer';
  const expand=make('button','','Laajenna');expand.style.cssText='padding:7px 12px;background:white;border:1px solid #c4d3df;border-radius:4px;cursor:pointer';
  const frameHolder=make('div');frameHolder.hidden=true;
  const frame=make('iframe');frame.title='Laajennettu opiskelija- ja opettajahaku';
  frame.style.cssText='width:100%;height:690px;border:1px solid #dce6ed;margin-top:10px;background:#fff';
  const url=()=>{
    const u=new URL('/profiles/students/',location.origin);
    if(q.value.trim())u.searchParams.set('oh_q',q.value.trim());
    u.hash='opiskelijahaku';
    return u;
  };
  const navigate=()=>location.assign(url().href);
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();navigate()}});
  go.onclick=navigate;
  expand.onclick=()=>{
    frameHolder.hidden=!frameHolder.hidden;
    expand.textContent=frameHolder.hidden?'Laajenna':'Pienennä';
    if(!frameHolder.hidden){const u=url();u.searchParams.set('oh_embed','1');frame.src=u.href}
    else frame.removeAttribute('src');
  };
  controls.append(q,go,expand);frameHolder.append(frame);body.append(controls,frameHolder);card.append(heading,body);
  // Insert beside actual dashboard cards, retaining their native layout.
  const dashboard=$('main#main-content')||$('main');
  const existingCards=dashboard?[...dashboard.querySelectorAll('.panel, .card, .dashboard-card')].filter(el=>!el.closest('#oh-home')):[];
  const anchor=existingCards.find(el=>el.getBoundingClientRect().width>0)||existingCards[0];
  if(anchor?.parentElement){
    const parent=anchor.parentElement;
    // Match the dashboard's grid column width and placement.
    const column=anchor.closest('[class*="col-md-"],[class*="col-lg-"],[class*="col-sm-"]');
    if(column&&column.parentElement){
      const wrapper=make('div',column.className);
      wrapper.append(card);column.parentElement.insertBefore(wrapper,column.nextSibling);
    }else parent.insertBefore(card,anchor.nextSibling);
  }else (dashboard||document.body).append(card);
  return;
}
const tabs=$('main#main-content ul.nav.nav-tabs-primary')||$('ul.nav.nav-tabs-primary');
if(!tabs){console.warn('[OpiskelijaHaku] Välilehtipalkkia ei löydy');return}
const li=make('li');li.id='oh-tab';li.classList.add('oa-added-tab');
const link=make('a','','Haku');
link.href=directoryPage?'#opiskelijahaku':'/profiles/students/#opiskelijahaku';
link.setAttribute('role','tab');li.append(link);
tabs.insertBefore(li,$('.tabdrop',tabs));
if(!directoryPage)return; // Student profiles: keep Wilma's own tabs and navigate to the search.
const native=$('main#main-content .panel.tab-content')||$('.panel.tab-content');
if(!native){li.remove();console.warn('[OpiskelijaHaku] Sisältöpaneelia ei löydy');return}
const panel=make('section');panel.id='oh-panel';panel.hidden=true;native.insertAdjacentElement('afterend',panel);
let active=false,abort=null,rows=[],picked=new Map(),directory=new Map(),teacherDirectory=new Map(),directoryLoading=false,directoryLoaded=false,teacherDirectoryLoaded=false;
function changeTab(enabled){active=enabled;panel.hidden=!enabled;native.style.display=enabled?'none':'';li.classList.toggle('active',enabled);link.setAttribute('aria-selected',String(enabled))}
link.onclick=e=>{e.preventDefault();$$('li.active',tabs).forEach(n=>n.classList.remove('active'));changeTab(true);renderChoices()};
tabs.addEventListener('click',e=>{if(!e.target.closest('#oh-tab')&&e.target.closest('a'))changeTab(false)});
panel.append(make('h2','','Opiskelija- ja opettajahaku'),make('p','oh-help','Hae opiskelijoita tai henkilökuntaa nimellä, valitse henkilöt ja tarkastele työjärjestysten opintojaksoja, ajankohtia ja opetustiloja.'));
const searchPeeker=document.createElement('button');searchPeeker.type='button';searchPeeker.className='oa-peeker-settings';searchPeeker.title='OpenApuri · Asetukset';searchPeeker.setAttribute('aria-label','Avaa OpenApurin asetukset');searchPeeker.style.cssText='position:absolute;right:18px;bottom:-6px;top:auto;width:45px;height:46px;padding:0;margin:0;border:0;background:transparent;cursor:pointer;z-index:40;display:flex;align-items:center;justify-content:center';const searchPeekerImg=document.createElement('img');searchPeekerImg.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';searchPeekerImg.alt='';searchPeekerImg.style.cssText='display:block;width:45px;height:46px;object-fit:contain;pointer-events:none';searchPeeker.append(searchPeekerImg);searchPeeker.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'search'}}))});
const searchHeading=panel.querySelector('h2');searchHeading.style.position='relative';searchHeading.style.paddingRight='78px';searchHeading.append(searchPeeker);
const chooser=make('div','oh-chooser'),chooserLabel=make('label'),filter=make('input');
filter.type='search';filter.placeholder='Hae opiskelijaa tai henkilökuntaa nimellä…';filter.autocomplete='off';
chooserLabel.append(make('strong','','Etsi henkilöä'),filter);chooser.append(chooserLabel);
const chooserActions=make('div'),refresh=make('button','','Päivitä luettelo'),directoryStatus=make('span','oh-help','');
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
const personKey=p=>(p.type||'student')+':'+p.id;

function readNames(doc,kind='students'){
const re=kind==='teachers'?teacherRe:studentRe,store=kind==='teachers'?teacherDirectory:directory;
for(const a of $$('a[href]',doc)){
  let u;try{u=new URL(a.getAttribute('href'),kind==='teachers'?location.origin+'/profiles/teachers/':location.href)}catch{continue}
  if(u.origin!==location.origin)continue;
  const m=re.exec(u.pathname);if(!m)continue;
  const n=clean(a.textContent);
  if(n.length>2&&n.length<120)store.set(m[1],{id:m[1],name:n,type:kind==='teachers'?'teacher':'student'});
}
}
// Do not seed the picker from the default 'Ohjaamasi tai valvomasi opiskelijat' overview.
// Names are loaded explicitly from the directory's full-list / alphabetical views.
function renderChoices(){
  choices.replaceChildren();
  const q=norm(filter.value);
  const people=[...directory.values(),...teacherDirectory.values()]
    .filter(p=>nameMatches(p.name,q))
    .sort((a,b)=>a.name.localeCompare(b.name,'fi')||personKey(a).localeCompare(personKey(b)));
  const visible=people.slice(0,80);
  for(const person of visible){
    const chosen=picked.has(personKey(person));
    const button=make('button','oh-choice'+(chosen?' oh-chosen':''),(chosen?'✓ ':'')+person.name);
    if(person.type==='teacher'){
      const marker=make('span','oh-staff-tag','Ope');
      marker.style.cssText='margin-left:7px;font-size:11px;font-weight:400;color:#7a8994;opacity:.8';
      button.append(marker);
    }
    button.type='button';button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(chosen));
    button.onclick=()=>{
      const key=personKey(person);
      if(picked.has(key))picked.delete(key);
      else if(picked.size<20)picked.set(key,person);
      else{say('Enintään 20 henkilöä kerrallaan.',true);return}
      renderPicked();renderChoices();
    };
    choices.append(button);
  }
  if(!visible.length)choices.append(make('div','oh-help',directoryLoading?'Nimiluetteloita ladataan…':!directoryLoaded&&!teacherDirectoryLoaded?'Kirjoita nimi tai paina Päivitä luettelot.':'Ei osumia.'));
  directoryStatus.textContent=(directoryLoading?'Ladataan… ':'')+directory.size+' opiskelijaa · '+teacherDirectory.size+' henkilökunnan jäsentä · osumia '+people.length+(people.length>80?' (näytetään 80)':'');
}
filter.addEventListener('input',()=>{
  renderChoices();
  if(!directoryLoading&&(!directoryLoaded||!teacherDirectoryLoaded))readDirectory();
});
async function readDirectory(force=false){
  if(directoryLoading)return;
  if(!force&&directoryLoaded&&teacherDirectoryLoaded)return;
  directoryLoading=true;refresh.disabled=true;renderChoices();
  say('Ladataan opiskelija- ja opettajaluetteloa…');
  const loadKind=async kind=>{
    const teacherMode=kind==='teachers';
    if(!force&&(teacherMode?teacherDirectoryLoaded:directoryLoaded))return {kind,skipped:true};
    const store=teacherMode?teacherDirectory:directory;
    const base='/profiles/'+kind;
    try{
      const links=[];
      if(teacherMode){
        const res=await fetch(base,{credentials:'same-origin'});
        if(!res.ok)throw Error('HTTP '+res.status);
        const doc=new DOMParser().parseFromString(await res.text(),'text/html');
        readNames(doc,kind);
        links.push(...$$('a[href]',doc));
      }else links.push(...$$('main#main-content a[href]').filter(a=>!a.closest('#oh-panel')));
      const urls=new Map();
      for(const a of links){
        let u;try{u=new URL(a.getAttribute('href'),location.origin+base+'/')}catch{continue}
        if(u.origin!==location.origin)continue;
        const path=u.pathname.replace(/\/$/,'');
        const isAlpha=new RegExp('^'+base+'/[a-zåäö]$','i').test(path);
        if(isAlpha||path===base+'/all'||(path===base&&norm(a.textContent)==='kaikki'))urls.set(u.href,u);
      }
      const queue=[...urls.values()].slice(0,42);let next=0,failed=0;
      async function worker(){
        while(next<queue.length){
          const u=queue[next++];
          try{
            const res=await fetch(u.href,{credentials:'same-origin'});
            if(!res.ok)throw Error('HTTP '+res.status);
            readNames(new DOMParser().parseFromString(await res.text(),'text/html'),kind);
          }catch(e){failed++;console.warn('[OpiskelijaHaku] Luetteloa ei voitu hakea:',e)}
          if(next%4===0)renderChoices();
        }
      }
      await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
      if(teacherMode)teacherDirectoryLoaded=true;else directoryLoaded=queue.length>0;
      return {kind,count:store.size,failed,missing:!queue.length&&!teacherMode};
    }catch(e){return {kind,error:e.message}}
  };
  try{
    const summary=await Promise.all([loadKind('students'),loadKind('teachers')]);
    const errors=summary.filter(x=>x.error||x.missing);
    say('Luettelot: '+directory.size+' opiskelijaa ja '+teacherDirectory.size+' henkilökunnan jäsentä.'+
      (errors.length?' Huomautus: '+errors.map(x=>x.kind+(x.error?' ('+x.error+')':' (luettelolinkkejä ei löytynyt)')).join(', '):''),Boolean(errors.length));
  }finally{directoryLoading=false;refresh.disabled=false;renderChoices()}
}
refresh.onclick=()=>{directoryLoaded=false;teacherDirectoryLoaded=false;readDirectory(true)};
function renderPicked(){selection.replaceChildren(make('strong','','Valitut henkilöt ('+picked.size+')'));const line=make('div');for(const p of picked.values()){const pill=make('span','oh-pill',p.name+' ');const remove=make('button','','×');remove.title='Poista';remove.onclick=()=>{picked.delete(personKey(p));renderPicked();renderChoices()};pill.append(remove);line.append(pill)}selection.append(line)}
cancel.onclick=()=>abort?.abort();
reset.onclick=()=>{picked.clear();rows=[];filter.value='';results.replaceChildren();renderPicked();renderChoices();say('Valinnat tyhjennetty.')};
function blockMoment(block,week){
const source=[block.querySelector('h3.sr-only')?.textContent,block.getAttribute('data-original-title'),block.getAttribute('title')].filter(Boolean).join(' ');
const dateMatch=source.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
let date=null;
function day(d,m,y){const x=new Date(y,m-1,d,12);return x.getDate()===d&&x.getMonth()===m-1&&x.getFullYear()===y?x:null}
if(dateMatch)date=day(+dateMatch[1],+dateMatch[2],+dateMatch[3]);
if(!date){const partial=source.match(/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/);if(partial)for(const y of [week.getFullYear()-1,week.getFullYear(),week.getFullYear()+1]){const x=day(+partial[1],+partial[2],y);if(x&&Math.abs(x-week)<7*86400000){date=x;break}}}
if(!date){const days=['maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai','sunnuntai'];const found=days.flatMap((x,i)=>new RegExp('(?:^|[\\s,;])'+x+'(?=\\s|[,:;.]|$)','i').test(source)?[i]:[]);if(found.length===1){date=new Date(week);date.setDate(date.getDate()+found[0])}}
const scrubbed=source.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g,' ').replace(/\b\d{1,2}\.\d{1,2}\.(?!\d)/g,' ');
const ranges=[...scrubbed.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)];
let time=ranges.length===2?{start:+ranges[0][1]*60+(+ranges[0][2]),end:+ranges[1][1]*60+(+ranges[1][2])}:null;
if(time&&time.end<=time.start)time=null;
return {date,time};
}
// Extract date and time from the rendered Wilma grid when lesson text lacks them.
// Only calibrated ruler coordinates and identifiable weekday headings are accepted.
function gridLessonMoment(block,week){
  const root=block.closest('.schedule');
  const axis=root?.querySelector('.hourlist.hours-container')||root?.querySelector('.hourlist');
  const container=block.closest('.schedule-container');
  if(!root||!axis||!container)return {date:null,time:null};
  const clock=s=>{
    const m=String(s||'').match(/(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/);
    return m?(+m[1]*60+(+m[2])):null;
  };
  const ticks=[];
  const walk=axis.querySelectorAll('.hour, .time, [class*="label"], span, div');
  for(const el of walk){
    if(el.children.length&&el.textContent.trim().length>16)continue;
    const value=clock(el.textContent);
    if(value===null)continue;
    const r=el.getBoundingClientRect();
    if(r.height<=0||r.width<=0)continue;
    // Prefer leaf text positions, avoiding duplicated times in ancestor nodes.
    if([...el.children].some(c=>clock(c.textContent)!==null))continue;
    ticks.push({value,y:r.top+r.height/2});
  }
  ticks.sort((a,b)=>a.y-b.y);
  const pairs=[];
  for(const tick of ticks)if(!pairs.some(p=>Math.abs(p.y-tick.y)<3))pairs.push(tick);
  let time=null;
  if(pairs.length>=2){
    const a=pairs[0],b=pairs[pairs.length-1],scale=(b.y-a.y)/(b.value-a.value);
    if(Number.isFinite(scale)&&scale>.3&&scale<10){
      const r=block.getBoundingClientRect();
      const toMin=y=>Math.round((a.value+(y-a.y)/scale)/5)*5;
      const start=toMin(r.top),end=toMin(r.bottom);
      if(start>=0&&end<=1440&&end>start)time={start,end};
    }
  }
  const weekdays=['ma','ti','ke','to','pe','la','su'];
  const header=root.querySelector('.weekday-container');
  const headings=[];
  if(header){
    const dayRe=/(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|(?:^|[\s(])(?:ma|ti|ke|to|pe|la|su)(?:[\s.)]|$))/i;
    for(const el of header.querySelectorAll('*')){
      if(el.children.length&&[...el.children].some(c=>dayRe.test(c.textContent)))continue;
      const label=String(el.textContent||'').trim();
      if(!label||!dayRe.test(label))continue;
      const x=el.getBoundingClientRect();
      if(x.width<=0)continue;
      const low=label.toLocaleLowerCase('fi');
      const d=low.match(/maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|(?:^|[\s(])(ma|ti|ke|to|pe|la|su)(?=[\s.)]|$)/);
      if(!d)continue;
      const day=d[0].trim().replace(/[().]/g,'');
      let index=weekdays.indexOf(day);
      if(index<0)index=['maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai','sunnuntai'].indexOf(day);
      if(index>=0)headings.push({index,x:x.left+x.width/2});
    }
  }
  let date=null;
  if(headings.length){
    const middle=block.getBoundingClientRect(),x=middle.left+middle.width/2;
    const best=headings.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a);
    // Ensure it lies within a plausible weekday column, never choose a faraway label.
    const spacing=headings.length>1?Math.min(...headings.slice(1).map((h,i)=>Math.abs(h.x-headings[i].x)).filter(n=>n>4)):container.getBoundingClientRect().width/5;
    if(Math.abs(best.x-x)<=Math.max(25,spacing*.6)){
      date=new Date(week);date.setDate(date.getDate()+best.index);
    }
  }
  return {date,time};
}
function lessonLabel(l){
const day=l.date?fi(new Date(l.date+'T12:00:00')):'Viikko '+l.week+' (päivä tuntematon)';
return day+(l.time?' '+pad(Math.floor(l.time.start/60))+':'+pad(l.time.start%60)+'–'+pad(Math.floor(l.time.end/60))+':'+pad(l.time.end%60):' (kellonaika tuntematon)');
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
const groupUrls=[];
for(const link of $$('a[href]',block)){
  let u;try{u=new URL(link.getAttribute('href'),location.origin)}catch{continue}
  if(u.origin===location.origin&&/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(u.pathname))groupUrls.push(u.pathname);
}
const roomNode=$(':scope > .info .rooms',block)||$(':scope > .info .room',block)||
  $('a.rooms',block)||$('a.room',block)||$('.rooms',block)||$('.room',block)||
  $('a[href*="/profiles/rooms/"]',block)||$('a[href*="/profiles/facilities/"]',block)||
  $('a[href*="/profiles/classrooms/"]',block)||$('[data-room]',block);
const room=clean(roomNode?.getAttribute('title')||roomNode?.getAttribute('data-room')||roomNode?.textContent||'');
foundCourses++;
const moment=blockMoment(block,week);
if((!moment.date||!moment.time)&&block.isConnected){
  const fromGrid=gridLessonMoment(block,week);
  if(!moment.date)moment.date=fromGrid.date;
  if(!moment.time)moment.time=fromGrid.time;
}
if(moment.date&&(moment.date<from||moment.date>to)){ignoredByDate++;continue}
if(clockRange){
if(!moment.time){parseSchedule.unknownTimes=(parseSchedule.unknownTimes||0)+1;ignoredByTime++;continue}
if(moment.time.end<=clockRange.start||moment.time.start>=clockRange.end){ignoredByTime++;continue}
}
const teachers=new Map();for(const a of $$('a.teachers[href]',block)){let u;try{u=new URL(a.href,location.href)}catch{continue}const m=teacherRe.exec(u.pathname);if(!m||u.origin!==location.origin)continue;teachers.set(m[1],{id:m[1],name:clean(a.getAttribute('title')||a.textContent)})}
out.push({person,course,group,groupUrls,teachers:[...teachers.values()],week:iso(week),lesson:{date:moment.date?iso(moment.date):null,time:moment.time,week:iso(week),room},partial:!moment.date&&(week<from||new Date(week.getTime()+6*86400000)>to)});
}
if(blocks.length&&foundCourses===0)throw Error('Työjärjestysmerkintöjä löytyi, mutta opintojaksotietoa ei tunnistettu.');
// Genuine empty results are possible after applying date/time filters.
return {rows:out,stats:{blocks:blocks.length,courses:foundCourses,ignoredByDate,ignoredByTime}};
}
function parseExportSchedule(data,person,week,from,to,clockRange){
  if(!data||!Array.isArray(data.Schedule))return null;
  const out=[];
  const parseTime=v=>{
    const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(v||''));
    return m?+m[1]*60+(+m[2]):null;
  };
  for(const entry of data.Schedule){
    const day=Number(entry?.Day);
    if(!Number.isInteger(day)||day<1||day>7)continue;
    const d=new Date(week);d.setDate(week.getDate()+day-1);
    if(d<from||d>to)continue;
    const start=parseTime(entry.Start),end=parseTime(entry.End);
    const time=start!==null&&end!==null&&end>start?{start,end}:null;
    if(clockRange&&(!time||time.end<=clockRange.start||time.start>=clockRange.end))continue;
    for(const group of Array.isArray(entry.Groups)?entry.Groups:[]){
      const course=clean(group?.FullCaption||group?.Caption||group?.ShortCaption);
      if(!course)continue;
      const groupName=clean(group?.Class||entry.Class||'');
      const rawRooms=group?.Rooms||entry.Rooms||group?.Room||entry.Room;
      const room=Array.isArray(rawRooms)?rawRooms.map(x=>clean(x?.LongCaption||x?.Caption||x?.Name||x)).filter(Boolean).join(', '):clean(rawRooms?.LongCaption||rawRooms?.Caption||rawRooms?.Name||(typeof rawRooms==='string'?rawRooms:''));
      const teacherList=new Map();
      for(const t of Array.isArray(group.Teachers)?group.Teachers:[]){
        const id=String(t?.Id||'');
        if(!/^\d+$/.test(id))continue;
        teacherList.set(id,{id,name:clean(t.LongCaption||t.Caption||'Opettaja')});
      }
      out.push({person,course,group:groupName,groupUrls:[],teachers:[...teacherList.values()],
        week:iso(week),lesson:{date:iso(d),time,week:iso(week),room},partial:false});
    }
  }
  return out;
}
let exportNotAvailable=false;
async function tryExportSchedule(person,week,from,to,clockRange,signal){
  if(exportNotAvailable)return null;
  const url=new URL('/schedule/export/students/'+encodeURIComponent(person.id)+'/',location.origin);
  url.searchParams.set('date',fi(week));
  const response=await fetch(url.href,{credentials:'same-origin',signal,headers:{Accept:'application/json'}});
  if(!response.ok){
    if(response.status===401||response.status===403||response.status===404)exportNotAvailable=true;
    return null;
  }
  const raw=await response.text();
  // Older Wilma instances may return JSON with text/html or text/plain.
  if(!/^\s*\{/.test(raw))return null;
  let data;try{data=JSON.parse(raw)}catch{return null}
  const rows=parseExportSchedule(data,person,week,from,to,clockRange);
  if(!rows?.length)return null;
  return {rows,stats:{blocks:rows.length,courses:rows.length,ignoredByDate:0,ignoredByTime:0,source:'json'}};
}
async function renderedSchedule(url,signal,parse){
  // Parse *while attached*: removing the iframe invalidates layout geometry.
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    frame.style.cssText='position:fixed;left:-20000px;top:0;width:1100px;height:800px;visibility:hidden;pointer-events:none;border:0';
    let completed=false,interval=null,timeout=null,loaded=false;
    const cleanup=()=>{clearInterval(interval);clearTimeout(timeout);signal.removeEventListener('abort',abort);frame.remove()};
    const finish=(err,doc)=>{
      if(completed)return;
      completed=true;
      try{if(err)reject(err);else resolve(parse(doc))}catch(e){reject(e)}
      finally{cleanup()}
    };
    const abort=()=>finish(new Error('Haku keskeytettiin.'));
    if(signal.aborted)return reject(new Error('Haku keskeytettiin.'));
    signal.addEventListener('abort',abort,{once:true});
    frame.addEventListener('load',()=>{loaded=true});
    frame.addEventListener('error',()=>finish(new Error('Työjärjestyksen avaus epäonnistui.')));
    interval=setInterval(()=>{
      let doc;try{doc=frame.contentDocument}catch{return}
      if(!doc)return;
      if(doc.querySelector('#schedule .block')){
        // Allow one paint so getBoundingClientRect reflects rendered grid.
        clearInterval(interval);
        requestAnimationFrame(()=>requestAnimationFrame(()=>finish(null,doc)));
      }else if(loaded&&!doc.querySelector('#schedule-container'))finish(new Error('Työjärjestys puuttuu ladatulta sivulta.'));
    },170);
    timeout=setTimeout(()=>{
      let doc;try{doc=frame.contentDocument}catch{}
      if(doc?.querySelector('#schedule .block'))finish(null,doc);
      else finish(new Error('Wilman työjärjestyksen lataus aikakatkaistiin.'));
    },9000);
    frame.src=url.href;document.body.append(frame);
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
// Prefer structured Wilma timetable data with explicit Day/Start/End.
if(p.type!=='teacher')try{
  const exported=await tryExportSchedule(p,d,from,to,clockRange,signal);
  if(exported)return exported;
}catch(e){if(signal.aborted)throw e}
// Not all Wilma instances grant access to export; fall back to existing view.
const u=new URL('/profiles/'+(p.type==='teacher'?'teachers':'students')+'/'+p.id+'/schedule',location.origin);u.searchParams.set('date',fi(d));
const response=await fetch(u,{credentials:'same-origin',signal});
if(!response.ok)throw Error('HTTP '+response.status);
const html=await response.text();
let fallback=null;
try{fallback=parseSchedule(html,p,d,from,to,clockRange)}
catch(e){if(e.message!=='NO_SCHEDULE_BLOCKS')throw e}
if(fallback&&fallback.rows.length&&fallback.rows.every(x=>x.lesson?.date&&x.lesson?.time))return fallback;
try{return await renderedSchedule(u,signal,doc=>parseSchedule(doc,p,d,from,to,clockRange))}
catch(e){
  if(signal.aborted)throw e;
  if(fallback)return fallback;
  if(e.message==='NO_SCHEDULE_BLOCKS')return {rows:[],stats:{blocks:0,courses:0,ignoredByDate:0,ignoredByTime:0}};
  throw e;
}
}));
try{
const output=await runPool(tasks,signal,(n,total)=>say('Haettu '+n+'/'+total+' työjärjestystä…'));
const failed=output.filter(x=>x?.error);
const errors=failed.length,combined=new Map();
const totalBlocks=output.reduce((n,o)=>n+(o?.stats?.blocks||0),0);
const totalCourses=output.reduce((n,o)=>n+(o?.stats?.courses||0),0);
for(const o of output){if(!o?.rows)continue;for(const x of o.rows){const key=personKey(x.person)+'|'+norm(x.course);if(!combined.has(key))combined.set(key,{...x,teachers:[],teacherIds:new Set(),groups:new Set(),groupUrls:new Set(),weeks:new Set(),lessons:new Map(),partial:false});
const item=combined.get(key);item.weeks.add(x.week);item.partial ||=x.partial;
if(x.group)item.groups.add(x.group);
for(const u of x.groupUrls||[])item.groupUrls.add(u);
for(const t of x.teachers)if(!item.teacherIds.has(t.id)){item.teacherIds.add(t.id);item.teachers.push(t)}
const l=x.lesson;if(l){const key=(l.date||'week:'+l.week)+'|'+(l.time?l.time.start+'-'+l.time.end:'?')+'|'+norm(x.group)+'|'+norm(l.room||'');if(!item.lessons.has(key))item.lessons.set(key,l)}
}}
rows=[...combined.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,'fi')||a.course.localeCompare(b.course,'fi'));
renderResults();
const firstError=failed[0]?.error||'';
say((signal.aborted?'Keskeytetty. ':'Valmis. ')+rows.length+' opintojaksoa, työjärjestysmerkintöjä '+totalBlocks+', tunnistettuja opintojaksoja '+totalCourses+', epäonnistuneita viikkohakuja '+errors+'.'+(firstError?' Esimerkkivirhe: '+firstError:'')+(parseSchedule.unknownTimes?' '+parseSchedule.unknownTimes+' merkintää ilman tunnistettavaa kellonaikaa.':''),errors>0||totalBlocks===0);
}catch(e){say('Hakuvirhe: '+e.message,true)}finally{abort=null;search.disabled=false;cancel.disabled=true}
};
function uniquePeople(list){
  return [...new Map(list.filter(p=>p&&/^\d+$/.test(String(p.id))).map(p=>[String(p.id),p])).values()];
}
async function guardianRecipients(students){
  const confirmed=new Set(),missing=[];
  // A guardian recipient is not the student's ID. Read Wilma's own
  // message links; do not manufacture r_guardian parameters.
  for(const p of uniquePeople(students)){
    try{
      const url=new URL('/profiles/students/'+encodeURIComponent(p.id),location.origin);
      const response=await fetch(url.href,{credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      const ids=new Set();
      for(const a of $$('a[href]',doc)){
        let u;try{u=new URL(a.getAttribute('href'),location.origin)}catch{continue}
        if(u.origin!==location.origin||u.pathname!=='/messages/compose')continue;
        for(const id of u.searchParams.getAll('r_guardian'))if(/^\d+$/.test(id))ids.add(id);
      }
      if(!ids.size)missing.push(p.name);
      for(const id of ids)confirmed.add(id);
    }catch(e){missing.push(p.name)}
  }
  return {ids:[...confirmed],missing};
}
async function selectedCourseStudents(courseRows){
  // The selected student's own timetable proves that student attends the
  // lesson. Teacher timetables do NOT prove course membership by themselves.
  const recipients=new Map(),unresolved=[];
  for(const row of courseRows)if(row.person.type!=='teacher')
    recipients.set(String(row.person.id),row.person);
  const rosterUrls=new Set();
  for(const row of courseRows.filter(r=>r.person.type==='teacher')){
    const urls=[...(row.groupUrls||[])];
    if(!urls.length)unresolved.push(row.course+' ('+row.person.name+'): ryhmän opiskelijaluetteloon ei ole linkkiä');
    else urls.forEach(u=>rosterUrls.add(u));
  }
  for(const path of rosterUrls){
    try{
      const url=new URL(path,location.origin);
      if(url.origin!==location.origin||!/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(url.pathname))throw Error('Virheellinen ryhmälinkki');
      const res=await fetch(url.href,{credentials:'same-origin'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const doc=new DOMParser().parseFromString(await res.text(),'text/html');
      // Class profiles expose their own enrolled pupils as student profile
      // anchors, without the older #students / .student-list container.
      // Limit the search to the class page's main article/content; never
      // scrape navigation, sidebar, or unrelated Wilma directories.
      const roster=doc.querySelector('#students, .student-list, .students-list, [data-role="students"], table.students, table.student-list, #group-students');
      const classProfile=/^\/profiles\/classes\/\d+\/?$/.test(url.pathname);
      const main=doc.querySelector('main#main-content')||doc.querySelector('#main-content');
      let root=roster;
      if(!root&&classProfile)root=main;
      if(!root){
        unresolved.push('Ryhmän opiskelijaluetteloa ei voitu tunnistaa: '+url.pathname);
        continue;
      }
      const studentLinks=new Map();
      for(const a of $$('a[href]',root)){
        if(a.closest('nav, header, footer, aside, .sidebar, .navigation, .navbar, .breadcrumb, .pagination'))continue;
        let link;try{link=new URL(a.getAttribute('href'),url)}catch{continue}
        const m=studentRe.exec(link.pathname);
        if(link.origin!==location.origin||!m)continue;
        const name=clean(a.textContent);
        if(!name||name.length>120)continue;
        studentLinks.set(m[1],{id:m[1],name,type:'student'});
      }
      const count=studentLinks.size;
      if(!count){
        unresolved.push('Ryhmän jäsenluettelossa ei ollut tunnistettavia opiskelijaprofiileja: '+url.pathname);
        continue;
      }
      if(classProfile&&!roster){
        // Class profile fallback is less specific than an explicit roster.
        // Show the provenance in the compose warning rather than presenting
        // the selection as independently verified membership.
        unresolved.push('Tarkista ryhmän '+url.pathname+' '+count+' opiskelijavastaanottajaa Wilmassa: opiskelijat poimittiin ryhmäsivun pääsisällöstä.');
      }
      for(const [id,p] of studentLinks)recipients.set(id,p);
    }catch(e){unresolved.push('Ryhmän opiskelijoiden hakeminen epäonnistui')}
  }
  return {students:[...recipients.values()],unresolved};
}
async function composeForSelection(courseRows,kinds,button,options={}){
 if(!courseRows.length){say('Valitse vähintään yksi opintojakso.',true);return}
 if(!options.draftRecipients&&!kinds.students&&!kinds.courseStudents&&!kinds.teachers&&!kinds.guardians){say('Valitse vastaanottajaryhmä.',true);return}
 const students=uniquePeople(courseRows.filter(r=>r.person.type!=='teacher').map(r=>r.person));
 const teachers=uniquePeople([...courseRows.flatMap(r=>r.teachers),...courseRows.filter(r=>r.person.type==='teacher').map(r=>r.person)]);
 const url=new URL('/messages/compose',location.origin);
 const useDraft=Boolean(options.draftRecipients);
 const tab=!useDraft&&(kinds.guardians||kinds.courseStudents)?window.open('about:blank','_blank'):null;
 if(!useDraft&&(kinds.guardians||kinds.courseStudents)&&!tab){say('Selain esti uuden viesti-ikkunan.',true);return}
 if(useDraft){
   for(const pair of options.draftRecipients.recipientQuery||[]){
     const [key,value]=String(pair).split('=');
     if(['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(key)&&/^\d+$/.test(value||''))url.searchParams.append(key,value);
   }
 }else{
   if(kinds.students)students.forEach(p=>url.searchParams.append('r_student',String(p.id)));
   if(kinds.teachers)teachers.forEach(p=>url.searchParams.append('r_teacher',String(p.id)));
 }
 const missing=[];
 if(!useDraft&&kinds.courseStudents){
   button.disabled=true;say('Tarkistetaan valittujen opintojaksojen opiskelijat…');
   try{
     const found=await selectedCourseStudents(courseRows);
     const existing=new Set(url.searchParams.getAll('r_student'));
     for(const p of found.students)if(!existing.has(String(p.id))){url.searchParams.append('r_student',String(p.id));existing.add(String(p.id))}
     missing.push(...found.unresolved);
   }catch(e){missing.push('Opintojaksojen opiskelijoiden hakeminen epäonnistui')}
   finally{button.disabled=false}
 }
 if(!useDraft&&kinds.teachers&&!teachers.length)missing.push('Opettajien tunnisteita ei löytynyt');
 if(!useDraft&&kinds.guardians){
   button.disabled=true;say('Haetaan huoltajien vastaanottajatietoja…');
   try{const g=await guardianRecipients(students);g.ids.forEach(id=>url.searchParams.append('r_guardian',id));missing.push(...g.missing.map(name=>'Huoltaja ei löytynyt: '+name))}
   catch(e){missing.push('Huoltajien haku epäonnistui')}
   finally{button.disabled=false}
 }
 const savedSnapshot=useDraft&&!url.search?options.draftRecipients.recipients:null;
 if(!url.search&&!savedSnapshot&&!useDraft){tab?.close();say('Vastaanottajia ei löytynyt. '+missing.join('; '),true);return}
 if(useDraft&&!url.search&&!savedSnapshot)missing.push('Luonnoksessa ei ollut palautettavia vastaanottajatunnisteita');
 const names=options.addNames?'Valitut opiskelijat:\n'+students.map(p=>p.name).join('\n'):'';
 const body=[String(options.body||''),names].filter(Boolean).join('\n\n');
 const transfer={
   createdAt:Date.now(),subject:String(options.subject||''),body,
   bodyHtml:options.bodyHtml||'',
   missingRecipients:missing,
   recipientQuery:[...url.searchParams].map(([key,val])=>key+'='+val),
   savedRecipients:savedSnapshot
 };
 localStorage.setItem('openapuri.composeRequest.v1',JSON.stringify(transfer));
 if(tab){try{tab.opener=null;tab.location.replace(url.href)}catch(e){tab.close();say('Viestin avaus epäonnistui.',true);return}}
 else window.open(url.href,'_blank','noopener');
 say('Wilman viestinkirjoitus avattu.'+(missing.length?' Huomautus näytetään viestisivulla: '+missing.join('; '):''),missing.length>0);
}
function renderResults(){
results.replaceChildren();
if(!rows.length){results.append(make('p','oh-help','Opintojaksoja ei löytynyt. Tarkista hakutilanteesta myös mahdolliset latausvirheet.'));return}
const actions=make('div');
const recipientToggle=make('button','oh-action','Valitse viestin vastaanottajat');
const recipientPanel=make('div','oh-recipient-panel');recipientPanel.hidden=true;
recipientPanel.style.cssText='padding:10px;margin:6px 0 12px;border:1px solid #cad7df;border-radius:6px';
const kinds={};
for(const [kind,label,defaultChecked] of [
  ['students','Opiskelijat',true],
  ['courseStudents','Valittujen opintojaksojen opiskelijat',false],
  ['teachers','Opettajat',false],
  ['guardians','Huoltajat',false]
]){
  const option=make('label');
  option.style.cssText='display:inline-flex;flex-direction:row;align-items:center;gap:6px;margin:5px 15px 5px 0;min-width:0;cursor:pointer';
  const cb=make('input');cb.type='checkbox';cb.checked=defaultChecked;cb.style.width='auto';
  kinds[kind]=cb;option.append(cb,make('span','',label));recipientPanel.append(option);
}
const addNames=make('input');addNames.type='checkbox';addNames.style.width='auto';
const namesLabel=make('label');namesLabel.style.cssText='display:flex;flex-direction:row;align-items:center;gap:8px;margin:7px 0';
namesLabel.append(addNames,make('span','','Lisää valittujen opiskelijoiden nimet viestitekstiin'));
recipientPanel.append(namesLabel);
const templateSelect=make('select');templateSelect.style.cssText='width:100%;padding:7px;margin:6px 0';
const titleInput=make('input');titleInput.placeholder='Viestin otsikko';titleInput.style.margin='5px 0';
const messageBody=make('textarea');messageBody.rows=4;messageBody.placeholder='Viestin sisältö';messageBody.style.cssText='width:100%;min-height:72px;margin:5px 0';
let templateHtml='',templateText='',activeDraft=null;
const getSaved=(key)=>{try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data:[]}catch{return []}};
let templates=[];
function reloadTemplates(){
 templates=[
 ...getSaved('openapuri.messageTemplates.v1').filter(t=>t?.title).map(t=>({kind:'template',name:'Pohja: '+t.title,subject:t.subject||'',body:t.body||'',html:t.bodyHtml||''})),
 ...getSaved('openapuri.draftHistory.v1').filter(t=>t?.subject).map(t=>({kind:'draft',name:'Luonnos: '+t.subject,subject:t.subject||'',body:t.bodyHtml||'',html:t.bodyHtml||'',recipientQuery:t.recipientQuery||[],recipients:t.recipients||null}))];
 templateSelect.replaceChildren();const first=make('option','','Valitse viestipohja tai tallennettu luonnos');first.value='';templateSelect.append(first);
 templates.forEach((t,i)=>{const el=make('option','',t.name);el.value=String(i);templateSelect.append(el)});
}
reloadTemplates();
templateSelect.onchange=()=>{
 activeDraft=null;
 if(templateSelect.value===''){draftRecipientsCheckbox.checked=false;draftRecipientsLabel.hidden=true;return}
 const t=templates[Number(templateSelect.value)];if(!t)return;
 activeDraft=t.kind==='draft'?t:null;
 draftRecipientsCheckbox.checked=Boolean(activeDraft);draftRecipientsLabel.hidden=!activeDraft;
 titleInput.value=t.subject;const safe=make('div');safe.innerHTML=t.html||t.body;templateText=safe.textContent||t.body;
 messageBody.value=templateText;templateHtml=t.html;
};
const draftRecipientsLabel=make('label');draftRecipientsLabel.hidden=true;
 draftRecipientsLabel.style.cssText='display:flex;flex-direction:row;gap:8px;align-items:center;margin:7px 0';
 const draftRecipientsCheckbox=make('input');draftRecipientsCheckbox.type='checkbox';draftRecipientsCheckbox.style.width='auto';
 draftRecipientsLabel.append(draftRecipientsCheckbox,make('span','','Käytä valitun luonnoksen vastaanottajia (korvaa valitut opiskelijat/opettajat)'));
 const refreshTemplates=make('button','','Päivitä tallennetut pohjat');refreshTemplates.onclick=reloadTemplates;
recipientPanel.append(make('strong','','Viestipohjat ja tallennetut luonnokset'),templateSelect,refreshTemplates,draftRecipientsLabel,titleInput,messageBody);
const openMessage=make('button','oh-action','Avaa viesti Wilmassa');
openMessage.style.display='block';
recipientPanel.append(openMessage,make('p','oh-help','Valitse yksi tai useampi vastaanottajaryhmä. Viestiä ei lähetetä automaattisesti. Tarkista vastaanottajat Wilmassa.'));
recipientToggle.onclick=()=>{recipientPanel.hidden=!recipientPanel.hidden};
actions.append(recipientToggle,recipientPanel);results.append(actions);
const byStudent=new Map();
rows.forEach((r,i)=>{const key=personKey(r.person);if(!byStudent.has(key))byStudent.set(key,{person:r.person,items:[]});byStudent.get(key).items.push({r,i})});
const selected=new Set(rows.map((_,i)=>i));
const onlyTeachers=rows.every(r=>r.person.type==='teacher');
if(onlyTeachers){kinds.students.checked=false;kinds.courseStudents.checked=false;kinds.teachers.checked=true;kinds.guardians.checked=false}
for(const {person,items} of byStudent.values()){
  const section=make('section','oh-student-group'),heading=make('h3');
  const personLink=make('a','',person.name);
  personLink.href='/profiles/'+(person.type==='teacher'?'teachers':'students')+'/'+encodeURIComponent(person.id);
  personLink.target='_blank';personLink.rel='noopener noreferrer';
  heading.append(personLink);
  if(person.type==='teacher'){
    const marker=make('span','oh-staff-tag','Ope');marker.style.cssText='margin-left:7px;font-size:11px;font-weight:400;color:#7a8994;opacity:.8';heading.append(marker);
  }
  heading.append(document.createTextNode(' · '+items.length+' opintojaksoa'));
  heading.style.cssText='font-size:16px;margin:12px 0 5px;font-weight:600';
  section.append(heading);
  const table=make('table'),thead=make('thead'),tr=make('tr');
  ['','Opintojakso','Opettaja(t)','Oppituntien ajankohdat','Opetustila'].forEach(x=>tr.append(make('th','',x)));
  thead.append(tr);table.append(thead);
  const body=make('tbody');
  for(const {r,i} of items){
    const row=make('tr'),pick=make('td'),cb=make('input');cb.type='checkbox';cb.checked=true;cb.setAttribute('aria-label','Valitse '+r.course);
    cb.onchange=()=>cb.checked?selected.add(i):selected.delete(i);pick.append(cb);
    const courseCell=make('td');
    const groupLinks=[...(r.groupUrls||[])].filter(path=>/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(String(path)));
    if(groupLinks.length){
      const courseLink=make('a','',r.course);
      courseLink.href=groupLinks[0];courseLink.target='_blank';courseLink.rel='noopener noreferrer';
      courseCell.append(courseLink);
      if(groupLinks.length>1){
        const extra=make('span','', ' ');
        for(let n=1;n<groupLinks.length;n++){
          const a=make('a','', 'Ryhmä '+(n+1));
          a.href=groupLinks[n];a.target='_blank';a.rel='noopener noreferrer';
          extra.append(' ',a);
        }
        courseCell.append(extra);
      }
    }else courseCell.textContent=r.course;
    row.append(pick,courseCell);
    const teacherCell=make('td');
    if(!r.teachers.length)teacherCell.textContent='Ei opettajatietoa';
    else for(const teacher of r.teachers){
      const a=make('a','',teacher.name);a.href='/profiles/teachers/'+teacher.id;a.target='_blank';a.rel='noopener';teacherCell.append(a,document.createTextNode(' '));
    }
    const lessonCell=make('td');
const lessons=[...(r.lessons?.values()||[])].sort((a,b)=>(a.date||a.week).localeCompare(b.date||b.week)||(a.time?.start??-1)-(b.time?.start??-1));
lessons.forEach((l,j)=>{if(j)lessonCell.append(document.createTextNode(' · '));lessonCell.append(make('span','',lessonLabel(l)))});
if(!lessons.length)lessonCell.textContent='Ajankohta ei tiedossa';
const roomCell=make('td');
lessons.forEach((l,j)=>{if(j)roomCell.append(document.createTextNode(' · '));roomCell.append(make('span','',l.room||'Ei huonetietoa'))});
if(!lessons.length)roomCell.textContent='Ei huonetietoa';
row.append(teacherCell,lessonCell,roomCell);body.append(row);
  }
  table.append(body);section.append(table);results.append(section);
}
results.append(make('p','oh-help','Opintojakso näkyy opiskelijaa kohden vain kerran. Ryhmämerkintöjä ei esitetä opintojakson niminä. Ajanjakson reunaviikot voivat sisältää myös sen ulkopuolisia opetuspäiviä.'));
const chosen=()=>[...selected].map(i=>rows[i]).filter(Boolean);
openMessage.onclick=()=>composeForSelection(chosen(),{students:kinds.students.checked,courseStudents:kinds.courseStudents.checked,teachers:kinds.teachers.checked,guardians:kinds.guardians.checked},openMessage,
{addNames:addNames.checked,subject:titleInput.value,body:messageBody.value,bodyHtml:templateHtml&&messageBody.value===templateText?templateHtml:'',draftRecipients:activeDraft&&draftRecipientsCheckbox.checked?activeDraft:null});
}

renderPicked();renderChoices();
if(directoryPage){
  const params=new URLSearchParams(location.search);
  filter.value=params.get('oh_q')||'';
  link.click();
  if(filter.value)readDirectory();
  if(embedPage){
    const hide=make('style');hide.textContent='body>header,body>nav,#navigation,.navbar,.breadcrumb,#oh-tab{display:none!important} main#main-content{padding:0!important} #oh-panel{padding:8px!important}';document.head.append(hide);
  }
}
})();});
})();