'use strict';
/* ───────────── Mode « Mécanicien » — PERSONNAGES 3D (employés, candidats) et avatars de CV ─────────────
   Petits personnages faits de boîtes (une dizaine de maillages), avec une tenue de travail ou de ville, une marche et des
   postures lisibles : debout, marche, penché sous le capot, accroupi aux roues, regard vers le dessous d'une voiture levée,
   assis (entretien), au clavier (accueil), à porter un carton.
   ═══ API `MWPUP` (aussi `window.__mwpup`) ═══
   MWPUP.genAp(rnd,opts)         apparence tirée au hasard {skin,hair,hs (coupe),shirt,pants,h (taille),beard,glasses,fem,seed}
   MWPUP.make(ap,opts)           → puppet {g (groupe THREE à poser dans la scène), ap, pose, set(pose), update(dt), place(x,z,ry), dispose()}
                                 opts : {tenue:'travail'|'ville'} (travail : bleu de travail et gilet ; ville : veste et chemise)
   MWPUP.POSES                   ['idle','walk','capot','roue','dessous','assis','clavier','porter','parle']
   MWPUP.avatar(ap)              adresse de données (image 96×96) du visage pour un CV ; mise en cache */
const MWPUP=(()=>{
const T=THREE,PI=Math.PI,api={};
const SKIN=[0xf3cfae,0xe6b48a,0xc98d62,0x95623f,0x5e3b27],HAIR=[0x16120f,0x3a2616,0x6b4524,0xa8793a,0xc9b37a,0x8a8a8a,0x7a2a16],
 SHIRT=[0x2f5aa8,0x2a7a5a,0x9a3a3a,0xc8a030,0x6a4a8a,0x3a3a42,0xd8d4c8,0x2a8aa0],PANTS=[0x20242c,0x3a3f4a,0x4a3a2a,0x2a3a5a],
 WORK=[0x1f4a8a,0x2a3f6a,0x3a4a2a,0x6a2a1a];
const BOX=new T.BoxGeometry(1,1,1),SPH=new T.SphereGeometry(.5,10,8);
const mats={};
function mat(c){let m=mats[c];if(!m){m=mats[c]=new T.MeshLambertMaterial({color:c});m.color.convertSRGBToLinear();m.userData.lin=1;}return m;}
api.genAp=(rnd,o)=>{o=o||{};rnd=rnd||Math.random;const pk=a=>a[Math.floor(rnd()*a.length)];
 const fem=o.fem!=null?!!o.fem:rnd()<.35;
 return {skin:pk(SKIN),hair:pk(HAIR),hs:Math.floor(rnd()*4),shirt:pk(SHIRT),pants:pk(PANTS),work:pk(WORK),h:fem?1.6+rnd()*.14:1.68+rnd()*.18,beard:!fem&&rnd()<.25,glasses:rnd()<.2,fem,seed:Math.floor(rnd()*1e6)};};
function part(g,geo,c,sx,sy,sz,x,y,z){const m=new T.Mesh(geo,mat(c));m.scale.set(sx,sy,sz);m.position.set(x,y,z);g.add(m);return m;}
api.make=(ap,o)=>{o=o||{};const ville=o.tenue==='ville',k=ap.h/1.75,fem=!!ap.fem;
 const root=new T.Group(),body=new T.Group();root.add(body);body.scale.setScalar(k);
 const top=ville?ap.shirt:ap.work,bot=ville?ap.pants:ap.work;
 const hips=new T.Group();hips.position.y=.93;body.add(hips);
 const legs=[-1,1].map(s=>{const l=new T.Group();l.position.set(s*.1,0,0);hips.add(l);part(l,BOX,bot,.17,.9,.2,0,-.45,0);part(l,BOX,0x1a1a1c,.18,.08,.27,0,-.89,.03);return l;});
 const torso=new T.Group();hips.add(torso);part(torso,BOX,top,fem?.38:.42,.58,.24,0,.29,0);
 if(!ville) part(torso,BOX,0xe8b81c,.43,.08,.25,0,.12,0); /* bande réfléchissante */
 else part(torso,BOX,0xf4f0e6,.12,.4,.01,0,.34,.125); /* plastron de chemise */
 const head=new T.Group();head.position.y=.6;torso.add(head);
 part(head,SPH,ap.skin,.24,.27,.24,0,.14,0);
 const hair=ap.hs===3&&!fem?0:ap.hair; /* hs 3 : crâne rasé */
 if(hair) part(head,BOX,hair,.26,ap.hs===1?.16:.1,.26,0,.27,-.01);
 part(head,BOX,0x1a1410,.04,.04,.02,-.065,.16,.115);part(head,BOX,0x1a1410,.04,.04,.02,.065,.16,.115);part(head,BOX,0x8a4a3a,.07,.02,.02,0,.06,.115); /* yeux et bouche */
 if(fem&&hair) part(head,BOX,hair,.26,.3,.1,0,.14,-.12);
 if(ap.beard) part(head,BOX,ap.hair,.2,.1,.08,0,.06,.1);
 if(ap.glasses) part(head,BOX,0x14161a,.24,.04,.02,0,.17,.125);
 if(!ville&&ap.hs===2) part(head,BOX,ap.work,.28,.06,.3,0,.3,.02); /* casquette */
 const arms=[-1,1].map(s=>{const a=new T.Group();a.position.set(s*(fem?.24:.27),.52,0);torso.add(a);part(a,BOX,top,.11,.5,.12,0,-.25,0);part(a,BOX,ap.skin,.1,.1,.11,0,-.55,0);return a;});
 const P={g:root,ap,pose:'idle',legs,arms,torso,head,hips,body,t:Math.random()*10,walk:0,tgt:null};
 const sit=()=>{hips.position.y=.5;legs.forEach(l=>{l.rotation.x=-1.5;});};
 P.set=pose=>{P.pose=pose;};
 P.place=(x,z,ry)=>{root.position.x=x;root.position.z=z;if(ry!=null) root.rotation.y=ry;};
 P.update=dt=>{P.t+=dt;const t=P.t,pose=P.pose;
  hips.position.y=.93;hips.rotation.x=0;torso.rotation.x=0;torso.rotation.z=0;head.rotation.x=0;head.rotation.y=0;legs.forEach(l=>{l.rotation.x=0;});arms.forEach(a=>{a.rotation.x=0;a.rotation.z=0;});body.position.y=0;
  if(pose==='walk'||pose==='porter'){const ph=t*7;legs[0].rotation.x=Math.sin(ph)*.7;legs[1].rotation.x=-Math.sin(ph)*.7;hips.position.y=.93+Math.abs(Math.sin(ph))*.03;
   if(pose==='porter'){arms.forEach(a=>{a.rotation.x=-1.25;});torso.rotation.x=-.08;}else{arms[0].rotation.x=-Math.sin(ph)*.6;arms[1].rotation.x=Math.sin(ph)*.6;}}
  else if(pose==='capot'){torso.rotation.x=.95;hips.rotation.x=.1;arms.forEach((a,i)=>{a.rotation.x=-1.3+Math.sin(t*3+i*2)*.25;});legs[0].rotation.x=-.15;legs[1].rotation.x=.2;head.rotation.x=-.5;}
  else if(pose==='roue'){hips.position.y=.5;legs.forEach(l=>{l.rotation.x=-1.35;});torso.rotation.x=.45;arms.forEach((a,i)=>{a.rotation.x=-1.1+Math.sin(t*5+i*3)*.35;});head.rotation.x=-.3;}
  else if(pose==='dessous'){head.rotation.x=-.55;arms.forEach((a,i)=>{a.rotation.x=-2.5;a.rotation.z=(i?-1:1)*.2;a.rotation.x+=Math.sin(t*4+i*2)*.15;});torso.rotation.x=-.08;}
  else if(pose==='assis'){sit();arms.forEach(a=>{a.rotation.x=-.9;});torso.rotation.x=.05;head.rotation.y=Math.sin(t*.7)*.08;}
  else if(pose==='clavier'){arms.forEach((a,i)=>{a.rotation.x=-1.1+Math.sin(t*9+i*1.7)*.12;});torso.rotation.x=.12;head.rotation.x=.18;}
  else if(pose==='parle'){sit();arms.forEach((a,i)=>{a.rotation.x=-.9+Math.sin(t*2.2+i*2.4)*.35;a.rotation.z=(i?-1:1)*(.1+Math.max(0,Math.sin(t*1.7+i))*.25);});head.rotation.y=Math.sin(t*1.1)*.12;head.rotation.x=Math.sin(t*1.6)*.06;}
  else{torso.rotation.x=Math.sin(t*1.3)*.015;arms[0].rotation.z=.04;arms[1].rotation.z=-.04;head.rotation.y=Math.sin(t*.5)*.1;}};
 P.dispose=()=>{if(root.parent) root.parent.remove(root);};
 return P;};
api.POSES=['idle','walk','capot','roue','dessous','assis','clavier','porter','parle'];
/* ── avatar de CV : visage dessiné sur un canvas, en cache ── */
const AV={};
api.avatar=ap=>{const key=ap.seed+'|'+ap.skin+'|'+ap.hair+'|'+ap.shirt;if(AV[key]) return AV[key];
 let url='';try{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d'),hx=n=>'#'+(n>>>0).toString(16).padStart(6,'0');
  const g=x.createLinearGradient(0,0,0,96);g.addColorStop(0,'#2a3f5c');g.addColorStop(1,'#14233a');x.fillStyle=g;x.fillRect(0,0,96,96);
  x.fillStyle=hx(ap.shirt);x.beginPath();x.moveTo(8,96);x.quadraticCurveTo(14,66,48,64);x.quadraticCurveTo(82,66,88,96);x.fill();
  x.fillStyle=hx(ap.skin);x.fillRect(41,52,14,16);x.beginPath();x.ellipse(48,40,19,23,0,0,7);x.fill();
  if(!(ap.hs===3&&!ap.fem)){x.fillStyle=hx(ap.hair);x.beginPath();x.ellipse(48,26,21,14+(ap.hs===1?6:0),0,Math.PI,0);x.fill();if(ap.fem){x.fillRect(27,26,8,36);x.fillRect(61,26,8,36);}}
  x.fillStyle='#1a1410';x.fillRect(40,38,4,4);x.fillRect(53,38,4,4);x.fillRect(44,54,9,2);
  if(ap.beard){x.fillStyle=hx(ap.hair);x.globalAlpha=.8;x.fillRect(34,54,28,9);x.globalAlpha=1;x.fillStyle=hx(ap.skin);x.fillRect(44,53,9,3);x.fillStyle='#1a1410';x.fillRect(44,55,9,2);}
  if(ap.glasses){x.strokeStyle='#14161a';x.lineWidth=2;x.strokeRect(36,35,12,9);x.strokeRect(50,35,12,9);x.beginPath();x.moveTo(48,39);x.lineTo(50,39);x.stroke();}
  url=c.toDataURL('image/png');}catch(e){}
 AV[key]=url;return url;};
return api;
})();
window.__mwpup=MWPUP;
