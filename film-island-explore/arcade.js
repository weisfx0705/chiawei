/* Challenge mode: one classic mini-game per role island, each tied to a course on that island. */
(() => {
'use strict';
const $=s=>document.querySelector(s),D=EXPLORE,role=id=>D.roles.find(r=>r.id===id);
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const rand=(a,b)=>a+Math.random()*(b-a),starText=n=>'★'.repeat(n)+'☆'.repeat(3-n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Audio: tiny synth, shared by every game ---------- */
let ctx;
function audio(){try{ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();return ctx}catch{return null}}
const soundOn=()=>opts?.sound?.()!==false;
function tone(freq,dur=.14,type='sine',vol=.06,when=0,slide){const a=audio();if(!a)return;const t=a.currentTime+when,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.03);o.onended=()=>{o.disconnect();g.disconnect()}}
function noise(dur=.3,freq=1800,vol=.08,when=0,type='bandpass'){const a=audio();if(!a)return;const t=a.currentTime+when,len=Math.ceil(a.sampleRate*dur),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=buf;f.type=type;f.frequency.value=freq;g.gain.value=vol;s.connect(f);f.connect(g);g.connect(a.destination);s.start(t);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect()}}
const sfx={
 ok(){if(soundOn()){tone(880,.09,'triangle',.05);tone(1320,.12,'triangle',.045,.07)}},
 bad(){if(soundOn())tone(220,.2,'square',.03,0,140)},
 tick(accent){if(soundOn())tone(accent?1568:1046,.045,'square',accent?.03:.018)},
 cut(){if(soundOn()){noise(.06,4200,.12,0,'highpass');tone(1760,.05,'triangle',.03)}},
 pop(){if(soundOn())tone(520,.08,'sine',.05,0,900)},
 win(){if(soundOn())[523,659,784,1047,1319].forEach((f,i)=>tone(f,.22,'triangle',.055,i*.09))},
 lose(){if(soundOn())[392,330,262].forEach((f,i)=>tone(f,.25,'triangle',.05,i*.14))}
};

/* ---------- Overlay shell ---------- */
const root=document.createElement('div');root.id='arcade';root.className='arcade';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','arcadeTitle');
root.innerHTML='<div class="arcade-cabinet"><header class="arcade-top"><span class="arcade-badge" id="arcadeBadge" aria-hidden="true"></span><div class="arcade-name"><small id="arcadeKicker"></small><b id="arcadeTitle"></b></div><div class="arcade-hud" id="arcadeHud" aria-live="polite"></div><button class="arcade-x" id="arcadeClose" type="button" aria-label="離開遊戲，回到島上">✕</button></header><div class="arcade-stage" id="arcadeStage"></div></div>';
document.body.append(root);
const stage=$('#arcadeStage'),hudEl=$('#arcadeHud');
let opts=null,current=null,run=0,timers=[],frames=[],offs=[],hudState={},inerted=[],lastFocus=null;

function teardown(){run++;timers.forEach(t=>{clearTimeout(t);clearInterval(t)});frames.forEach(cancelAnimationFrame);offs.forEach(f=>f());timers=[];frames=[];offs=[];hudState={};hudEl.innerHTML=''}
function hud(patch){Object.assign(hudState,patch);hudEl.innerHTML=Object.entries(hudState).filter(([,v])=>v!=null).map(([k,v])=>`<span class="chip chip-${k}">${v}</span>`).join('')}
function makeApi(){
 const token=run,alive=()=>token===run&&!root.hidden;
 const api={
  stage,hud,sfx,tone,noise,alive,
  later(fn,ms){const t=setTimeout(()=>alive()&&fn(),ms);timers.push(t);return t},
  loop(fn){let last=performance.now();const step=now=>{if(!alive())return;const dt=Math.min(.05,(now-last)/1000);last=now;if(fn(dt,now)!==false)frames.push(requestAnimationFrame(step))};frames.push(requestAnimationFrame(step))},
  on(el,ev,fn,o){el.addEventListener(ev,fn,o);offs.push(()=>el.removeEventListener(ev,fn,o))},
  timer(sec,onEnd){let left=sec,stopped=false;const show=()=>hud({time:`⏱ ${Math.max(0,left)}`});show();const iv=setInterval(()=>{if(stopped||!alive())return;left--;show();if(left<=5&&left>0)sfx.tick(false);if(left<=0){stopped=true;clearInterval(iv);onEnd()}},1000);timers.push(iv);return{stop(){stopped=true;clearInterval(iv)},add(d){left=Math.max(1,left+d);show()},get left(){return left}}},
  win(n,detail){if(alive())result(true,n,detail)},
  lose(detail){if(alive())result(false,0,detail)}
 };
 return api;
}

function open(id,options){
 const g=GAMES[id];if(!g)return;opts=options||{};current=id;lastFocus=document.activeElement;
 const r=role(id);root.style.setProperty('--role',r.color);$('#arcadeBadge').textContent=r.icon;$('#arcadeKicker').textContent=`闖關 STAGE · ${r.name}島`;$('#arcadeTitle').textContent=g.name;
 inerted=[...document.body.children].filter(el=>el!==root&&el.tagName!=='SCRIPT'&&!el.inert);inerted.forEach(el=>el.inert=true);
 root.hidden=false;document.body.classList.add('in-arcade');intro();
}
function close(){if(root.hidden)return;teardown();root.hidden=true;document.body.classList.remove('in-arcade');inerted.forEach(el=>el.inert=false);inerted=[];const o=opts;opts=null;current=null;o?.onClose?.();lastFocus?.focus?.({preventScroll:true})}
function course(id){const g=GAMES[id];return role(id).courses[g.course]}
function intro(){
 teardown();const id=current,g=GAMES[id],c=course(id);
 stage.innerHTML=`<div class="arcade-intro"><div class="ai-poster"><span class="ai-icon" aria-hidden="true">${g.icon}</span><span class="ai-genre">經典玩法｜${g.genre}</span></div><div class="ai-copy"><h3>${g.name}</h3><p>${g.pitch}</p><ol>${g.how.map(s=>`<li>${s}</li>`).join('')}</ol><div class="ai-course"><small>🎓 這關對應課程</small><b>《${c.name}》</b><span>${c.type} · ${c.learn}</span></div>${opts.best?`<p class="ai-best">最佳紀錄 <b>${starText(opts.best)}</b></p>`:''}${g.note?`<p class="ai-note">${g.note}</p>`:''}<button class="arcade-go" id="arcadeGo" type="button">▶ 開始闖關</button></div></div>`;
 $('#arcadeGo').onclick=()=>{audio();play()};$('#arcadeGo').focus({preventScroll:true});
}
function play(){teardown();stage.innerHTML='';const api=makeApi();GAMES[current].mount(api)}
function result(win,n,detail){
 teardown();const id=current,g=GAMES[id],c=course(id);
 if(win){sfx.win();opts.onWin?.(n)}else sfx.lose();
 const firstClear=win&&!opts.done;
 stage.innerHTML=`<div class="arcade-result ${win?'win':'lose'}">${win&&!reduced()?'<div class="ar-confetti" aria-hidden="true">'+Array.from({length:22},(_,i)=>`<i style="--x:${rand(2,98).toFixed(1)}%;--d:${rand(0,.5).toFixed(2)}s;--h:${Math.floor(rand(0,360))};--r:${Math.floor(rand(-200,200))}deg"></i>`).join('')+'</div>':''}<div class="ar-burst" aria-hidden="true">${win?'🏆':'🎬'}</div><h3>${win?'過關！CUT，這條 OK！':'差一點點！再來一條！'}</h3>${win?`<div class="ar-stars" aria-label="獲得 ${n} 顆星">${[0,1,2].map(i=>`<span class="${i<n?'on':''}" style="--d:${i*.18}s">★</span>`).join('')}</div>`:''}<p class="ar-detail">${detail||''}</p><div class="ar-lesson"><small>🎓 你剛剛練習的，就是《${c.name}》的核心能力</small><p>${g.lesson}</p></div><div class="ar-actions">${firstClear?`<button class="arcade-go" id="arClaim" type="button">🎁 領取${esc(opts.gear||'裝備')} →</button><button class="arcade-ghost" id="arRetry" type="button">↻ 再玩一次</button>`:win?`<button class="arcade-go" id="arBack" type="button">回到島上 →</button><button class="arcade-ghost" id="arRetry" type="button">↻ 再玩一次</button>`:`<button class="arcade-go" id="arRetry" type="button">↻ 再挑戰一次</button><button class="arcade-ghost" id="arBack" type="button">回到島上看課程</button>`}</div></div>`;
 $('#arRetry').onclick=play;if($('#arBack'))$('#arBack').onclick=close;
 if($('#arClaim'))$('#arClaim').onclick=()=>{const o=opts;close();o?.onClaim?.()};
 (stage.querySelector('.arcade-go')).focus({preventScroll:true});
}
$('#arcadeClose').onclick=close;
root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});

