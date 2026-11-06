import {mkdirSync,writeFileSync} from 'node:fs';

export async function profileMotion(page,label){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Performance.enable');
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const cases=[];
 const toggle=async()=>{
  await page.locator('.dsp-toggle').evaluate(el=>el.click());
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
  if(await page.locator('.dsp-toggle').getAttribute('aria-expanded')==='false')await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 };
 for(const long of [false,true]){
  if(long)await page.evaluate(()=>{
   const flow=document.querySelector('[data-chat-flow]');
   for(let turn=0;turn<40;turn++){
    const section=document.createElement('section');
    section.innerHTML=`<h3>第 ${turn+1} 轮分析</h3>`+Array.from({length:12},()=>'<p>这里是一段会话内容，用于衡量长对话在展开摘要时的排版开销。<code>const result = await readFile(path);</code>正文包含中英文、链接、代码与表格，模拟日常长会话的排版。</p>').join('')+'<pre class="code-block">'+('const value = await readResource();\n'.repeat(20))+'</pre><table><tbody>'+('<tr><td>文件</td><td>交付内容与来源</td></tr>'.repeat(8))+'</tbody></table>';
    flow.append(section);
   }
  });
  for(const width of [1600,1100]){
   await page.setViewportSize({width,height:1000});
   await page.waitForFunction(()=>{const s=document.querySelector('[data-conversation-session]');return getComputedStyle(s).getPropertyValue('--dsh-conversation-column-width').trim()===`${s.offsetWidth}px`;});
   await toggle();await toggle(); // Warm layout and font caches.
   await page.evaluate(()=>{
    window.__motionStats={updates:0,fits:0,probes:0};
    window.__motionFrames=[];window.__motionLongTasks=[];window.__motionRunning=true;
    let previous=performance.now();
    const frame=now=>{if(!__motionRunning)return;__motionFrames.push(now-previous);previous=now;requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
    window.__motionObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())__motionLongTasks.push(e.duration);});
    __motionObserver.observe({type:'longtask',buffered:false});
   });
   const before=await metric();
   for(let i=0;i<3;i++){await toggle();await toggle();}
   const after=await metric();
   const samples=await page.evaluate(()=>{
    __motionRunning=false;__motionObserver.disconnect();
    return {callbacks:__motionStats,frames:__motionFrames,longTasks:__motionLongTasks,nodes:document.querySelectorAll('*').length};
   });
   const frames=samples.frames.slice(1).sort((a,b)=>a-b);
   cases.push({content:long?'long':'short',width,nodes:samples.nodes,callbacks:samples.callbacks,frames:{count:frames.length,p95:frames[Math.floor(frames.length*.95)]||0,max:Math.max(0,...frames),over33ms:frames.filter(t=>t>33.4).length},longTasks:samples.longTasks,metrics:Object.fromEntries(['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(name=>[name,after[name]-before[name]]))});
  }
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 const report={label,cpuSlowdown:4,cyclesPerCase:3,cases};
 mkdirSync('qa',{recursive:true});writeFileSync(`qa/motion-${label}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
