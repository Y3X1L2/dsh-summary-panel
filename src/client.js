const h = React.createElement;
const inject = ['slots','sidebarRightTabs','sidebarRight','remote','remote.session','commandUi','uiConversation'];
function useSummary(sessionId) {
  const repository=summaryRepository;
  const subscribe=React.useCallback(listener=>repository.subscribe(sessionId,listener),[repository,sessionId]);
  const getSnapshot=React.useCallback(()=>repository.getSnapshot(sessionId),[repository,sessionId]);
  React.useEffect(()=>repository.retain(sessionId),[repository,sessionId]);
  return React.useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
}
function Icon({kind='file',size=16}) {
  const paths = {
    summary: 'M8 5h12M8 12h12M8 19h12M3 4h1v2H3zM3 11h1v2H3zM3 18h1v2H3z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    web: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    plus: 'M12 4v16M4 12h16',
    back: 'M15 5l-7 7 7 7',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    close: 'M6 6l12 12M6 18L18 6'
  };
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[kind]||paths.file}));
}
function Row({icon='file',label,detail,onClick,href,meta}) {
  const inner = [h(Icon,{kind:icon,key:'i'}),h('span',{className:'dsp-row-text',key:'t'},h('span',{className:'dsp-label'},label),detail&&h('span',{className:'dsp-detail'},detail)),meta&&h('span',{className:'dsp-meta',key:'m'},meta)];
  return href ? h('a',{className:'dsp-row',href,target:'_blank',rel:'noopener noreferrer',title:href},...inner) : h(onClick?'button':'div',{type:onClick?'button':undefined,className:'dsp-row',onClick,title:detail||label},...inner);
}
function SummaryPanel({sessionId,inputActions,view='summary',onNavigate,onClose,detail=false}) {
  const data=useSummary(sessionId);
  const [search,setSearch] = React.useState(''),[menu,setMenu] = React.useState(false),[notice,setNotice] = React.useState('');
  const [image,setImage]=React.useState(null);
  const alive=React.useRef(true);
  React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const mode = view;
  React.useEffect(()=>{setSearch('');setMenu(false);setNotice('');},[mode]);
  React.useEffect(()=>{
    if(!menu) return;
    const close = e=>{if(e.key==='Escape')setMenu(false);};
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[menu]);
  const navigate = onNavigate;
  const openFile = async item=>{
    if(item.attachment){
      try{const url=await summaryContext.uiConversation.imageUrl(sessionId,item.attachment);if(alive.current)setImage({url,label:item.label});}
      catch(e){if(alive.current)setNotice('图片暂时无法打开：'+e.message);}
      return;
    }
    try { summaryContext.sidebarRight.openResource(fileAddress(sessionId,item.path)); }
    catch(e){setNotice(e.message||'文件暂时无法打开');}
  };
  const create = kind=>{
    const requests={document:'请创建一份文档，完成后使用 present 交付文件。',spreadsheet:'请创建一份电子表格，完成后使用 present 交付文件。',presentation:'请创建一份演示文稿，完成后使用 present 交付文件。',file:'请创建一个文件，完成后使用 present 交付文件。'};
    const span=inputActions.captureInsertion();
    if(!inputActions.insertText(requests[kind],{...span,end:span.start})) setNotice('输入框当前不可编辑，请稍后再试');
    else setNotice('创建要求已添加到输入框，可以补充后发送');
    setMenu(false);
  };
  const addSource = ()=>{
    try {
      const span=inputActions.captureInsertion();
      const result=summaryContext.commandUi.dispatch({candidate:{name:'file'},session:{sessionId},span:{start:span.start,end:span.start}});
      if(result!=='handled')setNotice('请通过输入框的“添加文件”选择来源');
    } catch(e) {setNotice('无法添加文件：'+e.message);}
  };
  const filter=items=>items.filter(x=>`${x.label||''} ${x.path||''} ${x.url||''} ${x.description||''}`.toLowerCase().includes(search.toLowerCase()));
  const fileRow=x=>h(Row,{key:x.key,label:x.label,detail:mode==='summary'?undefined:(x.description||x.path),onClick:()=>openFile(x)});
  const sourceCount=data.files.length+data.tools.length+(data.pages.length||data.queries.length?1:0);
  const outputList=filter(data.outputs), fileList=filter(data.files), toolList=filter(data.tools), pageList=filter(data.pages),queryList=filter(data.queries);
  return h('div',{className:'dsp-panel','data-dsh-summary-panel':mode},
    mode!=='summary'&&h('div',{className:'dsp-toolbar'},h('strong',null,mode==='outputs'?'全部输出内容':'全部来源')),
    mode!=='summary'&&h('div',{className:'dsp-search'},h(Icon,{kind:'search'}),h('input',{value:search,onChange:e=>setSearch(e.target.value),placeholder:mode==='outputs'?'搜索输出文件':'搜索来源','aria-label':'搜索摘要条目'})),
    data.error&&h('div',{className:'dsp-notice',role:'alert'},'摘要读取未完成：'+data.error,h('button',{onClick:()=>summaryRepository.refresh(sessionId)},'重试')),
    notice&&h('div',{className:'dsp-notice',role:'status'},notice),
    image&&h('div',{className:'dsp-image-preview',role:'dialog','aria-label':image.label},h('button',{className:'dsp-icon','aria-label':'关闭图片预览',onClick:()=>setImage(null)},h(Icon,{kind:'close'})),h('img',{src:image.url,alt:image.label})),
    h('div',{className:mode==='summary'?'dsp-card':'dsp-full'},
      mode!=='sources'&&h('section',{'aria-label':'输出内容'},
        h('div',{className:'dsp-heading'},h('span',null,'输出内容'),data.outputs.length>0&&h('span',{className:'dsp-count'},data.outputs.length),h('div',{className:'dsp-menu-wrap'},h('button',{className:'dsp-icon','aria-label':'创建文件','aria-expanded':menu,onClick:()=>setMenu(!menu)},h(Icon,{kind:'plus'})),menu&&h('div',{className:'dsp-menu',role:'menu'},[['document','创建文档'],['spreadsheet','创建电子表格'],['presentation','创建演示文稿'],['file','创建其他文件']].map(([key,label])=>h('button',{key,role:'menuitem',onClick:()=>create(key)},label))))),
        outputList.length?(mode==='summary'?outputList.slice(0,4):outputList).map(fileRow):h('button',{className:'dsp-empty-create',onClick:()=>setMenu(true)},data.loading?'正在读取输出内容…':search?'没有匹配的文件':'创建文件'),
        mode==='summary'&&data.outputs.length>4&&h(Row,{icon:'link',label:`查看全部 ${data.outputs.length} 个文件`,onClick:()=>navigate('outputs')})
      ),
      mode==='summary'&&h('div',{className:'dsp-divider'}),
      mode!=='outputs'&&h('section',{'aria-label':'来源'},
        h('div',{className:'dsp-heading'},h('span',null,'来源'),sourceCount>0&&h('span',{className:'dsp-count'},sourceCount),h('button',{className:'dsp-icon','aria-label':'添加来源文件',onClick:addSource},h(Icon,{kind:'plus'}))),
        mode==='summary'?h(React.Fragment,null,
          ...data.files.slice(0,2).map(fileRow),
          (data.pages.length>0||data.queries.length>0)&&h(Row,{icon:'web',label:'网页搜索',onClick:()=>navigate('sources')}),
          ...data.tools.slice(0,2).map(x=>h(Row,{key:x.key,icon:'link',label:x.label,onClick:()=>navigate('sources')})),
          !sourceCount&&h('p',{className:'dsp-empty'},data.loading?'正在读取来源…':'暂无来源'),
          h(Row,{icon:'link',label:'查看全部',onClick:()=>navigate('sources')})
        ):h(React.Fragment,null,
          fileList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'附件文件'),...fileList.map(fileRow)),
          queryList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'搜索查询'),...queryList.map((x,i)=>h(Row,{key:i,icon:'search',label:x.label,meta:x.turn?`第 ${x.turn} 轮`:undefined}))),
          pageList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'网页'),...pageList.map(x=>h(Row,{key:x.key,icon:'web',label:x.label,detail:x.url,href:x.url,meta:x.visited?'已访问':'搜索结果'}))),
          toolList.length>0&&h('div',{className:'dsp-group'},h('h3',null,'工具来源'),...toolList.map(x=>h(Row,{key:x.key,icon:'link',label:x.label,meta:`${x.count} 次调用`}))),
          !fileList.length&&!queryList.length&&!pageList.length&&!toolList.length&&h('p',{className:'dsp-empty'},search?'没有匹配的来源':'暂无来源')
        )
      )
    ),
    data.loading&&h('p',{className:'dsp-loading',role:'status'},'正在补全历史记录…')
  );
}
let summaryContext;
let summaryRepository;
function apply(ctx) {
  summaryContext=ctx;
  const repository=new SummaryRepository(ctx.remote.session);
  summaryRepository=repository;
  ctx.effect(()=>()=>repository.dispose());
  ctx.on('connection/reset',()=>repository.reconnect(ctx.remote.session));
  ctx.effect(()=>{
    const style=document.createElement('style'); style.dataset.plugin='dsh-summary-panel';style.textContent=PANEL_CSS;document.head.append(style);
    return ()=>style.remove();
  });
  const openDetails=view=>ctx.sidebarRight.openTab(view==='outputs'?'summary-outputs':'summary-sources');
  for(const [kind,title,view] of [['summary-outputs','全部输出内容','outputs'],['summary-sources','全部来源','sources']]){
    const id='dsh-summary-panel/'+kind;
    ctx.effect(()=>ctx.sidebarRightTabs.register({id,kind,title:()=>title,priority:'extension'}));
    function Details({sessionId,inputActions}){return h(SummaryPanel,{sessionId,inputActions,view,detail:true,onNavigate:openDetails});}
    ctx.effect(()=>ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:id},Details)));
  }
  function Toggle({sessionId,inputActions}) {
    const [open,setOpen]=React.useState(false),[rendered,setRendered]=React.useState(false),[host,setHost]=React.useState(null);
    const ref=React.useRef(null),layout=React.useRef(null),visibility=React.useRef(null);
    if(visibility.current?.sessionId!==sessionId)visibility.current={sessionId,model:new SummaryVisibility(ctx.sidebarRight.isExpanded?.()===true)};
    React.useEffect(()=>{
      const model=visibility.current.model;
      setOpen(model.open);if(!model.open)setRendered(false);
      return watchRightSidebar(ref.current,ctx.sidebarRight,expanded=>{
        const previous=model.open,next=model.sidebar(expanded);
        if(previous===next)return;
        if(next)setRendered(true);setOpen(next);
      });
    },[sessionId]);
    React.useEffect(()=>repository.retain(sessionId),[sessionId]);
    React.useLayoutEffect(()=>{
      if(!rendered)return;
      const session=[...document.querySelectorAll('[data-conversation-session]')].find(node=>node.dataset.conversationSession===sessionId && node.getClientRects().length>0);
      if(!session)return;
      const seat=document.createElement('aside');seat.className='dsp-independent-rail';seat.dataset.state='open';seat.setAttribute('aria-label','会话摘要');
      session.classList.add('dsp-session-open');session.append(seat);layout.current=attachSummaryLayout(session,seat,ctx.sidebarRight);setHost(seat);
      return ()=>{layout.current?.dispose();layout.current=null;setHost(null);seat.remove();session.classList.remove('dsp-session-open');};
    },[rendered,sessionId]);
    React.useLayoutEffect(()=>{if(host){host.dataset.state=open?'open':'closing';layout.current?.setOpen(open);}},[host,open]);
    React.useEffect(()=>{
      if(open||!rendered)return;
      const timer=setTimeout(()=>setRendered(false),260);
      return ()=>clearTimeout(timer);
    },[open,rendered]);
    return h(React.Fragment,null,h('button',{ref,className:'dsp-toggle',type:'button','aria-label':open?'关闭摘要面板':'打开摘要面板','aria-expanded':open,title:'摘要：输出内容和来源',onClick:()=>{const next=visibility.current.model.toggle();if(next)setRendered(true);setOpen(next);}},h(Icon,{kind:'summary',size:18})),host&&ReactDOM.createPortal(h(SummaryPanel,{sessionId,inputActions,view:'summary',onNavigate:openDetails}),host));
  }
  ctx.effect(()=>ctx.slots.inject('conversation.session.header.utilities',()=>ctx.slots.register({name:'conversation.session.header.utilities',id:'dsh-summary-panel-toggle',order:1000},Toggle)));
}
