// Apply layout once, then move the card and content on a shared compositor clock.
export function createSummaryMotion(session,rail,roots) {
  let animations=[],generation=0;
  const anchorX=()=>{
    const flow=[...session.querySelectorAll('[data-chat-flow]')].find(node=>node.getClientRects().length&&node.getBoundingClientRect().width>0);
    return flow?.getBoundingClientRect().x??null;
  };
  const cancel=()=>{
    generation++;for(const animation of animations)animation.cancel();animations=[];
    session.classList.remove('dsp-motion-running');
  };
  return {
    run(open,applyLayout){
      const panel=rail.querySelector('.dsp-panel');
      const before=anchorX();
      const from=panel?new DOMMatrix(getComputedStyle(panel).transform).m41:rail.offsetWidth;
      cancel();applyLayout();rail.dataset.state=open?'open':'closing';
      if(!panel)return;
      const after=anchorX(),delta=before===null||after===null?0:before-after;
      const options={duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:240,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'};
      session.classList.add('dsp-motion-running');
      const current=[panel.animate([{transform:`translateX(${from}px)`},{transform:`translateX(${open?0:panel.offsetWidth}px)`}],options)];
      if(Math.abs(delta)>.01)for(const root of roots)if(root.isConnected){
        current.push(root.animate([{translate:`${delta}px 0`},{translate:'0px 0'}],{...options,composite:'add'}));
      }
      const start=document.timeline.currentTime;
      for(const animation of current)animation.startTime=start;
      animations=current;const token=generation;
      Promise.all(current.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
        if(token!==generation)return;
        for(const animation of current)animation.cancel();animations=[];
        session.classList.remove('dsp-motion-running');
      });
    },
    dispose:cancel
  };
}
