// Lay out the nested chat views and sticky composer on one shared axis.
export function attachSummaryLayout(session, rail, sidebarRight) {
  const scroll=session.querySelector(':scope > [data-conversation-scroll]');
  const roots=new Set(),slots=new Set();
  const motion=createSummaryMotion(session,rail,roots);
  let geometryKey='',geometry=null;
  let overlay=false, opened=false, preferredWidth=0, manualWidth=null, drag=null;
  const expanded=()=>sidebarRight.isExpanded?.()===true;
  const setLength=(name,value)=>{
    const next=`${Math.round(value*100)/100}px`;
    if(session.style.getPropertyValue(name)!==next)session.style.setProperty(name,next);
  };
  // Slot wrappers may use display:contents. Mark the actual flex items rather
  // than assuming the scrollport's direct children all have layout boxes.
  const markRoots=parent=>{
    for(const node of parent.children){
      if(getComputedStyle(node).display==='contents'){slots.add(node);markRoots(node);}
      else{node.setAttribute('data-dsp-layout-root','');roots.add(node);}
    }
  };
  const endCapture=()=>{
    const current=drag;drag=null;
    if(current?.handle.hasPointerCapture(current.pointerId))current.handle.releasePointerCapture(current.pointerId);
  };
  const release=()=>{
    endCapture();overlay=true;manualWidth=null;session.removeAttribute('data-dsp-manual-width');session.dataset.dspLayoutState='overlay';session.classList.remove('dsp-content-shifted');
  };
  const measure=()=>{
    const column=session.clientWidth,panel=rail.querySelector('.dsp-panel');
    const inset=panel?parseFloat(getComputedStyle(panel).paddingLeft):14;
    const cardLeft=rail.offsetLeft+inset,client=scroll.clientWidth,left=scroll.offsetLeft;
    const style=getComputedStyle(session.parentElement??session);
    const user=parseFloat(style.getPropertyValue('--dsh-chat-user-width'));
    const hostColumn=parseFloat(style.getPropertyValue('--dsh-conversation-column-width'))||column;
    preferredWidth=Number.isFinite(user)?user:Math.max(680,Math.min(hostColumn*.64,920));
    return {column,cardLeft,client,left};
  };
  const fit=()=>{
    const {column,cardLeft,client,left}=geometry;
    if(cardLeft<288){release();return;}
    const reserved=Math.max(0,client+2*left-cardLeft),available=client-reserved;
    const width=manualWidth??Math.min(preferredWidth,available-64);
    setLength('--dsp-reserved',reserved);setLength('--dsp-content-width',width);
    setLength('--dsp-axis-offset',(column-cardLeft)/2);
    setLength('--dsp-overflow',manualWidth===null?0:Math.max(0,width+64-available));
  };
  if(scroll)markRoots(scroll);
  const applyShift=()=>{
    overlay=false;geometry=measure();geometryKey=JSON.stringify({...geometry,preferredWidth});fit();
    if(!overlay){session.classList.add('dsp-content-shifted');session.dataset.dspLayoutState='open';}
  };
  const update=()=>{
    if(!scroll||!opened)return;
    if(expanded()){overlay=true;endCapture();return;}
    if(overlay){
      manualWidth=null;session.removeAttribute('data-dsp-manual-width');markRoots(scroll);
      motion.run(true,applyShift);return;
    }
    geometry=measure();const key=JSON.stringify({...geometry,preferredWidth});
    if(key===geometryKey)return;
    geometryKey=key;fit();
  };
  const pointerDown=event=>{
    const handle=event.target.closest('[data-width-handle]');
    if(event.button!==0||!handle||overlay||session.dataset.dspLayoutState!=='open'||!session.classList.contains('dsp-content-shifted'))return;
    event.preventDefault();event.stopPropagation();
    const width=parseFloat(session.style.getPropertyValue('--dsp-content-width'));
    const scale=session.getBoundingClientRect().width/session.offsetWidth||1;
    drag={handle,pointerId:event.pointerId,x:event.clientX,width,scale,side:handle.dataset.widthHandle,moved:false};
    manualWidth=width;session.setAttribute('data-dsp-manual-width','');
    handle.setPointerCapture(event.pointerId);
  };
  const resizeDrag=event=>{
    const dx=(event.clientX-drag.x)/drag.scale;
    drag.moved ||= Math.abs(dx)>=1;
    manualWidth=Math.min(Math.max(240,drag.width+(drag.side==='left'?-dx:dx)*2),Math.max(240,session.clientWidth-176));
    fit();
  };
  const pointerMove=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopPropagation();resizeDrag(event);
  };
  const pointerUp=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopPropagation();resizeDrag(event);
    const moved=drag.moved;endCapture();
    if(moved){
      // Commit through the same preference used by DSH's native width handles.
      const nativeWidth=Math.min(Math.max(manualWidth,640),Math.max(640,session.clientWidth-176));
      (session.parentElement??session).style.setProperty('--dsh-chat-user-width',`${nativeWidth}px`);
      try{localStorage.setItem('dsh.conversation.contentWidth',String(manualWidth));}catch{}
    }
  };
  const pointerCancel=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.stopPropagation();manualWidth=drag.width;endCapture();fit();
  };
  const handlers={pointerdown:pointerDown,pointermove:pointerMove,pointerup:pointerUp,pointercancel:pointerCancel,lostpointercapture:pointerCancel};
  for(const [name,handler] of Object.entries(handlers))session.addEventListener(name,handler,true);
  const widths=new WeakMap();
  const resize=new ResizeObserver(entries=>{let changed=false;for(const entry of entries){const width=entry.borderBoxSize?.[0]?.inlineSize??entry.contentRect.width;if(widths.get(entry.target)!==width){widths.set(entry.target,width);changed=true;}}if(changed)update();});
  resize.observe(session,{box:'border-box'});if(scroll)resize.observe(scroll,{box:'border-box'});
  const stopSidebar=watchRightSidebar(session,sidebarRight,update);
  const slotsObserver=new MutationObserver(records=>{
    for(const record of records)if(record.target===scroll||slots.has(record.target))markRoots(record.target);
  });
  if(scroll)slotsObserver.observe(scroll,{childList:true,subtree:true});
  return {
    setOpen(open){
      opened=open;endCapture();
      motion.run(open,()=>{
        if(open&&!expanded()&&scroll){manualWidth=null;session.removeAttribute('data-dsp-manual-width');applyShift();}
        else{release();session.dataset.dspLayoutState=open?'overlay':'closing';}
      });
    },
    dispose(){
      endCapture();motion.dispose();resize.disconnect();stopSidebar();slotsObserver.disconnect();
      for(const [name,handler] of Object.entries(handlers))session.removeEventListener(name,handler,true);
      for(const node of roots)node.removeAttribute('data-dsp-layout-root');
      session.classList.remove('dsp-content-shifted');
      for(const name of ['--dsp-reserved','--dsp-content-width','--dsp-axis-offset','--dsp-overflow'])session.style.removeProperty(name);
      delete session.dataset.dspLayoutState;session.removeAttribute('data-dsp-manual-width');
    }
  };
}
