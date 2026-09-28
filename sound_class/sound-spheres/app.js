'use strict';
// Stale cached builds have caused confusion twice; say plainly which one is running.
const BUILD = 'v12 · centered loading overlay';
console.info(`聲音球體 build: ${BUILD}`);
const $ = selector => document.querySelector(selector);
const ALL = 6;
const BLEND = 7;
const BLEND_HOME = 5;   // I DON'T KNOW leads the blend until the listener sweeps.
const state = {slide:0,scene:4,furthest:0,gateOpen:false,gateStarted:false,muted:Array(5).fill(false),playing:false,loading:false,real:false,includeMind:true,guided:false,stageTime:0,volume:70,message:'',request:0,focus:BLEND_HOME};
let engine = null;
let notes = {};
try { const saved=JSON.parse(localStorage.getItem('sound-spheres-notes')||'{}'); if(saved && typeof saved==='object' && !Array.isArray(saved))notes=saved; } catch {}
const sceneColors=['120,141,95','91,143,134','140,109,101','162,132,77','103,144,108'];
const sceneReady=[false,false,false,false,true];
const copy = [
  ['先聽見，腦內的自己。','五個念頭搶著說話。逐一安放，讓安靜慢慢回來。'],
  ['從一口呼吸，開始。','不必改變節奏。聽見氣息進來，再慢慢離開。'],
  ['每次觸碰，都有回聲。','讓注意力來到身體與世界接觸的地方。'],
  ['讓耳朵，與眼睛相遇。','想像聲源就在眼前；留意動作與聲音的關係。'],
  ['看不見，也能認得。','循著熟悉的聲音，把注意力放到視線之外。'],
  ['暫時，不必知道答案。','只聽音色、節奏與遠近，先不急著替它命名。'],
  ['讓整個世界，一起響起。','六圈一起亮起，感受內在、身體與世界同時存在。'],
  ['讓比例，在指尖下流動。','六層同時發聲，未知最靠近你。滑過球體換一層當主角，中心保持安靜。']
];
const slideKey=slide=>slide===ALL?'all':slide===BLEND?'blend':slide;
const slideName=slide=>slide===ALL?'全部一起聽':slide===BLEND?'交融聆聽':layers[slide][0];
const noteKey=()=>`${state.scene}-${slideKey(state.slide)}`;
const canGo=slide=>slide>=0 && slide<=BLEND && (slide===0 || (state.gateOpen && slide<=state.furthest));

$('#sphereRings').innerHTML=Array.from({length:6},(_,i)=>{
 const r=30+i*21,angle=(-145+i*38)*Math.PI/180,x=160+r*Math.cos(angle),y=160+r*Math.sin(angle);
 return `<g class="sphere-ring" data-ring="${i}" style="--i:${i}">${i===0?'<circle class="center-fill" cx="160" cy="160" r="29"/>':''}<circle class="ring-haze" cx="160" cy="160" r="${r}"/><circle class="ring-base" cx="160" cy="160" r="${r}"/><circle class="ring-light" cx="160" cy="160" r="${r}"/><circle class="ring-mark" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.6"/><circle class="ring-hit" data-jump="${i}" cx="160" cy="160" r="${r}"/></g>`;
}).join('');
$('#progress').innerHTML=Array.from({length:8},(_,i)=>`<button data-slide="${i}" aria-label="${i===ALL?'全部亮起':i===BLEND?'交融聆聽':`第 ${i+1} 層 ${layers[i][0]}`}" title="${i===ALL?'全部亮起':i===BLEND?'交融聆聽':layers[i][0]}"></button>`).join('');
$('#thoughtControls').innerHTML=THOUGHTS.map((v,i)=>`<button class="thought-button" data-mute="${i}" aria-label="關閉${v.title}的內在聲音"><span>${v.title}</span><span class="voice-indicator" aria-hidden="true">×</span></button>`).join('')+'<button class="thought-button quiet-all" id="quietAll">全部安放 <span aria-hidden="true">×</span></button>';
$('#sceneList').innerHTML=scenes.map((s,i)=>`<button class="scene-choice" data-scene="${i}"${sceneReady[i]?'':' disabled aria-disabled="true"'} aria-pressed="${i===state.scene}"><span class="scene-number">0${i+1}</span><span><strong>${s[1]}</strong><small>${sceneReady[i]?s[2]:'建構中 · 敬請期待'}</small></span><span class="chosen" aria-hidden="true">${sceneReady[i]?(i===state.scene?'✓':'→'):'⋯'}</span></button>`).join('');

