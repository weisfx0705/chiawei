/* KTV signal-flow lab. All signals are simulated; no microphone access or uploads. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const recModels = {mono:{n:1,name:'單軌錄音機',outs:false},stereo:{n:2,name:'兩軌錄音機',outs:true},three:{n:3,name:'三軌錄音機',outs:true},four:{n:4,name:'四軌錄音機',outs:true},f4:{n:4,name:'Zoom F4',outs:true}};
  const modeText = {
    pa:['A / 先讓 PA 照顧現場','麥克風與電腦先進 PA，再分送喇叭與錄音機。錄音機拿到的是哪一個 bus？若只是 LR 複製，人聲與伴奏已經混在一起。'],
    split:['B / 錄音優先，LR 借來當兩條路','人聲和 Mono 伴奏先進錄音機，保留 ISO。把人聲 Pan L、伴奏 Pan R，送到 PA 兩路 LINE IN；PA 兩路都置中，兩邊喇叭都有完整的 Mono mix。'],
    stereo:['C / 用兩組輸出，把立體聲找回來','F4 MAIN 1 送人聲，SUB 1/2 送伴奏 L/R。PA 人聲置中、伴奏分別 Pan L / R；一位歌手要 3 路錄音輸入，兩位要 4 路。']
  };
  let state = {mode:'pa',connections:[],selected:null,rewire:null,checked:false,running:false,takes:[],takeNumber:0};
  let ports = new Map(), paSettings={},recSettings={},matrix=[], latest=null, stopTimer=null, resizeFrame=0;
  const sound = window.KtvSound.create();
  let listenTarget='live', listenChannels=[{},{}], visualFrame=0, lastLyric=-1, playButtonVisible=false;
  const signalColors={vocal:'#be5061',music:'#227b8a',video:'#7964ae'};
  const config=()=>({mics:Number($('mic-count').value),wireless:$('mic-type').value==='wireless',pa:$('pa-type').value,paMics:Number($('pa-mics').value),rec:$('rec-type').value,model:recModels[$('rec-type').value],passive:$('speakers').value==='passive',mono:$('music-format').value==='mono',format:$('record-format').value});
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dbGain = n => Math.pow(10,Number(n)/20);
  const empty = () => ({m1:0,m2:0,l:0,r:0,wm1:0,wm2:0,wl:0,wr:0,fx:0,video:0});
  const scale = (v,k) => Object.fromEntries(Object.entries(v).map(([a,b])=>[a,b*k]));
  function add(...vs){const v=empty();vs.forEach(s=>Object.keys(v).forEach(k=>v[k]+=s[k]||0));return v;}
  const power = v => Math.sqrt(v.m1*v.m1+v.m2*v.m2+v.l*v.l+v.r*v.r);
  const has = v => power(v)>.0001 || v.video>0;
  const panGain = (p,side) => side===0 ? (p<=0?1:1-p) : (p>=0?1:1+p);
  const dry = (v,i) => v['m'+i]>.0001 && v['m'+(i===1?2:1)]<.0001 && v.l<.0001 && v.r<.0001 && v.fx<.0001;
  const sourceNames = {m1:'人聲 1',m2:'人聲 2',l:'伴奏 L',r:'伴奏 R'};
  function describe(v){const a=Object.keys(sourceNames).filter(k=>v[k]>.0001).map(k=>sourceNames[k]);return a.length ? a.join(' ＋ ')+(v.fx>.0001?' ＋ PA FX':'') : '沒有訊號';}
  function signalKinds(v){
    return [...(v.m1+v.m2>.0001?['vocal']:[]),...(v.l+v.r>.0001?['music']:[]),...(v.video>0?['video']:[])];
  }
  function badges(v,compact=false){
    const labels=compact?{vocal:'V',music:'B',video:'AV'}:{vocal:'V · Vocal',music:'B · 伴奏',video:'AV · 視訊'};
    return signalKinds(v).map(k=>`<small class="signal-chip ${k}">${labels[k]}</small>`).join('');
  }
  function meter(v){const peak=power(v)*.13;return {percent:Math.min(100,peak*100),clip:peak>=1,db:peak>.00001?(20*Math.log10(peak)).toFixed(1)+' dBFS':'−∞ dBFS'};}
  function message(t,error=false){$('patch-message').textContent=t;$('patch-message').classList.toggle('error',error);}
  function paIDs(c){return [...Array.from({length:c.paMics},(_,i)=>'mic'+(i+1)),...Array.from({length:4},(_,i)=>'line'+(i+1))];}
  function resetControls(){
    const c=config();paSettings={};recSettings={};
    paIDs(c).forEach(k=>paSettings[k]={level:100,pan:0,main:true,send1:100,send2:100});
    for(let i=1;i<=c.model.n;i++)recSettings[i]={trim:0,fader:100,pan:0,arm:true,type:state.mode==='pa'?'line':i<=c.mics?'mic':'line'};
    matrix=Array.from({length:4},()=>['off','off','off','off']);
    ['pa-master','send-master','rec-master'].forEach(k=>{$(k).value=80;$(k+'-value').value='80%';});
    $('pa-fx').checked=false;$('aux-pre').checked=true;$('f4-route').value='lr';
  }
  function port(id,label,dir,type,device,signalType=type){
    ports.set(id,{id,label,dir,type,device,signalType});
    return `<button class="port ${dir}" data-port="${id}" aria-label="${escape(label)}，${dir==='out'?'OUT 輸出':'IN 輸入'}"><i class="jack" aria-hidden="true"></i><span>${escape(label)}</span><em>${dir.toUpperCase()}</em></button>`;
  }
  function node(title,sub,icon,className,content,display=''){
    return `<article class="node ${className}"><div class="node-header"><span class="device-icon" aria-hidden="true">${icon}</span><h3>${title}</h3><span class="node-face" aria-hidden="true">•ᴗ•</span></div><p class="node-sub">${sub}</p>${display?`<div class="device-display" aria-hidden="true">${display}</div>`:''}<div class="ports">${content}</div></article>`;
  }
  function renderBoard(){
    const c=config();ports.clear();
    let sources='';
    for(let i=1;i<=c.mics;i++)sources+=node(c.wireless?`演唱者 ${i} ＋ 無線接收機`:`演唱者 ${i} 的麥克風`,c.wireless?'接收機設 MIC level，再送下一台。':'有線動圈・MIC level','♩','mic-node',port('mic'+i,`MIC ${i} OUT`,'out','mic','mic'+i));
    sources+=node('伴奏電腦',c.mono?'畫面與聲音分開走。軟體已加總 Mono。':'畫面走 HDMI，聲音走兩路 LINE level。','▱','computer-node',port('pc-video','HDMI OUT','out','video','pc')+(c.mono?port('pc-mono','AUDIO MONO OUT','out','line','pc'):port('pc-l','AUDIO L OUT','out','line','pc')+port('pc-r','AUDIO R OUT','out','line','pc')),'♪  PLAY YOUR SONG');
    const paIn=paIDs(c).map(k=>port('pa-'+k,(k.startsWith('mic')?'MIC ':'LINE ')+k.replace(/\D/g,'' )+' IN','in',k.startsWith('mic')?'mic':'line','pa')).join('');
    let paOut=port('pa-main-l','MAIN L OUT','out','line','pa')+port('pa-main-r','MAIN R OUT','out','line','pa');
    if(c.pa==='basic')paOut+=port('pa-rec-l','REC L OUT','out','line','pa')+port('pa-rec-r','REC R OUT','out','line','pa');
    if(c.pa==='aux')paOut+=port('pa-aux','AUX 1 OUT・MONO','out','line','pa');
    if(c.pa==='digital'){
      paOut+=port('pa-bus1','BUS 1 OUT','out','line','pa')+port('pa-bus2','BUS 2 OUT','out','line','pa');
      for(let i=1;i<=c.paMics;i++)paOut+=port('pa-direct'+i,`MIC ${i} DIRECT OUT`,'out','line','pa');
    }
    const paNode=node('PA 混音台',c.pa==='basic'?'MAIN 與 REC 共用混音。':c.pa==='aux'?'AUX 1 是一條獨立 Mono bus。':'MAIN / BUS / Direct 各有任務。','≋','mixer-node',paIn+'<div class="port-divider">OUTPUT / LINE LEVEL</div>'+paOut,'MIX IT YOUR WAY');
    let recIn='';for(let i=1;i<=c.model.n;i++)recIn+=port('rec-in'+i,`INPUT ${i}`,'in','combo','rec');
    let recOut='';if(c.model.outs){recOut=port('rec-main1',c.rec==='f4'?'MAIN 1 OUT':'L OUT','out','line','rec')+port('rec-main2',c.rec==='f4'?'MAIN 2 OUT':'R OUT','out','line','rec');if(c.rec==='f4')recOut+=port('rec-sub1','SUB 1 OUT','out','line','rec')+port('rec-sub2','SUB 2 OUT','out','line','rec');}
    const recNode=node(c.model.name,c.rec==='f4'?'4 路 ISO ＋ LR mix；2 組雙聲道輸出。':`${c.model.n} 個輸入可分別留在檔案裡。`,'⏺','rec-node',recIn+(recOut?'<div class="port-divider">OUTPUT / LINE LEVEL</div>'+recOut:''),'REC READY · ISO');
    let destinations=node('投影畫面','讓歌詞被看見。','▰','projector-node',port('screen','HDMI IN','in','video','screen'));
    if(c.passive)destinations+=node('功率擴大機','先接 LINE，再用喇叭線送出功率。','ϟ','amp-node',port('amp-in-l','LINE L IN','in','line','amp')+port('amp-in-r','LINE R IN','in','line','amp')+port('amp-out-l','SPEAKER L OUT','out','power','amp')+port('amp-out-r','SPEAKER R OUT','out','power','amp'));
    destinations+=node('左喇叭 L',c.passive?'被動式・吃功率訊號':'主動式・內建擴大機','◉','speaker-node',port('sp-l',c.passive?'SPEAKER IN':'LINE IN','in',c.passive?'power':'line','sp-l'))+node('右喇叭 R',c.passive?'被動式・吃功率訊號':'主動式・內建擴大機','◉','speaker-node',port('sp-r',c.passive?'SPEAKER IN':'LINE IN','in',c.passive?'power':'line','sp-r'));
    $('nodes').innerHTML=`<div class="node-column">${sources}</div><div class="node-column">${state.mode==='pa'?paNode:recNode}</div><div class="node-column">${state.mode==='pa'?recNode:paNode}</div><div class="node-column">${destinations}</div>`;
    $('mode-heading').textContent=modeText[state.mode][0];$('mode-note').textContent=modeText[state.mode][1];
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    $('aux-pre-label').hidden=c.pa!=='aux';$('f4-controls').hidden=c.rec!=='f4';
    $('pa-bus-note').textContent=c.pa==='basic'?'REC LR 與 MAIN 是同一個 mix；錄音輸出總量可再調小，但轉 MAIN 也會改到 REC。':c.pa==='aux'?'AUX 1 是 Mono。每路 SEND 決定多少送去錄音；PRE 不跟隨通道 FADER，也不跟隨 MAIN 總量。':'每一路可獨立送 MAIN、BUS 1、BUS 2；兩條 BUS 是兩個 Mono 輸出。MIC DIRECT OUT 取推桿與 PA FX 前的輸入。';
    renderMatrix();update();
  }
  function renderMatrix(){
    $('matrix-body').innerHTML=matrix.map((row,i)=>`<tr><th scope="row">INPUT ${i+1}</th>${row.map((v,j)=>`<td><button data-matrix="${i},${j}" data-value="${v}" aria-label="INPUT ${i+1} 到 ${['MAIN 1','MAIN 2','SUB 1','SUB 2'][j]}：${v.toUpperCase()}">${v.toUpperCase()}</button></td>`).join('')}</tr>`).join('');
    $('matrix-body').querySelectorAll('button').forEach(b=>{const col=Number(b.dataset.matrix.split(',')[1]);b.disabled=col<2&&$('f4-route').value==='lr';});
  }
  function solve(){
    const c=config(),memo=new Map(),visiting=new Set(),loops=new Set(),mismatch=[];
    function input(id){const wire=state.connections.find(x=>x.to===id);if(!wire)return empty();const v=output(wire.from);if(id.startsWith('rec-in')){const i=Number(id.slice(6)),p=ports.get(wire.from);if(p&&((p.type==='mic')!==(recSettings[i].type==='mic')))mismatch.push(`INPUT ${i} 收到 ${p.type==='mic'?'MIC':'LINE'} 電平，請把錄音機該路改成 ${p.type==='mic'?'MIC':'LINE'}。`);}return v;}
    function wet(v){return {...v,fx:v.fx+v.m1+v.m2+v.l+v.r,wm1:v.wm1+v.m1,wm2:v.wm2+v.m2,wl:v.wl+v.l,wr:v.wr+v.r};}
    function paChannel(k,post=true,fx=true){let v=input('pa-'+k);if(post)v=scale(v,paSettings[k].level/100);if(post&&fx&&$('pa-fx').checked)v=wet(v);return v;}
    function paMix(side){return scale(add(...paIDs(c).filter(k=>paSettings[k].main).map(k=>scale(paChannel(k),panGain(paSettings[k].pan,side)))),Number($('pa-master').value)/100);}
    function recInput(i){return scale(input('rec-in'+i),dbGain(recSettings[i].trim));}
    function recMix(side){return add(...Array.from({length:c.model.n},(_,a)=>{const i=a+1,s=recSettings[i];return scale(recInput(i),s.fader/100*panGain(s.pan,side));}));}
    function output(id){
      if(memo.has(id))return memo.get(id);
      if(visiting.has(id)){loops.add(id);return empty();}visiting.add(id);let v=empty();
      if(/^mic[12]$/.test(id)&&$('source-mic').checked)v['m'+id.slice(3)]=1;
      else if(id==='pc-video'&&$('source-video').checked)v.video=1;
      else if(id.startsWith('pc-')&&$('source-music').checked){if(id==='pc-l'||id==='pc-mono')v.l=c.mono?.5:1;if(id==='pc-r'||id==='pc-mono')v.r=c.mono?.5:1;}
      else if(id==='pa-main-l'||id==='pa-main-r')v=paMix(id.endsWith('l')?0:1);
      else if(id==='pa-rec-l'||id==='pa-rec-r')v=scale(paMix(id.endsWith('l')?0:1),Number($('send-master').value)/100);
      else if(id==='pa-aux')v=scale(add(...paIDs(c).filter(k=>paSettings[k].send1>0).map(k=>scale(paChannel(k,!$('aux-pre').checked),paSettings[k].send1/100))),Number($('send-master').value)/100);
      else if(id==='pa-bus1'||id==='pa-bus2'){const s=id.endsWith('1')?'send1':'send2';v=scale(add(...paIDs(c).filter(k=>paSettings[k][s]>0).map(k=>scale(paChannel(k,false),paSettings[k][s]/100))),Number($('send-master').value)/100);}
      else if(id.startsWith('pa-direct'))v=paChannel('mic'+id.replace('pa-direct',''),false);
      else if(id.startsWith('rec-')){
        const j=id==='rec-main1'?0:id==='rec-main2'?1:id==='rec-sub1'?2:3;
        if(j<2&&(c.rec!=='f4'||$('f4-route').value==='lr'))v=recMix(j);
        else v=add(...matrix.map((row,a)=>{if(row[j]==='off')return empty();return scale(recInput(a+1),row[j]==='post'?recSettings[a+1].fader/100:1);}));
        v=scale(v,Number($('rec-master').value)/100);
      }else if(id==='amp-out-l'||id==='amp-out-r')v=input(id.endsWith('l')?'amp-in-l':'amp-in-r');
      visiting.delete(id);memo.set(id,v);return v;
    }
    const live=[input('sp-l'),input('sp-r')],screen=input('screen');const inputs=Array.from({length:c.model.n},(_,i)=>recInput(i+1));
    const tracks=[];if(c.format!=='mix')inputs.forEach((v,i)=>{if(recSettings[i+1].arm)tracks.push({name:'ISO '+(i+1),v,id:'iso'+(i+1)});});
    if(c.format!=='iso')tracks.push({name:'MIX L',v:recMix(0),id:'mixl'},{name:'MIX R',v:recMix(1),id:'mixr'});
    state.connections.forEach(x=>output(x.from));
    return {c,live,screen,inputs,tracks,loops,mismatch:[...new Set(mismatch)],output,input};
  }
  function range(id,label,value,min,max,step=1,unit='%'){
    return `<label>${label}<output>${unit==='pan'?(value===0?'C':value<0?'L '+Math.round(-value*100):'R '+Math.round(value*100)):value+unit}</output><input aria-label="${id.startsWith('pa')?'PA '+id.split('-')[1]:'錄音機 INPUT '+id.split('-')[1]} ${label}" data-control="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }
  function renderStrips(r){
    const focused=document.activeElement;
    const activeId=focused?.dataset.control;
    if(activeId)return; // Keep the focused slider stable while dragging or using arrow keys.
    const c=r.c,connected=paIDs(c).filter(k=>state.connections.some(x=>x.to==='pa-'+k));
    $('pa-strips').innerHTML=connected.length?connected.map(k=>{const s=paSettings[k];return `<div class="strip"><div class="strip-head"><b>${k.startsWith('mic')?'MIC ':'LINE '}${k.replace(/\D/g,'')}</b><span class="strip-source">${escape(describe(r.input('pa-'+k)))}</span></div><div class="strip-controls">${range('pa-'+k+'-level','FADER',s.level,0,150)}${range('pa-'+k+'-pan','PAN',s.pan,-1,1,.1,'pan')}${c.pa!=='basic'?range('pa-'+k+'-send1',c.pa==='aux'?'AUX SEND':'BUS 1 SEND',s.send1,0,150):''}${c.pa==='digital'?range('pa-'+k+'-send2','BUS 2 SEND',s.send2,0,150):''}</div><div class="strip-checks"><label><input data-control="pa-${k}-main" type="checkbox" ${s.main?'checked':''}>送 MAIN</label></div></div>`;}).join(''):'<div class="strip-empty">先把麥克風或 LINE 訊號接進 PA，這裡就會出現通道控制。</div>';
    $('rec-strips').innerHTML=Array.from({length:c.model.n},(_,a)=>{const i=a+1,s=recSettings[i];return `<div class="strip"><div class="strip-head"><b>INPUT ${i}</b><select class="input-mode" data-control="rec-${i}-type" aria-label="錄音機 INPUT ${i} 輸入電平"><option value="mic" ${s.type==='mic'?'selected':''}>MIC</option><option value="line" ${s.type==='line'?'selected':''}>LINE</option></select><label class="arm"><input data-control="rec-${i}-arm" type="checkbox" ${s.arm?'checked':''}>ARM</label></div><div class="signal-detail">${escape(describe(r.inputs[a]))}</div><div class="strip-controls">${range('rec-'+i+'-trim','TRIM',s.trim,-12,24,1,' dB')}${range('rec-'+i+'-fader','FADER',s.fader,0,150)}${range('rec-'+i+'-pan','PAN',s.pan,-1,1,.1,'pan')}</div></div>`;}).join('');
  }
  function signalRow(name,v,id){const m=meter(v);return `<div class="signal-row" data-signal="${id}"><div class="signal-top"><b>${escape(name)}</b><span>${m.db}${m.clip?' · CLIP':''}</span>${id.startsWith('rec-')?`<button data-listen="${id}">▶ 試聽</button>`:''}</div><div class="signal-detail">${escape(describe(v))}</div><div class="signal-badges">${badges(v)}</div><div class="meter" aria-hidden="true"><i class="${m.clip?'clip':''}" style="width:${m.percent}%"></i></div></div>`;}
  function checks(r){
    const c=r.c,allVox=Array.from({length:c.mics},(_,i)=>r.live.every(v=>v['m'+(i+1)]>.0001)),music=r.live.every(v=>v.l+v.r>.0001),recorded=r.tracks.filter(t=>has(t.v));
    const dryVox=Array.from({length:c.mics},(_,i)=>r.tracks.some(t=>dry(t.v,i+1)));
    const safe=!r.loops.size&&!r.mismatch.length&&![...r.live,...r.inputs,...r.tracks.map(t=>t.v)].some(v=>meter(v).clip);
    const capturedAll=Array.from({length:c.mics},(_,i)=>r.tracks.some(t=>t.v['m'+(i+1)]>.0001)).every(Boolean);
    const list=[['歌詞已投影',r.screen.video>0],['每支麥克風都送到左右喇叭',allVox.every(Boolean)],['伴奏到達左右喇叭',music],['已啟用錄音軌，且所有人聲可留下',recorded.length>0&&capturedAll],[$('goal').value==='film'?'每支人聲都有乾淨的獨立軌':'輸入電平一致，無循環／示意超載',$('goal').value==='film'?dryVox.every(Boolean)&&safe:safe]];
    const diagnostics=[];
    if(!r.screen.video)diagnostics.push('歌詞還沒到：請把電腦 HDMI OUT 接到投影 HDMI IN。');
    if(allVox.some(x=>!x))diagnostics.push('至少一位演唱者尚未同時到達左右喇叭。沿著綠線檢查，再確認 FADER、MAIN 與 PAN。');
    if(!music)diagnostics.push('伴奏還沒有到左右兩邊：檢查電腦輸出、PAN、bus 指派與各級音量。');
    if(!capturedAll)diagnostics.push('有聲音不等於有錄到：檢查錄音輸入、TRIM、ARM 與錄音軌格式。');
    if(!dryVox.every(Boolean)&&recorded.length)diagnostics.push('目前沒有為每支人聲保留獨立乾聲軌。PA LR 混音即使錄進兩軌，也無法還原成乾淨的人聲／伴奏分軌。試試 B、C 或數位台 MIC DIRECT OUT。');
    if(c.model.n<c.mics+(c.mono?1:2)&&state.mode!=='pa')diagnostics.push(`容量提醒：${c.mics} 支人聲＋${c.mono?'Mono 伴奏需要 '+(c.mics+1):'Stereo 伴奏需要 '+(c.mics+2)} 個獨立輸入，目前只有 ${c.model.n} 個。`);
    if(r.live[0].m1+r.live[0].m2>0&&r.live[1].m1+r.live[1].m2>0&&r.live.every(v=>v.l+v.r>0)&&sameStereo(r.live))diagnostics.push('目前是雙邊都播同樣的 Mono mix。兩個喇叭都有聲音，不代表伴奏仍是 Stereo。');
    if(r.loops.size)diagnostics.push('偵測到循環回送。請拔掉 PA → 錄音機 → PA 的回送，或用獨立 bus 排除回送訊號。');
    diagnostics.push(...r.mismatch);
    if(!safe&&![...r.live,...r.inputs,...r.tracks.map(t=>t.v)].every(v=>!meter(v).clip))diagnostics.push('示意電平已達 CLIP，降低輸入 TRIM 或相應 bus / 輸出音量。');
    if(state.mode==='split'&&!c.mono)diagnostics.push('B 示範以先加總的 Mono 伴奏進一路。若要 Stereo，須多一個輸入並規劃雙組輸出，例如 C。');
    return {list,diagnostics,dryVox,safe};
  }
  const sameStereo = live => Math.abs(live[0].l-live[1].l)<.001&&Math.abs(live[0].r-live[1].r)<.001;
  function update(){
    latest=solve();const r=latest;
    renderStrips(r);
    $('live-results').innerHTML=signalRow('左喇叭 L',r.live[0],'left')+signalRow('右喇叭 R',r.live[1],'right');
    $('stereo-result').textContent=r.live.every(v=>v.l+v.r>0)?(sameStereo(r.live)?'雙邊 Mono：兩邊喇叭收到相同伴奏。':r.live[0].l>0&&r.live[1].r>0&&r.live[0].r<.001&&r.live[1].l<.001?'Stereo：伴奏 L / R 各自保留。':'左右訊號不同；請確認伴奏 L / R 的分配。'):'伴奏尚未到達左右兩邊。';
    $('record-results').innerHTML=r.tracks.length?r.tracks.map(t=>signalRow(t.name,t.v,'rec-'+t.id)).join(''):'<p>沒有啟用的錄音軌，請先打開 ARM。</p>';
    const check=checks(r),score=check.list.filter(x=>x[1]).length;
    $('check-score').textContent=state.checked?(score===5?'可以開唱了！ 5 / 5 ♪':`準備進度 ${score} / 5`):'準備單・接線即時更新';
    $('checklist').innerHTML=check.list.map(([label,pass])=>`<li class="${pass?'pass':''}"><span aria-label="${pass?'通過':'待完成'}">${pass?'✓':'·'}</span>${label}</li>`).join('');
    $('diagnostics').innerHTML=state.checked?(check.diagnostics.length?check.diagnostics.map(t=>`<p>${escape(t)}</p>`).join(''):'<p>任務通過！可以再關掉伴奏、單獨測人聲，確認每條路都符合預期。</p>'):'<p>先自己接接看，再按 Soundcheck，讓聲音總監幫你逐項檢查。</p>';
    $('projection').classList.toggle('on',r.screen.video>0);$('lyric').textContent=r.screen.video?'今天換我，唱給你聽 ♪':'等你接上畫面 ♪';
    ['left','right'].forEach((s,i)=>$('stage-'+s).classList.toggle('on',has(r.live[i])));
    $('stage-status').textContent=r.live.every(has)?(state.running?'SOUNDCHECK・你的舞台正在發光':'舞台有聲音了・再確認錄音軌 ♪'):'舞台待機中・等你接線';
    $('stage').classList.toggle('running',state.running||sound.playing);
    const activeElement=document.activeElement; // Do not replace a focused disconnect button unnecessarily.
    if(!activeElement?.classList.contains('unplug'))renderConnections();
    document.querySelectorAll('[data-port]').forEach(b=>{
      const p=ports.get(b.dataset.port),wire=state.connections.find(x=>p.dir==='out'?x.from===p.id:x.to===p.id),v=wire?r.output(wire.from):empty();
      b.classList.toggle('connected',!!wire&&has(v));b.classList.toggle('muted',!!wire&&!has(v));b.classList.toggle('selected',state.selected===p.id);
      b.classList.toggle('rewiring',!!state.rewire&&(state.rewire.from===p.id||state.rewire.to===p.id));
      b.setAttribute('aria-pressed',String(state.selected===p.id));
      b.classList.toggle('compatible',!!state.selected&&p.dir==='in'&&compatible(ports.get(state.selected),p));
      const kinds=signalKinds(v);
      b.dataset.signal=kinds.length>1?'mixed':kinds[0]||'none';
      b.querySelector('span').innerHTML=escape(p.label)+(wire?`<span class="port-sources">${has(v)?'✓ ':''}${badges(v,true)}</span>`:'');
      b.setAttribute('aria-label',`${p.label}，${p.dir.toUpperCase()} ${p.dir==='out'?'輸出':'輸入'}${wire?'；'+(v.video?'視訊':describe(v)):''}`);
    });
    $('unplug-selected').disabled=!state.rewire;
    syncListening(r);
    scheduleDraw();
  }
  function renderConnections(){
    $('cable-count').textContent=state.connections.length+' 條';
    $('connection-list').innerHTML=state.connections.length?state.connections.map((x,i)=>`<li><span>${escape(ports.get(x.from)?.label)} → ${escape(deviceName(ports.get(x.to)?.device))} ${escape(ports.get(x.to)?.label)} ${badges(latest.output(x.from),true)}</span><button class="unplug" data-unplug="${i}" aria-label="拔除 ${escape(ports.get(x.from)?.label)} 到 ${escape(ports.get(x.to)?.label)}">拔線 ×</button></li>`).join(''):'<li>還沒有線。先點一個 OUT 吧。</li>';
  }
  function deviceName(d){return ({pa:'PA',rec:'錄音機',screen:'投影',amp:'擴大機','sp-l':'左喇叭','sp-r':'右喇叭'})[d]||d;}
  function compatible(out,inp){if(!out||!inp||out.dir!=='out'||inp.dir!=='in'||out.device===inp.device)return false;return out.type===inp.type||(inp.type==='combo'&&(out.type==='line'||out.type==='mic'));}
  const sameWire=(a,b)=>!!a&&!!b&&a.from===b.from&&a.to===b.to;
  function cancelPatch(){
    state.selected=null;state.rewire=null;update();message('已取消選取，原有接線保留。');
  }
  function unplugWire(wire){
    if(!wire)return;
    state.connections=state.connections.filter(x=>!sameWire(x,wire));
    state.selected=null;state.rewire=null;update();
    message('已拔掉這條線。再選一個 OUT 和 IN，就能試另一種接法。');
  }
  function selectOutput(id,wire=null){
    state.selected=id;
    if(!state.rewire)state.rewire=wire||state.connections.find(x=>x.from===id)||null;
    if(state.rewire)message(`正在改接：已選 ${ports.get(id).label}。點新的 IN（也可先換 OUT）；原線先保留。按「拔選取線」可直接拔線，再次點選原本那對 OUT／IN 也能拔線。`);
    else message(`已選 ${ports.get(id).label}。下一步：點另一台設備的相容 IN；已有線的 IN 也能換接。`);
    update();
  }
  function connect(id){
    const p=ports.get(id);if(!p)return;
    if(p.dir==='out'){
      if(state.selected===id){cancelPatch();return;}
      selectOutput(id);return;
    }
    const attached=state.connections.find(x=>x.to===id);
    if(!state.selected){
      if(attached){selectOutput(attached.from,attached);return;}
      message('這是 IN 輸入。先選上游設備的 OUT，再把聲音送進來。',true);return;
    }
    const out=ports.get(state.selected);
    if(!compatible(out,p)){message(out.type==='power'?'擴大機的 SPEAKER OUT 是功率輸出，只能送被動式喇叭。不可送錄音機或一般 LINE IN。':out.type==='video'||p.type==='video'?'畫面與聲音是不同路徑：HDMI 要接 HDMI IN。':'訊號類型不合。MIC 找 MIC／錄音機輸入；LINE 找 LINE／錄音機輸入。被動式喇叭需要功率擴大機。',true);return;}
    const next={from:out.id,to:id};
    if(sameWire(attached,next)&&(!state.rewire||sameWire(state.rewire,next))){unplugWire(attached);return;}
    // Replace the selected cable and occupied endpoints together, after validation.
    const previous=state.connections;
    const kept=previous.filter(x=>!sameWire(x,state.rewire)&&x.from!==out.id&&x.to!==id);
    const replaced=previous.length-kept.length;
    state.connections=[...kept,next];
    if(solve().loops.size){
      state.connections=previous;
      message('這條線會造成循環回送。原有接線已保留，請換一個接點或用獨立 bus 隔離。',true);update();return;
    }
    state.selected=null;state.rewire=null;
    message(`${replaced?'已改接':'接通'}！${out.label} → ${deviceName(p.device)} ${p.label}。${replaced?'相關插孔的舊線已取代；可以再點接孔試另一種接法。':'彩色線與 ✓ 表示訊號已通過。'}`);
    update();
  }
  function syncBoardNavigation(){
    const scroll=document.querySelector('.board-scroll'),nav=$('patch-navigation');
    const max=scroll.scrollWidth-scroll.clientWidth;
    nav.hidden=max<2;
    const columns=[...document.querySelectorAll('.node-column')];
    if(!columns.length)return;
    const starts=columns.map(col=>col.getBoundingClientRect().left-scroll.getBoundingClientRect().left+scroll.scrollLeft-16);
    const active=scroll.scrollLeft>=max-2?3:starts.reduce((best,x,i)=>Math.abs(x-scroll.scrollLeft)<Math.abs(starts[best]-scroll.scrollLeft)?i:best,0);
    const labels=state.mode==='pa'?['聲源','PA','錄音機','舞台']:['聲源','錄音機','PA','舞台'];
    nav.querySelectorAll('[data-board-column]').forEach((button,i)=>{button.textContent=labels[i];button.setAttribute('aria-pressed',String(i===active));button.setAttribute('aria-label','跳到'+labels[i]);});
    $('patch-nav-hint').textContent=state.selected?`${state.rewire?'改接':'已選'} ${ports.get(state.selected).label} → 選新 IN，或先換 OUT`:'↔ 左右滑動，或點設備快速跳轉';
  }
  function scheduleDraw(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{syncBoardNavigation();draw();});}
  function draw(){
    const board=$('board'),rect=board.getBoundingClientRect(),svg=$('cables');svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    svg.innerHTML=state.connections.map((wire,i)=>{
      const a=document.querySelector(`[data-port="${wire.from}"] .jack`)?.getBoundingClientRect(),b=document.querySelector(`[data-port="${wire.to}"] .jack`)?.getBoundingClientRect();if(!a||!b)return '';
      const x1=a.left+a.width/2-rect.left,y1=a.top+a.height/2-rect.top,x2=b.left+b.width/2-rect.left,y2=b.top+b.height/2-rect.top;
      const offset=Math.max(35,Math.abs(x2-x1)*.45)+(i%3)*6;
      const kinds=signalKinds(latest.output(wire.from));
      const path=dy=>`M ${x1} ${y1+dy} C ${x1+offset} ${y1+dy}, ${x2-offset} ${y2+dy}, ${x2} ${y2+dy}`;
      if(!kinds.length)return `<path class="cable${sameWire(wire,state.rewire)?' rewiring':''}" data-wire="${wire.from}" d="${path(0)}"/>`;
      return kinds.map((kind,j)=>{
        const d=path((j-(kinds.length-1)/2)*4),color=signalColors[kind];
        return `<path class="cable live signal-${kind}${sameWire(wire,state.rewire)?' rewiring':''}" data-wire="${wire.from}" data-kind="${kind}" style="--signal-color:${color}" d="${d}"/>${state.running||sound.playing?`<path class="cable-pulse" style="--signal-color:${color}" d="${d}"/>`:''}`;
      }).join('');
    }).join('');
  }
  function changeEquipment(){
    state.connections=[];state.selected=null;state.rewire=null;state.checked=false;state.running=false;
    const f4=$('rec-type').value==='f4';Array.from($('record-format').options).forEach(o=>o.disabled=o.value!=='iso'&&!f4);if(!f4)$('record-format').value='iso';
    resetControls();renderBoard();message('演出夥伴換好了！接線與旋鈕已重設，現在可以重新設計路徑。');
  }
  function setMode(mode){
    state.mode=mode;state.connections=[];state.selected=null;state.rewire=null;state.checked=false;state.running=false;
    $('pa-type').value='basic';$('pa-mics').value='2';$('rec-type').value=mode==='pa'?'stereo':'f4';$('music-format').value=mode==='split'?'mono':'stereo';$('record-format').value='iso';
    changeEquipment();message('新任務開始。可以自己接線，也可以載入示範再拆解研究。');
  }
  function loadExample(kind=state.mode){
    if(kind==='aux'){setMode('pa');$('pa-type').value='aux';changeEquipment();}
    else if(kind!==state.mode)setMode(kind);
    const c=config();state.connections=[];state.selected=null;state.rewire=null;state.checked=false;resetControls();
    const wire=(from,to)=>{if(ports.has(from)&&ports.has(to)&&!state.connections.some(x=>x.to===to||x.from===from))state.connections.push({from,to});};
    wire('pc-video','screen');
    if(state.mode==='pa'){
      for(let i=1;i<=c.mics;i++)wire('mic'+i,'pa-mic'+i);
      if(c.mono)wire('pc-mono','pa-line1');else{wire('pc-l','pa-line1');wire('pc-r','pa-line2');paSettings.line1.pan=-1;paSettings.line2.pan=1;}
      if(c.pa==='basic'){wire('pa-rec-l','rec-in1');wire('pa-rec-r','rec-in2');}
      else if(c.pa==='aux'){wire('pa-aux','rec-in1');paSettings.line1.send1=0;paSettings.line2.send1=0;}
      else{for(let i=1;i<=c.mics;i++)wire('pa-direct'+i,'rec-in'+i);}
    }else{
      for(let i=1;i<=c.mics;i++)wire('mic'+i,'rec-in'+i);
      const a=c.mics+1;
      if(c.mono)wire('pc-mono','rec-in'+a);else{wire('pc-l','rec-in'+a);wire('pc-r','rec-in'+(a+1));}
      if(state.mode==='split'){
        for(let i=1;i<=c.model.n;i++)recSettings[i].pan=i<=c.mics?-1:1;
        wire('rec-main1','pa-line1');wire('rec-main2','pa-line2');
      }else{
        $('f4-route').value='matrix';
        for(let i=0;i<c.mics;i++)matrix[i][0]='pre';
        if(a<=4)matrix[a-1][2]='pre';if(!c.mono&&a+1<=4)matrix[a][3]='pre';
        if(!c.mono&&recSettings[a])recSettings[a].pan=-1;
        if(!c.mono&&recSettings[a+1])recSettings[a+1].pan=1;
        wire('rec-main1','pa-line1');wire('rec-sub1','pa-line2');wire('rec-sub2','pa-line3');
        paSettings.line2.pan=c.mono?0:-1;paSettings.line3.pan=1;
      }
    }
    if(c.passive){wire('pa-main-l','amp-in-l');wire('pa-main-r','amp-in-r');wire('amp-out-l','sp-l');wire('amp-out-r','sp-r');}
    else{wire('pa-main-l','sp-l');wire('pa-main-r','sp-r');}
    renderMatrix();update();message('示範已接好。這只是其中一種解法；試著改 Pan、拔一條線，或把某個送出量轉小。');
  }
  function controlChanged(el){
    const id=el.dataset.control;if(!id)return;const [group,key,param]=id.split('-'),obj=group==='pa'?paSettings[key]:recSettings[key];
    obj[param]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value);
    const out=el.parentElement.querySelector('output');if(out){const v=obj[param];out.value=param==='pan'?(v===0?'C':v<0?'L '+Math.round(-v*100):'R '+Math.round(v*100)):param==='trim'?v+' dB':v+'%';}
    update();
  }
  function runCheck(){state.checked=true;state.running=true;update();message('Soundcheck 開始！循著彩色線看來源，再對照現場與錄音結果。這個按鈕不會自動播放聲音。');clearTimeout(stopTimer);stopTimer=setTimeout(()=>{state.running=false;update();},9000);}
  function captureTake(){
    const r=solve();if(!r.tracks.some(t=>has(t.v))){message('目前沒有能留下聲音的錄音軌。先檢查接線、ARM 與測試訊號。',true);return;}
    const number=++state.takeNumber;state.takes.unshift({number,mode:state.mode,tracks:r.tracks.map(t=>({name:t.name,description:describe(t.v),db:meter(t.v).db})),master:$('pa-master').value,output:$('rec-master').value,dry:checks(r).dryVox.every(Boolean)});state.takes=state.takes.slice(0,3);
    $('takes').hidden=false;$('take-list').innerHTML=state.takes.map(t=>`<article class="take"><h4>TAKE ${String(t.number).padStart(2,'0')} · 路線 ${t.mode==='pa'?'A':t.mode==='split'?'B':'C'}</h4><p>PA MAIN ${t.master}% · REC OUT ${t.output}%</p>${t.tracks.map(v=>`<p><b>${v.name}</b> · ${escape(v.description)}<br>${v.db}（示意）</p>`).join('')}<p class="${t.dry?'':'take-warning'}">${t.dry?'✓ 每支人聲有獨立乾聲軌':'尚未保留每支人聲的獨立乾聲軌'}</p></article>`).join('');message('測試快照留下了！改動一個控制，再錄一次，就能比較差異。');
  }
  function sourceChannels(r,which){
    const vocal=which!=='source-music'&&$('source-mic').checked;
    const music=which!=='source-vocal'&&$('source-music').checked;
    return [0,1].map(side=>({...empty(),m1:vocal?1:0,m2:vocal&&r.c.mics===2?1:0,l:music&&side===0?1:0,r:music&&side===1?1:0}));
  }
  function syncListening(r){
    const target=$('listen-target');
    const choices=[['live','現場喇叭 L / R（依接線）'],['source-vocal','原始聲源 · Vocal'],['source-music','原始聲源 · 立體伴奏'],['source-both','原始聲源 · 人聲＋伴奏'],...r.tracks.map(t=>['rec-'+t.id,'錄音軌 · '+t.name])];
    const signature=choices.map(x=>x[0]).join('|');
    if(target.dataset.choices!==signature){target.innerHTML=choices.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');target.dataset.choices=signature;}
    if(!choices.some(x=>x[0]===listenTarget)){
      listenTarget='live';$('audio-status').textContent='原先監聽的錄音軌已停用，已切回現場喇叭。';
    }
    target.value=listenTarget;
    const original=listenTarget.startsWith('source-');
    const track=r.tracks.find(t=>'rec-'+t.id===listenTarget);
    listenChannels=original?sourceChannels(r,listenTarget):track?[track.v,track.v]:r.live;
    sound.setRoute(listenChannels);
    $('listen-mode').textContent=original?'原始聲源・不經接線':track?'錄音軌・'+track.name:'現場喇叭・依目前接線';
    $('listen-mode').dataset.mode=original?'source':'routed';
    $('listen-description').textContent=original?'先認識音色。這裡有聲音，還不代表喇叭或錄音機已接通。':track?'單一錄音軌以 Mono 置中試聽；只聽該軌收到的內容，與現場輸出分開。':'跟隨你目前的接線與控制；PAN、推桿、靜音、bus 改變時，耳朵同步更新。';
    const kinds=signalKinds(add(...listenChannels));
    $('listen-scope').dataset.signal=kinds.length>1?'mixed':kinds[0]||'none';
    $('audio-play').textContent=sound.playing?'Ⅱ 暫停試聽':'▶ 開始試聽';
    $('audio-play').setAttribute('aria-pressed',String(sound.playing));
    syncAudioDock();
    $('dock-target').textContent=target.selectedOptions[0].textContent;
    $('patch-listen').textContent=sound.playing&&listenTarget==='live'?'Ⅱ 暫停現場試聽':'▶ 聽目前接線';
    document.querySelectorAll('[data-audio-target]').forEach(b=>b.setAttribute('aria-pressed',String(sound.playing&&b.dataset.audioTarget===listenTarget)));
    $('stage').classList.toggle('running',state.running||sound.playing);
    if(!sound.playing)drawMonitor();
  }
  function syncAudioDock(){
    const visible=sound.playing&&!playButtonVisible;
    $('audio-dock').hidden=!visible;
    document.body.classList.toggle('audio-dock-visible',visible);
  }
  function drawMonitor(){
    const canvas=$('listen-scope'),ctx=canvas.getContext('2d');
    const width=canvas.clientWidth||960,height=canvas.clientHeight||128,ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const data=sound.analyse(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,width,height);
    const kinds=signalKinds(add(...listenChannels));
    let color=kinds.length===1?signalColors[kinds[0]]:'#8b9b86';
    if(kinds.length>1){color=ctx.createLinearGradient(55,0,width,0);color.addColorStop(0,signalColors.vocal);color.addColorStop(1,signalColors.music);}
    [0,1].forEach(side=>{
      const y=height*(side?.74:.27);ctx.strokeStyle='#dce3d4';ctx.lineWidth=1;ctx.setLineDash([4,6]);
      ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(width-14,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#62745d';ctx.font='bold 12px sans-serif';ctx.fillText(side?'R':'L',18,y+4);
      const wave=data.waves[side];ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();
      for(let x=0;x<width-64;x++){
        const v=!reduced&&sound.playing&&wave?wave[Math.floor(x/(width-65)*(wave.length-1))]:0;
        const yy=y-Math.max(-1,Math.min(1,v*6))*height*.21;x===0?ctx.moveTo(x+48,yy):ctx.lineTo(x+48,yy);
      }ctx.stroke();
    });
    $('vocal-motion').style.width=Math.min(100,data.levels.vocal*220)+'%';
    $('music-motion').style.width=Math.min(100,data.levels.music*220)+'%';
    $('sound-studio').classList.toggle('is-playing',sound.playing);
    const clock=n=>'00:'+String(Math.floor(n)).padStart(2,'0');
    $('listen-clock').textContent=clock(data.position)+' / 00:09 ↻';
    const beat=sound.playing?Math.floor(data.position/(60/data.bpm)):-1;
    if(lastLyric!==beat||$('tiny-lyric').parentElement.classList.contains('off')===$('source-video').checked){
      lastLyric=beat;const phrase=beat<0?'LA · OH · LA ♪':['啦〜 喔〜','哇啦・啦啦 ♪','嗚〜 啦〜','今天換我唱 ♪'][Math.floor(beat/4)%4];
      $('tiny-lyric').textContent=$('source-video').checked?phrase:'畫面已關閉';
      $('tiny-lyric').parentElement.classList.toggle('off',!$('source-video').checked);
      if(latest?.screen.video)$('lyric').textContent=sound.playing?phrase:'今天換我，唱給你聽 ♪';
    }
    if(sound.playing)visualFrame=requestAnimationFrame(drawMonitor);
  }
  async function listenAt(target){
    if(target)listenTarget=target;
    syncListening(solve());
    $('audio-play').disabled=true;$('audio-status').textContent='小樂團暖身中…';
    try{
      await sound.play();
      syncListening(solve());cancelAnimationFrame(visualFrame);drawMonitor();scheduleDraw();
      const label=$('listen-target').selectedOptions[0].textContent;
      $('audio-status').textContent=`正在循環播放：${label}。可一邊調整接線／推桿，一邊聽變化；按暫停停止。`;
      if(listenChannels.every(v=>!has(v)))$('audio-status').textContent+=' 目前此處沒有訊號，請接線、啟用聲源或調整輸出。';
      message('合成小樂團正在播放。珊瑚紅是 Vocal、湖水藍是伴奏；可以隨時切到現場或任一錄音軌。');
    }catch{
      $('audio-status').textContent='瀏覽器暫時無法播放音訊，請再次點擊開始試聽，或使用 Chrome / Safari。';
    }finally{$('audio-play').disabled=false;}
  }
  function pauseListening(){
    sound.pause();cancelAnimationFrame(visualFrame);syncListening(solve());drawMonitor();scheduleDraw();
    $('audio-status').textContent='試聽已暫停。再次播放會接續同一首小曲。';
  }
  $('nodes').addEventListener('click',e=>{const p=e.target.closest('[data-port]');if(p)connect(p.dataset.port);});
  $('connection-list').addEventListener('click',e=>{const b=e.target.closest('[data-unplug]');if(!b)return;const wire=state.connections[Number(b.dataset.unplug)];b.blur();unplugWire(wire);renderConnections();});
  ['mic-count','mic-type','pa-type','pa-mics','rec-type','speakers','music-format'].forEach(k=>$(k).addEventListener('change',changeEquipment));
  $('record-format').addEventListener('change',update);$('goal').addEventListener('change',update);
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('example').addEventListener('click',()=>loadExample());$('clear').addEventListener('click',()=>{state.connections=[];state.selected=null;state.rewire=null;state.running=false;update();message('接線清空了，控制器設定保留。試試自己重建一遍。');});
  ['pa-master','send-master','rec-master'].forEach(k=>$(k).addEventListener('input',()=>{$(k+'-value').value=$(k).value+'%';update();}));
  ['pa-fx','aux-pre','source-mic','source-music','source-video'].forEach(k=>$(k).addEventListener('change',update));
  ['pa-strips','rec-strips'].forEach(k=>{$(k).addEventListener('input',e=>controlChanged(e.target));$(k).addEventListener('change',e=>controlChanged(e.target));$(k).addEventListener('focusout',e=>{if(e.target.dataset.control)requestAnimationFrame(()=>{if(!document.activeElement?.dataset.control)update();});});});
  $('f4-route').addEventListener('change',()=>{renderMatrix();update();});
  $('matrix-body').addEventListener('click',e=>{const b=e.target.closest('[data-matrix]');if(!b)return;const [i,j]=b.dataset.matrix.split(',').map(Number),values=['off','pre','post'];matrix[i][j]=values[(values.indexOf(matrix[i][j])+1)%3];b.dataset.value=matrix[i][j];b.textContent=matrix[i][j].toUpperCase();b.setAttribute('aria-label',`INPUT ${i+1} 到 ${['MAIN 1','MAIN 2','SUB 1','SUB 2'][j]}：${matrix[i][j].toUpperCase()}`);update();});
  $('check').addEventListener('click',runCheck);$('record-test').addEventListener('click',captureTake);$('listen-live').addEventListener('click',()=>listenAt('live'));
  $('record-results').addEventListener('click',e=>{const b=e.target.closest('[data-listen]');if(!b)return;const t=solve().tracks.find(t=>'rec-'+t.id===b.dataset.listen);if(t)listenAt('rec-'+t.id);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.selected)cancelPatch();});
  $('unplug-selected').addEventListener('click',()=>unplugWire(state.rewire));
  $('patch-navigation').addEventListener('click',e=>{
    const button=e.target.closest('[data-board-column]');if(!button)return;
    const scroll=document.querySelector('.board-scroll'),column=document.querySelectorAll('.node-column')[Number(button.dataset.boardColumn)];
    scroll.scrollTo({left:column.getBoundingClientRect().left-scroll.getBoundingClientRect().left+scroll.scrollLeft-16,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  document.querySelector('.board-scroll').addEventListener('scroll',syncBoardNavigation,{passive:true});
  new IntersectionObserver(([entry])=>{playButtonVisible=entry.intersectionRatio>=.75;syncAudioDock();},{threshold:[0,.75,1]}).observe($('audio-play'));
  $('audio-play').addEventListener('click',()=>sound.playing?pauseListening():listenAt());
  $('dock-pause').addEventListener('click',pauseListening);
  $('patch-listen').addEventListener('click',()=>sound.playing&&listenTarget==='live'?pauseListening():listenAt('live'));
  $('listen-target').addEventListener('change',()=>{listenTarget=$('listen-target').value;syncListening(solve());if(sound.playing)$('audio-status').textContent='正在監聽：'+$('listen-target').selectedOptions[0].textContent+'。曲子持續播放，訊號位置已切換。';});
  document.querySelectorAll('[data-audio-target]').forEach(b=>b.addEventListener('click',()=>listenAt(b.dataset.audioTarget)));
  $('preview-volume').addEventListener('input',()=>{sound.setVolume(Number($('preview-volume').value)/100);$('preview-volume-value').value=$('preview-volume').value+'%';});
  window.addEventListener('pagehide',()=>sound.pause());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&sound.playing)pauseListening();});
  window.addEventListener('resize',()=>{scheduleDraw();if(!sound.playing)drawMonitor();});new ResizeObserver(scheduleDraw).observe($('nodes'));if(document.fonts)document.fonts.ready.then(scheduleDraw);
  resetControls();renderBoard();
})();
