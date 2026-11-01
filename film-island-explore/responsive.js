/* One-handed, map-first controls for phones and tablets. */
(() => {
// Keep the page at its designed 1:1 scale: the 3D map has its own pinch zoom, so page zoom only gets players stuck.
// iOS ignores user-scalable=no, so also cancel its pinch gestures, and re-apply the viewport to drop any zoom kept across reloads.
const viewport=document.querySelector('meta[name=viewport]');
function resetZoom(){viewport.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';if('scrollRestoration' in history)history.scrollRestoration='manual';scrollTo(0,0)}
resetZoom();
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1&&!e.target.closest('#world'))e.preventDefault()},{passive:false});
addEventListener('pageshow',resetZoom);addEventListener('orientationchange',()=>setTimeout(resetZoom,250));
const $=s=>document.querySelector(s),sheet=$('#mission'),expand=$('#expandMission');
const compact=matchMedia('(max-width:1100px), (pointer:coarse) and (max-width:1400px)');
const toolbar=$('.top-tools'),utility=document.createElement('div');utility.id='utilityMenu';
// Keep all existing controls and event handlers, while moving secondary actions into a menu.
for(const id of ['musicBtn','soundBtn','libraryBtn','timehouseBtn','hallBtn','aboutBtn'])utility.append($('#'+id));
const more=document.createElement('button');more.id='moreTools';more.type='button';more.innerHTML='☰ <span>更多</span>';more.setAttribute('aria-label','開啟更多功能');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','utilityMenu');toolbar.append(more,utility);
const passport=document.createElement('button');passport.id='compactPassport';passport.textContent='🎟 我的冒險卡';passport.onclick=()=>Game.passport();utility.append(passport);
const festival=document.createElement('button');festival.id='compactFestival';festival.textContent='🏆 金種子影展';festival.onclick=()=>showHighlight('festival');utility.append(festival);
const viewTools=$('.view-tools'),mapButtons=['zoomIn','zoomOut','moodBtn'].map(id=>$('#'+id));
function placeMapTools(){for(const button of mapButtons){if(compact.matches){utility.append(button);const label={zoomIn:'拉近地圖',zoomOut:'拉遠地圖',moodBtn:'片場光線'}[button.id];button.innerHTML=button.textContent.trim()[0]+' <span>'+label+'</span>';}else{viewTools.append(button);button.textContent=button.textContent.trim()[0]}}}
let menuOpen=false,expanded=false,frame;
function menu(value){menuOpen=value;document.body.classList.toggle('tools-open',value&&compact.matches);more.setAttribute('aria-expanded',String(value));more.setAttribute('aria-label',value?'關閉更多功能':'開啟更多功能');if(compact.matches)utility.inert=!value;else utility.inert=false}
more.onclick=()=>menu(!menuOpen);utility.addEventListener('click',e=>{if(e.target.closest('button'))menu(false)});
document.addEventListener('pointerdown',e=>{if(menuOpen&&!toolbar.contains(e.target))menu(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen){menu(false);more.focus()}});
function refresh(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 const open=!sheet.hidden;document.body.classList.toggle('compact-ui',compact.matches);document.body.classList.toggle('sheet-open',compact.matches&&open);document.body.classList.toggle('sheet-expanded',compact.matches&&open&&expanded);
 sheet.classList.toggle('expanded',expanded);expand.setAttribute('aria-expanded',String(expanded));expand.textContent=expanded?'↓ 收合介紹':'↑ 展開介紹';
 // Park the HUD just under the logo, whatever height the logo renders at on this device.
 document.body.style.setProperty('--hud-top',compact.matches?Math.ceil($('.logo-brand').getBoundingClientRect().bottom+10)+'px':'');
 document.body.style.setProperty('--map-obstruction',open?Math.max(innerHeight<=520?140:160,innerHeight*(innerHeight<=520?.36:.33))+'px':($('.game-bottom').getBoundingClientRect().height+12)+'px');
 const dock=$('.game-bottom');dock.inert=compact.matches&&open;
 window.IslandScene?.layout();
 })}
function collapse(){expanded=false;refresh()}
expand.onclick=()=>{expanded=!expanded;refresh()};
new MutationObserver(()=>{if(sheet.hidden)expanded=false;refresh()}).observe(sheet,{attributes:true,attributeFilter:['hidden']});
compact.addEventListener('change',()=>{placeMapTools();menu(false);if(!compact.matches)expanded=false;refresh()});
addEventListener('resize',refresh);$('.logo-brand img').addEventListener('load',refresh);window.visualViewport?.addEventListener('resize',refresh);
window.MobileLayout={refresh,collapse,state:()=>({compact:compact.matches,expanded,menuOpen})};placeMapTools();menu(false);refresh();
})();
