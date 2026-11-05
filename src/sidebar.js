// Keep the user's summary choice while the native sidebar temporarily hides it.
export class SummaryVisibility {
  constructor(expanded=false) { this.expanded=expanded;this.open=false;this.restore=false; }
  sidebar(expanded) {
    if(expanded===this.expanded)return this.open;
    this.expanded=expanded;
    if(expanded){this.restore=this.open;this.open=false;}
    else{this.open=this.open||this.restore;this.restore=false;}
    return this.open;
  }
  toggle() {
    this.open=!this.open;
    if(this.expanded)this.restore=this.open;
    return this.open;
  }
}

// The layout attributes change for both toolbar toggles and programmatic opens
// such as file previews. Keep this watcher alive even while the card is closed.
export function watchRightSidebar(anchor, sidebarRight, listener) {
  let previous;
  const read=()=>{
    const expanded=sidebarRight.isExpanded?.()===true;
    if(expanded===previous)return;
    previous=expanded;listener(expanded);
  };
  let frame=anchor?.parentElement;
  while(frame&&!frame.querySelector('[data-rightbar-col]'))frame=frame.parentElement;
  const mutation=new MutationObserver(read),resize=new ResizeObserver(read);
  if(frame){
    mutation.observe(frame,{attributes:true,attributeFilter:['data-rightbar-collapsed','data-rightbar-fullscreen']});
    resize.observe(frame);
  }
  read();
  return ()=>{mutation.disconnect();resize.disconnect();};
}
