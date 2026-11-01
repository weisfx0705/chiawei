/* Lightweight procedural dioramas. three.js r128, MIT; no model downloads. */
(() => {
const container=document.getElementById('map'), canvas=document.getElementById('world');
try {
const T=THREE, reduced=matchMedia('(prefers-reduced-motion: reduce)');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene(), camera=new T.OrthographicCamera(-25,25,20,-20,.1,200);camera.position.set(0,38,30);camera.lookAt(0,0,0);
const controls=new T.OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minZoom=.7;controls.maxZoom=2.2;controls.minPolarAngle=.4;controls.maxPolarAngle=1.1;controls.minAzimuthAngle=-1;controls.maxAzimuthAngle=1;
controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
const hemi=new T.HemisphereLight('#fff5de','#729f96',.85);scene.add(hemi);const sun=new T.DirectionalLight('#fff2d8',1.1);sun.position.set(-15,35,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25});sun.shadow.bias=-.001;scene.add(sun);
const materials=new Map();function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:new T.Color(c).convertSRGBToLinear(),roughness:.85,flatShading:true}));return materials.get(c)}
function mesh(g,geo,c,x=0,y=0,z=0){const o=new T.Mesh(geo,mat(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
const box=(g,w,h,d,c,x=0,y=0,z=0)=>mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);
const cyl=(g,rt,rb,h,c,x=0,y=0,z=0,n=12)=>mesh(g,new T.CylinderGeometry(rt,rb,h,n),c,x,y,z);
const ball=(g,r,c,x=0,y=0,z=0)=>mesh(g,new T.IcosahedronGeometry(r,1),c,x,y,z);
function rod(g,a,b,r,c){const d=new T.Vector3(...b).sub(new T.Vector3(...a));const o=cyl(g,r,r,d.length(),c);o.position.copy(new T.Vector3(...a).addScaledVector(d,.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o}
function tree(g,x,z,s=1){const t=new T.Group();g.add(t);t.position.set(x,0,z);t.scale.setScalar(s);cyl(t,.12,.17,1.3,'#84674d',0,.7);ball(t,.7,'#7ca66a',0,1.7);ball(t,.55,'#a4bc78',.3,2.1)}
function person(g,x,z,c){const p=new T.Group();p.position.set(x,.2,z);g.add(p);cyl(p,.22,.28,.7,c,0,.5);ball(p,.23,'#e9b78e',0,1.08);ball(p,.23,'#3b393b',0,1.2,-.04);box(p,.14,.4,.15,'#3d5250',-.14,.12);box(p,.14,.4,.15,'#3d5250',.14,.12);return p}
function clapper(g,x=0,y=0,z=0,s=1){const p=new T.Group();p.position.set(x,y,z);p.scale.setScalar(s);g.add(p);box(p,2.8,1.65,.3,'#28433f',0,1);box(p,2.9,.4,.35,'#f9f1dc',0,2.05);for(let i=0;i<5;i++){const stripe=box(p,.22,.42,.37,'#28433f',-1.15+i*.57,2.05);stripe.rotation.z=-.5}for(let i=0;i<2;i++)box(p,1.9,.055,.02,'#eee7cf',0,.75+i*.35,.17);return p}
function cam(g){box(g,2,1.3,1.1,'#28433f',0,2.2);const l=cyl(g,.56,.4,.8,'#4c6660',0,2.2,.9);l.rotation.x=Math.PI/2;const glass=cyl(g,.42,.42,.04,'#9accca',0,2.2,1.32);glass.rotation.x=Math.PI/2;for(let x of [-.6,.6]){const reel=cyl(g,.55,.55,.23,'#dfb56b',x,3,.05);reel.rotation.x=Math.PI/2}for(const [x,z] of [[-1,1],[1,1],[0,-1]])rod(g,[0,1.5,0],[x,.15,z],.08,'#47625a')}
function model(g,id,color){
if(id==='main'){box(g,5.7,2.5,3.5,'#f7e9ce',0,1.35,0);box(g,6, .35,3.8,'#d96b41',0,2.72,0);box(g,5.3,2.3,.2,'#28433f',0,1.6,1.85);const cv=document.createElement('canvas');cv.width=512;cv.height=256;let ctx=cv.getContext('2d');ctx.fillStyle='#28433f';ctx.fillRect(0,0,512,256);ctx.fillStyle='#e8ca84';ctx.textAlign='center';ctx.font='bold 68px sans-serif';ctx.fillText('CREATE',256,105);ctx.fillStyle='#f3efdf';ctx.font='bold 48px sans-serif';ctx.fillText('TOGETHER.',256,175);const face=new T.Mesh(new T.PlaneGeometry(4.5,2.1),new T.MeshBasicMaterial({map:new T.CanvasTexture(cv)}));face.position.set(0,1.6,1.97);g.add(face);box(g,3.4,.14,3.5,'#d96b41',0,.17,3);clapper(g,-2.6,2.9,0,.65);person(g,-2.1,3,'#e4b759');person(g,2,3.2,'#558d9a');tree(g,-3.9,-1,.95);tree(g,3.7,-1,.85);
} else if(id==='dir'){clapper(g,0,.15,0,1.2);box(g,1,.7,.8,'#c88d5e',1.5,.6,1);box(g,1,.7,.15,'#28433f',1.5,1.2,1.3);
} else if(id==='cam'){cam(g);const l=box(g,.9,.9,.35,'#f6dfaa',1.7,2.7,-.8);l.rotation.y=-.3;rod(g,[1.7,.1,-.8],[1.7,2.4,-.8],.06,'#47625a');
} else if(id==='art'){const pal=cyl(g,1.35,1.35,.18,'#e6bc80',0,.5,0,20);pal.scale.z=.7;for(let i=0;i<5;i++){const a=i*1.1;ball(g,.23,['#dc6a50','#759d85','#527f9f','#d5b952','#a87795'][i],Math.cos(a),.7,Math.sin(a)*.6)}rod(g,[-.5,.7,.3],[1.2,2.8,-.3],.12,'#84664e');ball(g,.2,'#d96745',1.2,2.8,-.3);box(g,1.4,2,.16,'#f8eecf',-1.4,1.5,-.8).rotation.z=-.15;
} else if(id==='snd'){const arc=new T.Mesh(new T.TorusGeometry(1.15,.16,8,30,Math.PI),mat('#344d48'));arc.position.set(0,1.6,0);g.add(arc);for(const x of [-1.1,1.1])box(g,.5,1.1,.6,color,x,1.4);cyl(g,.28,.28,.85,'#d6bc8b',0,1.2,1);rod(g,[0,.1,1],[0,.8,1],.06,'#344d48');cyl(g,.5,.5,.1,'#344d48',0,.15,1);
} else if(id==='edt'){box(g,3.4,2.2,.3,'#344d48',0,1.85);box(g,3,1.8,.04,'#a2cabb',0,1.9,.18);for(let j=0;j<3;j++)for(let i=0;i<3;i++)box(g,.65+i*.12,.2,.06,['#deae63','#e37d69','#6c9490'][j],-1+i*.95,1.4+j*.4,.22);box(g,.3,.5,.4,'#344d48',0,.5);box(g,1.8,.13,1,'#344d48',0,.2);box(g,2.5,.1,.9,'#e8d6ac',0,.15,1.1);
} else if(id==='pro'){const clipboard=box(g,2,2.8,.2,'#e7ba71',-.3,1.65);clipboard.rotation.z=.12;box(g,1,.3,.24,'#344d48',-.3,3.05);for(let i=0;i<4;i++)box(g,1.3,.07,.04,'#8b7757',-.3,1+i*.4,.15);box(g,1.2,.8,1.1,'#8eae8b',1.1,.5,1);box(g,.9,.6,.9,'#cad1a5',1.1,1.2,1);
} else if(id==='mkt'){const horn=cyl(g,.9,.35,1.7,'#df9478',0,1.9);horn.rotation.z=-Math.PI/2;const end=cyl(g,.72,.72,.05,'#344d48',.87,1.9);end.rotation.z=Math.PI/2;rod(g,[-.3,.2,0],[-.3,1.5,0],.17,'#344d48');box(g,1.5,.15,1.1,'#d9bc7c',0,.15);
} else if(id==='res'){for(let i=0;i<3;i++){const b=box(g,2.4-i*.15,.35,1.65,['#d69665','#749b94','#dbbe75'][i],0,.4+i*.4);b.rotation.y=i*.16}const ring=new T.Mesh(new T.TorusGeometry(.65,.1,8,24),mat('#344d48'));ring.position.set(.3,2,.6);g.add(ring);rod(g,[.75,1.5,.6],[1.4,.8,.6],.1,'#344d48')}
}
const logoTexture=new T.TextureLoader().load('logo.png');logoTexture.encoding=T.sRGBEncoding;
function sign(g,x,y,z,w=2.4){box(g,w+.24,w*.44+.2,.18,'#2b2838',x,y,z);const logo=new T.Mesh(new T.PlaneGeometry(w,w*.44),new T.MeshBasicMaterial({map:logoTexture,transparent:true,toneMapped:false}));logo.position.set(x,y,z+.101);g.add(logo);rod(g,[x,y-w*.22,z],[x,.2,z],.055,'#776248')}
const items=[{id:'main',name:'共同必修',icon:'🎞',color:'#f2b74c'},...EXPLORE.roles];
const positions=[[0,1],[-12.5,-12.5],[0,-18],[12.5,-12.5],[17.5,2],[12.5,15],[0,19],[-12.5,15],[-17.5,2]];
const islands=[],labels=document.getElementById('labels');
items.forEach((it,i)=>{const [x,z]=positions[i],g=new T.Group();g.position.set(x,i===0?.7:0,z);scene.add(g);const radius=i===0?4.7:3;const rock=cyl(g,radius,radius*.24,4.5,'#ad8964',0,-2.35,0,6);cyl(g,radius,radius,.35,it.color,0,0,0,6);cyl(g,radius*.93,radius*.93,.18,i===0?'#f6d682':'#9dce75',0,.23,0,6);model(g,it.id,it.color);sign(g,i===0?0:0,i===0?4.3:.8,i===0?-1.2:2.7,i===0?3.5:1.6);if(i){tree(g,-2,-1,.75);person(g,1.65,1.55,it.color)}for(let j=0;j<3;j++){const step=box(g,1.5,.18,1,'#f3e3b3',0,-.05-j*.2,radius+.25+j*.55);step.rotation.y=.05*j}g.traverse(o=>{o.userData.island=it.id});const ring=new T.Mesh(new T.TorusGeometry(radius+.25,.075,5,48),new T.MeshBasicMaterial({color:'#ffcc55'}));ring.rotation.x=-Math.PI/2;ring.position.y=.45;g.add(ring);ring.visible=i===0;
const label=document.createElement('button');label.className='island-label'+(i===0?' core active':'');label.dataset.island=it.id;label.innerHTML=`${it.icon} ${it.name}<small>${i===0?'領取飛行證':'小任務 · +100 XP'}</small>`;label.setAttribute('aria-label',`飛往${it.name}島`);label.setAttribute('aria-pressed',String(i===0));labels.append(label);label.onclick=()=>window.Game?.travel(it.id);
islands.push({g,ring,label,id:it.id,base:g.position.y});if(i){const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,-.6,0),new T.Vector3(x*.5,-1.8,z*.5),new T.Vector3(x,-.6,z));const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(40)),new T.LineDashedMaterial({color:'#fff2be',dashSize:.5,gapSize:.45,transparent:true,opacity:.8}));line.computeLineDistances();scene.add(line)}});
// Ferris wheel and cabins: an actual moving landmark above the back of the park.
const wheelBase=new T.Group();wheelBase.position.set(0,-5,-22);wheelBase.scale.setScalar(1.8);scene.add(wheelBase);const wheel=new T.Group();wheelBase.add(wheel);wheel.position.y=6;
for(const z of [-.6,.6]){const ring=new T.Mesh(new T.TorusGeometry(6,.14,7,64),mat('#fff2dc'));ring.position.z=z;wheel.add(ring)}
const cabins=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,x=Math.cos(a)*6,y=Math.sin(a)*6;rod(wheel,[0,0,0],[x,y,0],.055,'#f7d78f');const c=new T.Group();c.position.set(x,y,0);wheel.add(c);box(c,.9,1,1,['#e8a0a8','#85b8d3','#f0cb68','#9abf81'][i%4],0,-.6);box(c,.7,.45,1.04,'#e4f5f4',0,-.4);cabins.push(c)}
rod(wheelBase,[-3,-2,0],[0,6,0],.18,'#eee3c2');rod(wheelBase,[3,-2,0],[0,6,0],.18,'#eee3c2');
// An architectural marquee using the official higher-resolution department wordmark.
const marquee=new T.Group();marquee.position.set(0,15.5,-18);scene.add(marquee);const marqueeFace=new T.Group();marqueeFace.rotation.x=-Math.atan2(38,30);marquee.add(marqueeFace);
function plaque(w,h,r,depth,color,z){const sh=new T.Shape();sh.moveTo(-w/2+r,-h/2);sh.lineTo(w/2-r,-h/2);sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);sh.lineTo(w/2,h/2-r);sh.quadraticCurveTo(w/2,h/2,w/2-r,h/2);sh.lineTo(-w/2+r,h/2);sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);sh.lineTo(-w/2,-h/2+r);sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return mesh(marqueeFace,new T.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSize:.07,bevelThickness:.05,bevelSegments:2,steps:1}),color,0,0,z)}
plaque(15,3.65,.45,.3,'#354d53',-.25);plaque(14.7,3.4,.4,.12,'#cda363',.12);plaque(14.35,3.08,.35,.08,'#fff9eb',.27);
const wordmark=new T.TextureLoader().load('assets/department-logo-official.png');wordmark.encoding=T.sRGBEncoding;wordmark.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const wordmarkFace=new T.Mesh(new T.PlaneGeometry(12.8,12.8*70/418),new T.MeshBasicMaterial({map:wordmark,transparent:true,toneMapped:false}));wordmarkFace.position.z=.43;marqueeFace.add(wordmarkFace);
for(const x of [-7.4,7.4]){rod(marquee,[x,-13,-2],[x,.2,-.1],.13,'#b79b70');ball(marquee,.17,'#f5df9c',x,1.55,.32)}
for(let i=0;i<11;i++)ball(marqueeFace,.065,'#ffe2a1',-6.5+i*1.3,1.62,.31);

