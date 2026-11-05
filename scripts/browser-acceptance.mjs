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
 await page.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>${readFileSync(new URL('../test/fixtures/theme.css',import.meta.url),'utf8')}
 body{margin:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Arial,sans-serif}#fixture{display:grid;grid-template-columns:180px 1fr 380px;height:100vh}nav{background:var(--dsw-specific-sidebar-fill);padding:20px}main{min-width:0;display:flex;flex-direction:column}header{display:flex;align-items:center;gap:10px;padding:14px 18px;height:40px}#header-actions{margin-left:auto}[data-conversation-session]{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}.transcript{flex:1;overflow:auto}#text{width:570px;margin:40px 0 40px 40px;line-height:1.8}#right{padding:12px;background:var(--dsw-alias-bg-base);overflow:auto}textarea{height:80px;margin:18px;resize:none}button{font:inherit}
 </style><div id="fixture"><nav>DeepSeek Harness<br>验收会话</nav><main><header>摘要面板验收 <div id="header-actions"></div></header><div data-conversation-session="qa-session"><div class="transcript"><div id="text"><h2>正文排版检查</h2><p>打开摘要前后，这一段文字的位置、宽度与行数必须保持一致。摘要应当作为当前会话内的浮动卡片，完整列表和文件预览使用右侧边栏。</p><p>这是一份隔离的交互验收数据，不会发送模型请求或修改用户会话。</p></div></div><textarea id="composer" aria-label="消息输入框">保留原有草稿</textarea></div></main><aside id="right" aria-label="右侧边栏">文件 / 浏览器</aside></div>`);
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
   const spec=types.find(t=>t.kind===kind),entry=registrations.find(r=>r.spec.key===spec.id);
   roots.right.render(React.createElement(entry.component,{sessionId:'qa-session',inputActions:inputs}));
  };
  window.qa={registrations,types,opened:[],resources:[],sourcePicks:0,followCalls:0,liveSubscribers:new Set(),emit(event){events.push(event);for(const listener of this.liveSubscribers)listener(event);}};
  const ctx={effect:fn=>fn(),on:()=>()=>{},slots:{inject:(name,fn)=>fn(),register:(spec,component)=>{registrations.push({spec,component});return()=>{};}},sidebarRightTabs:{register:spec=>{types.push(spec);return()=>{};}},sidebarRight:{openTab:kind=>{qa.opened.push(kind);renderDetail(kind);},openResource:address=>{qa.resources.push(address);roots.right.render(React.createElement('div',{'data-preview':address},'文件预览：'+address));}},commandUi:{dispatch:()=>{qa.sourcePicks++;return 'handled';}},remote:{session:{async *follow(req,signal){
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
 const before=await bounds();
 await page.getByRole('button',{name:'打开摘要面板',exact:true}).click();
 await page.getByRole('button',{name:'查看全部 8 个文件',exact:true}).waitFor();
 assert.deepEqual(await bounds(),before,'Opening summary must not change text geometry');
 const rail=page.getByRole('complementary',{name:'会话摘要'});
 assert.equal(await rail.locator('.dsp-rail-heading').count(),0,'No summary title or close chrome above card');
 assert.equal(await rail.locator('.dsp-panel').evaluate(el=>getComputedStyle(el).fontSize),'13px');
 assert.equal(await rail.locator('.dsp-panel').evaluate(el=>getComputedStyle(el).animationName),'dsp-card-enter');
 assert.equal(await rail.evaluate(el=>getComputedStyle(el).overflowX),'hidden');
 const cardBounds=await rail.locator('.dsp-card').boundingBox(),sceneBounds=await page.locator('[data-conversation-session]').boundingBox();
 assert.ok(cardBounds.height<=340,`Compact summary with four file previews and web sources is too tall: ${cardBounds.height}`);
 assert.ok(cardBounds.y-sceneBounds.y<=12,'Card starts near the top of the conversation scene');
 await page.getByRole('button',{name:'查看全部 8 个文件',exact:true}).click();
 await page.locator('#right').getByRole('textbox',{name:'搜索摘要条目'}).waitFor();
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
 assert.equal(await rail.locator('.dsp-panel').evaluate(el=>getComputedStyle(el).animationName),'dsp-card-exit');
 assert.equal(await rail.evaluate(el=>getComputedStyle(el).overflowX),'hidden');
 await page.locator('.dsp-independent-rail').waitFor({state:'detached'});
 assert.deepEqual(await bounds(),before,'Closing summary must not change text geometry');
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
 assert.deepEqual(errors,[]);
 const report={passed:true,bundleVersion:JSON.parse(readFileSync('package.json')).version,checks:['body geometry unchanged on open/close','independent summary remains compact','outputs open in right sidebar','file preview opens in right sidebar','sources open in right sidebar','detail search filters results','create keeps existing draft','attachment picker delegated','light/dark host theme','opaque card pixel comparison in both themes','card stacks above transcript and code toolbar','Codex white daytime card and unchanged nighttime palette','no title or close chrome','13px text','card at top of conversation','enter and exit animations','close removes portal','header prewarms session data','card and detail tabs share one feed','closed card keeps receiving updates','three reopenings without requests or loading flashes'],themeResults,errors};
 writeFileSync('qa/browser-acceptance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