/* ---------- Shot-size illustrations for the storyboard memory game ---------- */
function person(color){return `<g><rect x="-8" y="60" width="6.6" height="37" rx="3" fill="#2d3159"/><rect x="1.4" y="60" width="6.6" height="37" rx="3" fill="#2d3159"/><ellipse cx="-5" cy="98" rx="5" ry="2.4" fill="#1d1b2c"/><ellipse cx="5" cy="98" rx="5" ry="2.4" fill="#1d1b2c"/><rect x="-18" y="28" width="5.5" height="29" rx="2.7" fill="${color}"/><rect x="12.5" y="28" width="5.5" height="29" rx="2.7" fill="${color}"/><circle cx="-15.2" cy="58" r="3" fill="#ffd4ad"/><circle cx="15.2" cy="58" r="3" fill="#ffd4ad"/><path d="M-13 27Q0 22 13 27L11.5 63H-11.5Z" fill="${color}"/><rect x="-3" y="18" width="6" height="8" fill="#f2be93"/><circle cx="0" cy="11" r="10" fill="#ffd4ad"/><path d="M-10.4 11Q-11 -.5 0 -.5Q11 -.5 10.4 11Q7 4.5 0 5Q-7 4.5-10.4 11Z" fill="#2a2238"/><circle cx="-3.7" cy="11.6" r="1.5" fill="#1d1b2c"/><circle cx="3.7" cy="11.6" r="1.5" fill="#1d1b2c"/><circle cx="-3.2" cy="11" r=".5" fill="#fff"/><circle cx="4.2" cy="11" r=".5" fill="#fff"/><circle cx="-6.4" cy="14.6" r="1.6" fill="#ff9f9f" opacity=".6"/><circle cx="6.4" cy="14.6" r="1.6" fill="#ff9f9f" opacity=".6"/><path d="M-2.6 15.6Q0 17.6 2.6 15.6" stroke="#8a4a3c" stroke-width=".9" fill="none" stroke-linecap="round"/></g>`}
const SHOTS=[
 {k:'els',name:'大遠景',en:'ELS',hint:'人很小，環境最大',s:.2,ty:70},
 {k:'fs',name:'全景',en:'FS',hint:'從頭到腳都看得到',s:.88,ty:6},
 {k:'ms',name:'中景',en:'MS',hint:'腰部以上',s:1.45,ty:8},
 {k:'mcu',name:'近景',en:'MCU',hint:'胸口以上',s:2.3,ty:6},
 {k:'cu',name:'特寫',en:'CU',hint:'臉部填滿畫面',s:3.8,ty:4},
 {k:'ecu',name:'大特寫',en:'ECU',hint:'只看得見眼睛',s:14,ty:-112}
];
function shotSvg(shot,color){const wide=shot.s<1;return `<svg viewBox="0 0 160 100" role="img" aria-label="${shot.name}畫面"><defs><linearGradient id="sky-${shot.k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wide?'#8fd0ff':'#ffe9c7'}"/><stop offset="1" stop-color="${wide?'#d9f1ff':'#ffd7a8'}"/></linearGradient></defs><rect width="160" height="100" fill="url(#sky-${shot.k})"/>${wide?`<circle cx="128" cy="22" r="10" fill="#ffd45c"/><path d="M0 78L30 48L52 66L82 36L118 72L140 56L160 70V100H0Z" fill="#8cc58a"/><path d="M0 86Q80 76 160 88V100H0Z" fill="#63a86a"/>${shot.k==='els'?'<circle cx="40" cy="76" r="6" fill="#3f8a55"/><rect x="39" y="80" width="2" height="7" fill="#7a5638"/>':''}`:''}<g transform="translate(80 ${shot.ty}) scale(${shot.s})">${person(color)}</g><rect x="1" y="1" width="158" height="98" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" rx="4"/></svg>`}

