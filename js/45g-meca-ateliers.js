'use strict';
/* ───────────── Mode « Mécanicien » — ATELIERS : repères, équipements et ambiance propres à chaque garage ─────────────
   Appelé par la fin de la fonction `garage(z)` de js/45c-meca-garages.js (MWD.ateliers(z,kit)) pour les 7 garages
   (Garage du Coin, Ventoux, Maison Aurèle, Scuderia Brivio et les trois garages à acheter).
   Rôle :
   - panneaux suspendus, lisibles de loin : PIÈCES (étagère), ÉTABLI, OUTILS (servante), ACCUEIL (comptoir) ;
   - banc de géométrie, râteliers de pneus, salle d'attente, bureau, vitrines, bannières : différents d'un garage à l'autre ;
   - aucune modification des positions des ponts, de l'établi, de l'étagère ni du comptoir (zones de js/40).
   API : MWT.REPERES (liste des repères posés, par garage), MWT.libre(z,x,z,r) pour les tests de parcours. */
const MWT=(()=>{
const REPERES={};
MWD.ateliers=(z,k)=>{
 const {D,st,P,core,det,loc,ryO,hx,dp,w,Hh,addCol,lounge,showcar,pick,sansF,signDraw}=k,T=D.T,PI=D.PI,ctx=k.ctx,id=z.id;
 const col=(u,v,wu,wv)=>{const a=loc(u,v);addCol(a.x,a.z,wu,wv);}; /* garages orientés nord ou sud : u = x, v = z */
 const rep=REPERES[id]=[];
 const ROT={door:ryO,back:ryO+PI,'u+':PI/2,'u-':-PI/2};
 const lux=id==='garage3',race=id==='garage4';
 /* ═══ panneaux suspendus aux poutres ═══ */
 const CAT={pieces:['#e8b81c','#161616','PIÈCES','Étagère'],etabli:['#e86a1c','#ffffff','ÉTABLI','Pose des pièces'],outils:['#c02a2a','#ffffff','OUTILS','Servante'],accueil:['#2a8a4a','#ffffff','ACCUEIL','Clients']};
 function hang(cat,u,v,y,wd,face){
  const c=CAT[cat],h=wd*.26,ry=ROT[face],p=loc(u,v),nx=Math.sin(ry),nz=Math.cos(ry),ax=Math.cos(ry),az=-Math.sin(ry);
  const bg=lux?'#15151b':race?'#161616':c[0],fg=lux?'#e6c46a':race?'#ffffff':c[1];
  const draw=(x,ww,hh)=>{x.fillStyle=bg;x.fillRect(0,0,ww,hh);
   x.fillStyle=c[0];x.fillRect(0,0,hh*.2,hh);if(lux||race){x.fillRect(0,hh*.9,ww,hh*.1);}
   x.strokeStyle=fg;x.lineWidth=hh*.04;x.strokeRect(hh*.06,hh*.06,ww-hh*.12,hh-hh*.12);
   x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';
   const fam=lux?'Georgia,"Times New Roman",serif':sansF,wt=race?'italic 800':'bold';let f=hh*.5;x.font=wt+' '+f+'px '+fam;
   while(x.measureText(c[2]).width>ww*.68&&f>12){f-=2;x.font=wt+' '+f+'px '+fam;}
   x.fillText(c[2],ww*.58,hh*.4);x.font=(lux?'':'600 ')+Math.round(hh*.19)+'px '+(lux?fam:'Arial');x.fillText(c[3],ww*.58,hh*.76);};
  const body=D.L(det('plain'),p.x,p.z,ry,0);
  body.box(wd+.08,h+.08,.07,0,y,0,0x24272c);
  const top=y+h/2+.04,len=Hh-.06-top;
  if(len>.1) for(const s of [-1,1]) body.box(.03,len,.03,s*(wd/2-.25),top+len/2,0,0x30343a);
  const tex=D.canvasTex(512,Math.round(512*h/wd),draw),m=new T.Mesh(new T.PlaneGeometry(wd,h),D.signMat(tex));
  m.position.set(p.x+nx*.045,y,p.z+nz*.045);m.rotation.y=ry;ctx.scene.add(m);
  rep.push({cat,x:p.x,z:p.z,y,face});return m;};
 const sy=Math.min(Hh-1.6,4.1);
 hang('pieces',hx-3.4,dp-2.4,sy,4.4,'door');
 hang('etabli',-hx+3.6,dp-2.4,sy,4.4,'door');
 {const nCh=w>30?3:2;hang('outils',-hx+1.25,dp*.30+(nCh-1)*.8,3.6,3.4,'u+');}
 hang('accueil',hx-3.2,3.0,3.4,3.2,'u-');
 /* ═══ petits meubles réutilisables ═══ */
 const bench=(u,v,face,c)=>{const l=P(core('plain'),u,v,face,0);l.box(1.8,.1,.5,0,.46,0,c||0x6a4a2a);l.box(1.8,.5,.08,0,.8,-.22,c||0x6a4a2a);for(const s of [-.8,.8]) l.box(.08,.44,.4,s,.22,0,0x30343a);};
 const table=(u,v,face,c,rw)=>{const l=P(det('plain'),u,v,face,0);l.box(rw||.9,.05,.6,0,.5,0,c||0xdcdcdc);for(const sx of [-1,1]) l.box(.05,.48,.05,sx*(rw||.9)/2*.85,.24,0,0x30343a);
  l.box(.3,.02,.22,-.15,.54,0,0xe8e0d0);l.cyl(.04,.04,.1,6,.2,.58,0,0xc02020);};
 const plant=(u,v,face)=>{const l=P(det('plain'),u,v,face,0);l.cyl(.26,.2,.45,10,0,.22,0,0xcfc8b8);l.sph(.42,.5,.42,1,0,.9,0,0x2f6a2a);};
 const desk=(u,v,face,c,withChair)=>{const l=P(core('plain'),u,v,face,0),dl=P(det('plain'),u,v,face,0);
  l.box(1.6,.06,.8,0,.76,0,c);for(const sx of [-.75,.75]) l.box(.06,.74,.7,sx,.37,0,0x30343a);l.box(1.4,.5,.04,0,.5,-.36,0x30343a);
  dl.box(.5,.34,.04,.2,1.1,-.18,0x15171a);dl.box(.12,.1,.2,.2,.84,-.18,0x15171a);dl.box(.4,.02,.16,.2,.8,.12,0x2a2c30);dl.box(.3,.02,.22,-.5,.8,0,0xe8e0d0);
  if(withChair!==false){const ch=P(det('plain'),u,v,face,0);ch.box(.5,.08,.5,0,.5,-.95,0x2a2c30);ch.box(.5,.6,.08,0,.85,-1.2,0x2a2c30);ch.cyl(.04,.04,.4,6,0,.28,-.95,0x55595e);}
  col(u,v,1.7,.9);};
 const tyreRack=(u,v,face,n)=>{const l=P(core('plain'),u,v,face,0),dl=P(det('plain'),u,v,face,0);
  for(const sx of [-1.25,1.25]) l.box(.06,2.0,.5,sx,1.0,0,0x2f5aa0);for(let r=0;r<3;r++) l.box(2.5,.04,.5,0,.1+r*.7,0,0xb8bcc0);
  for(let r=0;r<3;r++) for(let i=0;i<(n||4);i++){const x=-1.0+i*.66;dl.rcyl(.31,.31,.22,12,x,.46+r*.7,0,0x1a1a1c,PI/2,0);dl.rcyl(.19,.19,.23,10,x,.46+r*.7,0,0x8a8e94,PI/2,0);}
  const a=loc(u,v);addCol(a.x,a.z,face==='u+'||face==='u-'?.6:2.6,face==='u+'||face==='u-'?2.6:.6);};
 /* banc de géométrie : rampes, plateaux tournants, console et cible de caméra */
 const align=(u,v,accent)=>{const l=P(core('plain'),u,v,'door',0),dl=P(det('plain'),u,v,'door',0);
  for(const s of [-1,1]){l.box(.62,.16,5.4,s*.88,.17,0,0x3a3f46);l.box(.62,.02,5.4,s*.88,.26,0,0x6a7076);l.box(.06,.04,5.4,s*.88+s*.3,.27,0,accent);
   dl.cyl(.26,.26,.03,14,s*.88,.285,1.6,0xc8ccd0);dl.box(.5,.03,.5,s*.88,.285,-1.6,0xb8bcc0);
   l.box(.62,.1,.7,s*.88,.1,3.0,0x3a3f46);l.box(.62,.1,.7,s*.88,.1,-3.0,0x3a3f46);}
  l.box(.1,1.5,.1,-1.75,.95,-2.9,0x2a2e34);l.box(.1,1.5,.1,1.75,.95,-2.9,0x2a2e34);l.box(3.6,.1,.1,0,1.7,-2.9,0x2a2e34);dl.box(.3,.16,.12,-1.6,1.7,-2.9,0x15171a);dl.box(.3,.16,.12,1.6,1.7,-2.9,0x15171a);
  l.box(.6,1.0,.5,2.4,.5,.8,0xcfd3d6);l.box(.56,.4,.04,2.4,1.3,.56,0x14161a);dl.box(.5,.3,.02,2.4,1.32,.53,0x6ad0f0);l.box(.5,.04,.3,2.4,1.02,.95,0x30343a);
  col(u+2.4,v+.8,.7,.6);};
 const rug=(u,v,wu,wv,c,b)=>{const l=P(det('plain'),u,v,'door',0);l.box(wu,.012,wv,0,.106,0,c);l.box(wu-.2,.014,wv-.2,0,.108,0,b);};
 /* ═══ chaque garage a son caractère ═══ */
 if(id==='garage1'){ /* atelier de quartier : radio, calendrier, gamelle du chat, bidons — le désordre sympathique */
  const dl=P(det('plain'),hx-.5,dp*.34,'u-',0);dl.box(.5,.4,.6,0,.22,0,0xc8a020);dl.box(.3,.3,.4,0,.6,0,0x8a8e94);
  const rd=P(det('plain'),-hx+3.6,dp-1.2,'door',0);rd.box(.5,.22,.2,1.4,1.14,0,0x2a2c30);rd.cyl(.02,.02,.4,6,1.6,1.4,0,0x888e94);
  const bw=P(det('plain'),-hx+1.2,dp*.75,'u+',0);bw.cyl(.18,.14,.1,10,0,.05,0,0xd8d8d8);
  const cal=P(D.B('detail','posters'),hx-.28,dp*.74,'u-',0);cal.quad(.62,.9,0,1.9,0,null,[1/4,0,2/4,1]);}
 if(id==='garage2'){align(8,dp-8,0x2a5db0);tyreRack(-hx+.7,dp*.7,'u+',4);
  /* bureau vitré du conseiller : paroi de verre et plantes */
  const cl=P(D.B('core','glass'),hx-6.0,5.6,'door',0);cl.quad(3.0,2.4,0,1.3,0,null);
  plant(hx-8.2,4.2,'door');
  /* oriflammes de promotion au-dessus des voitures exposées */
  for(const u of [-hx*.5,hx*.28]){const f=P(det('plain'),u,dp*.2+.3,'door',0);f.box(.04,1.0,.04,0,Hh-1.0,0,0x30343a);f.box(1.5,.5,.03,0,Hh-1.7,0,0x2a5db0);}}
 if(id==='garage3'){align(8,dp-8,0xc8a050);rug(-hx+3.0,4.4,4.6,3.8,0x6a1a1a,0x3a0e0e);
  /* vitrine de maquettes sur le mur est */
  const vt=P(core('plain'),hx-.5,dp*.3,'u-',0),vd=P(det('plain'),hx-.5,dp*.3,'u-',0);
  vt.box(.5,1.9,2.2,0,.95,0,0x2a1c14);vt.box(.4,1.6,2.0,0,1.0,0,0x15151a);for(let i=0;i<3;i++){vt.box(.46,.03,1.9,-.02,.5+i*.5,0,0xc8a050);}
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) dl_car(vd,-.02,.62+i*.5,-.7+j*.7,[0xc01818,0xe6dcc0,0x2a4a8a][(i+j)%3]);
  col(hx-.5,dp*.3,.6,2.3);
  desk(hx-4.2,dp*.55,'u-',0x3a2a20,false);
  /* appliques : deux lampes de chevet sur le comptoir */
  const cl=P(det('plain'),hx-3.2,3.0,'door',0);cl.cyl(.1,.14,.04,8,.95,1.08,.1,0xc8a050);cl.cyl(.03,.03,.3,6,.95,1.2,.1,0xc8a050);cl.cyl(.14,.1,.16,8,.95,1.42,.1,0xfff0cc);}
 if(race){align(5,dp-8,0xc01818);
  /* poste de télémétrie : trois écrans, tabourets, bandes rouges */
  const tel=P(core('plain'),-hx+4.6,2.0,'back',0),dl=P(det('plain'),-hx+4.6,2.0,'back',0);
  tel.box(3.2,.06,.8,0,.76,0,0x1a1a1c);for(const sx of [-1.5,1.5]) tel.box(.06,.74,.7,sx,.37,0,0x30343a);
  for(const sx of [-1,0,1]){dl.box(.9,.55,.04,sx*.95,1.25,-.2,0x0e1013);dl.box(.82,.45,.02,sx*.95,1.25,-.17,[0x1fbf5a,0x2a8af0,0xf0a020][sx+1]);}
  for(const sx of [-.9,.9]){dl.cyl(.2,.2,.05,10,sx,.62,.9,0x2a2c30);dl.cyl(.03,.03,.5,6,sx,.34,.9,0x55595e);}
  col(-hx+4.6,2.0,3.3,.9);
  /* râtelier de pneus slicks et couvertures chauffantes */
  tyreRack(-hx+.7,dp*.7,'u+',4);
  for(const v of [dp*.45,dp*.62]){const b=P(det('plain'),hx-.3,v,'u-',0);b.box(.03,2.2,1.2,0,2.6,0,0xc01818);b.box(.035,2.2,.25,0,2.6,.0,0xf4f4f4);}
  const cw=P(det('plain'),hx-1.6,dp*.5,'u-',0);for(let k=0;k<3;k++) cw.box(1.0,.1,1.0,0,.1+k*.1,0,k%2?0x1a1a1a:0xc01818);}
 if(id==='garage5'){ /* petit atelier de quartier : coin d'attente, tarifs et étagère de bidons */
  bench(-6.6,1.1,'back',0x5a3a22);table(-4.3,1.2,'back',0xc8b896,.8);plant(-3.4,1.4,'back');
  col(-6.0,1.3,3.2,1.0);
  k.signPlane(z,-.2,dp-.28,2.9,1.8,.8,'door',(x,ww,hh)=>{x.fillStyle='#f2ecd2';x.fillRect(0,0,ww,hh);x.fillStyle='#2f8a4a';x.fillRect(0,0,ww,hh*.28);x.fillStyle='#fff';x.font='bold '+hh*.2+'px Arial';x.textAlign='center';x.fillText('TARIFS',ww/2,hh*.22);x.fillStyle='#222';x.font=hh*.12+'px Arial';x.textAlign='left';['Vidange ......... 80 €','Freins .......... 130 €','Pneus ........... 55 €','Diagnostic ...... 40 €'].forEach((t,i)=>x.fillText(t,ww*.08,hh*.46+i*hh*.16));});
  const sh=P(core('plain'),hx-.4,dp*.48,'u-',0),sd=P(det('plain'),hx-.4,dp*.48,'u-',0);
  sh.box(.4,.04,2.0,0,1.2,0,0x6a5034);sh.box(.4,.04,2.0,0,1.8,0,0x6a5034);for(const s of [-1,1]) sh.box(.04,1.8,.04,0,.9,s*.95,0x3a444e);
  for(let i=0;i<5;i++){sd.cyl(.09,.09,.26,8,-.02,1.35,-.8+i*.4,[0xe8c020,0x2a7a3a,0xc02020,0x1f4a8a,0xf0f0f0][i]);sd.cyl(.09,.09,.26,8,-.02,1.95,-.8+i*.4,[0x1f4a8a,0xf0f0f0,0xe8c020,0xc02020,0x2a7a3a][i]);}
  col(hx-.4,dp*.48,.5,2.1);}
 if(id==='garage6'){ /* garage familial : bureau d'« & Fils », banc de géométrie, pneus en rayon */
  desk(-9.4,2.0,'back',0x8a6a44);const fc=P(core('plain'),-12.2,1.1,'back',0);fc.box(.6,1.3,.5,0,.65,0,0x8a9096);for(let i=0;i<3;i++) fc.box(.5,.02,.02,0,.35+i*.4,.26,0x30343a);col(-12.2,1.1,.7,.6);
  bench(-5.4,1.1,'back',0x5a3a22);plant(-3.6,1.2,'back');
  align(8,dp-8,0xd8841a);tyreRack(hx-.7,dp*.78-.5,'u-',4);
  const ph=P(D.B('detail','posters'),-hx+.28,dp*.78,'u+',0);ph.quad(.62,1.2,0,1.9,0,null,[2/4,0,3/4,1]);}
 if(id==='garage7'){ /* grand garage vitré : salon d'attente, hall de réception, deux bancs de contrôle */
  lounge(-12.5,4.6,0x1a6a9a,0xdfe4ea);plant(-8.6,3.4,'door');plant(-16.6,3.4,'door');
  rug(-12.5,4.6,4.4,5.2,0xc8d4e0,0xe8eef4);
  const cf=P(core('plain'),-18.0,2.0,'back',0),cd=P(det('plain'),-18.0,2.0,'back',0);cf.box(1.2,1.0,.6,0,.5,0,0xdfe4ea);cf.box(1.3,.05,.7,0,1.02,0,0x1a6a9a);cd.box(.4,.35,.3,0,1.2,0,0x2f3338);cd.cyl(.05,.05,.1,6,.4,1.1,0,0xf0f0f0);col(-18.0,2.0,1.4,.8);
  align(8,dp-8,0x1a6a9a);tyreRack(-hx+.7,dp*.72,'u+',4);tyreRack(-hx+.7,dp*.72+3.2,'u+',4);
  k.signPlane(z,-12.5,.6,3.0,2.0,1.0,'back',(x,ww,hh)=>{x.fillStyle='#0e2a40';x.fillRect(0,0,ww,hh);x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='bold '+hh*.2+'px Arial';x.fillText("Bienvenue",ww/2,hh*.3);x.font=hh*.12+'px Arial';x.fillText("Café offert en salle d'attente",ww/2,hh*.6);});}
 function dl_car(B,x,y,zz,c){B.box(.34,.12,.2,x,y+.08,zz,c);B.box(.18,.1,.16,x,y+.18,zz,c);}
};
/* test de parcours : le cercle (x,z,r) est-il libre de tout obstacle ? */
const libre=(x,zz,r)=>{const W=MW.walls||[];for(const w of W){const cx=Math.max(w[0],Math.min(x,w[2])),cz=Math.max(w[1],Math.min(zz,w[3]));if((x-cx)**2+(zz-cz)**2<r*r) return false;}return true;};
return {REPERES,libre};
})();
