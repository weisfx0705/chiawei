/* Original procedural arcade score: eight-bar call-and-response, drums, and springy synths. */
(() => {
const KEY='film-island-score-v1';let enabled=true;try{enabled=localStorage.getItem(KEY)!=='off'}catch{}
let ctx,master,compressor,noiseBuffer,timer,next=0,step=0,mode='explore',started=false,generation=0;
const pauses=new Set(),voices=new Set();
const melodies=[
 [76,79,84,0,83,79,76,74],[77,81,84,86,84,81,79,0],
 [76,79,81,84,83,81,79,76],[74,79,83,86,84,83,79,0],
 [84,83,79,76,79,84,88,0],[86,84,81,77,81,84,89,86],
 [81,77,74,77,81,84,86,81],[79,83,86,89,88,86,84,0]
];
const harmony=[[48,0],[53,0],[57,1],[55,0],[48,0],[53,0],[50,1],[55,0]];
function track(node,cleanup){voices.add(node);node.onended=()=>{voices.delete(node);cleanup()}}
function tone(midi,t,len,gain,type='triangle',slide=0){const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(440*Math.pow(2,(midi-69)/12),t);if(slide)o.frequency.exponentialRampToValueAtTime(440*Math.pow(2,(midi+slide-69)/12),t+len);filter.type='lowpass';filter.frequency.value=type==='square'?2600:3800;o.connect(filter);filter.connect(g);g.connect(master);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.start(t);o.stop(t+len+.02);track(o,()=>{o.disconnect();g.disconnect();filter.disconnect()})}
function drum(kind,t,accent=1){const g=ctx.createGain();g.connect(master);
 if(kind==='kick'){const o=ctx.createOscillator();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(47,t+.14);o.connect(g);g.gain.setValueAtTime(.15*accent,t);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.start(t);o.stop(t+.2);track(o,()=>{o.disconnect();g.disconnect()})}
 else{const n=ctx.createBufferSource(),f=ctx.createBiquadFilter();n.buffer=noiseBuffer;f.type=kind==='hat'?'highpass':'bandpass';f.frequency.value=kind==='hat'?6500:1800;f.Q.value=.8;n.connect(f);f.connect(g);const duration=kind==='hat'?.035:.105;g.gain.setValueAtTime((kind==='hat'?.018:.075)*accent,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.start(t);n.stop(t+duration+.01);track(n,()=>{n.disconnect();f.disconnect();g.disconnect()})}
}
function schedule(){if(!ctx||ctx.state!=='running'||!enabled||pauses.size||document.hidden)return;if(next<ctx.currentTime-.2)next=ctx.currentTime+.025;
 while(next<ctx.currentTime+.12){const bar=Math.floor(step/16)%8,i=step%16,section=Math.floor(step/128)%2,[root,minor]=harmony[bar],beat=60/(mode==='cinema'?116:148)/4;
  if(mode==='cinema'){
   if(i%4===0){for(const n of [root+24,root+(minor?27:28),root+31])tone(n,next,.25,.025,'square');tone(root,next,.3,.09)}
   if(i===4||i===12)drum('snare',next,.7);if(i%2===0)tone(root+36+[0,minor?3:4,7,12][(i/2)%4],next,.15,.025,'triangle');
  }else{
   if(i%2===0){const melody=section===0?melodies[bar][i/2]:root+24+[0,minor?3:4,7,12,7,minor?3:4,14,7][i/2];if(melody){tone(melody,next,.14,.055,'square');tone(melody+12,next,.075,.012,'sine')}}
   if(i%4===0)tone(root+(i===8?12:0),next,.17,.095);if(i%4===2)tone(root+7,next,.12,.055);
   if(i===0||i===8||i===14&&bar%2===1)drum('kick',next);if(i===4||i===12)drum('snare',next);
   if(i%2===1)drum('hat',next,i===15?1.4:.7);
   if(i===15&&bar%2===1)tone(root+43,next,.13,.025,'sine',7);
  }
  next+=beat*(mode==='explore'?(i%2? .93:1.07):1);step=(step+1)%256;
 }
}
function stop(){generation++;clearInterval(timer);timer=null;if(master&&ctx){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.035)}for(const v of voices){try{v.stop(ctx.currentTime+.12)}catch{}}}
async function run(){if(!started||!enabled||pauses.size||document.hidden){stop();return}if(timer&&ctx?.state==='running')return;const ticket=++generation;
 try{ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();if(!master){master=ctx.createGain();master.gain.value=0;compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.006;compressor.release.value=.15;master.connect(compressor);compressor.connect(ctx.destination);noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1}
  await ctx.resume();if(ticket!==generation||!enabled||pauses.size||document.hidden)return;master.gain.setTargetAtTime(.46,ctx.currentTime,.12);next=ctx.currentTime+.035;clearInterval(timer);timer=setInterval(schedule,50);schedule();
 }catch{enabled=false;render()}
}
function render(){const b=document.getElementById('musicBtn');if(b){b.setAttribute('aria-pressed',String(enabled));b.innerHTML=`${enabled?'♫':'♩'} <span>配樂${enabled?'開':'關'}</span>`;b.title=enabled?'關閉合成配樂':'開啟合成配樂'}}
window.FilmMusic={start(){started=true;run()},toggle(){started=true;enabled=!enabled;try{localStorage.setItem(KEY,enabled?'on':'off')}catch{}render();run()},pause(reason){pauses.add(reason);stop()},resume(reason){if(pauses.delete(reason))run()},mode(value){if(mode===value)return;mode=value;step=0;stop();if(started)run()},state(){return{enabled,mode,paused:pauses.size>0,started,running:!!timer,bpm:mode==='cinema'?116:148}}};
document.addEventListener('pointerdown',()=>FilmMusic.start(),{once:true});document.addEventListener('visibilitychange',()=>document.hidden?FilmMusic.pause('hidden'):FilmMusic.resume('hidden'));render();
})();