/* ---------- The eight games ---------- */
const GAMES={
dir:{name:'分鏡翻牌大考驗',genre:'記憶翻牌',icon:'🎬',course:1,
 pitch:'導演開拍前要先畫分鏡。把六種「景別名稱」和它的「畫面」配成一對！',
 how:['翻開兩張牌，名稱和畫面相符就配對成功','六組全部配對就過關，限時 90 秒','步數越少，星星越多'],
 lesson:'分鏡師用「景別」決定觀眾和角色的距離：遠景交代環境、全景看見動作、特寫放大情緒。先把文字轉成這些鏡頭，劇組才知道要怎麼拍。',
 mount(api){
  const color=role('dir').color,deck=shuffle(SHOTS.flatMap(s=>[{s,face:'img'},{s,face:'txt'}]));let first=null,lock=false,moves=0,pairs=0;
  api.hud({pairs:`🃏 0 / 6`,moves:'步數 0'});
  api.stage.innerHTML=`<div class="mm-wrap"><p class="game-tip">翻牌找出相同景別的「名稱」和「畫面」</p><div class="mm-grid">${deck.map((c,i)=>`<button class="mm-card" data-i="${i}" type="button" aria-label="第 ${i+1} 張牌，尚未翻開"><span class="mm-inner"><span class="mm-back"><b>🎬</b><small>SHOT ${String(i+1).padStart(2,'0')}</small></span><span class="mm-face ${c.face}">${c.face==='img'?shotSvg(c.s,color):`<b>${c.s.name}</b><em>${c.s.en}</em><small>${c.s.hint}</small>`}</span></span></button>`).join('')}</div></div>`;
  const cards=[...api.stage.querySelectorAll('.mm-card')];
  const t=api.timer(90,()=>api.lose(`時間到！配對了 ${pairs} / 6 組景別。多看一眼「人在畫面裡有多大」，再試一次！`));
  cards.forEach(el=>api.on(el,'click',()=>{
   const c=deck[+el.dataset.i];if(lock||el.classList.contains('open'))return;el.classList.add('open');el.setAttribute('aria-label',`${c.s.name}${c.face==='img'?'的畫面':'（名稱）'}`);api.sfx.pop();
   if(!first){first=el;return}
   moves++;api.hud({moves:`步數 ${moves}`});const a=deck[+first.dataset.i],prev=first;first=null;
   if(a.s.k===c.s.k&&a.face!==c.face){prev.classList.add('matched');el.classList.add('matched');pairs++;api.sfx.ok();api.hud({pairs:`🃏 ${pairs} / 6`});
    if(pairs===6){t.stop();const n=moves<=11?3:moves<=16?2:1;api.later(()=>api.win(n,`${moves} 步完成六組景別配對，還剩 ${t.left} 秒。`),650)}}
   else{lock=true;api.later(()=>{prev.classList.remove('open');el.classList.remove('open');prev.setAttribute('aria-label','翻回的牌');el.setAttribute('aria-label','翻回的牌');lock=false},780)}
  }));
 }},

cam:{name:'點亮片場',genre:'點燈解謎（Lights Out）',icon:'💡',course:1,
 pitch:'每盞燈一打開，光就會灑到上下左右的鄰居。想辦法把整個片場的燈全部點亮！',
 how:['點一盞燈：它和上下左右的燈都會切換開／關','全部燈都亮起，這場戲就曝光正確；共兩場（3×3、4×4），限時 120 秒','卡關就按「💡 看提示」：它會標出下一盞該按的燈。跟著提示也能過關，順便學會規律！'],
 lesson:'燈光師打一盞燈，從來不只影響一個點——光會溢散到周圍。控制光的方向、範圍與明暗，讓畫面亮在該亮的地方，就是燈光課每天在練的事。',
 mount(api){
  const rounds=[{n:3,k:3},{n:4,k:4}];let r=0,board,start,need,moves=0,total=0,par=0,hints=0,busy=false,nudge=false,hinted=-1;
  const t=api.timer(120,()=>api.lose(`時間到！完成了 ${r} / 2 場。記得：每盞燈都會影響上下左右。`));
  const idx=(x,y,n)=>y*n+x;
  function press(b,i,n){const x=i%n,y=Math.floor(i/n);[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<n&&Y<n)b[idx(X,Y,n)]^=1})}
  function setup(){const {n,k}=rounds[r];do{board=Array(n*n).fill(1);need=Array(n*n).fill(0);shuffle([...Array(n*n).keys()]).slice(0,k).forEach(i=>{press(board,i,n);need[i]^=1})}while(board.every(v=>v));start=[...board];moves=0;par+=k;nudge=false;hinted=-1;const round=r;api.later(()=>{if(r===round&&!busy){nudge=true;$('#loHint')?.classList.add('nudge')}},14000);draw()}
  function draw(){const {n}=rounds[r],lit=board.filter(Boolean).length/board.length;
   api.hud({round:`第 ${r+1} / 2 場`,moves:`步數 ${total+moves}`});
   api.stage.innerHTML=`<div class="lo-wrap"><div class="lo-monitor" style="--lit:${lit}"><div class="lo-scene"><span class="lo-actor">🧍</span><span class="lo-prop a">🪴</span><span class="lo-prop b">🛋️</span><span class="lo-prop c">🖼️</span></div><div class="lo-meter"><span>曝光</span><span class="lo-track"><i style="width:${Math.round(lit*100)}%"></i></span><b>${Math.round(lit*100)}%</b></div><small>監看螢幕 · SCENE ${r+1}</small></div><div class="lo-side"><button type="button" class="lo-hint ${nudge||moves>=rounds[r].k+4?'nudge':''}" id="loHint"><b>💡 卡關了？看提示</b><small>標出下一盞該按的燈（+2 步）</small></button><div class="lo-grid" style="--n:${n}">${board.map((v,i)=>`<button class="lo-lamp ${v?'on':''} ${i===hinted?'hint':''}" data-i="${i}" type="button" aria-label="第 ${Math.floor(i/n)+1} 排第 ${i%n+1} 盞燈，${v?'亮':'暗'}" aria-pressed="${!!v}"><span></span></button>`).join('')}</div><div class="lo-tools"><button type="button" id="loReset">↺ 重來這場</button></div></div></div>`;
   api.stage.querySelectorAll('.lo-lamp').forEach(el=>el.onclick=()=>tap(+el.dataset.i));
   $('#loReset').onclick=()=>{if(busy)return;board=[...start];need=[...startNeed];hinted=-1;draw()};
   $('#loHint').onclick=()=>{if(busy)return;const opts=need.map((v,i)=>v?i:-1).filter(i=>i>=0);if(!opts.length)return;moves+=2;hints++;hinted=opts[0];draw()};
  }
  let startNeed;
  function tap(i){if(busy)return;const {n}=rounds[r];press(board,i,n);need[i]^=1;moves++;if(i===hinted)hinted=-1;api.sfx.tick(board[i]);draw();
   if(board.every(v=>v)){busy=true;total+=moves;api.sfx.ok();api.stage.querySelector('.lo-monitor').classList.add('perfect');
    api.later(()=>{busy=false;r++;if(r<rounds.length){setup();startNeed=[...need]}else{t.stop();const extra=total-par,n=extra<=2?3:extra<=8?2:1;api.win(n,`兩場都曝光正確！共 ${total} 步（參考步數 ${par}）${hints?`，用了 ${hints} 次提示`:''}。`)}},1000)}}
  setup();startNeed=[...need];
 }},