function mix() {
 engine?.mix({playing:state.playing&&!state.loading,real:state.real,layer:Math.min(state.slide,5),panorama:state.slide===ALL,solo:true,volume:state.volume,gateOpen:state.gateOpen,muted:state.muted,includeMind:state.includeMind,blend:state.slide===BLEND?state.focus:null});
}
function statusText() {
 if(state.message)return state.message;
 if(state.loading)return state.gateOpen?'正在載入這裡的聲音…':'正在準備五個內在聲音…';
 if(!state.gateOpen)return state.playing?`${state.muted.filter(v=>!v).length} 個念頭交疊中 · 點選念頭，先放下。`:state.gateStarted?'已暫停。安放全部念頭，才能出發。':'戴上耳機，按下開始。';
 if(state.slide===0)return '中心已安靜。準備好，從呼吸出發。';
 if(!state.playing)return '已暫停 · 照自己的步調。';
 if(state.real)return '聆聽你所在的真實環境。';
 if(state.guided)return `自動引導 · ${Math.max(0,60-Math.floor(state.stageTime))} 秒後前進`;
 if(state.slide===BLEND)return `${layers[Math.round(state.focus)][0]} 為主 · 其餘層次仍在，中心保持關閉`;
 return state.slide===ALL?(state.includeMind?'六層一起聽 · 也能留白中心。':'中心保持安靜 · 聽身體與世界。'):`只聽 ${layers[state.slide][0]} · 其餘圈保持安靜`;
}
function render() {
 const s=state.slide,all=s===ALL,blend=s===BLEND,lead=Math.round(state.focus),quiet=s===0&&state.gateOpen;
 document.documentElement.style.setProperty('--scene-rgb',sceneColors[state.scene]);
 document.body.classList.toggle('playing',state.playing&&!state.loading);
 document.body.classList.toggle('paused',!state.playing);
 document.body.classList.toggle('blend',blend);
 document.body.classList.toggle('loading-audio',state.loading);
 $('#slideEnglish').textContent=blend?'08 / BLEND':all?'07 / ALL TOGETHER':`${String(s+1).padStart(2,'0')} / ${layers[s][0]}`;
 $('#sceneShort').textContent=scenes[state.scene][1];
 $('#slideTitle').textContent=quiet?'安靜，回來了。':copy[s][0];
 $('#slideDescription').textContent=quiet?'聽見剛剛騰出的空間了嗎？下一圈，回到自己的呼吸。':all&&!state.includeMind?'留白中心，讓其餘五個層次一起展開。':copy[s][1];
 $('#centerEnglish').textContent=blend?layers[lead][0]:all?'TOGETHER':layers[s][0];
 $('#centerWord').textContent=blend?layers[lead][2]:all?'共鳴':s===0?(quiet?'安靜':'紛擾'):layers[s][2];
 $('#sphereCaption').textContent=blend?'滑過每一圈，換一種比例。':all?'世界就在這裡。':quiet?'留白，然後出發。':'由內向外，慢慢聽。';
 $('#sphere').setAttribute('aria-label',blend?`六層交融聆聽，目前以 ${layers[lead][0]} 為主，中心 I THINK 保持關閉`:all?(state.includeMind?'六層球體全部亮起':'外在五層亮起，中心保持安靜'):quiet?'中心已熄滅，下一步是 I AM':`第 ${s+1} 層 ${layers[s][0]} 亮起，其餘層次保持安靜`);
 document.querySelectorAll('.sphere-ring').forEach((g,i)=>{
  const active=blend?i>0:all?(i>0||state.includeMind):(s===i&&!quiet);
  g.classList.toggle('active',active);g.classList.toggle('current',s===i&&!all&&!blend);g.classList.toggle('passed',i<state.furthest);
  g.classList.toggle('all-lit',all&&active);g.classList.toggle('blend-lit',blend&&active);g.classList.toggle('lead',blend&&i===lead);
  g.querySelector('.ring-hit').style.cursor=blend?'crosshair':canGo(i)?'pointer':'default';
 });
 document.querySelectorAll('.progress button').forEach((b,i)=>{b.disabled=!canGo(i);b.classList.toggle('active',i===s);b.classList.toggle('visited',i<=state.furthest);b.setAttribute('aria-current',i===s?'step':'false')});
 $('#thoughtControls').hidden=s!==0||state.gateOpen;
 $('#quietPanel').hidden=!quiet;
 $('#listeningCue').hidden=s===0||all||blend;
 $('#wholeOptions').hidden=!all;
 $('#blendPanel').hidden=!blend;
 $('#blendFocus').value=lead;$('#blendFocusName').textContent=layers[lead][0];
 $('#includeMind').checked=state.includeMind;$('#includeMind').disabled=state.real;
 $('#cueText').textContent=s===1?'此刻，聽見真實錄音裡的自然呼吸。':s>=2&&s<=5?`此刻：${scenes[state.scene][4][s-2]}。`:'';
 if(s>=1&&s<=5&&state.real)$('#cueText').textContent=layers[s][5];
 document.querySelectorAll('[data-mute]').forEach((b,i)=>{b.disabled=state.muted[i];b.classList.toggle('quiet',state.muted[i]);b.querySelector('.voice-indicator').textContent=state.muted[i]?'✓':'×'});
 $('#status').textContent=statusText();$('#pageCount').textContent=`${String(s+1).padStart(2,'0')} / 08`;
 $('#loadingOverlay').setAttribute('aria-hidden',state.loading?'false':'true');
 $('#loadingTitle').textContent=state.gateOpen?'正在載入這裡的聲音':'正在準備內在聲音';
 $('#loadingDetail').textContent=state.gateOpen?'音檔準備好就會自動開始。':'第一次播放需要一點時間，正在喚醒五個聲音。';
 $('#previous').disabled=s===0;
 $('#next').disabled=!state.gateOpen;
 $('#nextLabel').textContent=s===0?'從呼吸出發':s===5?'全部亮起':all?'交融聆聽':blend?'再走一次':'下一層';
 $('#playIcon').textContent=state.loading?'×':state.playing?'Ⅱ':'▶';
 $('#playLabel').textContent=state.loading?'取消載入':state.playing?'暫停':!state.gateStarted&&!state.gateOpen?'開始體驗':quiet?'停留片刻':all?'聆聽全部':blend?'聆聽交融':'聆聽這一圈';
 $('#play').disabled=quiet;
 $('#volumeLabel').textContent=`音量 ${state.volume}%`;$('#volumeOutput').textContent=state.volume+'%';
 $('#realMode').disabled=!state.gateOpen;$('#realMode').setAttribute('aria-pressed',state.real);
 $('#realMode').firstChild.textContent=state.real?'✓ 正在聆聽真實環境 ':'聆聽真實環境 ';
 $('#autoGuide').disabled=!state.gateOpen;$('#autoGuide').setAttribute('aria-pressed',state.guided);
 $('#autoGuide').firstChild.textContent=state.guided?'停止自動引導 ':'六分鐘自動引導 ';
 $('#settingsHint').textContent=state.gateOpen?'自動引導從 I AM 出發，每分鐘前進一圈，最後停在全景。':'先安放五個念頭，便能開啟這兩種練習。';
 document.querySelectorAll('.scene-choice').forEach((b,i)=>{b.setAttribute('aria-pressed',i===state.scene);if(sceneReady[i])b.querySelector('.chosen').textContent=i===state.scene?'✓':'→'});
 mix();
}
function animateSlide() {
 const panel=$('.slide-panel');panel.classList.remove('entering');requestAnimationFrame(()=>panel.classList.add('entering'));
}
function stop(clearMessage=true) {
 state.request++;state.playing=false;state.loading=false;if(clearMessage)state.message='';render();
}
async function start() {
 const ticket=++state.request;state.message='';
 if(state.real&&state.gateOpen){state.playing=true;state.loading=false;render();return}
 try {
  engine??=new SoundField();
  // Resume synchronously within the user's click, before network awaits (iOS).
  const resume=engine.ctx.resume();state.loading=true;state.playing=false;render();await resume;
  let ready;
  if(!state.gateOpen)ready=await engine.prepareMind(state.muted);
  else {
   const requests=[engine.prepare(state.scene)];
   if(state.slide===ALL&&state.includeMind)requests.push(engine.prepareAllMind());
   ready=(await Promise.all(requests)).every(Boolean);
  }
  if(ticket!==state.request||!ready)return;
  state.playing=true;state.loading=false;if(!state.gateOpen)state.gateStarted=true;render();
 } catch {
  if(ticket!==state.request)return;
  state.playing=false;state.loading=false;state.message='聲音載入失敗，請確認連線後再按播放。';render();
 }
}
function changeSlide(to,{autoplay=true,fromGuide=false}={}) {
 if(!canGo(to))return;
 state.request++;state.loading=false;state.slide=to;state.stageTime=0;state.message='';if(!fromGuide)state.guided=false;
 if(to===BLEND)state.focus=BLEND_HOME;
 if(to===0&&state.gateOpen){state.playing=false;render()}
 else if(autoplay)start();else{state.playing=false;render()}
 animateSlide();
}
function next(fromGuide=false) {
 if(!state.gateOpen)return;
 if(state.slide===BLEND){resetExperience();return}
 const to=state.slide+1;state.furthest=Math.max(state.furthest,to);changeSlide(to,{fromGuide});
}
function muteThought(index) {
 if(state.gateOpen)return;
 if(index===null)state.muted.fill(true);else state.muted[index]=true;
 engine?.closeThought(index);
 if(state.muted.every(Boolean)){
  state.request++;state.gateOpen=true;state.playing=false;state.loading=false;state.message='';state.furthest=Math.max(state.furthest,1);
  render();$('#next').focus({preventScroll:true});return;
 }
 render();
}
function resetExperience() {
 stop();engine?.resetMind();state.slide=0;state.furthest=0;state.gateOpen=false;state.gateStarted=false;state.muted.fill(false);state.real=false;state.guided=false;state.includeMind=true;state.stageTime=0;state.focus=BLEND_HOME;
 animateSlide();start();
}
function openSheet(id){$('#'+id).showModal()}
$('#play').onclick=()=>state.playing||state.loading?stop():start();
$('#next').onclick=()=>next();
$('#previous').onclick=()=>changeSlide(state.slide-1,{autoplay:state.playing||state.loading});
$('#progress').onclick=e=>{const b=e.target.closest('[data-slide]');if(b&&!b.disabled)changeSlide(+b.dataset.slide)};
let ignoreSphereClickUntil=0;
$('#sphere').onclick=e=>{if(state.slide===BLEND||performance.now()<ignoreSphereClickUntil)return;const c=e.target.closest('[data-jump]');if(c)changeSlide(+c.dataset.jump)};
// Blend sweeping: map the pointer's distance from the centre onto the ring radii
// (r = 30 + i*21 in the 320x320 viewBox) and keep it off I THINK at the core.
function focusFromPointer(event) {
 const rect=$('#sphere').getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 const scale=Math.min(rect.width,rect.height)/320;
 const x=(event.clientX-rect.left-(rect.width-320*scale)/2)/scale;
 const y=(event.clientY-rect.top-(rect.height-320*scale)/2)/scale;
 return Math.min(5,Math.max(1,(Math.hypot(x-160,y-160)-30)/21));
}
function setFocus(value) {
 if(value===null||!Number.isFinite(value))return;
 const next=Math.round(value*100)/100;
 if(next===state.focus)return;
 const wasLead=Math.round(state.focus);state.focus=next;
 const lead=Math.round(next);
 if(lead!==wasLead){
  document.querySelectorAll('.sphere-ring').forEach((g,i)=>g.classList.toggle('lead',i===lead));
  $('#blendFocus').value=lead;$('#blendFocusName').textContent=layers[lead][0];
  $('#centerEnglish').textContent=layers[lead][0];$('#centerWord').textContent=layers[lead][2];
  $('#sphere').setAttribute('aria-label',`六層交融聆聽，目前以 ${layers[lead][0]} 為主，中心 I THINK 保持關閉`);
  $('#status').textContent=statusText();
 }
 mix();
}
$('#sphereZone').addEventListener('pointermove',e=>{if(state.slide===BLEND)setFocus(focusFromPointer(e))});
$('#sphereZone').addEventListener('pointerdown',e=>{if(state.slide===BLEND)setFocus(focusFromPointer(e))});
// A mouse leaving the sphere hands the lead back to I DON'T KNOW; a lifted finger keeps its place.
$('#sphereZone').addEventListener('pointerleave',e=>{if(state.slide===BLEND&&e.pointerType==='mouse')setFocus(BLEND_HOME)});
$('#blendFocus').oninput=()=>setFocus(Number($('#blendFocus').value));
$('#thoughtControls').onclick=e=>{const b=e.target.closest('[data-mute]');if(b&&!b.disabled)muteThought(+b.dataset.mute)};
$('#quietAll').onclick=()=>muteThought(null);
$('#replayMind').onclick=()=>resetExperience();
$('#includeMind').onchange=()=>{state.includeMind=$('#includeMind').checked;if(state.playing||state.loading)start();else render()};
$('#sceneButton').onclick=()=>openSheet('sceneDialog');
$('#helpButton').onclick=()=>openSheet('helpDialog');
$('#settingsButton').onclick=()=>openSheet('settingsDialog');
$('#sceneList').onclick=e=>{
 const b=e.target.closest('[data-scene]');if(!b||b.disabled)return;
 const selected=+b.dataset.scene,changed=selected!==state.scene;state.scene=selected;$('#sceneDialog').close();
 if(changed&&state.gateOpen&&(state.playing||state.loading))start();else render();
};
$('#volume').oninput=()=>{state.volume=Number($('#volume').value);render()};
$('#realMode').onclick=()=>{if(!state.gateOpen)return;const wasPlaying=state.playing||state.loading;stop();state.real=!state.real;render();if(wasPlaying)start()};
$('#autoGuide').onclick=()=>{
 if(!state.gateOpen)return;
 if(state.guided){state.guided=false;render();return}
 state.guided=true;state.furthest=Math.max(state.furthest,1);$('#settingsDialog').close();changeSlide(1,{fromGuide:true});
};
let editKey=null;
$('#notesButton').onclick=()=>{editKey=noteKey();$('#noteLabel').textContent=`${scenes[state.scene][1]} · ${slideName(state.slide)}`;$('#notes').value=notes[editKey]||'';openSheet('notesDialog')};
$('#notes').oninput=()=>{if(editKey===null)return;notes[editKey]=$('#notes').value;try{localStorage.setItem('sound-spheres-notes',JSON.stringify(notes));$('#saveStatus').textContent='已儲存在此瀏覽器。'}catch{$('#saveStatus').textContent='無法儲存，請先匯出。'}};
$('#download').onclick=()=>{
 let txt='# 我的聲音球體\n\n'+new Date().toLocaleString('zh-TW')+'\n\n';
 for(let s=0;s<5;s++)for(const l of [0,1,2,3,4,5,'all','blend'])if(notes[`${s}-${l}`])txt+=`## ${scenes[s][1]} / ${l==='all'?'全部一起聽':l==='blend'?'交融聆聽':layers[l][0]}\n${notes[`${s}-${l}`]}\n\n`;
 const url=URL.createObjectURL(new Blob([txt],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='我的聲音球體.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()}}));
document.addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.altKey||e.metaKey||e.ctrlKey)return;
 if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();next()}
 if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();changeSlide(state.slide-1,{autoplay:state.playing})}
 if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();state.playing||state.loading?stop():start()}
});
let gesture=null;
$('#sphereZone').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||state.slide===BLEND)return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId}});
$('#sphereZone').addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;if(Math.max(Math.abs(dx),Math.abs(dy))<45)return;ignoreSphereClickUntil=performance.now()+400;if(Math.abs(dx)>Math.abs(dy)?dx<0:dy<0)next();else changeSlide(state.slide-1,{autoplay:state.playing})});
$('#sphereZone').addEventListener('pointercancel',()=>gesture=null);
let previousTick=performance.now();
setInterval(()=>{
 const now=performance.now(),delta=(now-previousTick)/1000;previousTick=now;
 if(!state.playing||state.loading||!state.guided||document.querySelector('dialog[open]'))return;
 state.stageTime+=delta;
 if(state.stageTime>=60){if(state.slide<ALL)next(true);else{state.guided=false;stop();state.message='六分鐘練習完成。留下一筆，帶回生活。';render()}}
 else $('#status').textContent=statusText();
},250);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state.playing||state.loading))stop()});
let lastMeter=0;
function meter(now){if(now-lastMeter>100){lastMeter=now;const level=engine&&state.playing&&!state.real?engine.level():0;$('#signalFill').style.width=Math.min(100,Math.max(0,(20*Math.log10(level||.00001)+60)/60*100))+'%'}requestAnimationFrame(meter)}
requestAnimationFrame(meter);render();
