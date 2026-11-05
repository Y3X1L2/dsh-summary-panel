import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Exercise the shipped bundle against the host's slot and navigation contracts.
// This guards the two regressions discovered during desktop acceptance:
// using the single corner slot, and replacing the summary with its full list.
function load(){
 const registrations=[],types=[],opened=[],effects=[];
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment',useEffect:()=>{},useLayoutEffect:()=>{},useRef:v=>({current:v}),useCallback:fn=>fn,useSyncExternalStore:(_subscribe,getSnapshot)=>getSnapshot()};
 let exported;
 const document={head:{append(){}},createElement:()=>({dataset:{},remove(){}})};
 vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:entry=>{exported=entry.factory(name=>name==='react'?react:{createPortal:(node,host)=>({portal:node,host})});}}},document,console,AbortController,URL});
 const ctx={effect:fn=>{const off=fn();if(typeof off==='function')effects.push(off);},on:()=>()=>{},slots:{inject:(name,fn)=>fn(),register:(spec,component)=>{if(spec.name==='conversation.session.header.corner')throw Error('single slot occupied');registrations.push({spec,component});return()=>{};}},sidebarRightTabs:{register:spec=>{types.push(spec);return()=>{};}},sidebarRight:{openTab:kind=>opened.push(kind)},remote:{session:{}},commandUi:{},uiConversation:{}};
 exported.apply(ctx);return {react,registrations,types,opened};
}
const walk=(node,predicate)=>{
 if(!node||typeof node!=='object')return null;
 if(predicate(node))return node;
 for(const child of [node.portal,...(node.props?.children||[])].flat(Infinity)){const found=walk(child,predicate);if(found)return found;}
 return null;
};
test('shipped plugin uses right-hand utilities and registers only detail tabs',()=>{
 const {registrations,types}=load();
 assert.ok(registrations.some(r=>r.spec.name==='conversation.session.header.utilities'));
 assert.deepEqual(types.map(t=>t.kind),['summary-outputs','summary-sources']);
 assert.ok(!registrations.some(r=>r.spec.name==='conversation.session.header.corner'));
});
test('show-all keeps the compact summary in place and sends full lists to right sidebar',()=>{
 const {react,registrations,opened}=load();let index=0;
 const values=[true,true,{}];react.useState=initial=>[index<values.length?values[index++]:initial,()=>{}];
 const Toggle=registrations.find(r=>r.spec.name==='conversation.session.header.utilities').component;
 const toggle=Toggle({sessionId:'test',inputActions:{}}),portal=walk(toggle,n=>n.portal)?.portal;
 assert.equal(portal.props.view,'summary');
 portal.props.onNavigate('outputs');portal.props.onNavigate('sources');
 assert.deepEqual(opened,['summary-outputs','summary-sources']);assert.equal(portal.props.view,'summary');
});
test('detail tab receives the full source view and search surface',()=>{
 const {registrations,react}=load();
 const Details=registrations.find(r=>r.spec.key==='dsh-summary-panel/summary-sources').component;
 const detail=Details({sessionId:'test',inputActions:{}});
 assert.equal(detail.props.view,'sources');assert.equal(detail.props.detail,true);
 react.useState=initial=>[initial,()=>{}];
 const rendered=detail.type(detail.props);
 assert.ok(walk(rendered,n=>n.type==='input'&&n.props['aria-label']==='搜索摘要条目'));
 assert.ok(!walk(rendered,n=>n.props?.className==='dsp-rail-heading'));
});
test('summary keeps an overlay rail and applies scoped conversation layout styles',()=>{
 const css=readFileSync(new URL('../src/panel.css',import.meta.url),'utf8');
 const sessionRule=css.match(/\.dsp-session-open\{([^}]+)\}/)[1];
 assert.ok(!/padding|margin|width|grid|flex/.test(sessionRule));
 const railRule=css.match(/\.dsp-independent-rail\{([^}]+)\}/)[1];
 assert.match(railRule,/position:absolute/);assert.ok(!/border-left/.test(railRule));
 assert.match(css,/\.dsp-content-shifted\[data-dsp-layout-state=open\]/);
 assert.match(css,/\[data-conversation-scroll\]\{padding-right:var\(--dsp-reserved\)/);
 assert.ok(!/\[data-conversation-scroll\]>\*\{[^}]*translate/.test(css));
 assert.ok(!/scale\(/.test(css));
});