art:{name:'穿幫大搜查',genre:'找不同',icon:'🔍',course:0,
 pitch:'同一場戲隔天補拍，房間的陳設卻被動過了！在兩個鏡頭之間找出 5 個不一樣的地方。',
 how:['比較「第一天」與「隔天補拍」兩個鏡頭','點擊不一樣的位置（左右兩邊都可以點）','點錯扣 3 秒，限時 60 秒'],
 lesson:'鏡頭一換，桌上的杯子就不見了？這就是「穿幫」。美術組會拍照、記錄每一件陳設，讓場景在每一顆鏡頭裡都一致——從美術設計到場景製作，細節決定觀眾信不信。',
 mount(api){
  const rows=[['🖼️','🕰️','📅','🪞','🎐','🏮','🎨'],['📚','🏺','🕯️','📻','🌵','📷','⏰','🧴'],['☕','🍎','📖','🧁','✉️','🔑','👓','🥤'],['🪑','🧸','🪴','📦','🎸','👟','☂️','🧺','🐈']];
  const A=[];rows.forEach(pool=>{const p=shuffle(pool),gap=Math.floor(Math.random()*5);for(let x=0;x<5;x++)A.push(x===gap?'':p[x])});
  const B=[...A],diffs=shuffle([...A.keys()]).slice(0,5);
  diffs.forEach(i=>{const pool=rows[Math.floor(i/5)],row=A.slice(Math.floor(i/5)*5,Math.floor(i/5)*5+5);if(!A[i])B[i]=shuffle(pool.filter(e=>!row.includes(e)))[0];else if(Math.random()<.3)B[i]='';else B[i]=shuffle(pool.filter(e=>!row.includes(e)))[0]});
  let found=new Set(),misses=0;api.hud({found:'🔍 0 / 5'});
  const panel=(arr,label,side)=>`<figure class="sd-panel"><figcaption>${label}</figcaption><div class="sd-room">${arr.map((e,i)=>`<button class="sd-cell" data-i="${i}" data-side="${side}" type="button" aria-label="${side==='a'?'第一天':'隔天'}鏡頭，第 ${Math.floor(i/5)+1} 排第 ${i%5+1} 格${e?'':'（空）'}">${e?`<span>${e}</span>`:''}</button>`).join('')}</div></figure>`;
  api.stage.innerHTML=`<div class="sd-wrap"><p class="game-tip">左右兩張劇照有 5 處不同，點出來！</p><div class="sd-panels">${panel(A,'🎬 鏡頭 A · 第一天','a')}${panel(B,'🎬 鏡頭 B · 隔天補拍','b')}</div></div>`;
  const t=api.timer(60,()=>api.lose(`時間到！找到 ${found.size} / 5 處穿幫。試著一排一排比對。`));
  api.stage.querySelectorAll('.sd-cell').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;if(found.has(i))return;
   if(diffs.includes(i)){found.add(i);api.stage.querySelectorAll(`.sd-cell[data-i="${i}"]`).forEach(c=>c.classList.add('found'));api.sfx.ok();api.hud({found:`🔍 ${found.size} / 5`});
    if(found.size===5){t.stop();const n=misses<=1&&t.left>=25?3:misses<=4?2:1;api.later(()=>api.win(n,`5 處穿幫全部抓到！點錯 ${misses} 次，還剩 ${t.left} 秒。`),600)}}
   else{misses++;t.add(-3);api.sfx.bad();el.classList.remove('miss');void el.offsetWidth;el.classList.add('miss')}});
 }},

