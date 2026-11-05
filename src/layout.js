// Lay out the nested chat views and sticky composer on one shared axis.
export function attachSummaryLayout(session, rail, sidebarRight) {
  const scroll=session.querySelector(':scope > [data-conversation-scroll]');
  const roots=new Set();
  let released=false, preferredWidth=0, manualWidth=null, drag=null;
  const expanded=()=>sidebarRight.isExpanded?.()===true;
  const setLength=(name,value)=>{
    const next=`${Math.round(value*100)/100}px`;
    if(session.style.getPropertyValue(name)!==next)session.style.setProperty(name,next);
  };
  // Slot wrappers may use display:contents. Mark the actual flex items rather
  // than assuming the scrollport's direct children all have layout boxes.
  const markRoots=parent=>{
    for(const node of parent.children){
      if(getComputedStyle(node).display==='contents')markRoots(node);
      else{node.setAttribute('data-dsp-layout-root','');roots.add(node);}
    }
  };
  const endCapture=()=>{
    const current=drag;drag=null;
    if(current?.handle.hasPointerCapture(current.pointerId))current.handle.releasePointerCapture(current.pointerId);
  };
  const release=()=>{
    endCapture();released=true;session.dataset.dspLayoutState='overlay';session.classList.remove('dsp-content-shifted');
  };
  const fit=()=>{
    const column=session.clientWidth;
    const panel=rail.querySelector('.dsp-panel');
    const inset=panel?parseFloat(getComputedStyle(panel).paddingLeft):14;
    const cardLeft=rail.offsetLeft+inset;
    if(cardLeft<288){release();return;}
    // clientWidth excludes the scrollbar; the visible card starts inside the
    // rail. These two edges define the balanced free space around the text.
    const reserved=Math.max(0,scroll.clientWidth+2*scroll.offsetLeft-cardLeft);
    const available=scroll.clientWidth-reserved;
    const width=manualWidth??Math.min(preferredWidth,available-64);
    setLength('--dsp-reserved',reserved);
    setLength('--dsp-content-width',width);
    setLength('--dsp-axis-offset',(column-cardLeft)/2);
    setLength('--dsp-overflow',manualWidth===null?0:Math.max(0,width+64-available));
  };
  if(scroll&&!expanded()){
    const probe=document.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:0;width:var(--dsh-chat-content-width,680px)';
    session.append(probe);preferredWidth=probe.offsetWidth;probe.remove();
    markRoots(scroll);fit();if(!released)session.classList.add('dsp-content-shifted');
  }
  const update=()=>{
    if(expanded()){release();return;}
    if(!released&&preferredWidth)fit();
  };
  const pointerDown=event=>{
    const handle=event.target.closest('[data-width-handle]');
    if(event.button!==0||!handle||released||session.dataset.dspLayoutState!=='open'||!session.classList.contains('dsp-content-shifted'))return;
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
  const resize=new ResizeObserver(update);resize.observe(session);if(scroll)resize.observe(scroll);
  let frame=session.parentElement;
  while(frame&&!frame.querySelector('[data-rightbar-col]'))frame=frame.parentElement;
  const sidebarObserver=new MutationObserver(update);
  if(frame)sidebarObserver.observe(frame,{attributes:true,attributeFilter:['data-rightbar-collapsed','data-rightbar-fullscreen']});
  const slotsObserver=new MutationObserver(records=>{
    if(records.some(record=>record.target===scroll||getComputedStyle(record.target).display==='contents'))markRoots(scroll);
  });
  if(scroll)slotsObserver.observe(scroll,{childList:true,subtree:true});
  return {
    setOpen(open){session.dataset.dspLayoutState=open?'open':'closing';if(open)update();else endCapture();},
    dispose(){
      endCapture();resize.disconnect();sidebarObserver.disconnect();slotsObserver.disconnect();
      for(const [name,handler] of Object.entries(handlers))session.removeEventListener(name,handler,true);
      for(const node of roots)node.removeAttribute('data-dsp-layout-root');
      session.classList.remove('dsp-content-shifted');
      for(const name of ['--dsp-reserved','--dsp-content-width','--dsp-axis-offset','--dsp-overflow'])session.style.removeProperty(name);
      delete session.dataset.dspLayoutState;session.removeAttribute('data-dsp-manual-width');
    }
  };
}
