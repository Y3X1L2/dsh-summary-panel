// Give the transcript room once on opening, while leaving native width controls
// and the right sidebar free to take over after a user gesture.
export function attachSummaryLayout(session, rail, sidebarRight) {
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
