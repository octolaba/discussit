export const sampleText = `# Предложение: обсуждение документов

Один файл. Общий контекст.

Мы обсуждаем фрагменты Markdown и текстовых файлов вместе с агентами. Сам документ остаётся в привычном редакторе.

## Доставка комментариев

Каждый новый комментарий доставляется агенту ровно один раз.

Упоминание @claude/reviewer приглашает специалиста в обсуждение. Ответ появляется рядом с исходным вопросом.

## История и контекст

Обсуждение привязано к снимку документа. Если текст изменился, старые комментарии можно прочитать в прежнем контексте.

## Хранение

Комментарии и снимки храним рядом с документом или в общем локальном хранилище.

Решение о закрытии обсуждения остаётся за человеком.
`;
export const changedText = sampleText.replace('Каждый новый комментарий доставляется агенту ровно один раз.', 'Доставка работает как at-least-once. Повторные события распознаются по eventId, а ответы — по requestId.').replace('Один файл. Общий контекст.', 'Один файл. Общий контекст. Сохраняем каждый обсуждаемый снимок.');
export const uid = () => crypto.randomUUID();
export function project(events, through=Infinity) {
  const s={documents:{},snapshots:{},threads:{},comments:{},requests:{},reactions:{},storage:{},seq:0};
  for(const e of events){
    if(e.seq>through) break;
    const p=e.payload; s.seq=e.seq;
    switch(e.type){
      case 'document.opened': s.documents[p.id]={...p,storage:s.storage[p.folderId]||p.storage||'central'};break;
      case 'snapshot.captured':s.snapshots[p.id]={...p};s.documents[p.documentId].head=p.id;break;
      case 'storage.selected':if(p.folderId){s.storage[p.folderId]=p.mode;for(const d of Object.values(s.documents))if((d.folderId||d.id)===p.folderId)d.storage=p.mode;}else s.documents[p.documentId].storage=p.mode;break;
      case 'thread.created':case 'thread.forked':s.threads[p.id]={...p,resolved:false,seq:e.seq};break;
      case 'comment.created':s.comments[p.id]={...p,seq:e.seq,time:e.recordedAt};break;
      case 'thread.resolved':s.threads[p.threadId].resolved=true;break;
      case 'thread.reopened':s.threads[p.threadId].resolved=false;break;
      case 'reaction.set':{
        const key=JSON.stringify([p.commentId,p.actor,p.emoji]);if(p.active)s.reactions[key]={...p};else delete s.reactions[key];break;
      }
      case 'agent.requested':s.requests[p.id]={...p,status:'queued'};break;
      case 'agent.status':s.requests[p.id]={...s.requests[p.id],...p};break;
    }
  }
  return s;
}
export function append(events,type,payload,actor='Камиль',commandId=uid()){
  const previous=events.find(e=>e.commandId===commandId);
  if(previous){if(previous.type!==type||JSON.stringify(previous.payload)!==JSON.stringify(payload))throw Error('commandId уже использован с другим содержимым');return events;}
  return [...events,{schemaVersion:1,eventId:uid(),commandId,seq:(events.at(-1)?.seq||0)+1,recordedAt:new Date().toISOString(),actor,type,payload:structuredClone(payload)}];
}
export function seed(){
  let es=[];const add=(t,p,a='Камиль')=>{es=append(es,t,p,a);};
  add('document.opened',{id:'doc-demo',name:'proposal.md',path:'~/Documents/proposal.md',folderId:'demo-documents',folderPath:'~/Documents',storage:'central'});
  add('snapshot.captured',{id:'s1',documentId:'doc-demo',label:'S1',text:sampleText},'Файл');
  const quote='Каждый новый комментарий доставляется агенту ровно один раз.';
  const start=Array.from(sampleText.slice(0,sampleText.indexOf(quote))).length;
  add('thread.created',{id:'t1',documentId:'doc-demo',snapshotId:'s1',start,end:start+Array.from(quote).length,quote});
  add('comment.created',{id:'c1',threadId:'t1',parentId:null,actor:'Камиль',body:'@claude/reviewer А если соединение прервётся после доставки? Давай проверим гарантию.',snapshotId:'s1',throughSeq:3});
  add('comment.created',{id:'c2',threadId:'t1',parentId:'c1',actor:'Claude · reviewer',body:'Предлагаю at-least-once и дедупликацию по requestId. Между внешним вызовом и подтверждением остаётся окно неопределённости — его стоит показать в интерфейсе.',snapshotId:'s1',throughSeq:4},'Claude · reviewer');
  add('reaction.set',{commentId:'c2',actor:'Камиль',emoji:'👍',active:true});
  return es.map((e,i)=>({...e,recordedAt:new Date(Date.UTC(2026,9,6,8,40,i*13)).toISOString()}));
}
export function validateArchive(data){
  if(data.format!=='discuss-demo/1'||!Array.isArray(data.events)||!data.events.length||data.events.length>10000)throw Error('Ожидался архив Discuss demo/1 (до 10 000 событий).');
  const ids=new Set(),commands=new Set();let seq=0;
  const known=new Set(['document.opened','snapshot.captured','storage.selected','thread.created','thread.forked','comment.created','thread.resolved','thread.reopened','reaction.set','agent.requested','agent.status','subscription.changed','entry.opened']);
  for(const e of data.events){
    if(typeof e.actor!=='string'||!Number.isFinite(Date.parse(e.recordedAt)))throw Error('Неверный автор или время события.');
    for(const key of ['id','documentId','threadId','commentId','parentId'])if(['__proto__','prototype','constructor'].includes(e.payload?.[key]))throw Error('Недопустимый идентификатор.');
    if(e.payload?.throughSeq!==undefined&&(!Number.isInteger(e.payload.throughSeq)||e.payload.throughSeq<0||e.payload.throughSeq>=e.seq))throw Error('Неверная граница контекста.');
    if(e.type==='agent.status'&&!['queued','accepted','parent-accepted','child-confirmed','parent-fallback','running','completed','cancelled','interrupted','delivery-unknown'].includes(e.payload?.status))throw Error('Неверный статус агента.');
    if(e.schemaVersion!==1||e.seq!==++seq||!known.has(e.type)||!e.payload||typeof e.payload!=='object'||typeof e.eventId!=='string'||typeof e.commandId!=='string'||ids.has(e.eventId)||commands.has(e.commandId))throw Error('Нарушена структура журнала.');
    ids.add(e.eventId);commands.add(e.commandId);
    if(JSON.stringify(e.payload).length>2100000)throw Error('Слишком большой payload.');
  }
  try{const s=project(data.events);for(const d of Object.values(s.documents))if(typeof d.name!=='string'||!s.snapshots[d.head])throw 0;
    for(const snap of Object.values(s.snapshots))if(typeof snap.text!=='string'||!s.documents[snap.documentId])throw 0;
    for(const t of Object.values(s.threads)){const sn=s.snapshots[t.snapshotId];if(!sn||sn.documentId!==t.documentId||typeof t.quote!=='string'||!Number.isInteger(t.start)||!Number.isInteger(t.end)||Array.from(sn.text).slice(t.start,t.end).join('')!==t.quote)throw 0;}
    for(const r of Object.values(s.requests))if(!s.threads[r.threadId]||!s.comments[r.commentId]||!s.snapshots[r.snapshotId]||typeof r.agent!=='string'||!Number.isInteger(r.throughSeq))throw 0;
    for(const c of Object.values(s.comments))if((c.requestId!==undefined&&typeof c.requestId!=='string')||(c.responderKind!==undefined&&!['native-child','parent-fallback'].includes(c.responderKind))||!s.threads[c.threadId]||typeof c.body!=='string'||typeof c.actor!=='string'||!s.snapshots[c.snapshotId]||(c.parentId&&(!s.comments[c.parentId]||s.comments[c.parentId].threadId!==c.threadId||s.comments[c.parentId].seq>=c.seq)))throw 0;
  }catch{throw Error('Архив содержит несогласованные ссылки или контекст.');}
  return data.events;
}