// Posters on the actual islands point to real department productions.
const posterLoader=new T.TextureLoader(),crowd=[];
function poster(parent,id,x,y,z,width=2.6){
 const f=FILM_MEDIA.catalog.find(v=>v.id===id);if(!f)return;
 box(parent,width+.18,width*.5625+.18,.16,'#282436',x,y,z);
 const tex=posterLoader.load(f.thumb);tex.encoding=T.sRGBEncoding;
 const screen=new T.Mesh(new T.PlaneGeometry(width,width*.5625),new T.MeshBasicMaterial({map:tex,toneMapped:false}));screen.position.set(x,y,z+.1);screen.userData.media=id;parent.add(screen);
 rod(parent,[x,y-width*.28,z],[x,.3,z],.055,'#e3bd6d');
 return screen;
}
islands.forEach((v,i)=>{const story=FILM_MEDIA.roleMedia[v.id];if(story)poster(v.g,story.id,-2.15,2.4,-1.25,i===0?2.7:2.25);for(let j=0;j<2;j++){const p=person(v.g,-1+j*2,1.8,['#e58d75','#80aacc'][j]);crowd.push(p)}if(i){for(let j=1;j<5;j++){const pos=v.g.position.clone().multiplyScalar(j/5);const flag=mesh(scene,new T.ConeGeometry(.28,.55,3),['#eea583','#cfb6dd','#f4d17a','#98c9ba'][j-1],pos.x,-.8,pos.z);flag.rotation.z=Math.PI;}}});
// Graduation is a physical destination, with a marquee, carpet, seats and spotlights.
const hall=new T.Group();hall.position.set(23,1.2,-23);scene.add(hall);
cyl(hall,5.4,2,5,'#9d7f89',0,-2.5,0,8);cyl(hall,5.4,5.4,.4,'#dcb978',0,.15,0,8);
box(hall,8,5,1.4,'#30263f',0,2.7,-1.6);box(hall,8.6,.4,2,'#e1b95f',0,5.4,-1.6);
poster(hall,FILM_MEDIA.opening,0,3,-.8,5.8);sign(hall,0,5.9,-1,3.3);
for(const x of [-3.5,3.5]){cyl(hall,.28,.36,5,'#f1cd76',x,2.7,-.5);ball(hall,.4,'#fff3b9',x,5.4,-.5)}
box(hall,2.3,.16,6,'#ac3d56',0,.43,2.2);for(let row=0;row<2;row++)for(const x of [-3.1,-2.3,2.3,3.1]){box(hall,.55,.7,.6,'#80475a',x,.8,1.5+row*1.2);box(hall,.55,.6,.16,'#a56471',x,1.15,1.3+row*1.2)}
for(let i=0;i<4;i++)box(hall,2.4+i*.35,.22,.65,'#e2be83',0,-i*.2,5.1+i*.55);
const beams=[];for(const x of [-4.3,4.3]){box(hall,.6,.45,.6,'#292d40',x,.6,2.8);const beam=new T.Mesh(new T.ConeGeometry(1.6,11,16,1,true),new T.MeshBasicMaterial({color:'#ffe5a0',transparent:true,opacity:.085,depthWrite:false,side:T.DoubleSide}));beam.rotation.z=x>0?-.22:.22;beam.position.set(x,6,2.8);hall.add(beam);beams.push(beam)}
hall.traverse(o=>{if(!o.userData.media)o.userData.island='hall'});
const hallLabel=document.createElement('button');hallLabel.className='island-label hall-label';hallLabel.innerHTML='🎓 畢業製作殿堂<small>探索三個方向</small>';hallLabel.setAttribute('aria-label','前往畢業製作殿堂');hallLabel.onclick=()=>window.Game?.enterHall();labels.append(hallLabel);const hallRing=new T.Mesh(new T.TorusGeometry(5.7,.1,5,60),new T.MeshBasicMaterial({color:'#ffc85b'}));hallRing.rotation.x=-Math.PI/2;hallRing.position.y=.5;hall.add(hallRing);islands.push({g:hall,ring:hallRing,label:hallLabel,id:'hall',base:1.2});
// A separate inspiration room beside (not inside) the graduation screening hall.
const timehouse=new T.Group();timehouse.position.set(25,.6,-7);scene.add(timehouse);
cyl(timehouse,3.6,1.4,3.8,'#8f839f',0,-1.9,0,8);cyl(timehouse,3.6,3.6,.3,'#a6d9d5',0,.2,0,8);
const dome=mesh(timehouse,new T.SphereGeometry(2.55,24,12,0,Math.PI*2,0,Math.PI/2),'#b9e1e7',0,.35,-.35);dome.material=new T.MeshStandardMaterial({color:'#8dc8d3',transparent:true,opacity:.36,roughness:.25,depthWrite:false});
for(const x of [-2.4,2.4])cyl(timehouse,.14,.19,3.2,'#e9d39c',x,1.8,0);
const portal=new T.Mesh(new T.TorusGeometry(1.4,.16,8,32),new T.MeshStandardMaterial({color:'#b9ffdc',emissive:'#43b7a5',emissiveIntensity:.6}));portal.position.set(0,1.8,1.3);timehouse.add(portal);
const timehouseScreens=[];const initialFilms=FILM_MEDIA.catalog.filter(f=>f.category==='海外創作').slice(0,3);
for(let i=0;i<3;i++){const screen=poster(timehouse,initialFilms[i].id,(i-1)*1.5,2.6,-.8,1.35);if(screen)timehouseScreens.push(screen)}
const banner=document.createElement('canvas');banner.width=640;banner.height=160;const bg=banner.getContext('2d');bg.fillStyle='#263a46';bg.fillRect(0,0,640,160);bg.fillStyle='#d4f9e6';bg.textAlign='center';bg.font='bold 62px sans-serif';bg.fillText('精神時光屋',320,100);const bannerTex=new T.CanvasTexture(banner);bannerTex.encoding=T.sRGBEncoding;
const nameplate=new T.Mesh(new T.PlaneGeometry(4.2,1.05),new T.MeshBasicMaterial({map:bannerTex,toneMapped:false}));nameplate.position.set(0,4,.2);timehouse.add(nameplate);sign(timehouse,0,.8,3,1.6);
timehouse.traverse(o=>{delete o.userData.media;o.userData.island='timehouse'});
const timehouseLabel=document.createElement('button');timehouseLabel.className='island-label timehouse-label';timehouseLabel.innerHTML='✦ 精神時光屋<small>隨機三部作品</small>';timehouseLabel.setAttribute('aria-label','前往畢業製作精神時光屋');timehouseLabel.onclick=()=>window.Game?.enterTimehouse();labels.append(timehouseLabel);
const timehouseRing=new T.Mesh(new T.TorusGeometry(3.8,.06,6,48),new T.MeshBasicMaterial({color:'#c8f8e7'}));timehouseRing.rotation.x=-Math.PI/2;timehouseRing.position.y=.45;timehouse.add(timehouseRing);islands.push({g:timehouse,ring:timehouseRing,label:timehouseLabel,id:'timehouse',base:.6});
const timehouseTextureCache=new Map();
const regularPositions=islands.map(v=>v.g.position.clone());let shortLayout=false;
const clouds=[];for(let i=0;i<14;i++){const g=new T.Group();for(let j=0;j<4;j++){const o=ball(g,1.5+j*.3,'#fff9f1',j*1.3,0,0);o.scale.y=.5}const a=i/14*Math.PI*2;g.position.set(Math.cos(a)*23,-5,Math.sin(a)*23);scene.add(g);clouds.push(g)}
const balloons=[];for(let i=0;i<3;i++){const g=new T.Group();scene.add(g);g.position.set([-23,23,19][i],8,[-12,-15,16][i]);ball(g,1.8,['#f0b05c','#dd8da1','#82c4ba'][i],0,2.5);cyl(g,1.1,.5,1.8,'#f7dfb3',0,1.2);box(g,.8,.6,.8,'#8d6b54',0,-.4);rod(g,[-.4,-.2,0],[-.6,.8,0],.035,'#f7ebd5');rod(g,[.4,-.2,0],[.6,.8,0],.035,'#f7ebd5');balloons.push(g)}
// Expressive avatar, separate wearable slots, and deployable film-strip glider.
const hero=new T.Group(),bodyRoot=new T.Group();hero.add(bodyRoot);scene.add(hero);hero.scale.setScalar(1.35);hero.position.set(0,1,4);
const shirt=box(bodyRoot,.65,.72,.42,'#fff1dd',0,.93);box(bodyRoot,.52,.22,.4,'#e77e48',0,.55);const legs=[];for(const x of [-.2,.2]){const l=new T.Group();l.position.set(x,.5,0);bodyRoot.add(l);box(l,.19,.45,.22,'#52789e',0,-.2);box(l,.23,.15,.38,'#fff5e7',0,-.48,.08);legs.push(l)}
ball(bodyRoot,.43,'#e9bc95',0,1.65);const hair=ball(bodyRoot,.44,'#44333d',0,1.8,-.08);hair.scale.y=.65;for(let i=-1;i<=1;i++)ball(bodyRoot,.16,'#44333d',i*.23,1.96,.23);
for(const x of [-.16,.16]){ball(bodyRoot,.065,'#272b40',x,1.65,.39);ball(bodyRoot,.022,'#ffffff',x+.018,1.67,.45);const blush=ball(bodyRoot,.07,'#e5938f',x*1.55,1.5,.33);blush.scale.y=.4}const smile=new T.Mesh(new T.TorusGeometry(.065,.014,5,12,Math.PI),mat('#884b48'));smile.rotation.z=Math.PI;smile.position.set(0,1.48,.41);bodyRoot.add(smile);
for(const x of [-.47,.47]){const arm=box(bodyRoot,.2,.55,.22,'#fff1dd',x,1);arm.rotation.z=x>0?-.18:.18;ball(bodyRoot,.13,'#e9bc95',x,.7,.06)}
sign(bodyRoot,0,1.1,.25,.27); // tiny official crew pass
const gearRoot=new T.Group();bodyRoot.add(gearRoot);const slots={};
function slot(id){const g=new T.Group();gearRoot.add(g);g.visible=false;slots[id]=g;return g}
let g=slot('dir');const beret=ball(g,.48,'#d95f43',0,2.08);beret.scale.set(1,.3,1);ball(g,.07,'#87403b',.1,2.23);
g=slot('cam');const gearCamera=new T.Group();g.add(gearCamera);cam(gearCamera);gearCamera.scale.setScalar(.25);gearCamera.position.set(-.68,.37,.35);
g=slot('art');const palette=cyl(g,.32,.32,.07,'#e1b578',.44,.7,.3,14);palette.rotation.x=.8;for(let i=0;i<3;i++)ball(g,.06,['#e85a49','#5b9fb0','#e4bd3e'][i],.27+i*.15,.75,.45);
g=slot('snd');const arch=new T.Mesh(new T.TorusGeometry(.46,.065,8,24,Math.PI),mat('#7454a8'));arch.position.y=1.68;g.add(arch);for(const x of [-.45,.45])box(g,.18,.3,.23,'#d5a2eb',x,1.62);
g=slot('edt');const drone=box(g,.45,.15,.4,'#76c5c0',-.95,2.5,-.2);for(const x of [-1.25,-.65])for(const z of [-.5,.1]){rod(g,[-.95,2.5,-.2],[x,2.5,z],.035,'#536f78');const prop=cyl(g,.18,.18,.03,'#d5e2a3',x,2.55,z,10)}
g=slot('pro');box(g,.7,.8,.34,'#e3ac4a',0,1,-.42);box(g,.45,.35,.18,'#a87640',0,.8,-.64);for(const x of [-.23,.23])box(g,.08,.75,.08,'#a87640',x,1.05,.26);
g=slot('mkt');const horn=cyl(g,.23,.1,.5,'#e27c9d',.65,.8,.3);horn.rotation.x=Math.PI/2;const mouth=cyl(g,.18,.18,.025,'#513c55',.65,.8,.56);mouth.rotation.x=Math.PI/2;
g=slot('res');for(const x of [-.17,.17]){const lens=new T.Mesh(new T.TorusGeometry(.14,.025,6,20),mat('#bf872e'));lens.position.set(x,1.66,.44);g.add(lens)}rod(g,[-.04,1.66,.44],[.04,1.66,.44],.02,'#bf872e');
const crown=slot('premiere');for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const star=ball(crown,.09,'#ffc94f',Math.cos(a)*.65,2.5,Math.sin(a)*.65);star.scale.y=1.5}
const glider=new T.Group();bodyRoot.add(glider);glider.position.y=2.65;const shape=new T.Shape();shape.moveTo(-2,0);shape.lineTo(0,1);shape.lineTo(2,0);shape.lineTo(0,-.75);shape.closePath();const wing=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:'#f5bc54',side:T.DoubleSide,roughness:1}));wing.rotation.x=-Math.PI/2;glider.add(wing);for(const x of [-1.4,1.4])rod(glider,[x,0,0],[x*.2,-1.7,0],.025,'#f8ecd5');for(let i=-3;i<=3;i++)box(glider,.17,.025,.13,'#fff5dd',i*.42,.025,.04);glider.visible=false;
// Portrait uses the same wearable model, so each reward visibly stays on the player.
const portraitCanvas=document.getElementById('portrait'),portraitHome=portraitCanvas.parentElement;
let portraitRenderer,portraitScene,portraitModel,portraitCamera,portraitAngle=.25;
try{portraitRenderer=new T.WebGLRenderer({canvas:portraitCanvas,alpha:true,antialias:true});portraitRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));portraitRenderer.outputEncoding=T.sRGBEncoding;portraitRenderer.toneMapping=T.ACESFilmicToneMapping;portraitScene=new T.Scene();portraitScene.add(new T.HemisphereLight('#fff4df','#9e8db3',1.2));const pl=new T.DirectionalLight('#fff0d9',1);pl.position.set(-3,5,5);portraitScene.add(pl);portraitCamera=new T.PerspectiveCamera(36,1,.1,30);portraitCamera.position.set(0,1.5,5);portraitCamera.lookAt(0,1.2,0)}catch{}
function refreshPortrait(){if(!portraitRenderer)return;if(portraitModel)portraitScene.remove(portraitModel);portraitModel=bodyRoot.clone(true);portraitModel.children[portraitModel.children.length-1].visible=false;portraitScene.add(portraitModel)}refreshPortrait();
let flight=null,flightSeq=0,selected='main',panel=false,burstUntil=0;const trailPositions=new Float32Array(30*3),confettiPositions=new Float32Array(100*3),vel=[];
const trailGeo=new T.BufferGeometry();trailGeo.setAttribute('position',new T.BufferAttribute(trailPositions,3));const trail=new T.Points(trailGeo,new T.PointsMaterial({color:'#fff1a0',size:.18,transparent:true,opacity:.8}));scene.add(trail);trail.visible=false;
const confettiGeo=new T.BufferGeometry();confettiGeo.setAttribute('position',new T.BufferAttribute(confettiPositions,3));const colors=new Float32Array(100*3);for(let i=0;i<100;i++)new T.Color(['#ffc34c','#f47da1','#80d8e1','#fff5e7'][i%4]).toArray(colors,i*3);confettiGeo.setAttribute('color',new T.BufferAttribute(colors,3));const confetti=new T.Points(confettiGeo,new T.PointsMaterial({vertexColors:true,size:.25}));scene.add(confetti);confetti.visible=false;
let skyTarget=new T.Color('#b8dcef'),sunTarget=new T.Color('#fff2d8'),skyCurrent=skyTarget.clone();const themes={day:['#b8dcef','#fff2d8'],sunset:['#e9bfcb','#ffc18a'],night:['#747da6','#bacbff']};
window.IslandScene={
travel(id){const target=islands.find(v=>v.id===id);if(!target)return Promise.resolve(false);selected=id;islands.forEach(v=>{v.ring.visible=v.id===id;v.label.classList.toggle('active',v.id===id);v.label.setAttribute('aria-pressed',String(v.id===id))});if(flight)flight.resolve(false);const to=target.g.position.clone().add(new T.Vector3(0,.45,2.5));const token=++flightSeq;return new Promise(resolve=>{flight={from:hero.position.clone(),to,start:performance.now(),duration:reduced.matches?80:1700,resolve,token};glider.visible=!reduced.matches;trail.visible=!reduced.matches;for(let i=0;i<30;i++)hero.position.toArray(trailPositions,i*3)})},
equip(ids){for(const [id,g] of Object.entries(slots))g.visible=ids.includes(id);refreshPortrait()},
save(ids){islands.filter(v=>v.id!=='hall'&&v.id!=='timehouse').forEach(v=>{v.label.classList.toggle('saved',ids.includes(v.id));v.label.querySelector('small').textContent=ids.includes(v.id)?'✓ 任務完成':v.id==='main'?'共同必修出發':'小任務 · +100 XP'})},
timehousePosters(ids){ids.forEach((id,i)=>{const f=FILM_MEDIA.catalog.find(v=>v.id===id);if(!f||!timehouseScreens[i])return;if(!timehouseTextureCache.has(id)){const tex=posterLoader.load(f.thumb);tex.encoding=T.sRGBEncoding;timehouseTextureCache.set(id,tex)}timehouseScreens[i].material.map=timehouseTextureCache.get(id);timehouseScreens[i].material.needsUpdate=true})},
unlockHall(ready){hallLabel.querySelector('small').textContent=ready?'✦ 開放入場':'探索三個方向';document.getElementById('hallBtn').classList.toggle('unlocked',ready);hallRing.visible=ready;},
reward(){if(reduced.matches)return;burstUntil=performance.now()+2200;confetti.visible=true;for(let i=0;i<100;i++){hero.position.toArray(confettiPositions,i*3);vel[i]=new T.Vector3((Math.random()-.5)*8,Math.random()*7+3,(Math.random()-.5)*8)}},
mood(key){const p=themes[key];if(p){skyTarget.set(p[0]);sunTarget.set(p[1])}},panel(open){panel=open;resize()},layout(){resize()},reset(){controls.reset();camera.zoom=1;camera.updateProjectionMatrix()},zoom(f){camera.zoom=Math.max(.7,Math.min(2.2,camera.zoom*f));camera.updateProjectionMatrix()},mountPortrait(target){(target||portraitHome).append(portraitCanvas);resizePortrait()},rotate(direction=1){portraitAngle+=direction*Math.PI/2},state(){return{flying:!!flight,selected,portraitParent:portraitCanvas.parentElement.id||'hud',portraitAngle,position:hero.position.toArray(),equipped:Object.entries(slots).filter(([k,v])=>v.visible).map(([k])=>k)}}
};controls.saveState();
function resize(){
 const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);
 const compact=matchMedia('(max-width:1100px), (pointer:coarse) and (max-width:1400px)').matches;
 const short=compact&&h<=520&&w>h;
 if(short!==shortLayout){shortLayout=short;const rowPositions=[[0,6],[-30,-7],[-18,-7],[-6,-7],[6,-7],[18,-7],[30,-7],[-24,8],[-12,8],[14,8],[28,8]];
 islands.forEach((v,i)=>{v.g.position.x=short?rowPositions[i][0]:regularPositions[i].x;v.g.position.z=short?rowPositions[i][1]:regularPositions[i].z});
 wheelBase.position.set(0,short?-6:-5,short?-7:-22);wheelBase.scale.setScalar(short?.9:1.8);
 marquee.position.set(0,short?7:15.5,short?-5:-18);marquee.scale.setScalar(short?.8:1);
 const destination=islands.find(v=>v.id===selected);if(destination){const to=destination.g.position.clone().add(new T.Vector3(0,.45,2.5));if(flight){flight.from.copy(hero.position);flight.to.copy(to);flight.start=performance.now()}else hero.position.copy(to)}
 }
 let hh=Math.max(31,27/(w/h)),shiftX=0,shiftY=0;
 if(compact){
  const hud=document.querySelector('.player-hud'),quest=document.querySelector('.quest-banner');
  const top=Math.min(h*.3,Math.max(hud?.getBoundingClientRect().bottom||90,quest?.getBoundingClientRect().bottom||90)+8);
  const dock=document.querySelector('.game-bottom'),bottom=panel?Math.max(h<=520?140:160,h*(h<=520?.36:.33)):(dock?.getBoundingClientRect().height||76)+12;
  const available=Math.max(110,h-top-bottom);
  hh=Math.max((short?36:29.5)/(w/h),(short?10:24)*h/available);
  shiftY=h/2-(top+available/2);
 }else if(panel){shiftX=120}
 camera.left=-hh*w/h;camera.right=hh*w/h;camera.top=hh;camera.bottom=-hh;
 if(compact||panel)camera.setViewOffset(w,h,shiftX,shiftY,w,h);else camera.clearViewOffset();
 camera.updateProjectionMatrix();resizePortrait();
}
function resizePortrait(){if(!portraitRenderer||!portraitCanvas.clientWidth||!portraitCanvas.clientHeight)return;portraitRenderer.setSize(portraitCanvas.clientWidth,portraitCanvas.clientHeight,false);portraitCamera.aspect=portraitCanvas.clientWidth/portraitCanvas.clientHeight;portraitCamera.updateProjectionMatrix()}
new ResizeObserver(resizePortrait).observe(portraitCanvas);
let portraitDrag=null;portraitCanvas.addEventListener('pointerdown',e=>{portraitDrag=e.clientX;portraitCanvas.setPointerCapture(e.pointerId)});portraitCanvas.addEventListener('pointermove',e=>{if(portraitDrag===null)return;portraitAngle+=(e.clientX-portraitDrag)*.018;portraitDrag=e.clientX});portraitCanvas.addEventListener('pointerup',()=>portraitDrag=null);portraitCanvas.addEventListener('pointercancel',()=>portraitDrag=null);
new ResizeObserver(resize).observe(container);resize();
const ray=new T.Raycaster(),pointer=new T.Vector2();let down=null,multi=false,pointers=new Set();canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);multi=pointers.size>1;down=[e.clientX,e.clientY]});canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null});canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(multi||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8){if(!pointers.size)multi=false;return}down=null;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(islands.map(x=>x.g),true).find(h=>h.object.userData.island||h.object.userData.media);if(hit){const data=hit.object.userData;if(data.media)window.Campus?.playFilm(data.media);else if(data.island==='timehouse')window.Game?.enterTimehouse();else if(data.island==='hall')window.Game?.enterHall();else window.Game?.travel(data.island)}});
// Compact label avoidance: retain nearby anchors and connect any displaced labels.
const leaderSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');leaderSvg.id='labelLeaders';leaderSvg.setAttribute('aria-hidden','true');container.insertBefore(leaderSvg,labels);
const leaderLines=islands.map(()=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');leaderSvg.append(line);return line});
function arrangeLabels(){
 if(document.body.classList.contains('sheet-expanded'))return;
 const w=container.clientWidth,h=container.clientHeight,compact=matchMedia('(max-width:1100px), (pointer:coarse) and (max-width:1400px)').matches;
 const sheet=document.getElementById('mission'),dock=document.querySelector('.game-bottom');let bottom=h-8,right=w-8;
 if(compact){bottom=panel?sheet.getBoundingClientRect().top-6:dock.getBoundingClientRect().top-6}else if(panel)right=sheet.getBoundingClientRect().left-8;
 const obstacles=['.player-hud','.quest-banner','.logo-brand','.top-tools','#encounter'].map(sel=>document.querySelector(sel)).filter(el=>el&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&!el.hidden).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}});
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 const entries=islands.map((v,i)=>{const p=new T.Vector3(v.g.position.x,v.g.position.y-.2,v.g.position.z+3.9).project(camera);return{v,i,ax:(p.x*.5+.5)*w,ay:(-p.y*.5+.5)*h,lw:v.label.offsetWidth,lh:v.label.offsetHeight}}).sort((a,b)=>a.ay-b.ay||a.ax-b.ax);
 const placed=[];const ys=[0,-12,12,-24,24,-40,40,-56,56,-72,72],xs=w<=360?[0,-14,14,-28,28,-44,44]:[0,-14,14,-28,28];
 for(const e of entries){let best=null;
  for(const dy of ys)for(const dx of xs){const x=Math.max(8,Math.min(right-e.lw,e.ax-e.lw/2+dx)),y=Math.max(8,Math.min(bottom-e.lh,e.ay+dy));const rect={x,y,w:e.lw,h:e.lh};let cost=(x+e.lw/2-e.ax)**2+(y-e.ay)**2;
   for(const other of placed)cost+=overlap({x:x-4,y:y-4,w:e.lw+8,h:e.lh+8},other)*1200;
   for(const other of obstacles)cost+=overlap(rect,other)*1500;
   if(e.v.labelPosition)cost+=.3*((x-e.v.labelPosition.x)**2+(y-e.v.labelPosition.y)**2);
   if(!best||cost<best.cost)best={...rect,cost};
  }
  placed.push(best);e.v.labelPosition=best;e.v.label.style.left=(best.x+e.lw/2)+'px';e.v.label.style.top=best.y+'px';
  const line=leaderLines[e.i],distance=Math.hypot(best.x+e.lw/2-e.ax,best.y-e.ay);line.style.display=distance>12?'':'none';line.setAttribute('x1',e.ax);line.setAttribute('y1',e.ay);line.setAttribute('x2',Math.max(best.x+8,Math.min(best.x+best.w-8,e.ax)));line.setAttribute('y2',best.y>e.ay?best.y:best.y+best.h);
 }
}

