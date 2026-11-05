import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SummaryRepository} from '../src/aggregate.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const delivery=(seq,path)=>({seq,type:'deliverables/presented',time:seq,data:{turn:1,files:[{path}]}});
function liveRemote(){
 const feeds=new Map(),calls=[];
 const remote={calls,feeds,async *follow({address},signal){
  calls.push(address.sessionId);let wake;const queue=[];
  feeds.set(address.sessionId,event=>{queue.push(event);wake?.();});
  try{
   yield {type:'snapshot',header:{cwd:'/work'},cursor:0,hasMore:false,records:[{type:'event',event:delivery(0,address.sessionId+'.md')}]};
   while(!signal.aborted){
    if(!queue.length)await new Promise(resolve=>{wake=resolve;signal.addEventListener('abort',resolve,{once:true});});
    wake=undefined;
    while(queue.length)yield {type:'event',event:queue.shift()};
   }
  }finally{feeds.delete(address.sessionId);}
 }};return remote;
}
test('prewarm and card/detail views share one feed; closing and reopening never resets loaded data',async()=>{
 const remote=liveRemote(),repository=new SummaryRepository(remote);
 const releaseHeader=repository.retain('a');await tick();
 const loaded=repository.getSnapshot('a');assert.equal(loaded.loading,false);
 const releaseCard=repository.retain('a'),releaseDetails=repository.retain('a');
 releaseCard();remote.feeds.get('a')(delivery(1,'updated-while-closed.md'));await tick();
 const cached=repository.getSnapshot('a');assert.equal(cached.outputs[0].label,'updated-while-closed.md');
 const releaseReopened=repository.retain('a');assert.equal(repository.getSnapshot('a'),cached);
 assert.deepEqual(remote.calls,['a']);
 releaseReopened();releaseDetails();releaseHeader();repository.dispose();await tick();
 assert.equal(remote.feeds.size,0);
});
test('session caches are isolated and only a bounded number of inactive sessions are retained',async()=>{
 const remote=liveRemote(),repository=new SummaryRepository(remote,2);
 for(const id of ['a','b','c']){const release=repository.retain(id);await tick();assert.equal(repository.getSnapshot(id).outputs[0].label,id+'.md');release();await tick();}
 assert.deepEqual([...repository.entries.keys()],['b','c']);repository.dispose();
});
test('reconnect retains a complete cached view until history backfill finishes',async()=>{
 const remote=liveRemote(),repository=new SummaryRepository(remote);
 const release=repository.retain('a');await tick();const cached=repository.getSnapshot('a');
 let finishPage;
 const reconnectRemote={async *follow(_req,signal){yield {type:'snapshot',header:{cwd:'/work'},cursor:2,hasMore:true,records:[{type:'event',event:delivery(2,'new.md')}]};await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));},page:()=>new Promise(resolve=>{finishPage=resolve;})};
 repository.reconnect(reconnectRemote);await tick();
 assert.equal(repository.getSnapshot('a'),cached);assert.equal(repository.getSnapshot('a').loading,false);
 finishPage({ok:true,value:{hasMore:false,records:[{type:'event',event:delivery(0,'a.md')}]}});await tick();
 assert.deepEqual(repository.getSnapshot('a').outputs.map(f=>f.label),['new.md','a.md']);
 release();repository.dispose();
});
