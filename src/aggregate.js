const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const parse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
const text = v => typeof v === 'string' ? v : '';
const list = v => Array.isArray(v) ? v : [];
export function normalizePath(path, cwd = '') {
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
export function pathKey(path) { return /^(?:[a-z]:\/|\/\/)/i.test(path) ? path.toLowerCase() : path; }
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function fileAddress(sessionId, path) {
  return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}
export function aggregate(events, initialCwd = '') {
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
export class SummaryFeed {
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
export class SummaryRepository {
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
