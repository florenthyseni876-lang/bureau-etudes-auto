'use strict';
/* ───────────── Modèle véhicule ───────────── */
function computeCar(S,E){
  const B=BODY[S.body],ch=CHAS[S.chassis],pn=PANEL[S.panels],gb=GBX[S.gearbox],ty=TYRE[S.compound];
  const g0=9.81,rho=1.2,front=S.enginePos==='FT'||S.enginePos==='FL',sz=B.m/620;
  const od=S.rim*25.4+2*S.tireW*S.profile/100,r=Math.min(od,B.tireMax)/2000,wR=S.tireW+S.stagger;
  const tireStr=`${S.tireW}/${S.profile} R${S.rim}`+(S.stagger?` · ${wR}/${Math.max(20,Math.round(S.tireW*S.profile/wR/5)*5)} R${S.rim}`:'');
  // masses
  const mRim=w=>(.7*S.rim-2)*{steel:1.15,alloy:1,forged:.74}[S.rimType]*(.7+.3*w/205),mTire=w=>.03*w+.2*S.rim;
  const mBrk=(t,d)=>t==='drum'?2*(7+Math.pow(d/250,2)*4):2*(Math.pow(d/300,2)*7*BRK[t].m+4.5);
  const parts={
    caisse:B.m*(.72*ch.mf+.28*pn.mf)+{none:0,lip:2,wing:9}[S.wing]+(S.splitter?4:0)+(S.flatFloor?11:0),
    moteur:E.mass,
    transmission:36+.085*E.peakT+4*(S.gears-5)+gb.m+(GEARSETS[S.gearSet]?0:(S.gbxCap-450)*.035)+{fwd:18,rwd:front?46:20,awd:84}[S.drive]+{open:0,lsd:6,active:14}[S.diff],
    trains:(SUSP[S.suspF].m+SUSP[S.suspR].m)*sz+2*(mRim(S.tireW)+mTire(S.tireW))+2*(mRim(wR)+mTire(wR))+mBrk(S.brakeF,S.brakeFd)+mBrk(S.brakeR,S.brakeRd),
    habitacle:TRIM[S.trim].m*(.5+.1*S.seats)+MEDIA[S.media].m,
    securite:PASS[S.passive].m+(S.abs?6:0)+(S.tc?1:0)+(S.esp?3:0)+STEER[S.steering].m,
    divers:B.tank*.75+18+55*sz+(S.muffler==='comf'?8:S.muffler==='valve'?5:0),
  };
  const mass=Object.values(parts).reduce((a,b)=>a+b,0),mP=mass+75;
  let fw=POS[S.enginePos].fw+(E.mass-140)*.025*(front?1:-1)+(S.drive==='rwd'&&front?-2:0)+(S.drive==='awd'?(front?-1.5:2):0);
  fw=clamp(fw,34,68)/100;
  const h=(.37*B.H+(S.gc-B.gc0)*.8+(E.hgt-640)*.03)/1000,track=(B.W-240)/1000,hL=h/(B.WB/1000);
  // aéro
  const cd=B.cd+{none:0,lip:.008,wing:.04}[S.wing]+(S.splitter?.008:0)-(S.flatFloor?.014:0)+(S.gc-B.gc0)*.00018+(S.tireW-205)*.00011;
  const A=B.A+(S.gc-B.gc0)*B.W/1e6*.6,CdA=cd*A;
  const cl=.12-{none:0,lip:.07,wing:.28}[S.wing]-(S.splitter?.09:0)-(S.flatFloor?.16+clamp((140-S.gc)*.002,-.08,.08):0);
  const down=v=>-cl*.5*rho*A*v*v;
  // pneus
  const muBase=ty.mu*(1-.0001*(mass/4-340));
  const muF=muBase*(1+.0007*(S.tireW-205)),muR=muBase*(1+.0007*(wR-205));
  const crr=ty.crr*(1+.0006*((S.tireW+wR)/2-205));
  // boîte
  const cvt=S.gearbox==='cvt',gset=GEARSETS[S.gearSet];let gears=[];
  if(cvt) for(let i=0;i<24;i++) gears.push(S.first*Math.pow(S.top/S.first,i/23));
  else if(gset&&gset.r) gears=gset.r.slice();
  else for(let i=0;i<S.gears;i++) gears.push(S.first*Math.pow(S.top/S.first,Math.pow(i/(S.gears-1),.88)));
  const n=gears.length;
  const etaD=gb.eta*(S.drive==='awd'?.955:1)*(S.drive==='rwd'&&front?.985:1);
  const lim=E.limiter,wRpm=(v,g)=>v/r*gears[g]*S.final*30/Math.PI;
  const vAt=(rpm,g)=>rpm*Math.PI/30*r/(gears[g]*S.final)*3.6;
  const res=v=>.5*rho*CdA*v*v+crr*(1+v*v/8000)*mP*g0;
  const shiftRpm=gears.map((gr,g)=>{if(g===n-1) return lim;if(cvt) return Math.min(lim-30,E.peakPrpm+120);const k=gears[g+1]/gr;for(let rpm=Math.max(E.peakTrpm,2000);rpm<lim;rpm+=50){if(rpm*k>E.idle&&E.tq(rpm)<E.tq(rpm*k)*k) return rpm;}return lim-30;});
  // motricité
  const dF={open:.93,lsd:1,active:1.02}[S.diff]*(S.tc?1:.96)*1.02*(S.launchCtl&&E.ecuOn?1.03:1),W=mP*g0;
  const Ftr=S.drive==='fwd'?muF*dF*W*fw/(1+muF*dF*hL):S.drive==='rwd'?muR*dF*W*(1-fw)/(1-muR*dF*hL):(muF+muR)/2*dF*W*.98;
  const isAuto=S.gearbox==='auto'||cvt;
  const launch=isAuto?Math.min(2400,Math.max(1600,E.peakTrpm)):clamp(E.peakTrpm,1800,lim*.8);
  // départ arrêté
  const out={},trace=[],dt=.01;let t=0,v=0,x=0,g=0,sh=0,slipT=0,next=0;
  const marks=[[80,'t80'],[100,'t100'],[120,'t120'],[200,'t200']];
  while(t<60&&x<1010){
    const ratio=gears[g]*S.final,rpm=wRpm(v,g);
    let rpmE=rpm,mult=1,F=0;
    if(g===0&&rpm<launch){rpmE=launch;if(isAuto) mult=1+.7*(1-rpm/launch);}
    rpmE=clamp(rpmE,E.idle,lim);
    if(rpm<lim) F=E.tq(rpmE)*mult*ratio*etaD/r;
    if(sh>0){F*=gb.cut;sh-=dt;}
    let slip=false;if(F>Ftr){if(F>Ftr*1.15) slipT+=dt;F=Ftr*.97;slip=true;}
    const a=(F-res(v))/(mP*(slip?1.03:1.04+.0011*ratio*ratio)),v2=Math.max(0,v+a*dt);
    for(const [kmh,key] of marks){const vv=kmh/3.6;if(!out[key]&&v<vv&&v2>=vv) out[key]=t+dt*(vv-v)/(v2-v);}
    x+=(v+v2)/2*dt;v=v2;t+=dt;
    if(!out.t400&&x>=400){out.t400=t;out.v400=v*3.6;}
    if(!out.t1000&&x>=1000){out.t1000=t;out.v1000=v*3.6;}
    if(sh<=0&&g<n-1&&wRpm(v,g)>=shiftRpm[g]){g++;sh=gb.shift;}
    if(t>=next-1e-9){trace.push({t,v:v*3.6,x,g,rpm:Math.round(clamp(Math.max(wRpm(v,g),g===0?Math.min(launch,rpmE):0),E.idle,lim))});next+=.05;}
  }
  const spin=slipT>.8;
  // vitesse maxi
  let vmax=0,vg=0,vlim=false;
  for(let gi=0;gi<n;gi++) for(let kmh=20;kmh<=470;kmh+=.5){
    const vv=kmh/3.6,rpm=wRpm(vv,gi);if(rpm>lim) break;if(rpm<E.idle) continue;
    if(E.tq(rpm)*gears[gi]*S.final*etaD/r>=res(vv)&&kmh>vmax){vmax=kmh;vg=gi;vlim=rpm>lim-90;}
  }
  // freinage
  const muB=(muF+muR)/2*1.09,need=mP*g0*muB,fsB=clamp(fw+muB*hL,.5,.92);
  const capF=2*BRK[S.brakeF].k*(S.brakeFd/1000)*24000,capR=2*BRK[S.brakeR].k*(S.brakeRd/1000)*24000;
  const capFac=Math.min(1,capF/(need*fsB),capR/(need*(1-fsB)));
  const dec=muB*g0*capFac*(S.abs?1:.87),brake100=27.78*27.78/(2*dec);
  const therm=2*BRK[S.brakeF].th*Math.pow(S.brakeFd/300,2)*100+2*BRK[S.brakeR].th*Math.pow(S.brakeRd/300,2)*100;
  const fade=clamp(100*therm/(mP*.38*(.3+Math.pow(vmax/220,2))),0,100);
  const discMax=S.rim*25.4-75;
  // tenue de route
  const sF=SUSP[S.suspF],sR=SUSP[S.suspR],st=S.stiff/100,rollBias=(S.arbF-S.arbR)/100;
  const common=(1-.07*Math.pow(1-st,2)-.02*Math.pow(st,3))*(1-(h/track-.34)*.22)*(.965+.035*ch.rig/100)*(1+(50-S.profile)*.0007);
  const gF=muF*sF.grip*(1-.05*rollBias)*common,gR=muR*sR.grip*(1+.05*rollBias)*common;
  const gLat=Math.min(gF,gR),gAero=gLat*(1+down(41.7)/(mP*g0));
  const pwr=E.peakP/(mass/1000);
  const bal=clamp((gR-gF)/((gR+gF)/2)*130+(fw-.5)*50+(S.drive==='fwd'?4:S.drive==='rwd'?-4*Math.min(1,pwr/200):1)+(S.enginePos==='RR'?-4:0),-30,30);
  const agility=clamp(100-(mass-900)/14-(B.WB-2400)/25+st*10+(S.steering==='mech'?-4:0),0,100);
  const gripSc=clamp((gLat-.75)/.6*100,0,100);
  const handling=clamp((100-Math.abs(bal-1)*2.6)*.45+gripSc*.35+agility*.2,0,100);
  // confort, sécurité, usages
  const comfort=clamp(68+(sF.comf+sR.comf-150)*.28-(st-.35)*30+clamp((S.profile-50)*.45,-12,9)+TRIM[S.trim].comf+ch.comf+ty.comf+(B.WB-2600)*.012
    -Math.max(0,E.noise-55)*.28+(E.smooth-70)*.12+(gb.comf-60)*.08+(S.steering==='mech'?-5:0)+(B.kind==='roadster'?-5:0)+(S.media!=='none'?2:0)-Math.max(0,130-S.gc)*.08,0,100);
  const safety=clamp(ch.saf+PASS[S.passive].s+(S.abs?5:0)+(S.esp?7:0)+(S.tc?2:0)+clamp((mass-1200)*.006,-4,6)+clamp((40-brake100)*.5,-5,4)+(B.kind==='roadster'?-4:0),0,100);
  const cargo=B.cargo*(S.enginePos==='MR'?.6:S.enginePos==='RR'?.75:1)*(S.seats===7?.55:1)*(S.drive==='awd'?.93:1);
  const pract=clamp(S.seats*9+cargo*.07+(B.pill.length>=2?12:0)+clamp((S.gc-120)*.05,0,6),0,100);
  const off=clamp(clamp((S.gc-130)*.28,0,42)+(S.drive==='awd'?22:S.drive==='rwd'?4:2)+(S.diff!=='open'?5:0)+ty.off*.14+(sF.off+sR.off)*.07+(S.chassis==='ladder'?6:0)+clamp((E.tq(2000)/mass-.12)*60,0,8),0,100);
  const prest=clamp(TRIM[S.trim].pres*.42+MEDIA[S.media].p*.5+E.smooth*.14+clamp(E.peakP/6,0,22)+(E.n>=8?8:E.n>=6?4:0)+(S.chassis==='carbon'?6:S.chassis==='alu'?3:0)+(S.panels==='carbon'?4:0),0,100);
  // consommation
  const fu=FUEL[S.fuel],pAv=rpm=>E.tq(rpm)*rpm*Math.PI/30;
  const fuelW=vv=>{
    const Pe=res(vv)*vv/etaD+600;let rpm=E.idle;
    for(let gi=n-1;gi>=0;gi--){const rr=wRpm(vv,gi);if(gi===0||(rr>=Math.max(1250,E.idle+250)&&pAv(rr)*.85>=Pe)){rpm=Math.max(rr,E.idle);break;}}
    rpm=Math.min(rpm,lim);
    const load=clamp(Pe/Math.max(1,pAv(rpm)),0,1);
    return (Pe+(E.fmep(rpm)+E.pumpK*(1-load))*1e5*E.dispM3*rpm/120)/E.etaC;
  };
  const l100=jkm=>jkm/(fu.lhv*1e6)*100;
  const urb=l100(fuelW(8.33)/8.33*1000+2.5*.5*mP*13.9*13.9/(etaD*E.etaC*.7)+(S.startStop&&E.ecuOn?8:35)*(E.fmep(E.idle)+E.pumpK)*1e5*E.dispM3*E.idle/120/E.etaC);
  const road=l100(fuelW(25)/25*1000),hwy=l100(fuelW(36.11)/36.11*1000);
  const mix=.35*urb+.4*road+.25*hwy;
  const conso={urb,road,hwy,mix},co2=mix*fu.co2,range=B.tank/mix*100;
  // coûts
  const rimC=w=>({steel:40+4*S.rim,alloy:90+9*S.rim,forged:3*(90+9*S.rim)}[S.rimType])+ty.cost*(w/205)*(S.rim/16);
  const costs={
    'Caisse et structure':B.m*5+(ch.cost+pn.cost)*sz+{none:0,lip:120,wing:900}[S.wing]+(S.splitter?350:0)+(S.flatFloor?1400:0),
    'Moteur':E.cost,
    'Transmission':gb.cost+(GEARSETS[S.gearSet]?0:Math.max(-300,(S.gbxCap-450)*3))+120*(S.gears-5)+1.8*E.peakT+{fwd:300,rwd:650,awd:1900}[S.drive]+{open:0,lsd:700,active:2200}[S.diff],
    'Trains roulants':SUSP[S.suspF].cost+SUSP[S.suspR].cost+2*rimC(S.tireW)+2*rimC(wR)+BRK[S.brakeF].cost*S.brakeFd/300+BRK[S.brakeR].cost*S.brakeRd/300,
    'Habitacle':TRIM[S.trim].cost*(.6+.1*S.seats)+MEDIA[S.media].cost,
    'Sécurité et aides':PASS[S.passive].cost+(S.abs?350:0)+(S.tc?150:0)+(S.esp?300:0)+STEER[S.steering].cost,
    'Assemblage':1300+.5*mass,
  };
  const cost=Object.values(costs).reduce((a,b)=>a+b,0),price=cost*1.25;
  // usages
  const sc=(v,lo,hi)=>clamp((v-lo)/(hi-lo)*100,0,100);
  const sAcc=out.t100?sc(16-out.t100,0,13):0,sV=sc(vmax,130,330),sBrk=sc(48-brake100,0,18),sEco=sc(14-mix,0,10);
  const sPrice=sc(60000-price,0,48000),sPriceS=sc(140000-price,0,110000),sSize=sc(4700-B.L,0,1100);
  const seg={
    'Citadine':.28*sEco+.24*sPrice+.14*sSize+.12*comfort+.12*E.rel+.10*safety,
    'Familiale':.22*pract+.18*comfort+.18*safety+.14*sEco+.14*E.rel+.14*sPrice,
    'Sportive':.26*sAcc+.24*handling+.14*sBrk+.14*E.sound+.12*sV+.10*sPriceS,
    'Grand tourisme':.24*comfort+.20*prest+.16*E.smooth+.14*sAcc+.12*safety+.14*(100-E.noise),
    'Tout-terrain':.6*off+.15*E.rel+.15*pract+.10*clamp(E.tq(2000)/3,0,100),
    'Circuit':.26*sc(pwr,60,520)+.26*sc(gAero,.8,1.6)+.10*sBrk+.08*fade+.12*clamp(100-Math.abs(bal)*3,0,100)+.10*gb.sport+.08*sc(1900-mass,0,1100),
  };
  const best=Object.entries(seg).sort((a,b)=>b[1]-a[1])[0];
  // contrôles
  const bay=B.bay[S.enginePos],trans=S.enginePos==='FT',maxW=trans?720:B.bw;
  const fit={len:E.len,max:bay,wid:E.wid,maxW,ok:E.len<=bay&&E.wid<=maxW};
  const K=[],add=(lv,t,d)=>K.push({lv,t,d});
  add(fit.ok?'ok':'crit','Implantation du moteur',fit.ok?`Le ${E.c.lab} (${nf(E.len)} × ${nf(E.wid)} mm) tient dans le compartiment (${nf(bay)} × ${nf(maxW)} mm).`:`Le ${E.c.lab} mesure ${nf(E.len)} × ${nf(E.wid)} mm pour un compartiment de ${nf(bay)} × ${nf(maxW)} mm. Réduisez l'alésage, le nombre de cylindres, ou changez d'implantation.`);
  if(E.dz) add(S.cr>=14.5?'ok':'crit','Auto-allumage',S.cr>=14.5?`Taux de ${nf(S.cr,1)} : le gazole s'enflamme par la seule compression.`:`Taux de ${nf(S.cr,1)} trop faible pour enflammer le gazole. Visez 15 à 20.`);
  else add(E.knock<=0?'ok':E.knock<1?'warn':'crit','Cliquetis',E.knock<=0?`Taux effectif ${nf(E.effCR,1)} pour une limite de ${nf(E.limit,1)} avec ce carburant.`:`Taux effectif ${nf(E.effCR,1)} au-dessus de la limite ${nf(E.limit,1)}. Baissez la compression ou la pression, ou passez à un carburant plus détonant-résistant.`);
  const o1=E.spLim/E.spMax;
  add(o1<.92?'ok':o1<1.04?'warn':'crit',E.rot?"Vitesse des segments d'arête":'Vitesse de piston',`${nf(E.spLim,1)} m/s au rupteur pour un équipage mobile donné à ${E.spMax} m/s.`+(o1>=.92?' Raccourcissez la course, baissez le rupteur ou montez un équipage plus résistant.':''));
  const o2=E.specT/E.tMax;
  add(o2<.9?'ok':o2<1.05?'warn':'crit','Tenue au couple',`${nf(E.specT)} Nm/l pour une limite de ${nf(E.tMax)} Nm/l.`+(o2>=.9?" L'équipage mobile est trop sollicité.":''));
  {const q=E.oilQ,o=E.oil,lit=nf(E.oilCap*q,1),cap=nf(E.oilCap,1);let lv='ok',d=`${lit} l de ${o.n} pour ${cap} l prévus : le film d'huile tient à pleine charge.`;
    if(q<.6){lv='crit';d=`${lit} l pour ${cap} l prévus : la pompe aspire de l'air à haut régime, les coussinets ne sont plus lubrifiés.`;}
    else if(q>1.3){lv='crit';d=`${lit} l pour ${cap} l prévus : le vilebrequin barbote dans l'huile et la fait mousser. Pression instable, fuites aux joints, catalyseur encrassé.`;}
    else if(q<.85){lv='warn';d=`${lit} l pour ${cap} l prévus : niveau bas, l'huile chauffe davantage et la marge avant déjaugeage est faible.`;}
    else if(q>1.1){lv='warn';d=`${lit} l pour ${cap} l prévus : trop-plein, le vilebrequin effleure l'huile. Frottements et moussage.`;}
    else if(o.h<E.oilReq-.5){lv=o.h<E.oilReq-3?'crit':'warn';d=`La ${o.n} est trop fluide à chaud pour ce moteur (${nf(E.peakP/E.L)} ch/l) : le film se rompt à pleine charge. Choisissez un grade à chaud plus élevé.`;}
    else if(o.h>E.oilReq+8){lv='warn';d=`La ${o.n} est plus épaisse que nécessaire : frottements et consommation en hausse, pression très élevée à froid.`;}
    add(lv,'Lubrification',d);}
  if(E.limiter>E.floatRpm) add(E.limiter>E.floatRpm+400?'crit':'warn','Affolement des soupapes',`La distribution décroche vers ${nf(Math.round(E.floatRpm/50)*50)} tr/min, avant le rupteur réglé à ${nf(E.limiter)} tr/min.`);
  add(capFac>=1?(fade>=45?'ok':'warn'):'crit','Freinage',capFac>=1?`Capacité suffisante, endurance ${nf(fade)}/100.`+(fade<45?' Les freins chaufferont vite en usage soutenu.':''):`Les freins ne peuvent exploiter que ${nf(capFac*100)} % de l'adhérence des pneus. Augmentez le diamètre ou changez de technologie.`);
  if(S.brakeFd>discMax||S.brakeRd>discMax) add('crit','Disques et jantes',`Une jante de ${S.rim}" accepte ${nf(discMax)} mm au plus.`);
  if(od>B.tireMax) add('crit','Passages de roue',`La roue fait ${nf(od)} mm de diamètre pour ${nf(B.tireMax)} mm admis par cette caisse.`);
  else if(od<B.tireMax-150) add('warn','Passages de roue',`La roue de ${nf(od)} mm paraît petite pour cette caisse (jusqu'à ${nf(B.tireMax)} mm).`);
  if(spin) add('warn','Motricité','Les roues motrices patinent au démarrage : le couple dépasse ce que les pneus transmettent.');
  const gbxCap=gset?gset.cap:S.gbxCap,gbxR=E.peakT/gbxCap;
  {let wk=null,wr=0;for(const k in E.fails) if(E.fails[k].r>wr){wr=E.fails[k].r;wk=k;}
   const lv=wk?lvOf(wk,wr):'ok';if(wk) add(lv==='break'?'crit':lv==='crit'?'warn':'ok','Résistance du moteur',lv==='ok'||lv==='warn'?`Organe le plus sollicité : ${lc(FAILS[wk].n)} (${nf(wr*100)} % de sa limite).`:`${FAILS[wk].n} à ${nf(wr*100)} % de sa limite : ${lv==='break'?'le moteur cassera lors d\'un essai à fond.':'usure très rapide.'} ${FAILS[wk].fix}`);}
  add(gbxR<.9?'ok':gbxR<1?'warn':'crit','Boîte et embrayage',`${nf(E.peakT)} Nm pour une boîte prévue pour ${nf(gbxCap)} Nm${gbxR>=1.25?' : elle cassera pendant un essai à fond.':gbxR>=1?' : l\'embrayage patine et s\'use vite.':'.'}`);
  if(S.sump==='wet'&&gLat>1.1) add('warn',"Déjaugeage de l'huile",`À ${nf(gLat,2)} g en virage, l'huile d'un carter humide se plaque d'un côté et la pompe aspire de l'air. Un carter sec règle le problème.`);
  if(E.ecuOn&&S.ecuVmax&&vmax>250){vmax=250;add('ok','Bridage électronique','Le calculateur coupe à 250 km/h : la voiture irait plus vite sans ce bridage.');}
  if(E.mism==='lean') add('crit','Calculateur',`La cartographie est prévue pour ${FUEL[S.ecuFuel].n} mais le réservoir contient ${FUEL[S.fuel].n}, qui demande ${nf((FNEED[S.fuel]/FNEED[S.ecuFuel]-1)*100)} % de carburant en plus. Les corrections automatiques sont à bout : mélange trop pauvre, ratés, perte de puissance. Recalibrez le calculateur ou montez un capteur d'éthanol.`);
  else if(E.mism==='rich') add('warn','Calculateur',`La cartographie est prévue pour ${FUEL[S.ecuFuel].n} : avec ${FUEL[S.fuel].n} le mélange est trop riche, le moteur consomme et s'encrasse.`);
  if(S.fuelSys!=='carb') add(E.duty>1?'crit':E.duty>.85?'warn':'ok','Injecteurs',E.duty>1?`Il faudrait ${nf(E.injNeed,-1)} cm³/min par injecteur, ils n'en débitent que ${nf(E.injFlow,-1)} : le moteur manque de carburant en haut et sa puissance plafonne. Montez des injecteurs plus gros ou augmentez la pression.`:E.injBig?`Injecteurs très surdimensionnés (${nf(E.duty*100)} % d'ouverture à pleine puissance) : dosage imprécis au ralenti.`:`Ouverts à ${nf(E.duty*100)} % à pleine puissance${E.duty>.85?' : au-delà de 85 %, ils chauffent et la marge est nulle.':'.'}`);
  if(E.idleLow) add('warn','Ralenti',`${nf(E.idle)} tr/min, c'est trop bas pour cet arbre à cames (${nf(E.idle0)} tr/min conseillés) : le moteur broute et peut caler.`);
  if(cvt){}
  else if(vlim&&vg===n-1) add('warn','Étagement',`La vitesse maxi est atteinte au rupteur en ${n}e. Un dernier rapport ou un pont plus long libérerait de la vitesse.`);
  else if(vg<n-1) add('ok','Étagement',`La vitesse maxi est atteinte en ${vg+1}e ; la ${n}e sert de rapport de croisière.`);
  if(!E.emis) add('warn','Homologation','Sans catalyseur ni injection, le véhicule ne passe pas les normes antipollution : usage piste uniquement.');
  if(S.muffler==='free') add('warn','Niveau sonore','Échappement libre : au-delà des limites de bruit sur route ouverte.');
  if(range<400) add('warn','Autonomie',`${nf(range)} km avec un réservoir de ${B.tank} l.`);
  if(S.gc<95) add('warn','Garde au sol',`${S.gc} mm : frottements probables sur ralentisseurs.`);
  for(const k of Object.keys(FAULTS)) if(ui.faults[k]&&(!FAULTS[k].ok||FAULTS[k].ok(E))) add('crit','Panne : '+FAULTS[k].n(E),FAULTS[k].d(E));
  const issues=K.filter(k=>k.lv!=='ok').length;
  return Object.assign(out,{gbxCap,gbxR,dyn:{gears,r,etaD,mP,res,Ftr,shiftRpm,launch,wRpm,lim,isAuto,cut:gb.cut,shift:gb.shift,pAv},fuelW,lhv:fu.lhv,mass,mP,parts,fw,h,cd,A,CdA,cl,down200:down(55.56)/g0,od,r,wR,tireStr,gears,etaD,shiftRpm,launch,vAt,spin,trace,
    vmax,vg,vlim,brake100,capFac,fade,discMax,cvt,gLat,gAero,bal,handling,comfort,safety,pract,off,prest,cargo,conso,co2,range,costs,cost,price,seg,best,fit,checks:K,issues,pwr});
}
