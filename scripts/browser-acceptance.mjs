import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
mkdirSync('qa',{recursive:true});
try{
 await page.route('http://dsh-summary.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
 await page.goto('http://dsh-summary.test/');
 await page.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>${readFileSync(new URL('../test/fixtures/theme.css',import.meta.url),'utf8')}
 body{margin:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:"Microsoft YaHei","Segoe UI",Arial,sans-serif}#fixture{display:grid;grid-template-columns:180px minmax(0,1fr) 380px;height:100vh;transition:grid-template-columns 240ms ease}#fixture[data-rightbar-collapsed]{grid-template-columns:180px minmax(0,1fr) 0}nav{background:var(--dsw-specific-sidebar-fill);padding:20px}main{min-width:0;display:flex;flex-direction:column}header{display:flex;align-items:center;gap:10px;padding:14px 18px;height:40px}#header-actions{margin-left:auto}[data-conversation-session]{--dsh-chat-content-width:var(--dsh-chat-user-width,clamp(680px,calc(var(--dsh-conversation-column-width,0px) * .64),920px));flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;position:relative}[data-conversation-scroll]{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-gutter:stable;margin-right:2px}.slot{display:contents}.transcript{flex:1 0 auto;display:flex;flex-direction:column;min-width:0}.chat-frame{container-type:inline-size;flex:none}.chat-scroll{padding:16px 32px;container-type:inline-size;overflow:clip visible}#text{width:100%;max-width:var(--dsh-chat-content-width);margin:24px auto;line-height:1.8}.md-table-wide{width:100cqw;margin-left:calc((100% - 100cqw) / 2);overflow:auto}.md-table-wide table{width:100%;border-collapse:collapse}.md-table-wide td{padding:12px;border-block:1px solid #8883}.code-block{overflow:auto;max-width:100%;background:#8881;padding:12px;box-sizing:border-box}.composer-seat{padding:12px 16px;flex:none}textarea{display:block;box-sizing:border-box;width:calc(var(--dsh-chat-content-width) + 32px);max-width:100%;height:80px;margin:0 auto;resize:none}#right{padding:12px;background:var(--dsw-alias-bg-base);overflow:auto}#fixture[data-rightbar-collapsed] #right{display:none}[data-width-handle]{position:absolute;top:0;bottom:0;width:10px;cursor:col-resize;z-index:1}[data-width-handle=right]{left:calc(50% + var(--dsh-chat-content-width) / 2 + 24px)}[data-width-handle=left]{right:calc(50% + var(--dsh-chat-content-width) / 2 + 24px)}button{font:inherit}
 </style><div id="fixture" data-rightbar-collapsed><nav>DeepSeek Harness<br>验收会话</nav><main><header>摘要面板验收 <div id="header-actions"></div></header><div data-conversation-session="qa-session"><div data-conversation-scroll><div class="slot" data-slot="conversation.session"><div class="transcript"><div class="slot" data-slot="conversation.chat"><div class="chat-frame"><div class="chat-scroll"><div id="text" data-chat-flow><h2>正文排版检查</h2><p>打开摘要时，对话正文和输入框为右侧卡片让出空间。手动调整对话宽度或展开右侧边栏后，可以自由调整布局。完整列表和文件预览使用右侧边栏。</p><div class="md-table-wide"><table><tbody><tr><td>宽表格</td><td>正文与输入框应同时为摘要卡片让位</td></tr><tr><td>来源</td><td>表格可在自己的容器内横向滚动</td></tr></tbody></table></div><pre class="code-block">const output = await createDocument();\nawait present(output);</pre><p>浏览器交互验收示例。</p></div></div></div></div></div></div><div class="composer-seat"><textarea id="composer" aria-label="消息输入框">保留原有草稿</textarea></div></div><div data-width-handle="left"></div><div data-width-handle="right"></div></div></main><aside id="right" data-rightbar-col aria-label="右侧边栏">文件 / 浏览器</aside></div>`);
 await page.evaluate(()=>{
  const session=document.querySelector('[data-conversation-session]');
  const publish=()=>session.parentElement.style.setProperty('--dsh-conversation-column-width',`${session.offsetWidth}px`);
  new ResizeObserver(publish).observe(session);publish();
  // A native-like handler sits behind the plugin's capture handler. A real
  // pointer drag must either belong to the plugin or reach the native control.
  for(const handle of session.querySelectorAll('[data-width-handle]')){
   let drag;
   handle.addEventListener('pointerdown',event=>{
    qa.nativeDragStarts=(qa.nativeDragStarts||0)+1;
    const pref=Number(localStorage.getItem('dsh.conversation.contentWidth'));
    drag={x:event.clientX,width:pref>0?Math.max(640,pref):Math.max(680,Math.min(session.offsetWidth*.64,920))};
    handle.setPointerCapture(event.pointerId);
   });
   handle.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=(event.clientX-drag.x)*(handle.dataset.widthHandle==='left'?-1:1);
    session.parentElement.style.setProperty('--dsh-chat-user-width',`${Math.max(640,Math.min(drag.width+2*dx,session.clientWidth-176))}px`);
   });
   handle.addEventListener('pointerup',()=>{drag=null;});
  }
 });
 await page.addScriptTag({content:readFileSync(require.resolve('react/umd/react.development.js'.replace('/umd/react.development.js','') ).replace(/index\.js$/,'umd/react.development.js'),'utf8')});
 await page.addScriptTag({content:readFileSync(require.resolve('react-dom').replace(/index\.js$/,'umd/react-dom.development.js'),'utf8')});
 await page.evaluate(()=>{
  const React=window.React,ReactDOM=window.ReactDOM;
  const registrations=[],types=[],events=[],outputs=Array.from({length:8},(_,i)=>({path:`C:/qa/result-${i+1}.md`,description:`交付文件 ${i+1}`}));
  events.push({seq:0,type:'deliverables/presented',time:1,data:{turn:1,files:outputs}});
  events.push({seq:1,type:'tool/call',time:2,data:{turn:1,callId:'search',name:'web_search',arguments:JSON.stringify({queries:['DSH 文档']})}});
  events.push({seq:2,type:'tool/result',time:3,data:{turn:1,message:{source:{callId:'search'},isError:false},meta:{sources:[{url:'https://example.com/docs',title:'文档来源'}],truncated:false}}});
  const inputs={captureInsertion:()=>({start:0,end:0,draftRev:1}),insertText:(text)=>{document.querySelector('#composer').value=text+document.querySelector('#composer').value;return true;}};
  const roots={header:ReactDOM.createRoot(document.querySelector('#header-actions')),right:ReactDOM.createRoot(document.querySelector('#right'))};
  const renderDetail=kind=>{
   qa.setSidebar(true);
   const spec=types.find(t=>t.kind===kind),entry=registrations.find(r=>r.spec.key===spec.id);
   roots.right.render(React.createElement(entry.component,{sessionId:'qa-session',inputActions:inputs}));
  };
  window.qa={registrations,types,expanded:false,setSidebar(open){this.expanded=open;document.querySelector('#fixture').toggleAttribute('data-rightbar-collapsed',!open);},opened:[],resources:[],sourcePicks:0,followCalls:0,liveSubscribers:new Set(),emit(event){events.push(event);for(const listener of this.liveSubscribers)listener(event);}};
  const ctx={effect:fn=>fn(),on:()=>()=>{},slots:{inject:(name,fn)=>fn(),register:(spec,component)=>{registrations.push({spec,component});return()=>{};}},sidebarRightTabs:{register:spec=>{types.push(spec);return()=>{};}},sidebarRight:{isExpanded:()=>qa.expanded,openTab:kind=>{qa.opened.push(kind);renderDetail(kind);},openResource:address=>{qa.setSidebar(true);qa.resources.push(address);roots.right.render(React.createElement('div',{'data-preview':address},'文件预览：'+address));}},commandUi:{dispatch:()=>{qa.sourcePicks++;return 'handled';}},remote:{session:{async *follow(req,signal){
   qa.followCalls++;let wake;const queue=[];const listener=event=>{queue.push(event);wake?.();};qa.liveSubscribers.add(listener);
   try{yield {type:'snapshot',header:{cwd:'C:/qa'},cursor:events.at(-1).seq,hasMore:false,records:events.map(event=>({type:'event',event}))};
    while(!signal.aborted){if(!queue.length)await new Promise(resolve=>{wake=resolve;signal.addEventListener('abort',resolve,{once:true});});wake=undefined;while(queue.length)yield {type:'event',event:queue.shift()};}
   }finally{qa.liveSubscribers.delete(listener);}
  }}},uiConversation:{}};
  window.__ModuleLoader__={load:entry=>{
   const plugin=entry.factory(name=>name==='react'?React:ReactDOM);plugin.apply(ctx);
   const Toggle=registrations.find(r=>r.spec.name==='conversation.session.header.utilities').component;
   roots.header.render(React.createElement(Toggle,{sessionId:'qa-session',inputActions:inputs}));
  }};
 });
 await page.addScriptTag({content:readFileSync('lib/client.js','utf8')});
 await page.waitForFunction(()=>qa.followCalls===1);
 assert.equal(await page.locator('.dsp-independent-rail').count(),0,'Header preloads before the card opens');
 const bounds=()=>page.locator('#text').boundingBox();
 const settle=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
 const assertSynchronizedMotion=async()=>{
  const samples=await page.evaluate(()=>{
   const session=document.querySelector('[data-conversation-session]');
   const scroll=session.querySelector('[data-conversation-scroll]');
   const panel=session.querySelector('.dsp-independent-rail>.dsp-panel');
   getComputedStyle(session).getPropertyValue('--dsp-reveal');
   const animation=session.getAnimations().find(a=>a.transitionProperty==='--dsp-reveal');
   if(!animation)throw Error('Missing shared reveal transition');
   animation.pause();
   const samples=[];
   for(const time of [0,60,120,180,240]){
    animation.currentTime=time;
    const owner=getComputedStyle(session),style=getComputedStyle(panel);
    const progress=Number(owner.getPropertyValue('--dsp-reveal'));
    const reserved=parseFloat(owner.getPropertyValue('--dsp-reserved'));
    samples.push({progress,padding:parseFloat(getComputedStyle(scroll).paddingRight),reserved,translation:new DOMMatrix(style.transform).m41,width:panel.offsetWidth,textX:session.querySelector('[data-chat-flow]').getBoundingClientRect().x});
   }
   animation.currentTime=0;animation.play();return samples;
  });
  assert.ok(samples.some(s=>s.progress>0.1&&s.progress<0.99),'Sample intermediate motion frames');
  const first=samples[0],last=samples.at(-1);
  for(const sample of samples){
   const fraction=(sample.progress-first.progress)/(last.progress-first.progress);
   assert.ok(Math.abs(sample.textX-(first.textX+(last.textX-first.textX)*fraction))<0.1,'Visible text moves with the same normalized progress');
   assert.ok(Math.abs(sample.padding-sample.reserved*sample.progress)<0.1,'Transcript uses the shared progress on every frame');
   assert.ok(Math.abs(sample.translation-sample.width*(1-sample.progress))<0.1,'Card uses exactly the same progress on every frame');
  }
 };
 const before=await bounds();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();
 await page.getByRole('button',{name:'查看全部 8 个文件',exact:true}).waitFor();
 await assertSynchronizedMotion();
 await settle();
 const shifted=await bounds();
 assert.ok(Math.abs(shifted.width-before.width)<=1,'Wide conversations keep their text width');
 assert.ok(shifted.x<before.x,'Opening summary shifts the conversation left');
 const rail=page.getByRole('complementary',{name:'会话摘要'});
 assert.equal(await rail.locator('.dsp-rail-heading').count(),0,'No summary title or close chrome above card');
 assert.equal(await rail.locator('.dsp-panel').evaluate(el=>getComputedStyle(el).fontSize),'13px');
 assert.equal(await page.locator('.dsp-session-open').evaluate(el=>getComputedStyle(el).transitionProperty),'--dsp-reveal');
 assert.equal(await rail.evaluate(el=>getComputedStyle(el).overflowX),'hidden');
 const cardBounds=await rail.locator('.dsp-card').boundingBox(),sceneBounds=await page.locator('[data-conversation-session]').boundingBox();
 assert.ok(shifted.x+shifted.width<=cardBounds.x-8,'Text must stay left of the summary');
 const wideTable=await page.locator('.md-table-wide').boundingBox();
 assert.ok(wideTable.x>=sceneBounds.x&&wideTable.x+wideTable.width<=cardBounds.x,'Wide table must also stay left of card');
 const codeBlock=await page.locator('.code-block').boundingBox();
 assert.ok(codeBlock.x>=sceneBounds.x&&codeBlock.x+codeBlock.width<=cardBounds.x,'Code block must stay inside reserved layout');
 const gapLeft=shifted.x-sceneBounds.x,gapRight=cardBounds.x-shifted.x-shifted.width;
 assert.ok(Math.abs(gapLeft-gapRight)<=2,`Normal gaps must balance: ${gapLeft} / ${gapRight}`);
 const composer=await page.locator('#composer').boundingBox();
 assert.ok(composer.x+composer.width<=cardBounds.x,'Composer must also have room');
 if(process.env.UPDATE_DEMO){
  mkdirSync('docs/images',{recursive:true});
  const original=await page.locator('#text').innerHTML();
  const originalHeader=await page.locator('header').evaluate(el=>{const value=el.firstChild.textContent;el.firstChild.textContent='会话摘要';return value;});
  const originalDraft=await page.locator('#composer').inputValue();
  await page.locator('#composer').fill('继续完善项目文档…');
  const previewStyle=await page.addStyleTag({content:'textarea{border:0;border-radius:18px;padding:14px;font:inherit;background:#f5f5f5;color:#777}'});
  await page.setViewportSize({width:1600,height:640});await settle();
  await page.locator('#text h2').evaluate(el=>el.textContent='项目交付记录');
  await page.locator('#text > p').first().evaluate(el=>el.textContent='文档与代码已整理完成。通过右上角摘要卡片，可以快速打开交付文件、查看来源和检索完整列表。');
  await page.locator('#text > p').last().evaluate(el=>el.textContent='拖动对话两侧的手柄，可从当前宽度继续调整阅读区域。');
  await page.locator('.md-table-wide table').evaluate(el=>el.innerHTML='<tbody><tr><td>文档</td><td>整理项目需求、实现方案与使用说明</td></tr><tr><td>代码</td><td>生成可运行的代码与配置文件</td></tr></tbody>');
  await page.mouse.move(0,0);
  await page.locator('main').screenshot({path:'docs/images/layout-light.png'});
  await previewStyle.evaluate(el=>el.remove());
  await page.locator('header').evaluate((el,value)=>el.firstChild.textContent=value,originalHeader);
  await page.locator('#composer').fill(originalDraft);
  await page.locator('#text').evaluate((el,original)=>el.innerHTML=original,original);
  await page.setViewportSize({width:1600,height:1000});await settle();
 }
 // Animation may already be finished, so inspect the authored keyframes too.
 const animationCss=await page.locator('style[data-plugin="dsh-summary-panel"]').textContent();
 assert.match(animationCss,/@property --dsp-reveal/);
 assert.match(animationCss,/transform:translateX\(calc\(\(1 - var\(--dsp-reveal\)\) \* 100%\)\)/);
 assert.ok(cardBounds.height<=340,`Compact summary with four file previews and web sources is too tall: ${cardBounds.height}`);
 assert.ok(cardBounds.y-sceneBounds.y<=12,'Card starts near the top of the conversation scene');
 // A wide conversation retains the same center throughout the first drag.
 const wideHandle=await page.locator('[data-width-handle=right]').boundingBox();
 await page.mouse.move(wideHandle.x+5,500);await page.mouse.down();
 assert.deepEqual(await bounds(),shifted,'Wide pointer-down must not recenter');
 await page.mouse.up();
 assert.equal(await page.evaluate(()=>localStorage.getItem('dsh.conversation.contentWidth')),null,'A click alone does not change the saved width');
 await page.mouse.down();await page.mouse.move(wideHandle.x+17,500,{steps:3});await page.mouse.up();
 const wideDragged=await bounds();
 assert.ok(Math.abs(wideDragged.width-shifted.width-24)<=1);
 assert.ok(Math.abs((wideDragged.x+wideDragged.width/2)-(shifted.x+shifted.width/2))<=1,'Wide drag keeps its existing center axis');
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await assertSynchronizedMotion();
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 await page.evaluate(()=>{localStorage.removeItem('dsh.conversation.contentWidth');document.querySelector('main').style.removeProperty('--dsh-chat-user-width');});
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await settle();
 // Resizing the application while the card is open should keep normal text in view.
 await page.setViewportSize({width:1100,height:1000});
 await page.waitForFunction(()=>document.querySelector('#text').getBoundingClientRect().width<680);await settle();
 const resized=await bounds(),resizedCard=await rail.locator('.dsp-card').boundingBox();
 assert.ok(resized.x>=204&&resized.x+resized.width<=resizedCard.x-8,'Window resize keeps text beside the card');
 await page.setViewportSize({width:1600,height:1000});
 await page.waitForFunction(()=>document.querySelector('#text').getBoundingClientRect().width>900);await settle();
 await page.getByRole('button',{name:'查看全部 8 个文件',exact:true}).click();
 await page.locator('#right').getByRole('textbox',{name:'搜索摘要条目'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.dsp-independent-rail')?.dataset.state==='closing');
 assert.equal(await page.locator('.dsp-session-open').evaluate(el=>getComputedStyle(el).transitionProperty),'--dsp-reveal','Sidebar opening uses the shared close transition');
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});await settle();
 assert.equal(await page.locator('.dsp-content-shifted').count(),0,'Opening native sidebar returns the conversation to native layout');
 const assertReturnedLayout=async()=>{
  await page.getByRole('button',{name:'关闭摘要面板',exact:true}).waitFor();
  await page.waitForFunction(()=>{const s=document.querySelector('[data-conversation-session]');return s.classList.contains('dsp-content-shifted')&&getComputedStyle(s).getPropertyValue('--dsh-conversation-column-width').trim()===`${s.offsetWidth}px`;});
  await settle();
  const text=await bounds(),card=await rail.locator('.dsp-card').boundingBox(),scene=await page.locator('[data-conversation-session]').boundingBox();
  assert.ok(text.x+text.width<=card.x-8,'Returning from sidebar must reserve space for text');
  assert.ok(Math.abs(text.x-scene.x-(card.x-text.x-text.width))<=2,'Return restores balanced margins');
  assert.equal(await page.evaluate(()=>qa.followCalls),1,'Sidebar round trips retain the shared feed');
 };
 await page.evaluate(()=>qa.setSidebar(false));
 await assertReturnedLayout();
 // A second open hides it again; manually opening it over the sidebar remains
 // allowed, and closing the sidebar must rebuild the balanced text layout.
 await page.evaluate(()=>qa.setSidebar(true));
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});await settle();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await settle();
 assert.equal(await page.locator('.dsp-content-shifted').count(),0,'Manual summary inside sidebar overlays the native layout');
 await page.evaluate(()=>qa.setSidebar(false));
 await assertReturnedLayout();
 // Reversing the sidebar while the summary is sliding out cancels its pending
 // removal and keeps exactly one working card.
 await page.evaluate(()=>qa.setSidebar(true));
 await page.waitForFunction(()=>document.querySelector('.dsp-independent-rail')?.dataset.state==='closing');
 await page.evaluate(()=>qa.setSidebar(false));
 await assertReturnedLayout();assert.equal(await rail.count(),1);
 // Continue exercising the detail tabs with a manually reopened overlay card.
 await page.evaluate(()=>qa.setSidebar(true));
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});await settle();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await settle();
 assert.equal(await page.locator('#right').getByRole('button',{name:/result-\d.md/}).count(),8);
 assert.equal(await rail.locator('[data-dsh-summary-panel]').getAttribute('data-dsh-summary-panel'),'summary');
 await page.locator('#right').getByRole('textbox',{name:'搜索摘要条目'}).fill('result-8');
 assert.equal(await page.locator('#right').getByRole('button',{name:/result-\d.md/}).count(),1);
 await rail.getByRole('button',{name:'result-8.md',exact:true}).click();
 await page.locator('#right [data-preview]').waitFor();
 assert.match(await page.locator('#right [data-preview]').getAttribute('data-preview'),/^dsh-resource:\/\/file\/session\/qa-session\//);
 await rail.getByRole('button',{name:'网页搜索',exact:true}).click();
 await page.locator('#right').getByRole('link',{name:/文档来源/}).waitFor();
 assert.equal(await rail.getByRole('button',{name:'网页搜索',exact:true}).count(),1);
 await rail.getByRole('button',{name:'创建文件',exact:true}).click();
 await rail.getByRole('menuitem',{name:'创建文档',exact:true}).click();
 assert.match(await page.locator('#composer').inputValue(),/保留原有草稿$/);
 assert.match(await page.locator('#composer').inputValue(),/请创建一份文档/);
 await rail.getByRole('button',{name:'添加来源文件',exact:true}).click();
 assert.equal(await page.evaluate(()=>qa.sourcePicks),1);
 const themeResults={};
 // Reproduce transcript text and a raised code-block toolbar directly below the
 // card. The card must win hit testing and its interior pixels must not depend
 // on whether that underlying content is visible.
 await page.evaluate(()=>{
  const content=document.createElement('div');content.id='overlap-probe';
  content.textContent='正文与代码工具栏不得透过卡片';
  content.style.cssText='position:absolute;z-index:50;top:20px;right:14px;width:312px;height:480px;background:#ff00ff;color:#000;font-size:24px;';
  document.querySelector('[data-conversation-session]').append(content);
 });
 await rail.locator('.dsp-panel').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.body.toggleAttribute('data-ds-dark-theme',theme==='dark'),theme);
  themeResults[theme]=await rail.locator('.dsp-card').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,border:getComputedStyle(el).borderWidth}));
  assert.equal(themeResults[theme].border,theme==='light'?'1px':'0px');
  if(theme==='light'){
   assert.equal(themeResults[theme].background,'rgb(255, 255, 255)');
   assert.equal(themeResults[theme].color,'rgb(102, 102, 102)');
  }else{
   assert.equal(themeResults[theme].background,'color(srgb 0.144941 0.145216 0.152784)');
   assert.equal(themeResults[theme].color,'rgb(249, 250, 251)');
  }
  const box=await rail.locator('.dsp-card').boundingBox();
  const clip={x:box.x+30,y:box.y+30,width:box.width-60,height:box.height-60};
  assert.ok(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.dsp-card'),{x:box.x+box.width/2,y:box.y+box.height/2}),'Card must cover raised transcript controls');
  const withContent=await page.screenshot({clip});
  await page.locator('#overlap-probe').evaluate(el=>el.style.visibility='hidden');
  const withoutContent=await page.screenshot({clip});
  assert.ok(withContent.equals(withoutContent),`${theme}: transcript must not bleed through opaque card`);
  await page.locator('#overlap-probe').evaluate(el=>el.style.visibility='visible');
  await page.screenshot({path:`qa/${theme}-acceptance.png`});
  if(process.env.UPDATE_DEMO){
   await page.locator('#overlap-probe').evaluate(el=>el.style.visibility='hidden');
   await page.mouse.move(0,0);
   mkdirSync('docs/images',{recursive:true});
   await rail.locator('.dsp-card').screenshot({path:`docs/images/${theme}.png`});
  }
 }
 assert.notEqual(themeResults.light.background,themeResults.dark.background);
 assert.notEqual(themeResults.light.color,themeResults.dark.color);
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 assert.equal(await page.locator('.dsp-session-open').evaluate(el=>getComputedStyle(el).transitionProperty),'--dsp-reveal');
 assert.equal(await rail.evaluate(el=>getComputedStyle(el).overflowX),'hidden');
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 const nativeOverlay=await bounds();
 assert.equal(await page.locator('.dsp-content-shifted').count(),0);
 // An already expanded sidebar allows the card to overlay without changing text.
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await settle();
 assert.deepEqual(await bounds(),nativeOverlay,'Opening alongside sidebar keeps native geometry');
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 assert.equal(await page.locator('.dsp-independent-rail').count(),0);
 assert.equal(await page.evaluate(()=>qa.followCalls),1,'Card and detail tabs must share their feed');
 await page.evaluate(()=>{
  qa.emit({seq:3,type:'deliverables/presented',time:4,data:{turn:2,files:[{path:'C:/qa/updated-while-closed.md'}]}});
  qa.loadingFlashes=[];
  qa.observer=new MutationObserver(()=>{const text=document.querySelector('[data-conversation-session]').textContent;if(/正在读取|正在补全历史/.test(text))qa.loadingFlashes.push(text);});
  qa.observer.observe(document.querySelector('[data-conversation-session]'),{subtree:true,childList:true,characterData:true});
 });
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();
  await rail.getByRole('button',{name:'updated-while-closed.md',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>qa.followCalls),1,'Reopening must not reload history');
  await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
  await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 }
 assert.deepEqual(await page.evaluate(()=>{qa.observer.disconnect();return qa.loadingFlashes;}),[],'No loading flash when reopening');
 // Narrow normal layout caps the initial width; a subsequent native width
 // gesture can expand under the card, without shifting its left edge offscreen.
 await page.evaluate(()=>{qa.setSidebar(false);document.querySelector('#overlap-probe').remove();});
 await settle();
 assert.equal(await rail.count(),0,'An explicitly closed summary stays closed when returning from sidebar');
 await page.setViewportSize({width:1100,height:1000});
 await page.waitForFunction(()=>{const session=document.querySelector('[data-conversation-session]');return session.offsetWidth===920&&getComputedStyle(session).getPropertyValue('--dsh-conversation-column-width').trim()==='920px';});
 const narrowBefore=await bounds();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await assertSynchronizedMotion();await settle();
 const narrowText=await bounds(),narrowCard=await rail.locator('.dsp-card').boundingBox();
 assert.ok(narrowText.width<narrowBefore.width,'Narrow columns cap the initial text width');
 assert.ok(narrowText.x+narrowText.width<=narrowCard.x-8,'Narrow normal layout avoids overlap');
 assert.ok(narrowText.x>=180+24,'Narrow layout preserves a left margin');
 assert.ok(Math.abs((narrowText.x-180)-(narrowCard.x-narrowText.x-narrowText.width))<=2,'Narrow margins must balance too');
 assert.ok(await rail.evaluate(el=>el.scrollWidth<=el.clientWidth),'No horizontal scrollbar during slide');
 // Pressing the right handle must not release the summary layout or recenter.
 const rightHandle=await page.locator('[data-width-handle=right]').boundingBox();
 const dragY=Math.max(narrowCard.y+narrowCard.height+30,500);
 await page.mouse.move(rightHandle.x+5,dragY);await page.mouse.down();
 assert.deepEqual(await bounds(),narrowText,'Pointer-down must preserve the displayed position and width');
 await page.mouse.move(rightHandle.x+15,dragY,{steps:2});
 const firstStep=await bounds();
 assert.ok(Math.abs(firstStep.width-narrowText.width-20)<=1,'First movement starts from displayed width');
 assert.ok(Math.abs(firstStep.x-narrowText.x)<=11,'No initial recentering jump');
 await page.mouse.move(rightHandle.x+5+(744-narrowText.width)/2,dragY,{steps:8});
 await page.mouse.up();await settle();
 const manual=await bounds();
 assert.equal(manual.width,744,'Dragging can expand to the native maximum');
 assert.ok(manual.x+manual.width>narrowCard.x,'Manual expansion may extend underneath the summary');
 assert.ok(manual.x>=180+24,'Manual expansion never shifts the left edge offscreen');
 assert.equal(await page.evaluate(()=>qa.nativeDragStarts||0),0,'Native control must not also start a competing drag');
 assert.equal(Number(await page.evaluate(()=>localStorage.getItem('dsh.conversation.contentWidth'))),744);
 // The other handle must continue from the existing manual width, too.
 const leftHandle=await page.locator('[data-width-handle=left]').boundingBox();
 await page.mouse.move(leftHandle.x+5,dragY);await page.mouse.down();
 assert.deepEqual(await bounds(),manual,'Second drag must start from the current position');
 await page.mouse.move(leftHandle.x+25,dragY,{steps:4});await page.mouse.up();
 assert.equal((await bounds()).width,704,'Left-handle drag shrinks from the previous manual width');
 await page.evaluate(()=>document.addEventListener('pointerdown',e=>qa.activePointerId=e.pointerId,{capture:true,once:true}));
 const cancelHandle=await page.locator('[data-width-handle=right]').boundingBox();
 await page.mouse.move(cancelHandle.x+5,dragY);await page.mouse.down();
 await page.mouse.move(cancelHandle.x-5,dragY,{steps:2});
 await page.evaluate(()=>document.querySelector('[data-width-handle=right]').releasePointerCapture(qa.activePointerId));
 await page.mouse.move(cancelHandle.x-6,dragY);await page.mouse.up();
 assert.equal((await bounds()).width,704,'Losing pointer capture cancels to the starting width');
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 await page.evaluate(()=>{document.querySelector('main').style.removeProperty('--dsh-chat-user-width');localStorage.removeItem('dsh.conversation.contentWidth');});
 assert.deepEqual(await bounds(),narrowBefore,'Closing restores native conversation geometry');
 assert.equal(await page.locator('[data-dsp-manual-width]').count(),0,'Manual state is cleaned up');
 // Rapid reversal must cancel the pending unmount and leave one working card.
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();await settle();
 assert.equal(await rail.count(),1);assert.equal(await page.evaluate(()=>qa.followCalls),1);
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();
 assert.equal(await page.locator('.dsp-session-open').evaluate(el=>getComputedStyle(el).transitionDuration),'0.001s');
 await page.getByRole('button',{name:'关闭摘要面板',exact:true}).click();
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 const nativeHandle=await page.locator('[data-width-handle=right]').boundingBox();
 await page.mouse.move(nativeHandle.x+5,500);await page.mouse.down();
 await page.mouse.move(nativeHandle.x+15,500,{steps:2});await page.mouse.up();
 assert.equal(await page.evaluate(()=>qa.nativeDragStarts),1,'After closing, native width controls work normally');
 assert.equal(await page.locator('[data-dsp-layout-root]').count(),0,'Layout markers are removed on close');
 assert.deepEqual(errors,[]);
 const report={passed:true,bundleVersion:JSON.parse(readFileSync('package.json')).version,checks:['normal opening shifts text and composer away from card','card and transcript share one reveal timeline','opening and closing match at five intermediate motion samples','visible text matches card progress in wide and narrow layouts','wide text width preserved','narrow initial width fits available room','manual width may overlap without clipping left edge','wide and narrow margins balance within two pixels','real pointer-down does not recenter text','dragging begins at displayed width','both handles continue from current manual width','manual preference persists without competing native drag','wide drag preserves its previous center axis','lost capture cancels cleanly','native width controls resume after closing','display-contents slot wrappers move with shared scroll layout','wide tables and code blocks stay inside available area','expanded sidebar keeps native geometry','opening sidebar animates summary closed','return restores prior open summary','manual overlay returns to balanced layout','rapid sidebar reversal cancels pending unmount','explicitly closed summary stays closed on return','close restores native layout','horizontal slide and no horizontal scrollbar','rapid toggle reversal preserves one card','window resize keeps text in view','reduced motion uses minimal animation','independent summary remains compact','outputs open in right sidebar','file preview opens in right sidebar','sources open in right sidebar','detail search filters results','create keeps existing draft','attachment picker delegated','light/dark host theme','opaque card pixel comparison in both themes','card stacks above transcript and code toolbar','Codex white daytime card and unchanged nighttime palette','no title or close chrome','13px text','card at top of conversation','enter and exit animations','close removes portal','header prewarms session data','card and detail tabs share one feed','closed card keeps receiving updates','three reopenings without requests or loading flashes'],themeResults,errors};
 writeFileSync('qa/browser-acceptance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