snd:{name:'Boom 收音不穿幫',genre:'拖曳定位挑戰',icon:'🎙️',course:1,
 pitch:'攝影機框住了演員，你是收音師！把 Boom 麥克風舉到「畫框外、但離嘴巴最近」的位置，錄完三條鏡頭。',
 how:['拖曳畫面（或用方向鍵）移動 Boom 麥克風','麥克風任何一部分碰到或太貼近畫框都算穿幫 NG；離太遠則會收進太多噪音','三條鏡頭（中景、近景、移動特寫）至少兩條 OK 就過關'],
 note:'🎓 改編自課程教材〈電影同步錄音基本態度〉的 Boom 互動練習。',
 lesson:'同步錄音追求最高的「訊噪比」：麥克風越靠近嘴巴，人聲越清楚、環境噪音越少；可是一進入畫面就穿幫。收音師永遠在畫框邊緣，找那個「最近又看不見」的位置。',
 mount(api){
  const takes=[{name:'中景',h:72},{name:'近景',h:50},{name:'移動特寫',h:32,drift:.08}];
  let take=-1,phase='idle',phaseT=0,sum=0,samples=0,passes=0,ngs=0,qualities=[],mic={x:40,y:9999},W=0,H=0,frame={},mouth={},state='';
  api.hud({take:'第 1 / 3 條',ok:'OK 0',ng:'NG 0'});
  api.stage.innerHTML=`<div class="bm-wrap"><div class="bm-bar"><div class="bm-status" id="bmStatus"><b>架好 Boom！</b><small>拖曳麥克風到畫框外最靠近嘴巴的位置</small></div><div class="bm-snr" aria-label="訊噪比"><small>SNR</small><span id="bmSnr">${'<i></i>'.repeat(5)}</span></div></div><div class="bm-stage" id="bmStage"><svg class="bm-actor" id="bmActor" aria-hidden="true"></svg><svg class="bm-svg" id="bmSvg" aria-hidden="true"></svg><div class="bm-frame" id="bmFrame"><span>🎥 CAMERA FRAME 16:9</span><i class="bm-rec" id="bmRec">● REC</i></div><div class="bm-cue" id="bmCue"></div><div class="bm-take"><i id="bmTakeBar"></i></div></div></div>`;
  const st=$('#bmStage'),svg=$('#bmSvg'),actor=$('#bmActor'),fr=$('#bmFrame'),cue=$('#bmCue'),status=$('#bmStatus'),bars=[...api.stage.querySelectorAll('#bmSnr i')],takeBar=$('#bmTakeBar');
  function layout(t=0){W=st.clientWidth;H=st.clientHeight;const k=takes[Math.max(0,take)],s=Math.min(H*.0085,W*.9/128),fh=k.h*s,fw=fh*16/9;
   const actorX=W/2,top=Math.max(26+7*s,H*.54-30*s);mouth={x:actorX,y:top+15.6*s};
   const cx=Math.max(fw/2+8,Math.min(W-fw/2-8,actorX+(k.drift?Math.sin(t*1.3)*W*k.drift:0))),ft=top-fh*.1;frame={l:cx-fw/2,t:ft,r:cx+fw/2,b:ft+fh};
   fr.style.cssText=`left:${frame.l}px;top:${frame.t}px;width:${fw}px;height:${fh}px`;
   return {actorX,top,s}}
  function draw(){const {actorX,top,s}=layout(phase==='rec'?phaseT:0);const ang=Math.atan2(mouth.y-mic.y,mouth.x-mic.x)*180/Math.PI;
   const pose=`translate(${actorX} ${top}) scale(${s})`;if(actor.dataset.pose!==pose){actor.dataset.pose=pose;actor.innerHTML=`<g transform="${pose}">${person('#8668a1')}</g>`}svg.innerHTML=`<g transform="translate(${mic.x} ${mic.y}) rotate(${ang})"><rect x="-1400" y="-2.5" width="1390" height="5" rx="2.5" fill="#9aa3c7"/><rect x="-12" y="-5" width="6" height="10" rx="2" fill="#2b2f55"/><rect x="-8" y="-11" width="40" height="22" rx="11" class="bm-mic ${state}"/><path d="M-4 -11v22M4 -11v22M12 -11v22M20 -11v22" stroke="#0002" stroke-width="2"/></g>`}
  // Test the whole drawn capsule (axis x 3–21 in mic space, radius 11) plus its mount, not just the pivot:
  // any part within PAD px of the frame (its 3px border included) is visible on camera.
  function measure(){const PAD=6,a=Math.atan2(mouth.y-mic.y,mouth.x-mic.x),ux=Math.cos(a),uy=Math.sin(a);
   const gap=(x,y)=>Math.hypot(Math.max(frame.l-x,0,x-frame.r),Math.max(frame.t-y,0,y-frame.b));
   let clear=gap(mic.x-9*ux,mic.y-9*uy)-5;for(let k=3;k<=21;k+=2)clear=Math.min(clear,gap(mic.x+k*ux,mic.y+k*uy)-11);
   if(clear<PAD)return{ng:true,edge:clear>=0,q:0};
   const tip={x:mic.x+32*ux,y:mic.y+32*uy},d=Math.hypot(tip.x-mouth.x,tip.y-mouth.y),dmin=Math.min(mouth.y-frame.t,frame.b-mouth.y,mouth.x-frame.l,frame.r-mouth.x)+PAD;
   return{ng:false,q:Math.max(0,Math.min(1,1-(d-dmin)/(H*.3)))}}
  function feedback(r){state=r.ng?'ng':r.q>=.82?'best':r.q>=.6?'good':'far';
   status.className='bm-status '+state;status.innerHTML=r.ng?(r.edge?'<b>太貼框了！算穿幫</b><small>手一晃就會入鏡，留一點安全距離</small>':'<b>穿幫了！麥克風進入畫面</b><small>Mic in frame — 往畫框外移一點</small>'):r.q>=.82?'<b>完美位置！Sweet Spot</b><small>又近又看不見，人聲最清楚</small>':r.q>=.6?'<b>尚可 Good</b><small>再靠近畫框邊緣一點</small>':'<b>太遠了！噪音太多</b><small>Too far — 貼近畫框邊緣，靠近嘴巴</small>';
   const lv=r.ng?5:Math.round(r.q*5);bars.forEach((b,i)=>{b.className=i<lv?(r.ng?'on ng':r.q>=.6?'on':'on far'):''})}
  function setMic(x,y){mic.x=Math.max(8,Math.min(W-8,x));mic.y=Math.max(8,Math.min(H-8,y))}
  // On touch, hold the mic a little above the finger so it stays visible.
  const fromEvent=e=>{const r=st.getBoundingClientRect();setMic(e.clientX-r.left,e.clientY-r.top-(e.pointerType==='touch'?40:0))};
  api.on(st,'pointerdown',e=>{fromEvent(e);try{st.setPointerCapture(e.pointerId)}catch{}});api.on(st,'pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)fromEvent(e)});
  api.on(document,'keydown',e=>{const d={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}[e.key];if(d){e.preventDefault();setMic(mic.x+d[0],mic.y+d[1])}});
  function say(t,cls=''){cue.textContent=t;cue.className='bm-cue show '+cls}
  function nextTake(){take++;if(take>=takes.length){const avg=qualities.length?qualities.reduce((a,b)=>a+b,0)/qualities.length:0;phase='done';
    if(passes>=2){const n=passes===3&&avg>=.85?3:passes===3?2:1;api.win(n,`三條鏡頭 OK ${passes} 條、NG ${ngs} 條，平均收音品質 ${Math.round(avg*100)}%。`)}else api.lose(`OK ${passes} 條、NG ${ngs} 條。記得：麥克風要「貼著畫框外緣」，越靠近嘴巴越好，但不能進框！`);return}
   phase='setup';phaseT=0;sum=0;samples=0;fr.classList.remove('rolling','ng','ok');api.hud({take:`第 ${take+1} / 3 條`});say(`第 ${take+1} 條・${takes[take].name}　架好 Boom！`)}
  function endTake(ok,q){phase='between';phaseT=0;fr.classList.remove('rolling');fr.classList.add(ok?'ok':'ng');if(ok){passes++;qualities.push(q);api.sfx.ok();say(`CUT！OK，收音品質 ${Math.round(q*100)}%`,'ok')}else{ngs++;api.sfx.bad();say(q<0?'NG！穿幫了，重來下一條':`NG！收音品質 ${Math.round(q*100)}%，太遠了`,'ng')}api.hud({ok:`OK ${passes}`,ng:`NG ${ngs}`})}
  layout();mic={x:W*.12,y:H*.92};
  api.loop(dt=>{if(phase==='done')return false;phaseT+=dt;draw();const r=measure();feedback(r);
   if(phase==='setup'){const left=3-phaseT;if(left<=0){phase='rec';phaseT=0;fr.classList.add('rolling');say('ACTION！維持位置…','rec');api.sfx.tick(true)}else if(phaseT>1.2)say(`${Math.ceil(left)}…`)}
   else if(phase==='rec'){takeBar.style.width=Math.min(100,phaseT/6*100)+'%';if(r.ng){endTake(false,-1);return}sum+=r.q*dt;samples+=dt;if(phaseT>=6){const q=sum/samples;endTake(q>=.7,q)}}
   else if(phase==='between'){takeBar.style.width='0%';if(phaseT>1.6)nextTake()}});
  nextTake();
 }},

edt:{name:'節拍剪接台',genre:'節奏遊戲',icon:'✂️',course:0,
 pitch:'剪接點跟著節拍滑進來。在它碰到紅色 CUT 線的瞬間下刀，剪出有節奏感的段落！',
 how:['白色剪接點碰到紅色 CUT 線時，點擊畫面或按空白鍵','Perfect、Good 都算剪中','16 個剪接點剪中 11 個以上就過關'],
 lesson:'剪在哪一格，決定節奏和情緒。剪輯師常跟著音樂、動作或對白的節拍下刀，用鏡頭的順序與長度把觀眾的心跳帶著走。',
 mount(api){
  const beat=60/92,beats=[0,2,3,4,6,7,7.5,8,10,11,12,12.5,14,15,15.5,16],times=beats.map(b=>b*beat),labels=['遠景','中景','特寫','反應','空鏡','插入','近景','全景'],palette=['#ff7a59','#ffc94a','#5cc8ff','#9b7bff','#4fd1a5','#ff6fa8','#f4a261','#7bdff2'];
  const judged=times.map(()=>null);let hits=0,perfect=0,speed=210,t0,ended=false;
  const a=audio(),clock=()=>a?a.currentTime:performance.now()/1000;
  api.hud({hits:`✂ 0 / 16`,judge:null});
  const clips=times.map((t,i)=>{const from=i?times[i-1]:t-beat*2;return `<div class="rh-clip" style="left:${from*speed}px;width:${(t-from)*speed}px;--c:${palette[i%8]}"><span>${labels[i%8]}</span></div>`}).join('')+`<div class="rh-clip" style="left:${times[15]*speed}px;width:${beat*3*speed}px;--c:${palette[0]}"><span>END</span></div>`;
  api.stage.innerHTML=`<div class="rh-wrap" id="rhWrap"><div class="rh-monitor"><span id="rhShot">🎬</span><b id="rhCount">準備</b></div><div class="rh-track" id="rhTrack"><div class="rh-ruler"></div><div class="rh-reel" id="rhReel">${clips}${times.map((t,i)=>`<i class="rh-mark" data-i="${i}" style="left:${t*speed}px"></i>`).join('')}</div><div class="rh-audio"></div><div class="rh-line"><b>CUT</b></div><div class="rh-judge" id="rhJudge"></div></div><button class="rh-button" id="rhCut" type="button">✂ CUT（空白鍵）</button></div>`;
  const reel=$('#rhReel'),track=$('#rhTrack'),judgeEl=$('#rhJudge'),marks=[...api.stage.querySelectorAll('.rh-mark')];
  const lineX=()=>track.clientWidth*.24;
  t0=clock()+beat*4+.25;
  if(a&&soundOn())for(let b=-4;b<=17;b++){const at=t0+b*beat-a.currentTime;if(at>0){const accent=b%4===0;tone(accent?1568:1046,.04,'square',b<0?.035:.018,at)}}
  for(let b=-4;b<0;b++)api.later(()=>{$('#rhCount').textContent=String(-b)},Math.max(0,(t0+b*beat-clock())*1000));
  api.later(()=>{$('#rhCount').textContent='剪！'},Math.max(0,(t0-clock())*1000));
  function show(text,cls){judgeEl.textContent=text;judgeEl.className='rh-judge '+cls;void judgeEl.offsetWidth;judgeEl.classList.add('pop')}
  function mark(i,kind){judged[i]=kind;marks[i].classList.add(kind==='miss'?'miss':'hit');if(kind!=='miss'){hits++;api.hud({hits:`✂ ${hits} / 16`});$('#rhShot').textContent=['🌄','🧍','👀','😮','🌫️','✉️','🙂','🏙️'][(i+1)%8]}}
  function cut(){if(ended)return;const now=clock()-t0;let best=-1,bd=9;times.forEach((t,i)=>{if(judged[i])return;const d=Math.abs(now-t);if(d<bd){bd=d;best=i}});
   if(best<0||bd>.3){show('空剪','idle');return}
   if(bd<=.09){perfect++;mark(best,'perfect');api.sfx.cut();show('PERFECT','perfect')}else if(bd<=.18){mark(best,'good');api.sfx.cut();show('GOOD','good')}else{mark(best,'miss');show(now<times[best]?'太早':'太晚','miss')}}
  api.on($('#rhCut'),'pointerdown',e=>{e.preventDefault();cut()});api.on(track,'pointerdown',e=>{e.preventDefault();cut()});
  api.on(document,'keydown',e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(!e.repeat)cut()}});
  api.loop(()=>{const now=clock()-t0;reel.style.transform=`translateX(${lineX()-now*speed}px)`;
   times.forEach((t,i)=>{if(!judged[i]&&now-t>.3){mark(i,'miss');show('MISS','miss')}});
   if(!ended&&judged.every(Boolean)&&now>times[15]+.7){ended=true;
    if(hits>=11){const n=hits>=15?3:hits>=13?2:1;api.win(n,`剪中 ${hits} / 16 個剪接點，其中 ${perfect} 個 PERFECT。`)}else api.lose(`剪中 ${hits} / 16 個。跟著「滴、滴、滴」的節拍器一起數拍子，會更準！`);return false}});
 }},

