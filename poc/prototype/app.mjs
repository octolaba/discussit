import {sampleText,changedText,seed,project,append,uid,validateArchive} from './domain.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='discuss-lab-v1';let events,storageAvailable=true,loadFailure=false,rawStored=null,backupKey=null;
try{rawStored=localStorage.getItem(KEY);events=JSON.parse(rawStored||'null');if(events)validateArchive({format:'discuss-demo/1',events});else events=seed();}
catch{events=seed();storageAvailable=false;loadFailure=true;if(rawStored){try{backupKey=KEY+'-recovery-'+Date.now();localStorage.setItem(backupKey,rawStored);}catch{/* Original key is preserved even if the backup cannot be written. */}}}
const ui={doc:'doc-demo',snapshot:null,thread:'t1',tab:'document',filter:'open',through:null,selection:null,reply:null,fork:null,online:true,subscribed:true,cursor:events.at(-1).seq,eventFilter:'all',fallback:false};
const running=new Set();let generation=0;
const live=()=>project(events);const state=()=>project(events,ui.through??Infinity);const readonly=()=>ui.through!==null;
function displayed(s=state()){const doc=s.documents[ui.doc]||Object.values(s.documents)[0];const candidate=s.snapshots[ui.snapshot];const snapshot=(!readonly()&&candidate?.documentId===doc?.id)?candidate:s.snapshots[doc?.head];return{doc,snapshot};}
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4000);}
function save(){if(loadFailure){storageAvailable=false;return;}try{localStorage.setItem(KEY,JSON.stringify(events));storageAvailable=true;}catch{storageAvailable=false;toast('Не удалось сохранить в браузере. Экспортируйте историю.');}}
function emit(type,payload,actor='Камиль'){events=append(events,type,payload,actor);if(ui.subscribed)ui.cursor=events.at(-1).seq;save();render();}
function ensureLive(){if(readonly()){toast('Вы просматриваете прошлое. Вернитесь в настоящее для изменений.');return false;}return true;}
function label(e){return({'document.opened':'Документ открыт','snapshot.captured':'Сохранён снимок','thread.created':'Начато обсуждение','thread.forked':'Создана отдельная ветка','comment.created':'Добавлен комментарий','reaction.set':e.payload.active?'Добавлена реакция':'Реакция снята','thread.resolved':'Обсуждение решено','thread.reopened':'Обсуждение открыто снова','agent.requested':'Агент приглашён','agent.status':'Статус агента','storage.selected':'Выбрано хранилище','entry.opened':'Открыто через '+e.payload.surface,'subscription.changed':'Изменена подписка'})[e.type]||e.type;}
const time=t=>new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function eventDoc(e,s=live()){const p=e.payload;return p.documentId||(e.type==='document.opened'?p.id:null)||s.threads[p.threadId]?.documentId||s.threads[s.comments[p.commentId]?.threadId]?.documentId||s.threads[s.requests[p.id]?.threadId]?.documentId;}
function threadComments(s,t){return Object.values(s.comments).filter(c=>c.threadId===t.id).sort((a,b)=>a.seq-b.seq);}
function switchDoc(id){ui.doc=id;ui.snapshot=null;ui.thread=null;ui.selection=null;ui.reply=null;ui.fork=null;ui.through=null;ui.tab='document';$('#commentInput').value='';render();}
function render(){
  const s=state(),{doc,snapshot}=displayed(s);if(!doc||!snapshot)return;
  $('#documents').innerHTML=Object.values(live().documents).map(d=>`<button class="doc-item ${d.id===doc.id?'active':''}" data-doc="${esc(d.id)}"><b class="doc-icon">▤</b><span>${esc(d.name)}</span></button>`).join('');
  $('#docName').textContent=doc.name;$('#saveState').textContent=storageAvailable?'● Сохранено в браузере':'⚠ Только в памяти';
  $('#eventCount').textContent=events.length+' событий';$('#snapshotMeta').textContent=snapshot.label+' · '+Array.from(snapshot.text).length+' символов';
  const snapshots=Object.values(s.snapshots).filter(x=>x.documentId===doc.id);
  $('#versionSelect').innerHTML=snapshots.map(x=>`<option value="${esc(x.id)}" ${x.id===snapshot.id?'selected':''}>${esc(x.label)}${x.id===doc.head?' · сейчас':''}</option>`).join('');$('#versionSelect').disabled=readonly();
  $('#storageButton').innerHTML=`${doc.storage==='sidecar'?'▣ В папке документа':'◉ Общее хранилище'}<small>${doc.storage==='sidecar'?esc(doc.folderPath||'Папка demo')+' / .discuss':'Library / Discuss /'}<br>Расположение · имитация</small>`;
  $('#versionBanner').innerHTML=snapshot.id!==doc.head?`<div class="banner"><span>Вы смотрите ${esc(snapshot.label)}. На диске есть новая версия. Контекст обсуждения сохранён.</span><button data-action="head">Открыть новую</button></div>`:'';
  $('#historyBanner').innerHTML=readonly()?`<div class="banner history"><span>История · после события #${ui.through}. Изменения отключены.</span><button data-action="live">В настоящее →</button></div>`:'';
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===ui.tab));for(const t of ['document','history','events'])$('#'+t+'View').hidden=t!==ui.tab;
  const thread=s.threads[ui.thread];let text=snapshot.text;
  if(thread&&thread.snapshotId===snapshot.id){const chars=Array.from(text),mark=document.createElement('mark');mark.textContent=chars.slice(thread.start,thread.end).join('');$('#documentText').replaceChildren(document.createTextNode(chars.slice(0,thread.start).join('')),mark,document.createTextNode(chars.slice(thread.end).join('')));}else $('#documentText').textContent=text;
  $('#recoveryBanner').innerHTML=loadFailure?`<div class="banner"><span>Сохранённая история не прочитана. Оригинал сохранён${backupKey?' и скопирован в резервный ключ':''}; демо работает в памяти.</span><button id="recoveryExport">Скачать исходные данные</button></div>`:'';
  if(loadFailure)$('#recoveryExport').onclick=()=>downloadJSON(rawStored||'', 'discuss-recovery.txt',true);
  $('#changeButton').disabled=readonly();$('#agentToggle').textContent=ui.online?'Отключить агентов':'Подключить агентов';$$('.agent-light').forEach(x=>x.style.background=ui.online?'#5d9165':'#b4b6ae');
  renderThreads(s,doc,snapshot);renderComposer(s,doc,snapshot);renderHistory();renderEvents();
}
function renderThreads(s,doc,snapshot){
  const ts=Object.values(s.threads).filter(t=>t.documentId===doc.id);
  $('#threadCount').textContent=ts.filter(t=>!t.resolved).length;
  $$('.filter-row button').forEach(b=>b.classList.toggle('active',b.dataset.filter===ui.filter));
  const t=s.threads[ui.thread];
  if(!t||t.documentId!==doc.id){
    const filtered=ts.filter(t=>ui.filter==='all'||(ui.filter==='resolved')===t.resolved);
    $('#threadPanel').innerHTML=filtered.length?filtered.map(t=>{const cs=threadComments(s,t);return`<button class="thread-card" data-thread="${esc(t.id)}"><div class="quote-preview">${esc(t.quote.slice(0,150))}</div><p>${esc(cs[0]?.body.slice(0,170)||'Пустое обсуждение')}</p><div class="mini"><span>${cs.length} сообщ. · ${esc(s.snapshots[t.snapshotId]?.label)}${t.forkedFromCommentId?' · ветка':''}</span><span>${t.resolved?'✓ Решено':'● Открыто'}</span></div></button>`;}).join(''):`<div class="empty"><strong>${ui.filter==='resolved'?'Пока нет решений.':'Место для мысли.'}</strong>Выделите фрагмент текста и начните обсуждение.<br>Ваш комментарий сохранится вместе с контекстом.</div>`;return;
  }
  const cs=threadComments(s,t),origin=s.snapshots[t.snapshotId];
  const stale=t.snapshotId!==doc.head;
  const tree=(parent,depth=0)=>cs.filter(c=>c.parentId===parent).map(c=>commentHTML(s,c,depth)+tree(c.id,depth+1)).join('');
  let requests=Object.values(s.requests).filter(r=>r.threadId===t.id&&r.status!=='completed'&&r.status!=='cancelled');
  $('#threadPanel').innerHTML=`<div class="anchor-box"><div class="eyebrow">ИСХОДНЫЙ ФРАГМЕНТ · ${esc(origin?.label)}${stale?' · ТЕКСТ ИЗМЕНИЛСЯ':''}</div>${esc(t.quote)}<div class="anchor-actions"><button data-action="origin">Открыть контекст ↗</button>${t.forkedFromCommentId?`<button data-origin-comment="${esc(t.forkedFromCommentId)}">↰ Источник ветки</button>`:''}</div></div><div class="thread-meta"><span>${cs.length} сообщений · ${t.resolved?'✓ Решено':'Открыто'}</span><button data-action="resolve" ${readonly()?'disabled':''}>${t.resolved?'Открыть снова':'✓ Решить'}</button></div>${tree(null)}${requests.map(r=>`<div class="agent-status">${esc(r.agent)} · ${esc(statusText(r.status))}${!ui.online?' · нет соединения':''}<br><span class="mini">Контекст ${esc(s.snapshots[r.snapshotId]?.label)} · до #${esc(r.throughSeq)} · имитация<br>${esc(receiptText(r.receipt))}</span>${['interrupted','delivery-unknown'].includes(r.status)?`<button data-retry="${esc(r.id)}">Повторить</button>`:''}<button data-cancel-request="${esc(r.id)}" ${readonly()?'disabled':''}>Отменить</button></div>`).join('')}`;
}
function statusText(st){return({queued:'в очереди',accepted:'родитель получил запрос','parent-accepted':'родитель получил запрос','child-confirmed':'native child подтверждён','parent-fallback':'специалист не вызван · отвечает родитель',running:'готовит ответ…',interrupted:'исход доставки неизвестен','delivery-unknown':'исход доставки неизвестен',completed:'ответил',cancelled:'отменён'})[st]||st;}
function receiptText(receipt){return({'parent-accepted':'Receipt: parent-accepted · demo','child-confirmed':'Receipt: child-confirmed · native child · demo','parent-fallback':'Receipt: parent-fallback · native child не вызван · demo','child-replied':'Receipt: child-replied · demo','parent-replied':'Receipt: parent-replied · demo'})[receipt]||'Receipt ещё не получен';}
function commentHTML(s,c,depth){
  const t=s.threads[c.threadId],doc=s.documents[t.documentId];const agent=c.actor.startsWith('Claude')?'claude':c.actor.startsWith('Codex')?'codex':'human';
  const reacted=Object.values(s.reactions).filter(r=>r.commentId===c.id);
  const rs=['👍','💡','✅'].map(emoji=>{const users=reacted.filter(r=>r.emoji===emoji);return`<button class="${users.length?'reacted':''}" data-react="${esc(c.id)}" data-emoji="${emoji}" aria-label="${emoji} реакция к ${esc(c.actor)}" aria-pressed="${users.some(r=>r.actor==='Камиль')}" ${readonly()?'disabled':''}>${emoji}${users.length?' '+users.length:''}</button>`;}).join('');
  const parent=s.comments[c.parentId];
  return`<div class="comment ${depth?'comment-reply':''}"><div class="comment-top"><span class="avatar ${agent}">${agent==='claude'?'C':agent==='codex'?'›_':'К'}</span><span class="comment-author">${esc(c.actor)}</span><time class="comment-time">${time(c.time)}</time></div>${parent?`<div class="comment-parent">↳ Ответ ${esc(parent.actor)}: ${esc(parent.body.slice(0,65))}…</div>`:''}<div class="comment-body">${esc(c.body).replace(/@(claude\/reviewer|codex\/architect)/g,'<span class="mention-token">@$1</span>')}</div>${c.snapshotId!==doc.head?`<span class="state-chip">Контекст ${esc(s.snapshots[c.snapshotId]?.label)} · прежняя версия</span>`:''}${c.requestId?`<div class="state-chip">${c.responderKind==='native-child'?'native child · подтверждён · demo':'parent fallback · специалист не вызван · demo'}<br>Ответ на запрос ${esc(c.requestId.slice(0,8))}</div>`:''}<div class="comment-actions">${rs}<button data-reply="${esc(c.id)}" ${readonly()?'disabled':''}>Ответить</button><button data-fork="${esc(c.id)}" ${readonly()?'disabled':''}>↗ Ветка</button></div></div>`;
}
function renderComposer(s,doc,snapshot){
  let context='',hint='Enter — новая строка. ⌘ Enter — отправить.';const t=s.threads[ui.thread];
  if(readonly())context='История доступна только для чтения.';
  else if(ui.selection)context='Новый тред · '+ui.selection.quote.slice(0,90);
  else if(ui.fork)context='Отдельная ветка от '+s.comments[ui.fork]?.actor;
  else if(ui.reply)context='Ответ '+s.comments[ui.reply]?.actor;
  else if(t)context='Ответ в обсуждение · '+s.snapshots[t.snapshotId]?.label;
  else context='Сначала выделите фрагмент текста.';
  if(ui.reply&&s.comments[ui.reply]?.actor.startsWith('Claude'))hint='Ответ пригласит @claude/reviewer автоматически (demo).';
  if(ui.reply&&s.comments[ui.reply]?.actor.startsWith('Codex'))hint='Ответ пригласит @codex/architect автоматически (demo).';
  if(t?.resolved&&!ui.selection&&!ui.fork)hint='Тред решён. Новый ответ сохранится без автоматического переоткрытия.';
  $('#composeContext').innerHTML=`<div class="compose-context"><span>${esc(context)}</span>${ui.selection||ui.reply||ui.fork?'<button type="button" data-action="cancel-compose" aria-label="Отменить выбор">×</button>':''}</div>`;
  $('#composerHint').textContent=hint;$('#commentInput').disabled=readonly();$('#mentionButton').disabled=readonly();$('#sendButton').disabled=readonly()||(!ui.selection&&!t);
}
function renderHistory(){
  const max=events.at(-1).seq;$('#timeSlider').max=max;$('#timeSlider').value=ui.through??max;$('#timeLabel').textContent=ui.through??max;$('#liveButton').disabled=!readonly();
  $('#historyList').innerHTML=[...events].reverse().map(e=>`<button class="history-row ${ui.through===e.seq?'active':''}" data-seq="${e.seq}" ${e.seq<2?'disabled':''}><span class="seq">#${e.seq}</span><span><strong>${esc(label(e))}</strong><small>${esc(e.actor)}${e.payload.body?' · '+esc(e.payload.body.slice(0,70)):''}</small></span><time>${time(e.recordedAt)}</time></button>`).join('');
}
function renderEvents(){
  const unseen=events.at(-1).seq-ui.cursor;$('#eventsBadge').textContent=unseen?'+'+unseen:'';
  $('#subscriptionToggle').textContent=ui.subscribed?'Приостановить':'Догнать '+unseen+' событий';$('#cursorLabel').textContent=`cursor #${ui.cursor} · ${ui.subscribed?'подключено':'пауза'}`;
  $('#eventList').innerHTML=events.filter(e=>e.seq<=ui.cursor&&(ui.eventFilter==='all'||e.type.startsWith(ui.eventFilter))).reverse().map(e=>`<details><summary><span class="event-seq">#${e.seq}</span><span>${esc(e.type)}</span><time>${time(e.recordedAt)}</time></summary><pre>${esc(JSON.stringify(e,null,2))}</pre></details>`).join('');
}
function setThrough(n){ui.through=n;ui.selection=null;ui.reply=null;ui.fork=null;$('#selectionButton').hidden=true;render();}
function toLive(){ui.through=null;ui.snapshot=null;render();}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal();}
function closeModal(){$('#modal').close();}
function selectThread(id){ui.thread=id;ui.selection=null;ui.reply=null;ui.fork=null;render();}
function makeRequest(comment,agent){const req={id:uid(),threadId:comment.threadId,commentId:comment.id,agent,snapshotId:comment.snapshotId,throughSeq:events.at(-1).seq,route:ui.fallback?'parent-fallback':'native-child'};emit('agent.requested',req,'Система');pump();}
function pump(){
  if(!ui.online)return;
  for(const r of Object.values(live().requests)){
    if(r.status!=='queued'||running.has(r.id))continue;running.add(r.id);const gen=generation;
    const valid=()=>gen===generation&&ui.online&&['queued','parent-accepted','accepted','child-confirmed','parent-fallback','running'].includes(live().requests[r.id]?.status);
    const fallback=r.route==='parent-fallback';
    setTimeout(()=>{if(!valid()){running.delete(r.id);return;}emit('agent.status',{id:r.id,status:'parent-accepted',receipt:'parent-accepted'},r.agent);},500);
    setTimeout(()=>{if(!valid()){running.delete(r.id);return;}emit('agent.status',{id:r.id,status:fallback?'parent-fallback':'child-confirmed',receipt:fallback?'parent-fallback':'child-confirmed'},r.agent);},1000);
    setTimeout(()=>{if(!valid()){running.delete(r.id);return;}emit('agent.status',{id:r.id,status:'running'},r.agent);},1700);
    setTimeout(()=>{
      if(!valid()){running.delete(r.id);return;}
      const provider=r.agent.startsWith('@claude')?'Claude':'Codex';
      const author=fallback?provider+' · parent':provider+(provider==='Claude'?' · reviewer':' · architect');
      const body=fallback?'Родитель ответил сам: выбранный специалист не был вызван. Это демонстрация parent fallback, а не подтверждение работы native subagent.':provider==='Claude'?'В этом фрагменте я бы отдельно зафиксировал границу гарантии: сохранение комментария и получение его агентом — разные состояния. Снимок и requestId позволяют сохранить контекст при повторе. Это демонстрационный ответ reviewer.':'Предлагаю провести команду через единое ядро: записать событие, обновить проекцию и отправить запрос через outbox. UI и CLI используют один контракт. Это демонстрационный ответ architect.';
      emit('comment.created',{id:uid(),threadId:r.threadId,parentId:r.commentId,actor:author,body,snapshotId:r.snapshotId,throughSeq:r.throughSeq,requestId:r.id,responderKind:fallback?'parent-fallback':'native-child'},author);
      emit('agent.status',{id:r.id,status:'completed',receipt:fallback?'parent-replied':'child-replied'},author);running.delete(r.id);
    },2700);
  }
}
function toggleAgents(){
  if(!ensureLive())return;ui.online=!ui.online;generation++;running.clear();
  if(!ui.online){for(const r of Object.values(live().requests))if(['accepted','parent-accepted','child-confirmed','parent-fallback','running'].includes(r.status))emit('agent.status',{id:r.id,status:'delivery-unknown'},'Система');}
  render();pump();toast(ui.online?'Агенты подключены. Неотправленная очередь продолжена; неизвестный исход требует решения.':'Нет соединения. Неотправленные запросы ждут, принятые требуют сверки.');
}
function addMention(token){const input=$('#commentInput');input.value=input.value.replace(/@[^\s]*$/,'')+(input.value&&!/\s$/.test(input.value)?' ':'')+token+' ';$('#mentionMenu').hidden=true;input.focus();}
function submit(){
  if(!ensureLive())return;const body=$('#commentInput').value.trim();if(!body){toast('Напишите комментарий.');return;}
  const s=live(),{doc,snapshot}=displayed(s);let thread=s.threads[ui.thread];
  if(ui.selection){const a=ui.selection;thread={id:uid(),documentId:doc.id,snapshotId:a.snapshotId,start:a.start,end:a.end,quote:a.quote};emit('thread.created',thread);ui.thread=thread.id;}
  else if(ui.fork&&thread){thread={id:uid(),documentId:doc.id,snapshotId:thread.snapshotId,start:thread.start,end:thread.end,quote:thread.quote,forkedFromCommentId:ui.fork};emit('thread.forked',thread);ui.thread=thread.id;}
  if(!thread){toast('Выделите фрагмент текста.');return;}
  const parentId=ui.selection||ui.fork?null:ui.reply||null;
  const comment={id:uid(),threadId:thread.id,parentId,actor:'Камиль',body,snapshotId:snapshot.id,throughSeq:events.at(-1).seq};
  $('#commentInput').value='';ui.selection=null;ui.reply=null;ui.fork=null;$('#mentionMenu').hidden=true;
  emit('comment.created',comment);const mentions=[...new Set(body.match(/@(claude\/reviewer|codex\/architect)\b/g)||[])];if(parentId){const author=s.comments[parentId]?.actor||'';const implicit=author.startsWith('Claude')?'@claude/reviewer':author.startsWith('Codex')?'@codex/architect':null;if(implicit&&!mentions.includes(implicit))mentions.push(implicit);}
  mentions.forEach(a=>makeRequest(comment,a));toast(mentions.length?'Комментарий сохранён. Агент приглашён (demo).':'Комментарий сохранён вместе с контекстом.');
}
function simulateChange(){
  if(!ensureLive())return;const s=live(),{doc,snapshot}=displayed(s);const old=s.snapshots[doc.head];
  const all=Object.values(s.snapshots).filter(x=>x.documentId===doc.id);const text=old.text===sampleText?changedText:old.text+'\nУточнение: новая редакция документа '+(all.length+1)+'.\n';
  ui.snapshot=snapshot.id;emit('snapshot.captured',{id:uid(),documentId:doc.id,label:'S'+(all.length+1),text},'Файл');toast('На диске новая версия (имитация). Старый контекст сохранён.');
}
function openModal(){modal(`<span class="eyebrow">ОДИН ФАЙЛ — НЕСКОЛЬКО ВХОДОВ</span><h2>Начать с документа.</h2><p>В прототипе можно открыть настоящий текстовый файл через выбор файла. Он читается только в браузере. Системные способы ниже — имитация будущего UX.</p><button class="primary" data-modal="file">Выбрать .md или .txt</button><div class="modal-options"><button class="option" data-modal="finder"><strong>▤ Через Finder</strong><small>Контекстное меню → Быстрые действия → Обсудить.</small></button><button class="option" data-modal="terminal"><strong>›_ Через терминал</strong><small>discuss annotate -- proposal.md</small></button></div>`);}
function finderModal(){modal(`<span class="eyebrow">FINDER · ИМИТАЦИЯ</span><h2>Обсудить, не перемещая.</h2><p>Файл остаётся в папке. Quick Action передаст его путь локальному сервису.</p><div class="fake-finder"><span>▤ proposal.md</span><div class="fake-menu"><button disabled>Открыть</button><button disabled>Быстрые действия</button><button class="primary" data-modal="entry-finder">Обсудить</button></div></div><p>Системное меню не установлено. Этот экран демонстрирует точку входа.</p>`);}
function terminalModal(){modal(`<span class="eyebrow">TERMINAL · ИМИТАЦИЯ</span><h2>Та же дискуссия, из CLI.</h2><div class="fake-terminal">$ discuss annotate -- proposal.md<br><span style="opacity:.6">✓ Снимок сохранён<br>↗ Открыть обсуждение в браузере</span></div><button class="primary" data-modal="entry-terminal">Открыть обсуждение →</button><p>Команда показана как будущий контракт. Production CLI в этом прототипе нет.</p>`);}
function storageModal(){const {doc}=displayed();modal(`<span class="eyebrow">РАСПОЛОЖЕНИЕ · ИМИТАЦИЯ</span><h2>История остаётся вашей.</h2><p>В продукте это выбор места одного хранилища. Здесь переключается предпочтение для виртуальной папки: события сохраняются в localStorage, реальная база не переносится.</p><div class="modal-options"><button class="option" data-store="central"><strong>${doc.storage==='central'?'✓ ':''}Общее локальное</strong><small>Library / Application Support / Discuss<br>Все папки в одном пространстве.</small></button><button class="option" data-store="sidecar"><strong>${doc.storage==='sidecar'?'✓ ':''}В папке документа</strong><small>${esc(doc.folderPath||'Папка demo')} / .discuss / store.sqlite<br>Для обычной локальной папки.</small></button></div><p>Для Git и облачно синхронизируемых папок: общее хранилище + переносимый экспорт.</p>`);}
function labModal(){modal(`<span class="eyebrow">ПУЛЬТ ОКРУЖЕНИЯ</span><h2>Попробуйте весь путь.</h2><p>Выделите фразу, оставьте вопрос с @, ответьте, отделите ветку и поставьте реакцию. Затем измените документ и вернитесь к старому контексту.</p><div class="lab-grid"><button data-modal="open">① Открыть файл · Finder / CLI / выбор файла</button><button data-modal="change">② Имитировать внешнюю правку файла</button><button data-modal="toggle-agent">③ ${ui.online?'Отключить':'Подключить'} агентов · проверить очередь</button><button data-modal="fallback">↳ Ответ родителя вместо child: ${ui.fallback?'включён':'выключен'}</button><button data-modal="history">④ Восстановить прошлое по событиям</button><button data-modal="events">⑤ Проверить подписку и reconnect</button><button data-modal="storage">⑥ Выбрать место хранения (demo)</button><button data-modal="export">↓ Экспортировать историю</button><button data-modal="import">↑ Открыть архив</button><button data-modal="reset">↺ Начать демо заново</button></div><p>Reset заменит только данные этого прототипа. Экспортируйте нужную историю перед сбросом.</p>`);}
// UI routing is deliberately small; every persisted change passes through emit().
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.doc)return switchDoc(b.dataset.doc);
  if(b.dataset.thread)return selectThread(b.dataset.thread);
  if(b.dataset.tab){ui.tab=b.dataset.tab;render();return;}
  if(b.dataset.filter){ui.filter=b.dataset.filter;ui.thread=null;render();return;}
  if(b.dataset.seq)return setThrough(Number(b.dataset.seq));
  if(b.dataset.reply){ui.reply=b.dataset.reply;ui.selection=null;ui.fork=null;render();$('#commentInput').focus();return;}
  if(b.dataset.fork){ui.fork=b.dataset.fork;ui.reply=null;ui.selection=null;render();$('#commentInput').focus();return;}
  if(b.dataset.react){if(!ensureLive())return;const payload={commentId:b.dataset.react,actor:'Камиль',emoji:b.dataset.emoji};payload.active=!Object.values(live().reactions).some(r=>r.commentId===payload.commentId&&r.actor===payload.actor&&r.emoji===payload.emoji);emit('reaction.set',payload);return;}
  if(b.dataset.mention)return addMention(b.dataset.mention);
  if(b.dataset.originComment){const c=state().comments[b.dataset.originComment];if(c)selectThread(c.threadId);return;}
  if(b.dataset.cancelRequest){if(!ensureLive())return;emit('agent.status',{id:b.dataset.cancelRequest,status:'cancelled'},'Система');return;}
  if(b.dataset.retry){if(!ensureLive())return;modal(`<h2>Повторить запрос?</h2><p>Прошлый запуск мог выполниться. В реальном адаптере сначала нужна сверка с harness. Явный повтор может повторить вычисление; requestId сохраняется.</p><button class="primary" data-confirm-retry="${esc(b.dataset.retry)}">Повторить с тем же requestId</button>`);return;}
  if(b.dataset.confirmRetry){closeModal();emit('agent.status',{id:b.dataset.confirmRetry,status:'queued',receipt:null},'Система');pump();return;}
  if(b.dataset.store){if(!ensureLive())return;emit('storage.selected',{documentId:displayed().doc.id,folderId:displayed().doc.folderId||displayed().doc.id,mode:b.dataset.store});closeModal();toast('Предпочтение сохранено. Физическое хранение — в браузере.');return;}
  if(b.dataset.action){const a=b.dataset.action;
    if(a==='live')toLive();if(a==='head'){ui.snapshot=null;render();}
    if(a==='origin'){const t=state().threads[ui.thread];ui.snapshot=t.snapshotId;ui.tab='document';render();}
    if(a==='resolve'&&ensureLive()){const t=live().threads[ui.thread];emit(t.resolved?'thread.reopened':'thread.resolved',{threadId:t.id});}
    if(a==='cancel-compose'){ui.selection=null;ui.reply=null;ui.fork=null;render();}
    return;
  }
  if(b.dataset.modal){const a=b.dataset.modal;closeModal();
    if(a==='file')$('#fileInput').click();if(a==='open')openModal();if(a==='finder')finderModal();if(a==='terminal')terminalModal();if(a==='change')simulateChange();if(a==='toggle-agent')toggleAgents();if(a==='storage')storageModal();
    if(a==='history'||a==='events'){ui.tab=a;render();}
    if(a==='fallback'){ui.fallback=!ui.fallback;toast('Следующий запрос: '+(ui.fallback?'ответ родителя без child (demo).':'подтверждённый native child (demo).'));}
    if(a==='export')$('#exportButton').click();if(a==='import')$('#importInput').click();
    if(a.startsWith('entry-')){if(!ensureLive())return;switchDoc('doc-demo');toast('Открыто прежнее обсуждение proposal.md (demo).');}
    if(a==='reset')modal(`<h2>Начать заново?</h2><p>Будут заменены только данные Discuss demo в этом браузере.</p><button class="primary" data-modal="confirm-reset">Сбросить демо</button>`);
    if(a==='confirm-reset'){generation++;running.clear();loadFailure=false;events=seed();Object.assign(ui,{doc:'doc-demo',snapshot:null,thread:'t1',tab:'document',filter:'open',through:null,selection:null,reply:null,fork:null,online:true,subscribed:true,cursor:events.length,eventFilter:'all'});$('#commentInput').value='';save();render();}
  }
});
$('#openButton').onclick=openModal;$('#labButton').onclick=labModal;$('#closeModal').onclick=closeModal;$('#storageButton').onclick=storageModal;$('#agentToggle').onclick=toggleAgents;$('#changeButton').onclick=simulateChange;
$('#threadsButton').onclick=()=>{ui.thread=null;ui.selection=null;ui.reply=null;ui.fork=null;render();};
$('#versionSelect').onchange=e=>{ui.snapshot=e.target.value;ui.selection=null;render();};
$('#timeSlider').oninput=e=>setThrough(Number(e.target.value));$('#liveButton').onclick=toLive;
$('#subscriptionToggle').onclick=()=>{ui.subscribed=!ui.subscribed;if(ui.subscribed)ui.cursor=events.at(-1).seq;render();toast(ui.subscribed?'Пропущенные события доставлены в подписку.':'Подписка приостановлена. Сам журнал продолжает записываться.');};
$('#eventFilter').onchange=e=>{ui.eventFilter=e.target.value;renderEvents();};
$('#composer').onsubmit=e=>{e.preventDefault();submit();};$('#commentInput').onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();submit();}};
$('#commentInput').oninput=e=>{$('#mentionMenu').hidden=!/@[^\s]*$/.test(e.target.value);};$('#mentionButton').onclick=()=>{$('#mentionMenu').hidden=!$('#mentionMenu').hidden;};
let pendingSelection=null;
function captureSelection(){
  if(readonly())return;const selection=window.getSelection();if(!selection.rangeCount||selection.isCollapsed)return;
  const range=selection.getRangeAt(0),el=$('#documentText');if(!el.contains(range.startContainer)||!el.contains(range.endContainer))return;
  const before=range.cloneRange();before.selectNodeContents(el);before.setEnd(range.startContainer,range.startOffset);
  const start=Array.from(before.toString()).length,quote=range.toString();if(!quote.trim())return;
  pendingSelection={snapshotId:displayed().snapshot.id,start,end:start+Array.from(quote).length,quote};
  const box=range.getBoundingClientRect();$('#selectionButton').style.left=Math.min(Math.max(12,box.left),window.innerWidth-210)+'px';$('#selectionButton').style.top=Math.max(8,Math.min(box.bottom+8,window.innerHeight-48))+'px';$('#selectionButton').hidden=false;
}
$('#documentText').addEventListener('mouseup',captureSelection);
document.addEventListener('selectionchange',()=>{clearTimeout(captureSelection.timer);captureSelection.timer=setTimeout(captureSelection,80);});
document.addEventListener('keydown',e=>{if(e.altKey&&e.key==='Enter'&&!$('#selectionButton').hidden){e.preventDefault();$('#selectionButton').click();}});
$('#selectionButton').onmousedown=e=>e.preventDefault();$('#selectionButton').onclick=()=>{ui.selection=pendingSelection;ui.reply=null;ui.fork=null;$('#selectionButton').hidden=true;window.getSelection().removeAllRanges();renderComposer(state(),displayed().doc,displayed().snapshot);$('#commentInput').focus();};
document.addEventListener('mousedown',e=>{if(!e.target.closest('#selectionButton,#documentText'))$('#selectionButton').hidden=true;});
$('#fileInput').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||!ensureLive())return;if(file.size>2*1024*1024){toast('В демо поддерживаются файлы до 2 MiB.');return;}
  try{const buffer=await file.arrayBuffer();const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(text.includes('\0'))throw Error('binary');
    const id=uid();emit('document.opened',{id,name:file.name,path:file.name,folderId:'browser-imports',folderPath:'Файлы браузера (виртуальная папка)',storage:'central'});emit('snapshot.captured',{id:uid(),documentId:id,label:'S1',text},'Файл');switchDoc(id);toast('Файл открыт локально. Выделите фрагмент.');
  }catch{toast('Нужен текстовый файл в UTF-8.');}
};
function downloadJSON(data,name,raw=false){const blob=new Blob([raw?data:JSON.stringify(data,null,2)],{type:raw?'text/plain':'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#exportButton').onclick=()=>{downloadJSON({format:'discuss-demo/1',exportedAt:new Date().toISOString(),events},'discuss-history.json');toast('Архив включает снимки и весь журнал.');};
$('#importButton').onclick=()=>$('#importInput').click();
$('#importInput').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||!ensureLive())return;if(file.size>16*1024*1024){toast('Архив больше 16 MiB.');return;}try{const incoming=validateArchive(JSON.parse(await file.text()));modal(`<h2>Открыть архив?</h2><p>Архив содержит ${incoming.length} событий. Он заменит текущее демо в браузере. Сначала экспортируйте текущую историю, если хотите её сохранить.</p><button id="confirmImport" class="primary">Открыть этот архив</button>`);$('#confirmImport').onclick=()=>{generation++;running.clear();loadFailure=false;events=incoming;ui.cursor=events.at(-1).seq;ui.subscribed=true;ui.through=null;ui.thread=null;ui.doc=Object.keys(live().documents)[0];ui.snapshot=null;ui.selection=null;ui.reply=null;ui.fork=null;recoverPending('import');save();closeModal();render();toast('История восстановлена из архива.');};}catch(err){toast(err.message||'Не удалось прочитать архив.');}};
function recoverPending(mode='reload'){for(const r of Object.values(live().requests))if(['accepted','parent-accepted','child-confirmed','parent-fallback','running','interrupted',...(mode==='import'?['queued']:[])].includes(r.status))events=append(events,'agent.status',{id:r.id,status:'delivery-unknown'},'Система');if(ui.subscribed)ui.cursor=events.at(-1).seq;}
recoverPending();save();render();if(!loadFailure)pump();
