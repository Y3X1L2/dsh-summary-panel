window.__ModuleLoader__.load({id:'dsh-summary-panel',factory:(require)=>{
const React=require('react');
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const parse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
const text = v => typeof v === 'string' ? v : '';
const list = v => Array.isArray(v) ? v : [];
function normalizePath(path, cwd = '') {
  let p = text(path).replace(/\\/g, '/');
  if (!p || /[\u0000-\u001f]/.test(p)) return null;
  if (!/^(?:[a-z]:\/|\/)/i.test(p) && cwd) p = cwd.replace(/\\/g, '/').replace(/\/$/, '') + '/' + p;
  const prefix = p.startsWith('//') ? '//' : p.startsWith('/') ? '/' : '';
  const parts = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' && parts.length && parts.at(-1) !== '..') parts.pop();
    else if (part !== '..' || !prefix) parts.push(part);
  }
  return prefix + parts.join('/');
}
function pathKey(path) { return /^(?:[a-z]:\/|\/\/)/i.test(path) ? path.toLowerCase() : path; }
function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
function fileAddress(sessionId, path) {
  return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}
function aggregate(events, initialCwd = '') {
  let cwd = initialCwd;
  const calls = new Map(), outputs = new Map(), files = new Map(), tools = new Map(), pages = new Map(), queries = new Map();
  const putFile = (map, path, extra) => {
    const normalized = normalizePath(path, cwd);
    if (!normalized) return;
    const key = pathKey(normalized), old = map.get(key);
    map.set(key, {...old, ...extra, key, path: normalized, label: normalized.split('/').at(-1), description: extra.description || old?.description || ''});
  };
  const putPage = (url, title, extra) => {
    const normalized = safeUrl(url); if (!normalized) return;
    const u = new URL(normalized); u.hash = '';
    const key = u.href, old = pages.get(key);
    pages.set(key, {...old, ...extra, key, url: normalized, label: text(title) || old?.label || u.hostname, visited: !!(extra.visited || old?.visited)});
  };
  for (const event of [...events].sort((a,b) => a.seq-b.seq)) {
    const d = event.data; if (!record(d)) continue;
    const location = {seq: event.seq, turn: d.turn, time: event.time};
    if (event.type === 'working-directory/set') cwd = text(d.cwd || d.path) || cwd;
    if (event.type === 'tool/call') calls.set(d.callId, {name: text(d.name), args: parse(d.arguments) || {}, ...location});
    if (event.type === 'deliverables/presented' && Array.isArray(d.files)) {
      for (const f of d.files) if (record(f)) putFile(outputs, f.path, {...location, description: text(f.description), delivered: true});
    }
    if (event.type === 'user/message') {
      for (const item of list(d.content)) {
        if (!record(item)) continue;
        // Only explicit file references and attachment records, never paths guessed from prose.
        const ref = item.reference || item;
        if (['file', 'file-reference', 'local-file', 'localImage', 'file_reference'].includes(item.type)) putFile(files, ref.path || ref.file_path || ref.fsPath, location);
        if (item.type === 'image' && record(item.attachment) && typeof item.attachment.attachmentId === 'string') {
          const attachment = item.attachment, key = 'attachment:' + attachment.attachmentId;
          files.set(key, {key, label:text(attachment.name)||'图片附件', attachment, ...location});
        }
      }
      for (const f of list(d.attachments)) if (record(f)) putFile(files, f.path || f.fsPath, location);
    }
    if (event.type !== 'tool/result') continue;
    const message = d.message || {};
    if (message.isError || d.error) continue;
    const call = calls.get(message.source?.callId || message.toolCallId || d.callId);
    if (!call) continue;
    const {name, args} = call, meta = record(d.meta) ? d.meta : {};
    if (name === 'web_search') {
      for (const q of list(args.queries || (args.query ? [args.query] : []))) {
        const value = typeof q === 'string' ? q : q?.query;
        if (value) queries.set(value, {label: value, ...location});
      }
      for (const source of list(meta.sources)) if (record(source)) putPage(source.url, source.title, {...location, snippet: text(source.snippet), visited: false});
    } else if (name === 'web_fetch') {
      putPage(meta.url || args.url, meta.title, {...location, visited: true});
    } else if (name === 'present') {
      // Durable declaration is authoritative. No output is inferred from arbitrary shell text.
    } else if (name.includes('__') || name.startsWith('mcp:')) {
      const provider = name.includes('__') ? name.split('__')[0] : name.split(':')[1];
      const old = tools.get(provider);
      tools.set(provider, {key: provider, label: provider, count: (old?.count || 0)+1, ...location});
    }
  }
  return {outputs: [...outputs.values()].reverse(), files: [...files.values()].reverse(), tools: [...tools.values()], pages: [...pages.values()].reverse(), queries: [...queries.values()].reverse()};
}

// Pages stay pinned to the opening cursor while live events
// continue arriving. Sequence identity makes overlapping history and reconnects idempotent.
class SummaryFeed {
  constructor(remote, sessionId, publish) { Object.assign(this, {remote, sessionId, publish}); this.controller = new AbortController(); this.events = new Map(); }
  add(records) { for (const r of records || []) if (r.type === 'event' && r.event) this.events.set(r.event.seq, r.event); }
  emit(loading, error = '') { if (!this.controller.signal.aborted) this.publish({...aggregate(this.events.values(), this.cwd), loading: loading || !!this.backfilling, error}); }
  async backfill(snapshot) {
    let page = snapshot;
    while (page.hasMore && !this.controller.signal.aborted) {
      const beforeSeq = page.records?.[0]?.event.seq;
      if (!Number.isInteger(beforeSeq)) throw new Error('历史记录缺少分页位置');
      const result = await this.remote.page({address: {kind:'session',sessionId:this.sessionId}, throughSeq:snapshot.cursor, beforeSeq, maxMessages:200}, this.controller.signal);
      if (!result.ok) throw new Error(result.error?.message || '历史记录读取失败');
      page = result.value;
      if (page.hasMore && (!page.records.length || page.records[0].event.seq >= beforeSeq)) throw new Error('历史分页未前进');
      this.add(page.records); this.emit(page.hasMore);
    }
    this.backfilling = false;
    this.emit(false);
  }
  async start() {
    const signal = this.controller.signal;
    try {
      for await (const frame of this.remote.follow({address:{kind:'session',sessionId:this.sessionId},maxMessages:200},signal)) {
        if (signal.aborted) break;
        if (frame.type === 'snapshot') {
          this.events.clear(); this.cwd = frame.header?.cwd || ''; this.add(frame.records); this.backfilling = frame.hasMore; this.emit(frame.hasMore);
          this.history = this.backfill(frame).catch(e=>{this.backfilling=false;this.emit(false,e.message);});
        } else if (frame.type === 'event') { this.add([frame]); this.emit(false); }
      }
    } catch (e) { if (!signal.aborted) this.emit(false, e.message || '连接中断，请重试'); }
  }
  dispose() { this.controller.abort(); }
}

const emptySummary = () => ({outputs:[],files:[],tools:[],pages:[],queries:[],loading:true,error:''});

// Plugin-owned session cache. Header owners prewarm it, while the card and detail
// tabs subscribe to the same feed. Closing a card never owns the data lifetime.
class SummaryRepository {
  constructor(remote, maxIdle = 20) { this.remote=remote;this.maxIdle=maxIdle;this.entries=new Map();this.disposed=false; }
  entry(id) {
    let entry=this.entries.get(id);
    if(!entry){entry={id,refs:0,ready:false,snapshot:emptySummary(),listeners:new Set(),feed:null};this.entries.set(id,entry);}
    return entry;
  }
  getSnapshot(id) { return this.entry(id).snapshot; }
  subscribe(id,listener) { const entry=this.entry(id);entry.listeners.add(listener);return()=>{entry.listeners.delete(listener);this.trim();}; }
  retain(id) {
    if(this.disposed)return()=>{};
    const entry=this.entry(id);entry.refs++;
    // Move recently selected sessions to the end of the idle-cache order.
    this.entries.delete(id);this.entries.set(id,entry);
    this.start(entry);
    let released=false;
    return()=>{
      if(released)return;released=true;entry.refs--;
      if(entry.refs===0){entry.feed?.dispose();entry.feed=null;this.trim();}
    };
  }
  start(entry) {
    if(this.disposed||entry.feed)return;
    const feed=new SummaryFeed(this.remote,entry.id,value=>{
      if(entry.feed!==feed||this.disposed)return;
      // Keep a complete cached view while reconnecting/backfilling. Never flash
      // a partial recent-history snapshot over an already complete summary.
      if(entry.ready&&value.loading)return;
      entry.snapshot=entry.ready&&value.error?{...entry.snapshot,error:value.error}:value;
      if(!value.loading&&!value.error)entry.ready=true;
      for(const listener of entry.listeners)listener();
    });
    entry.feed=feed;void feed.start();
  }
  refresh(id) { const entry=this.entry(id);entry.feed?.dispose();entry.feed=null;if(entry.refs>0)this.start(entry); }
  reconnect(remote=this.remote) { this.remote=remote;for(const entry of this.entries.values())this.refresh(entry.id); }
  trim() {
    const idle=[...this.entries.values()].filter(entry=>entry.refs===0&&entry.listeners.size===0);
    for(const entry of idle.slice(0,Math.max(0,idle.length-this.maxIdle)))this.entries.delete(entry.id);
  }
  dispose() { this.disposed=true;for(const entry of this.entries.values()){entry.feed?.dispose();entry.listeners.clear();}this.entries.clear(); }
}

// Give the transcript room once on opening, while leaving native width controls
// and the right sidebar free to take over after a user gesture.
function attachSummaryLayout(session, rail, sidebarRight) {
  const scroll=session.querySelector(':scope > [data-conversation-scroll]');
  let manual=false, released=false, initialOffset=0, preferredWidth=0;
  const expanded=()=>sidebarRight.isExpanded?.()===true;
  const measureWidth=()=>{
    const probe=document.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:0;width:var(--dsh-chat-content-width,680px)';
    session.append(probe);
    const width=probe.getBoundingClientRect().width;
    probe.remove();return width;
  };
  const setOffset=value=>{
    const next=`${Math.round(value)}px`;
    if(session.style.getPropertyValue('--dsp-offset')!==next)session.style.setProperty('--dsp-offset',next);
  };
  const release=()=>{
    released=true;session.dataset.dspLayoutState='overlay';session.classList.remove('dsp-content-shifted');
  };
  const fit=()=>{
    const column=session.getBoundingClientRect().width;
    const card=rail.getBoundingClientRect().width;
    const width=Math.min(preferredWidth,Math.max(240,column-card-48));
    initialOffset=Math.max(0,(column+width)/2-(column-card-16));
    const next=`${width}px`;
    if(session.style.getPropertyValue('--dsp-content-width')!==next)session.style.setProperty('--dsp-content-width',next);
    setOffset(initialOffset);
  };
  if(scroll&&!expanded()){
    preferredWidth=measureWidth();fit();session.classList.add('dsp-content-shifted');
  }
  const update=()=>{
    if(expanded()){release();return;}
    if(released||!preferredWidth)return;
    if(!manual){fit();return;}
    // A wide manual setting may run under the card, but never translate its
    // left edge outside the conversation viewport.
    setOffset(Math.min(initialOffset,Math.max(0,(session.getBoundingClientRect().width-measureWidth())/2-24)));
  };
  const pointerDown=event=>{
    if(event.button!==0||!event.target.closest('[data-width-handle]'))return;
    manual=true;session.setAttribute('data-dsp-manual-width','');update();
  };
  session.addEventListener('pointerdown',pointerDown,true);
  const resize=new ResizeObserver(update);resize.observe(session);
  const widthObserver=new MutationObserver(update);
  widthObserver.observe(session,{attributes:true,attributeFilter:['style']});
  if(session.parentElement)widthObserver.observe(session.parentElement,{attributes:true,attributeFilter:['style']});
  let frame=session.parentElement;
  while(frame&&!frame.querySelector('[data-rightbar-col]'))frame=frame.parentElement;
  const sidebarObserver=new MutationObserver(update);
  if(frame)sidebarObserver.observe(frame,{attributes:true,attributeFilter:['data-rightbar-collapsed','data-rightbar-fullscreen']});
  return {
    setOpen(open){session.dataset.dspLayoutState=open?'open':'closing';},
    dispose(){
      resize.disconnect();widthObserver.disconnect();sidebarObserver.disconnect();
      session.removeEventListener('pointerdown',pointerDown,true);
      session.classList.remove('dsp-content-shifted');
      session.style.removeProperty('--dsp-offset');session.style.removeProperty('--dsp-content-width');
      delete session.dataset.dspLayoutState;session.removeAttribute('data-dsp-manual-width');
    }
  };
}

const PANEL_CSS=".dsp-panel{color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.5;height:100%;box-sizing:border-box;padding:6px 14px 14px;overflow:auto;min-width:0}\n.dsp-session-open{position:relative!important;isolation:isolate}\n.dsp-content-shifted:not([data-dsp-manual-width]){--dsh-chat-content-width:var(--dsp-content-width)!important}\n.dsp-session-open>[data-conversation-scroll]>*{transition:translate 240ms cubic-bezier(.2,.8,.2,1)}\n.dsp-session-open[data-dsp-manual-width]>[data-conversation-scroll]>*,.dsp-session-open[data-dsp-layout-state=overlay]>[data-conversation-scroll]>*{transition:none}\n.dsp-content-shifted[data-dsp-layout-state=open]>[data-conversation-scroll]>*,.dsp-content-shifted[data-dsp-layout-state=open]>[data-width-handle]{translate:calc(-1 * var(--dsp-offset)) 0}\n.dsp-independent-rail{position:absolute;top:0;right:0;width:340px;max-height:100%;overflow-x:hidden;overflow-y:auto;background:transparent;z-index:1000;min-height:0}\n.dsp-independent-rail>.dsp-panel{height:auto;overflow:visible}\n.dsp-independent-rail[data-state=open]>.dsp-panel{animation:dsp-card-enter 240ms cubic-bezier(.2,.8,.2,1) both;transform-origin:top right}\n.dsp-independent-rail[data-state=closing]>.dsp-panel{animation:dsp-card-exit 200ms ease-in both;pointer-events:none;transform-origin:top right}\n@keyframes dsp-card-enter{from{transform:translateX(100%)}to{transform:translateX(0)}}\n@keyframes dsp-card-exit{from{transform:translateX(0)}to{transform:translateX(100%)}}\n@media(prefers-reduced-motion:reduce){.dsp-independent-rail[data-state]>.dsp-panel{animation-duration:1ms}.dsp-session-open>[data-conversation-scroll]>*{transition-duration:1ms}}\n.dsp-image-preview{padding:10px;margin-bottom:12px;border-radius:16px;background:var(--dsw-alias-bg-layer-2)}.dsp-image-preview>button{display:flex;margin-left:auto}.dsp-image-preview img{display:block;max-width:100%;max-height:60vh;margin:auto;object-fit:contain}\n@media(max-width:1100px){.dsp-independent-rail{width:min(340px,90vw)}}\n.dsp-panel *{box-sizing:border-box}.dsp-panel button,.dsp-panel input{font:inherit}.dsp-panel button{color:inherit;cursor:pointer}.dsp-panel button:focus-visible,.dsp-panel a:focus-visible,.dsp-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}\n.dsp-card{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-base));border:0;border-radius:20px;padding:12px 14px;min-width:0}\nbody:not([data-ds-dark-theme]) .dsp-card{--dsw-alias-label-primary:#666;--dsw-alias-label-secondary:#666;--dsw-alias-label-tertiary:#999;--dsw-alias-border-l2:#ececec;background:#fff;color:#666;border:1px solid #e5e5e5;box-shadow:0 2px 6px #00000005,0 8px 24px #00000008}\n.dsp-heading{display:flex;align-items:center;gap:6px;min-height:24px;margin-bottom:2px;font-weight:600;color:var(--dsw-alias-label-secondary)}\n.dsp-heading>.dsp-icon,.dsp-menu-wrap{margin-left:auto}.dsp-count{font-size:12px;font-weight:400;color:var(--dsw-alias-label-tertiary)}\n.dsp-icon,.dsp-toggle{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}\n.dsp-panel .dsp-icon{width:24px;height:24px;border-radius:6px}\n.dsp-toggle{margin-right:5px}.dsp-icon:hover,.dsp-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.dsp-divider{height:1px;background:var(--dsw-alias-border-l2);margin:8px 2px}\n.dsp-row{display:flex;align-items:center;gap:10px;width:100%;min-width:0;border:0;background:transparent;text-decoration:none;color:var(--dsw-alias-label-secondary);padding:5px 4px;text-align:left;border-radius:7px;min-height:30px}\nbutton.dsp-row:hover,a.dsp-row:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n.dsp-row>svg{flex:none;color:var(--dsw-alias-label-secondary)}.dsp-row-text{min-width:0;flex:1}.dsp-label{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsp-detail{display:block;color:var(--dsw-alias-label-tertiary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsp-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}\n.dsp-empty,.dsp-empty-create{color:var(--dsw-alias-label-tertiary);margin:0;padding:5px 4px}.dsp-empty-create{border:0;background:transparent;text-align:left;width:100%}.dsp-empty-create:hover{color:var(--dsw-alias-label-primary)}\n.dsp-menu-wrap{position:relative}.dsp-menu{position:absolute;right:0;top:34px;width:180px;padding:5px;z-index:5;border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-interactive-bg-hover));border:1px solid var(--dsw-alias-border-l2);box-shadow:0 6px 22px #0002;backdrop-filter:blur(20px)}.dsp-menu button{display:block;width:100%;border:0;text-align:left;background:transparent;padding:8px;border-radius:7px}.dsp-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.dsp-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:14px}.dsp-search{display:flex;gap:8px;align-items:center;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:7px 10px;margin-bottom:18px;color:var(--dsw-alias-label-tertiary)}.dsp-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary)}.dsp-full{padding:0 4px}.dsp-group{margin:12px 0}.dsp-group h3{font-size:12px;font-weight:500;color:var(--dsw-alias-label-tertiary);margin:16px 5px 6px}.dsp-notice{padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;margin-bottom:12px;font-size:12px;overflow-wrap:anywhere}.dsp-notice button{background:transparent;border:0;text-decoration:underline;margin-left:6px}.dsp-loading{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:0 8px}\n@media(max-width:600px){.dsp-panel{padding:6px 8px}.dsp-card{padding:10px 12px;border-radius:18px}}\n";
const ReactDOM=require('react-dom');
const h = React.createElement;
const inject = ['slots','sidebarRightTabs','sidebarRight','remote','remote.session','commandUi','uiConversation'];
function useSummary(sessionId) {
  const repository=summaryRepository;
  const subscribe=React.useCallback(listener=>repository.subscribe(sessionId,listener),[repository,sessionId]);
  const getSnapshot=React.useCallback(()=>repository.getSnapshot(sessionId),[repository,sessionId]);
  React.useEffect(()=>repository.retain(sessionId),[repository,sessionId]);
  return React.useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
}
function Icon({kind='file',size=16}) {
  const paths = {
    summary: 'M8 5h12M8 12h12M8 19h12M3 4h1v2H3zM3 11h1v2H3zM3 18h1v2H3z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    web: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    plus: 'M12 4v16M4 12h16',
    back: 'M15 5l-7 7 7 7',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    close: 'M6 6l12 12M6 18L18 6'
  };
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[kind]||paths.file}));
}
function Row({icon='file',label,detail,onClick,href,meta}) {
  const inner = [h(Icon,{kind:icon,key:'i'}),h('span',{className:'dsp-row-text',key:'t'},h('span',{className:'dsp-label'},label),detail&&h('span',{className:'dsp-detail'},detail)),meta&&h('span',{className:'dsp-meta',key:'m'},meta)];
  return href ? h('a',{className:'dsp-row',href,target:'_blank',rel:'noopener noreferrer',title:href},...inner) : h(onClick?'button':'div',{type:onClick?'button':undefined,className:'dsp-row',onClick,title:detail||label},...inner);
}
function SummaryPanel({sessionId,inputActions,view='summary',onNavigate,onClose,detail=false}) {
  const data=useSummary(sessionId);
  const [search,setSearch] = React.useState(''),[menu,setMenu] = React.useState(false),[notice,setNotice] = React.useState('');
  const [image,setImage]=React.useState(null);
  const alive=React.useRef(true);
  React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const mode = view;
  React.useEffect(()=>{setSearch('');setMenu(false);setNotice('');},[mode]);
  React.useEffect(()=>{
    if(!menu) return;
    const close = e=>{if(e.key==='Escape')setMenu(false);};
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[menu]);
  const navigate = onNavigate;
  const openFile = async item=>{
    if(item.attachment){
      try{const url=await summaryContext.uiConversation.imageUrl(sessionId,item.attachment);if(alive.current)setImage({url,label:item.label});}
      catch(e){if(alive.current)setNotice('图片暂时无法打开：'+e.message);}
      return;
    }
    try { summaryContext.sidebarRight.openResource(fileAddress(sessionId,item.path)); }
    catch(e){setNotice(e.message||'文件暂时无法打开');}
  };
  const create = kind=>{
    const requests={document:'请创建一份文档，完成后使用 present 交付文件。',spreadsheet:'请创建一份电子表格，完成后使用 present 交付文件。',presentation:'请创建一份演示文稿，完成后使用 present 交付文件。',file:'请创建一个文件，完成后使用 present 交付文件。'};
    const span=inputActions.captureInsertion();
    if(!inputActions.insertText(requests[kind],{...span,end:span.start})) setNotice('输入框当前不可编辑，请稍后再试');
    else setNotice('创建要求已添加到输入框，可以补充后发送');
    setMenu(false);
  };
  const addSource = ()=>{
    try {
      const span=inputActions.captureInsertion();
      const result=summaryContext.commandUi.dispatch({candidate:{name:'file'},session:{sessionId},span:{start:span.start,end:span.start}});
      if(result!=='handled')setNotice('请通过输入框的“添加文件”选择来源');
    } catch(e) {setNotice('无法添加文件：'+e.message);}
  };
  const filter=items=>items.filter(x=>`${x.label||''} ${x.path||''} ${x.url||''} ${x.description||''}`.toLowerCase().includes(search.toLowerCase()));
  const fileRow=x=>h(Row,{key:x.key,label:x.label,detail:mode==='summary'?undefined:(x.description||x.path),onClick:()=>openFile(x)});
  const sourceCount=data.files.length+data.tools.length+(data.pages.length||data.queries.length?1:0);
  const outputList=filter(data.outputs), fileList=filter(data.files), toolList=filter(data.tools), pageList=filter(data.pages),queryList=filter(data.queries);
  return h('div',{className:'dsp-panel','data-dsh-summary-panel':mode},
    mode!=='summary'&&h('div',{className:'dsp-toolbar'},h('strong',null,mode==='outputs'?'全部输出内容':'全部来源')),
    mode!=='summary'&&h('div',{className:'dsp-search'},h(Icon,{kind:'search'}),h('input',{value:search,onChange:e=>setSearch(e.target.value),placeholder:mode==='outputs'?'搜索输出文件':'搜索来源','aria-label':'搜索摘要条目'})),
    data.error&&h('div',{className:'dsp-notice',role:'alert'},'摘要读取未完成：'+data.error,h('button',{onClick:()=>summaryRepository.refresh(sessionId)},'重试')),
    notice&&h('div',{className:'dsp-notice',role:'status'},notice),
    image&&h('div',{className:'dsp-image-preview',role:'dialog','aria-label':image.label},h('button',{className:'dsp-icon','aria-label':'关闭图片预览',onClick:()=>setImage(null)},h(Icon,{kind:'close'})),h('img',{src:image.url,alt:image.label})),
    h('div',{className:mode==='summary'?'dsp-card':'dsp-full'},
      mode!=='sources'&&h('section',{'aria-label':'输出内容'},
        h('div',{className:'dsp-heading'},h('span',null,'输出内容'),data.outputs.length>0&&h('span',{className:'dsp-count'},data.outputs.length),h('div',{className:'dsp-menu-wrap'},h('button',{className:'dsp-icon','aria-label':'创建文件','aria-expanded':menu,onClick:()=>setMenu(!menu)},h(Icon,{kind:'plus'})),menu&&h('div',{className:'dsp-menu',role:'menu'},[['document','创建文档'],['spreadsheet','创建电子表格'],['presentation','创建演示文稿'],['file','创建其他文件']].map(([key,label])=>h('button',{key,role:'menuitem',onClick:()=>create(key)},label))))),
        outputList.length?(mode==='summary'?outputList.slice(0,4):outputList).map(fileRow):h('button',{className:'dsp-empty-create',onClick:()=>setMenu(true)},data.loading?'正在读取输出内容…':search?'没有匹配的文件':'创建文件'),
        mode==='summary'&&data.outputs.length>4&&h(Row,{icon:'link',label:`查看全部 ${data.outputs.length} 个文件`,onClick:()=>navigate('outputs')})
      ),
      mode==='summary'&&h('div',{className:'dsp-divider'}),
      mode!=='outputs'&&h('section',{'aria-label':'来源'},
        h('div',{className:'dsp-heading'},h('span',null,'来源'),sourceCount>0&&h('span',{className:'dsp-count'},sourceCount),h('button',{className:'dsp-icon','aria-label':'添加来源文件',onClick:addSource},h(Icon,{kind:'plus'}))),
        mode==='summary'?h(React.Fragment,null,
          ...data.files.slice(0,2).map(fileRow),
          (data.pages.length>0||data.queries.length>0)&&h(Row,{icon:'web',label:'网页搜索',onClick:()=>navigate('sources')}),
          ...data.tools.slice(0,2).map(x=>h(Row,{key:x.key,icon:'link',label:x.label,onClick:()=>navigate('sources')})),
          !sourceCount&&h('p',{className:'dsp-empty'},data.loading?'正在读取来源…':'暂无来源'),
          h(Row,{icon:'link',label:'查看全部',onClick:()=>navigate('sources')})
        ):h(React.Fragment,null,
          fileList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'附件文件'),...fileList.map(fileRow)),
          queryList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'搜索查询'),...queryList.map((x,i)=>h(Row,{key:i,icon:'search',label:x.label,meta:x.turn?`第 ${x.turn} 轮`:undefined}))),
          pageList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'网页'),...pageList.map(x=>h(Row,{key:x.key,icon:'web',label:x.label,detail:x.url,href:x.url,meta:x.visited?'已访问':'搜索结果'}))),
          toolList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'工具来源'),...toolList.map(x=>h(Row,{key:x.key,icon:'link',label:x.label,meta:`${x.count} 次调用`}))),
          !fileList.length&&!queryList.length&&!pageList.length&&!toolList.length&&h('p',{className:'dsp-empty'},search?'没有匹配的来源':'暂无来源')
        )
      )
    ),
    data.loading&&h('p',{className:'dsp-loading',role:'status'},'正在补全历史记录…')
  );
}
let summaryContext;
let summaryRepository;
function apply(ctx) {
  summaryContext=ctx;
  const repository=new SummaryRepository(ctx.remote.session);
  summaryRepository=repository;
  ctx.effect(()=>()=>repository.dispose());
  ctx.on('connection/reset',()=>repository.reconnect(ctx.remote.session));
  ctx.effect(()=>{
    const style=document.createElement('style'); style.dataset.plugin='dsh-summary-panel';style.textContent=PANEL_CSS;document.head.append(style);
    return ()=>style.remove();
  });
  const openDetails=view=>ctx.sidebarRight.openTab(view==='outputs'?'summary-outputs':'summary-sources');
  for(const [kind,title,view] of [['summary-outputs','全部输出内容','outputs'],['summary-sources','全部来源','sources']]){
    const id='dsh-summary-panel/'+kind;
    ctx.effect(()=>ctx.sidebarRightTabs.register({id,kind,title:()=>title,priority:'extension'}));
    function Details({sessionId,inputActions}){return h(SummaryPanel,{sessionId,inputActions,view,detail:true,onNavigate:openDetails});}
    ctx.effect(()=>ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:id},Details)));
  }
  function Toggle({sessionId,inputActions}) {
    const [open,setOpen]=React.useState(false),[rendered,setRendered]=React.useState(false),[host,setHost]=React.useState(null);
    const ref=React.useRef(null),layout=React.useRef(null);
    React.useEffect(()=>repository.retain(sessionId),[sessionId]);
    React.useLayoutEffect(()=>{
      if(!rendered)return;
      const session=[...document.querySelectorAll('[data-conversation-session]')].find(node=>node.dataset.conversationSession===sessionId && node.getClientRects().length>0);
      if(!session)return;
      const seat=document.createElement('aside');seat.className='dsp-independent-rail';seat.dataset.state='open';seat.setAttribute('aria-label','会话摘要');
      session.classList.add('dsp-session-open');session.append(seat);layout.current=attachSummaryLayout(session,seat,ctx.sidebarRight);setHost(seat);
      return ()=>{layout.current?.dispose();layout.current=null;setHost(null);seat.remove();session.classList.remove('dsp-session-open');};
    },[rendered,sessionId]);
    React.useLayoutEffect(()=>{if(host){host.dataset.state=open?'open':'closing';layout.current?.setOpen(open);}},[host,open]);
    React.useEffect(()=>{
      if(open||!rendered)return;
      const timer=setTimeout(()=>setRendered(false),260);
      return ()=>clearTimeout(timer);
    },[open,rendered]);
    return h(React.Fragment,null,h('button',{ref,className:'dsp-toggle',type:'button','aria-label':open?'关闭摘要面板':'打开摘要面板','aria-expanded':open,title:'摘要：输出内容和来源',onClick:()=>{if(!open)setRendered(true);setOpen(!open);}},h(Icon,{kind:'summary',size:18})),host&&ReactDOM.createPortal(h(SummaryPanel,{sessionId,inputActions,view:'summary',onNavigate:openDetails}),host));
  }
  ctx.effect(()=>ctx.slots.inject('conversation.session.header.utilities',()=>ctx.slots.register({name:'conversation.session.header.utilities',id:'dsh-summary-panel-toggle',order:1000},Toggle)));
}

return {apply(ctx){try{return apply(ctx);}catch(error){console.error('dsh-summary-panel activation',error?.stack||error);throw error;}},inject};
}});