pro:{name:'製片補給大作戰',genre:'接物遊戲',icon:'📋',course:1,
 pitch:'外景就要開拍！移動補給推車，接住劇組需要的資源，閃開下雨、超支和延誤。',
 how:['拖曳畫面或按 ← → 移動推車','✅ 綠圈是補給（🎥 器材、🔋 電池、🍱 便當、📝 許可、🎤 收音、💡 燈具）：接住 +1','❌ 紅圈是風險（🌧 下雨、💸 超支、⏰ 延誤）：碰到失去一顆心；45 秒內接滿 15 個補給就過關'],
 lesson:'製片要在時間、預算與人力之間取捨：把需要的資源準時送到片場，同時避開超支和延誤的風險。規劃通告、盤點預算，就是讓電影「拍得成」的能力。',
 mount(api){
  const good={'🎥':'器材','🔋':'電池','🍱':'便當','📝':'許可','🎤':'收音','💡':'燈具'},bad={'🌧':'下雨','💸':'超支','⏰':'延誤'},G=Object.keys(good),B=Object.keys(bad);let items=[],score=0,lives=3,cartX=.5,target=.5,keys=0,spawn=0,elapsed=0,over=false,live=false,t=null;
  api.hud({score:'📦 0 / 15',lives:'❤❤❤'});
  api.stage.innerHTML=`<div class="ct-wrap" id="ctWrap"><div class="ct-sky"><span class="ct-sign">🎬 外景片場</span></div><div class="ct-legend"><span class="good"><b>✅ 接住 +1</b>${G.join(' ')}</span><span class="bad"><b>❌ 閃開 −❤</b>${B.join(' ')}</span></div><div class="ct-ready" id="ctReady"><b>準備開拍！</b><p><span class="good">綠圈 = 劇組需要的補給，接住 +1</span><span class="bad">紅圈 = 下雨、超支、延誤，碰到 −❤</span></p><em id="ctCount">3</em></div><div class="ct-field" id="ctField"></div><div class="ct-cart" id="ctCart"><span>🛒</span><small>製片車</small></div><div class="ct-pop" id="ctPop"></div></div>`;
  const field=$('#ctField'),wrap=$('#ctWrap'),cart=$('#ctCart');
  [2,1].forEach((n,i)=>api.later(()=>{$('#ctCount').textContent=n},(i+1)*900));api.later(()=>{$('#ctReady').classList.add('gone');live=true;t=api.timer(45,()=>end(false,`時間到！接到 ${score} / 15 個補給。`))},2700);
  function end(win,detail){if(over)return;over=true;t?.stop();if(win){const n=lives;api.later(()=>api.win(n,detail),400)}else api.later(()=>api.lose(detail),400)}
  const setTarget=e=>{const r=wrap.getBoundingClientRect();target=Math.min(.95,Math.max(.05,(e.clientX-r.left)/r.width))};
  api.on(wrap,'pointerdown',e=>{setTarget(e);try{wrap.setPointerCapture(e.pointerId)}catch{}});api.on(wrap,'pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)setTarget(e)});
  api.on(document,'keydown',e=>{if(e.key==='ArrowLeft'){keys=-1;e.preventDefault()}if(e.key==='ArrowRight'){keys=1;e.preventDefault()}});
  api.on(document,'keyup',e=>{if((e.key==='ArrowLeft'&&keys<0)||(e.key==='ArrowRight'&&keys>0))keys=0});
  function pop(text,x,cls){const p=$('#ctPop');p.textContent=text;p.className='ct-pop show '+cls;p.style.left=x*100+'%'}
  api.loop(dt=>{if(over)return false;const W=wrap.clientWidth,H=wrap.clientHeight;
   if(keys)target=Math.min(.95,Math.max(.05,target+keys*dt*.9));cartX+=(target-cartX)*Math.min(1,dt*14);cart.style.left=cartX*100+'%';
   if(!live)return;elapsed+=dt;spawn-=dt;if(spawn<=0){spawn=Math.max(.42,.85-elapsed*.009);const isBad=Math.random()<.32,e=isBad?B[Math.floor(Math.random()*B.length)]:G[Math.floor(Math.random()*G.length)],el=document.createElement('span');el.className='ct-item '+(isBad?'bad':'good');el.innerHTML=`<b>${e}</b><i>${isBad?'✕':'+1'}</i>`;field.append(el);items.push({el,e,x:rand(.06,.94),y:-40,v:rand(150,210)+elapsed*3.2,bad:isBad})}
   const cartTop=H-78,cw=Math.max(70,W*.14);
   items=items.filter(it=>{it.y+=it.v*dt;it.el.style.transform=`translate(${it.x*W}px,${it.y}px)`;
    if(it.y>cartTop-30&&it.y<cartTop+20&&Math.abs(it.x*W-cartX*W)<cw/2+12){it.el.remove();
     if(it.bad){lives--;api.sfx.bad();pop(`−❤ ${bad[it.e]}！`,it.x,'bad');cart.classList.remove('hurt');void cart.offsetWidth;cart.classList.add('hurt');api.hud({lives:'❤'.repeat(lives)+'♡'.repeat(3-lives)});if(lives<=0)end(false,`推車被風險擊倒了！接到 ${score} 個補給。製片也要學會「閃」——避開風險同樣重要。`)}
     else{score++;api.sfx.ok();pop(`+1 ${good[it.e]}`,it.x,'good');api.hud({score:`📦 ${score} / 15`});if(score>=15)end(true,`接滿 15 個補給，剩下 ${lives} 顆心、${t?.left??0} 秒，準時開拍！`)}
     return false}
    if(it.y>H+20){it.el.remove();return false}return true})});
 }},

mkt:{name:'找對觀眾打地鼠',genre:'打地鼠',icon:'📣',course:1,
 pitch:'首映宣傳開跑！觀眾一個個從座位冒出來，只點「這部片的目標觀眾」。',
 how:['看清楚上方的片名與目標觀眾','點冒出來的目標觀眾 +1；點錯 −1','三部片、每部 15 秒，總分 12 分以上過關'],
 lesson:'行銷不是對所有人大喊，而是先找到「誰最想看」，再決定說什麼、在哪裡說。分析觀眾、規劃宣傳與數位發行，作品才能遇見它的觀眾。',
 mount(api){
  const types={horror:['👻','驚悚迷'],romance:['💕','愛情迷'],scifi:['🚀','科幻迷'],music:['🎵','音樂迷'],sport:['⚽','運動迷'],family:['🧸','親子觀眾'],food:['🍜','美食迷']};
  const films=[{title:'《午夜的錄音帶》',genre:'驚悚短片',target:['horror']},{title:'《夏日和弦》',genre:'青春音樂愛情片',target:['music','romance']},{title:'《小行星搬家記》',genre:'科幻動畫',target:['scifi','family']}];
  let round=-1,score=0,holes=Array(9).fill(null),spawnT=0,live=false,remain=15,all=Object.keys(types);
  api.hud({score:'🎯 0 分',round:null,time:null});
  api.stage.innerHTML=`<div class="wm-wrap"><div class="wm-brief" id="wmBrief"></div><div class="wm-grid">${holes.map((_,i)=>`<button class="wm-hole" data-i="${i}" type="button" aria-label="座位 ${i+1}"><span class="wm-mole"></span><i class="wm-seat"></i></button>`).join('')}</div></div>`;
  const els=[...api.stage.querySelectorAll('.wm-hole')],brief=$('#wmBrief');
  function nextRound(){round++;if(round>=films.length){live=false;const ok=score>=12,n=score>=20?3:score>=16?2:1;ok?api.win(n,`三部片宣傳結束，總分 ${score} 分！`):api.lose(`總分 ${score} 分，差 ${12-score} 分過關。先看清楚每部片的目標觀眾再出手！`);return}
   const f=films[round];live=false;holes.forEach((h,i)=>hide(i));remain=15;
   brief.innerHTML=`<small>第 ${round+1} / 3 部 · ${f.genre}</small><b>${f.title}</b><span>目標觀眾：${f.target.map(k=>`<em>${types[k][0]} ${types[k][1]}</em>`).join('')}</span>`;brief.classList.remove('flash');void brief.offsetWidth;brief.classList.add('flash');
   api.hud({round:`第 ${round+1} / 3 部`,time:`⏱ 15`});api.later(()=>{live=true;tick()},1500)}
  function tick(){if(!live)return;remain--;api.hud({time:`⏱ ${remain}`});if(remain<=0){live=false;api.later(nextRound,700);return}api.later(tick,1000)}
  function hide(i){holes[i]=null;els[i].classList.remove('up','hit','wrong')}
  function show(){const free=holes.map((h,i)=>h?-1:i).filter(i=>i>=0);if(!free.length)return;const i=free[Math.floor(Math.random()*free.length)],f=films[round],isT=Math.random()<.46,pool=isT?f.target:all.filter(k=>!f.target.includes(k)),k=pool[Math.floor(Math.random()*pool.length)],id=Symbol();
   holes[i]={k,id,target:f.target.includes(k)};els[i].querySelector('.wm-mole').innerHTML=`<b>${types[k][0]}</b><small>${types[k][1]}</small>`;els[i].setAttribute('aria-label',`座位 ${i+1}：${types[k][1]}`);els[i].classList.add('up');api.later(()=>{if(holes[i]?.id===id)hide(i)},Math.max(760,1050-round*110))}
  els.forEach((el,i)=>el.onclick=()=>{const h=holes[i];if(!live||!h||h.hit)return;h.hit=true;if(h.target){score++;api.sfx.ok();el.classList.add('hit')}else{score=Math.max(0,score-1);api.sfx.bad();el.classList.add('wrong')}api.hud({score:`🎯 ${score} 分`});api.later(()=>{if(holes[i]===h)hide(i)},260)});
  api.loop(dt=>{if(!live)return;spawnT-=dt;if(spawnT<=0){spawnT=rand(.5,.72);show()}});
  nextRound();
 }},

res:{name:'影史快問快答',genre:'問答遊戲',icon:'📚',course:0,
 pitch:'五題電影名詞快問快答，每題 15 秒。答對 3 題就過關，每題都有解說！',
 how:['讀題後從四個選項選一個','每題 15 秒，作答後會看到解說','答對 3 題過關，答對越多星星越多'],
 lesson:'蒙太奇、長鏡頭、場面調度……這些詞不是拿來背的，而是拆解電影的工具。學會它們，你就能從「好好看」說到「為什麼這樣拍」。',
 mount(api){
  const bank=[
   {q:'同一張面無表情的臉，接上一碗湯、一副棺材或一個小孩的畫面，觀眾會讀出飢餓、哀傷或溫柔。這個實驗叫做？',a:'庫勒雪夫效應',o:['蝴蝶效應','安慰劑效應','光暈效應'],why:'蘇聯導演庫勒雪夫發現：鏡頭的意義會被前後鏡頭改變——這正是剪接的力量。'},
   {q:'一個鏡頭從頭到尾不剪接、長時間連續拍攝，稱為？',a:'長鏡頭',o:['跳接','定格','溶接'],why:'長鏡頭保留真實的時間流動，讓觀眾跟著角色一起「待在」現場。'},
   {q:'角色突然看向鏡頭，直接對觀眾說話。這種手法叫做？',a:'打破第四面牆',o:['正反拍','越軸','淡出'],why:'舞台的「第四面牆」是隔開角色與觀眾的隱形牆；直接對觀眾說話就是打破它。'},
   {q:'劇中人人都在搶的公事包，觀眾始終不知道裡面是什麼。希區考克稱這種推動劇情、本身不重要的物件為？',a:'麥高芬',o:['蒙太奇','空鏡','景深'],why:'麥高芬（MacGuffin）的重點不是它是什麼，而是它讓角色動起來。'},
   {q:'1895 年，盧米埃兄弟在巴黎公開售票放映短片，常被視為什麼的起點？',a:'電影公開放映',o:['電視廣播','有聲電影','彩色電影'],why:'這場放映常被稱為電影誕生的時刻；有聲與彩色電影要再過數十年才普及。'},
   {q:'拍兩人對話時，攝影機跨過兩人之間的假想線，畫面左右方向突然顛倒。這叫做？',a:'越軸',o:['推軌','搖鏡','變焦'],why:'「180 度假想線」幫觀眾維持方向感；越軸會讓人搞不清楚誰在看誰。'},
   {q:'「場面調度（mise-en-scène）」主要在討論什麼？',a:'畫面裡的佈景、燈光、走位與構圖',o:['只有剪接的順序','電影票房的分配','配樂的旋律'],why:'場面調度源自劇場，指「放進場景裡的一切」——導演如何安排畫面中的每個元素。'},
   {q:'把不同鏡頭剪接在一起，讓它們碰撞出新的意義，這種手法稱為？',a:'蒙太奇',o:['長鏡頭','特寫','空鏡'],why:'蒙太奇（montage）源自法文「組裝」，愛森斯坦等蘇聯導演把它發展成重要理論。'}
  ];
  const qs=shuffle(bank).slice(0,5);let i=0,right=0,timer=null,left=15;
  function ask(){const q=qs[i],options=shuffle([q.a,...q.o]);left=15;
   api.hud({q:`第 ${i+1} / 5 題`,right:`✓ ${right}`,time:'⏱ 15'});
   api.stage.innerHTML=`<div class="qz-wrap"><div class="qz-bar"><i id="qzBar"></i></div><p class="qz-num">QUESTION ${i+1}</p><h3 class="qz-q">${q.q}</h3><div class="qz-options">${options.map((o,k)=>`<button class="qz-opt" type="button" data-o="${esc(o)}"><i>${'ABCD'[k]}</i>${o}</button>`).join('')}</div><div class="qz-why" id="qzWhy" hidden></div></div>`;
   api.stage.querySelectorAll('.qz-opt').forEach(b=>b.onclick=()=>answer(b.dataset.o));api.stage.querySelector('.qz-opt').focus({preventScroll:true});
   clearInterval(timer);timer=setInterval(()=>{if(!api.alive()){clearInterval(timer);return}left--;api.hud({time:`⏱ ${left}`});const bar=$('#qzBar');if(bar)bar.style.width=left/15*100+'%';if(left<=0){clearInterval(timer);answer(null)}},1000)}
  function answer(o){clearInterval(timer);const q=qs[i],ok=o===q.a;if(ok){right++;api.sfx.ok()}else api.sfx.bad();
   api.stage.querySelectorAll('.qz-opt').forEach(b=>{b.disabled=true;if(b.dataset.o===q.a)b.classList.add('right');else if(b.dataset.o===o)b.classList.add('wrong')});
   const why=$('#qzWhy');why.hidden=false;why.innerHTML=`<b>${ok?'✓ 答對了！':o===null?'⏱ 時間到！':'✕ 再想想！'}</b> 答案是「${q.a}」。${q.why}<button class="arcade-go" id="qzNext" type="button">${i<4?'下一題 →':'看結果 →'}</button>`;api.hud({right:`✓ ${right}`});
   $('#qzNext').onclick=()=>{i++;if(i<5)ask();else right>=3?api.win(right-2,`五題答對 ${right} 題！`):api.lose(`五題答對 ${right} 題，差 ${3-right} 題過關。每題的解說都是下次的提示！`)};$('#qzNext').focus({preventScroll:true})}
  offs.push(()=>clearInterval(timer));ask();
 }}
};

function meta(id){return GAMES[id]}
function card(id,record){const g=GAMES[id],c=course(id);return `<section class="arcade-card"><div class="ac-top"><span class="ac-genre">🎮 經典玩法｜${g.genre}</span>${record?`<span class="ac-stars" aria-label="最佳 ${record.stars} 星">${starText(record.stars)}</span>`:''}</div><p class="ac-pitch">${g.pitch}</p><ol class="ac-how">${g.how.map(s=>`<li>${s}</li>`).join('')}</ol><div class="ac-course"><small>🎓 這關練的是</small><b>《${c.name}》</b><span>${c.learn}</span></div></section>`}
window.Arcade={meta,card,open,close,isOpen:()=>!root.hidden,current:()=>current};
})();