let last=performance.now(),frameCount=0;function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((now-last)/1000,.1);last=now;const a=reduced.matches?1:1-Math.exp(-dt*5),t=now/1000;controls.update();
islands.forEach((v,i)=>{v.g.position.y=v.base+(reduced.matches?0:Math.sin(t*.8+i)*.12);const p=new T.Vector3(v.g.position.x,v.g.position.y-.2,v.g.position.z+3.9).project(camera);const half=v.label.offsetWidth/2+7;v.label.style.left=Math.max(half,Math.min(container.clientWidth-half,(p.x*.5+.5)*container.clientWidth))+'px';v.label.style.top=(-p.y*.5+.5)*container.clientHeight+'px'});
if(flight){const k=Math.min(1,(now-flight.start)/flight.duration),ease=k*k*(3-2*k);hero.position.lerpVectors(flight.from,flight.to,ease);hero.position.y+=Math.sin(k*Math.PI)*7;bodyRoot.rotation.z=reduced.matches?0:Math.sin(k*Math.PI*2)*.18;bodyRoot.rotation.y=Math.atan2(flight.to.x-flight.from.x,flight.to.z-flight.from.z);for(let i=29;i>0;i--)for(let j=0;j<3;j++)trailPositions[i*3+j]=trailPositions[(i-1)*3+j];hero.position.toArray(trailPositions,0);trailGeo.attributes.position.needsUpdate=true;if(k===1){const done=flight;flight=null;glider.visible=false;trail.visible=false;bodyRoot.rotation.set(0,.3,0);done.resolve(true)}}else{bodyRoot.position.y=reduced.matches?0:Math.sin(t*2.5)*.045;legs.forEach((l,i)=>l.rotation.x=reduced.matches?0:Math.sin(t*2+i*Math.PI)*.05)}
if(!reduced.matches){wheel.rotation.z=t*.13;cabins.forEach(c=>c.rotation.z=-wheel.rotation.z);balloons.forEach((g,i)=>g.position.y=8+Math.sin(t*.7+i)*.7);crowd.forEach((p,i)=>{p.rotation.z=Math.sin(t*2+i)*.055;p.position.y=.2+Math.abs(Math.sin(t*1.5+i))*.08});beams.forEach((b,i)=>b.rotation.z=Math.sin(t*.5+i*3)*.25);if(slots.edt.visible)slots.edt.position.y=Math.sin(t*3)*.08;slots.premiere.rotation.y=t*.6}
if(confetti.visible){for(let i=0;i<100;i++){vel[i].y-=dt*5;for(let j=0;j<3;j++)confettiPositions[i*3+j]+=vel[i].getComponent(j)*dt}confettiGeo.attributes.position.needsUpdate=true;if(now>burstUntil)confetti.visible=false}
const hp=hero.position.clone().add(new T.Vector3(0,flight?5:3.8,0)).project(camera),tag=document.getElementById('heroTag');tag.style.left=(hp.x*.5+.5)*container.clientWidth+'px';tag.style.top=(-hp.y*.5+.5)*container.clientHeight+'px';tag.textContent=flight?'🪂 飛行中！':'你在這裡 ↓';
skyCurrent.lerp(skyTarget,a);sun.color.lerp(sunTarget,a);document.body.style.background=`linear-gradient(#${skyCurrent.getHexString()}, #ead6de)`;arrangeLabels();renderer.render(scene,camera);if(portraitRenderer&&portraitModel&&frameCount++%2===0){portraitModel.rotation.y=portraitAngle+(reduced.matches?0:Math.sin(t*.5)*.12);portraitRenderer.render(portraitScene,portraitCamera)}}requestAnimationFrame(frame);
} catch(e) {document.getElementById('mapFallback').hidden=false;canvas.hidden=true;document.getElementById('labels').hidden=true;console.warn('3D map unavailable; course missions remain available.');}
})();
