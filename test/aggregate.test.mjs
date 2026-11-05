import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregate,SummaryFeed,safeUrl,normalizePath,fileAddress} from '../src/aggregate.js';
const event=(seq,type,data)=>({seq,type,data,time:seq});
const call=(seq,id,name,args)=>event(seq,'tool/call',{turn:1,callId:id,name,arguments:JSON.stringify(args)});
const result=(seq,id,meta={},isError=false)=>event(seq,'tool/result',{turn:1,message:{source:{callId:id},isError},meta});
test('delivered paths deduplicate across spelling and turns; failed or unrelated calls contribute nothing',()=>{
 const out=aggregate([event(1,'deliverables/presented',{turn:1,files:[{path:'out/a.md',description:'first'}]}),event(3,'deliverables/presented',{turn:2,files:[{path:'C:\\work\\out\\A.md',description:'latest'}]}),call(4,'c','write',{file_path:'bad.txt'}),result(5,'c',{},true)],'C:/work');
 assert.equal(out.outputs.length,1);assert.equal(out.outputs[0].description,'latest');assert.equal(out.outputs[0].turn,2);
});
test('web search, fetched URLs and MCP providers aggregate successful structured results only',()=>{
 const out=aggregate([call(1,'s','web_search',{queries:['DSH docs']}),result(2,'s',{sources:[{url:'https://example.com/a#one',title:'Docs'},{url:'javascript:alert(1)'}]}),call(3,'f','web_fetch',{url:'https://example.com/a#two'}),result(4,'f'),call(5,'m','drive__search',{}),result(6,'m'),call(7,'b','web_search',{queries:['failed']}),result(8,'b',{},true)]);
 assert.deepEqual(out.queries.map(q=>q.label),['DSH docs']);assert.equal(out.pages.length,1);assert.equal(out.pages[0].visited,true);assert.equal(out.tools[0].label,'drive');
});
test('only explicit user file references become file sources, never ordinary paths in text',()=>{
 const out=aggregate([event(1,'user/message',{content:[{type:'file',path:'input.csv'},{type:'text',text:'see secret.txt'}]})],'/work');
 assert.deepEqual(out.files.map(x=>x.path),['/work/input.csv']);assert.equal(out.outputs.length,0);
});
test('durable image attachments are sources with a stable id across repeated submissions',()=>{
 const item={type:'image',attachment:{attachmentId:'img-1',name:'reference.png',mediaType:'image/png',width:100,height:100,bytes:128}};
 const out=aggregate([event(1,'user/message',{content:[item]}),event(2,'user/message',{content:[item]})]);
 assert.equal(out.files.length,1);assert.equal(out.files[0].attachment.attachmentId,'img-1');assert.equal(out.files[0].label,'reference.png');
});
test('malformed optional metadata does not break the whole summary',()=>{
 const out=aggregate([event(0,'user/message',{content:{bad:true},attachments:[null]}),call(1,'s','web_search',{queries:123}),result(2,'s',{sources:{bad:true}})]);
 assert.equal(out.pages.length,0);assert.equal(out.files.length,0);
});
test('file addresses encode whitespace and reserved URL characters; unsafe links rejected',()=>{
 assert.equal(normalizePath('a/../b.txt','C:\\work'),'C:/work/b.txt');
 assert.equal(fileAddress('s','a #.txt'),'dsh-resource://file/session/s/a%20%23.txt');
 for(const u of ['javascript:alert(1)','file:///C:/x','https://user:pass@example.com/'])assert.equal(safeUrl(u),null);
});
test('backfills several history pages against one cut while preserving overlapping live events',async()=>{
 let release;const wait=new Promise(r=>release=r),pageRequests=[],published=[];
 const remote={async *follow(){yield {type:'snapshot',header:{cwd:'/work'},cursor:9,hasMore:true,records:[{type:'event',event:event(9,'deliverables/presented',{files:[{path:'new.md'}]})}]};await wait;yield {type:'event',event:event(10,'deliverables/presented',{files:[{path:'live.md'}]})};},async page(req){pageRequests.push(req);if(req.beforeSeq===9)return {ok:true,value:{hasMore:true,records:[{type:'event',event:event(5,'deliverables/presented',{files:[{path:'middle.md'}]})}]}};release();return {ok:true,value:{hasMore:false,records:[{type:'event',event:event(0,'deliverables/presented',{files:[{path:'old.md'}]})}]}};}};
 const feed=new SummaryFeed(remote,'s',v=>published.push(v));await feed.start();await feed.history;
 assert.deepEqual(new Set(published.at(-1).outputs.map(x=>x.label)),new Set(['new.md','old.md','middle.md','live.md']));assert.deepEqual(pageRequests.map(x=>x.throughSeq),[9,9]);feed.dispose();
});
test('dispose cancels both live and history work without publishing stale data',async()=>{
 let aborted=false,published=0;
 const remote={async *follow(req,signal){await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));}};
 const feed=new SummaryFeed(remote,'s',()=>published++),task=feed.start();feed.dispose();await task;assert.ok(aborted);assert.equal(published,0);
});
