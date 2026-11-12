'use strict';
/* ───────────── Modèle moteur ───────────── */
function computeEngine(S){
  const c=CFG[S.config],n=c.n,rot=c.rot||0,vt=rot?VTR:VT[S.valvetrain],fs=FS[S.fuelSys],fu=FUEL[S.fuel];
  const bore=rot?86:S.bore,stroke=rot?62:S.stroke;
  const disp=rot?3*Math.sqrt(3)*(S.bore/7)*S.bore*S.stroke*rot/1000:Math.PI/4*bore*bore*stroke*n/1000,L=disp/1000,dispM3=disp*(rot?2:1)/1e6,Ls=rot?2*L:L;
  const F=ui.faults,fOn=k=>!!F[k],ecu0=S.fuelSys!=='carb'&&S.fuelSys!=='idi';
  const cam=S.cam/100,nt=NT[S.aspiration]||0,turbo=nt>0,sc=S.aspiration==='sc',boosted=turbo||sc,bi=nt>1,stg=nt>1?S.turboStage:'par',ts2=S.turboSize2/100;
  const boost=boosted?S.boost*(fOn('boost')?.2:1):0,ts=S.turboSize/100;
  const blk=BLOCK[S.blockMat],lin=LINER[S.liner],vm=VALVE[S.valveMat],spg=SPRING[S.springs],itk=INTAKE[S.intake],tt=TURBO[S.turboType],tbr=BEAR[S.turboBearing],sct=SCT[S.scType],dry=S.sump==='dry';
  const exh=EXH.man[S.manifold].f*EXH.cat[S.cat].f*EXH.muf[S.muffler].f*(dry?1.008:1)*(fOn('cat')&&S.cat!=='none'?.93:1);
  const rpmPk=(2800+4200*cam)*Math.pow(86/stroke,.5)*vt.rf;
  const vePk=vt.ve+.07*cam+fs.ve+(S.vvl?.01:0)+itk.ve-(fOn('timing')?.08:0);
  const aLow=(.18+.42*cam)*(S.vvt?.6:1)*(S.vvl?.85:1)*itk.al*(fOn('timing')?1.25:1);
  const aHigh=vt.ah*Math.pow(stroke/bore,.4)*(S.vvl?.75:1)*itk.ah*(fOn('cat')&&S.cat!=='none'?2.4:1);
  const tm=TIMING[S.timing],two0=c.lay!=='I'&&!rot,tmF=(rot?0:1)*(S.valvetrain==='ohv'?.5:1)*(two0?1.7:1)*(S.valvetrain.indexOf('dohc')===0?1.25:1)*(.8+.05*n),tmMass=tm.m*tmF;
  const floatRpm=vt.flt*Math.pow(86/stroke,.25)*(S.internals==='ti'?1.05:1)*tm.flt*vm.flt*spg.flt;
  const dz=!!fu.diesel,otto=(1-Math.pow(S.cr,-.3))/(1-Math.pow(10,-.3))*(dz?.93:1)*(c.rot?.82:1);
  let mism='',lamK=1;if(ecu0&&!fu.diesel&&!S.flex&&S.ecuFuel!==S.fuel){const rr=FNEED[S.fuel]/FNEED[S.ecuFuel];lamK=rr/clamp(rr,.8,1.25);mism=lamK>1.03?'lean':lamK<.97?'rich':'';}
  const adv=ecu0?S.ecuAdv:0,misK=(mism==='lean'?.84:mism==='rich'?.96:1)*(S.fuel==='e85'&&S.ecuFuel!=='e85'&&!S.flex&&ecu0?1/1.04:1)*(1+.004*adv-.0006*adv*adv);
  const lam=clamp((fOn('lambda')&&ecu0&&!fu.diesel?.8:S.lambda)*lamK,.7,1.2),mixF=l=>1-2.2*(l-.88)*(l-.88),mix=dz?.72:mixF(lam);
  const icT={none:.62,air:.45,water:.40}[S.intercooler],icD={none:.72,air:.88,water:.92}[S.intercooler];
  const spF=[1,1,.82,.74,.68],chF=[1,1,1.12,1.2,1.26],nSm=stg==='seq'?(nt===4?2:1):stg==='comp'?(nt>=3?2:1):nt,bl=Math.min(S.boostLow*(fOn('boost')?.2:1),boost);
  const tcv=(size,cnt,rpm)=>{const s0=(900+2200*size)*spF[cnt]*tt.sp*tbr.sp,s1=s0+(900+1500*size)*tt.sp,chk=(4200+4500*size)*chF[cnt]*tt.ch;return [sstep((rpm-s0)/(s1-s0)),1-.45*clamp((rpm-chk)/(chk*.5),0,1)];};
  const prAt=rpm=>{
    if(turbo){
      if(stg==='par'){const [sp,tap]=tcv(ts,nt,rpm);return 1+boost*sp*tap;}
      const [spA,tapA]=tcv(ts*.8,nSm,rpm),[spB,tapB]=tcv(ts2,stg==='seq'?nt:Math.max(1,nt-nSm),rpm);
      if(stg==='seq') return 1+Math.max(bl*spA*tapA,boost*Math.min(spB,sstep((rpm-S.seqRpm)/700))*tapB);
      return (1+bl*spA)*(1+Math.max(0,(1+boost)/(1+bl)-1)*Math.min(spB,sstep((rpm-S.seqRpm+600)/1200))*tapB);
    }
    if(sc) return S.scType==='centri'?1+boost*Math.pow(Math.min(1,rpm/S.limiter),1.8):1+boost*(.7+.3*Math.min(1,rpm/3500));
    return 1;
  };
  const limit=fu.oct+fs.knock+lin.kn+vm.kn+(rot?.5:0)+(S.headMat==='alu'?.4:0)-Math.max(0,bore-86)*.025+clamp((.92-lam)*4,-.5,.5);
  const effCR=S.cr*Math.pow(1+boost,boosted?icT:0)+.12*adv;
  const knock=dz?0:Math.max(0,effCR-limit),ecu=S.fuelSys!=='carb';
  const knockF=1-Math.min(.35,(ecu?.05:.02)*knock);
  const oil=OIL[S.oilGrade],oilCap=Math.round((2.2+.75*L+.12*n)*10)/10,oilQ=S.oilFill/100;
  const fr=vt.fr*(1+.015*(n-4))*(dz?1.2:1)*tm.fr*lin.fr*(1+.012*(oil.h-11))*(oilQ>1.1?1+(oilQ-1.1)*.25:1);
  const fmep=rpm=>{const sp=2*stroke*rpm/60000;return (.40+.055*sp+.0024*sp*sp)*fr;};
  const fK=misK*(fOn('misfire')?(n-1)/n*.97:1)*(fOn('headgasket')?.9:1)*(fOn('coolant')?.75:1);
  const tq0=(rpm,bf)=>{
    const x=rpm/rpmPk;
    let ve=x<1?vePk*(1-aLow*Math.pow(1-x,1.7)):vePk*(1-aHigh*(x-1)*(x-1));
    if(rpm>floatRpm) ve*=Math.max(.15,1-Math.pow((rpm-floatRpm)/1400,2));
    ve=Math.max(.08,ve);
    const pr=1+(prAt(rpm)-1)*(typeof bf==='number'?bf:1);let loss=0;
    if(turbo) loss=.22*(pr-1); else if(sc) loss=sct.loss*(pr-1)*(.6+.4*rpm/6000);
    const imep=14.3*ve*otto*mix*fu.pw*exh*knockF*Math.pow(pr,boosted?icD:1)*(dz?1-.6*Math.pow(clamp((rpm-4200)/2200,0,1),2):1)-loss;
    return Math.max(0,imep*fK-fmep(rpm))*1e5*dispM3/(4*Math.PI);
  };
  let pkW=0;for(let r=1000;r<=S.limiter;r+=200) pkW=Math.max(pkW,tq0(r)*r*Math.PI/30);
  let capW=fOn('fuelpump')?pkW*.6:0;
  const nInj=S.fuelSys==='mono'?1:n,injNeed=pkW/735.5*5*FNEED[S.fuel]*(dz?1:.9/Math.min(lam,1))/nInj,injFlow=(S.injSize||1e6)*Math.sqrt(S.fuelPress/3),duty=S.fuelSys==='carb'?0:injNeed/injFlow;
  if(duty>1){const cw=pkW/duty;capW=capW?Math.min(capW,cw):cw;}
  const injBig=S.fuelSys!=='carb'&&injFlow>3.5*injNeed;
  const tq=(rpm,bf)=>{const t=tq0(rpm,bf);return capW&&t*rpm*Math.PI/30>capW?capW/(rpm*Math.PI/30):t;};
  const idle0=Math.round((650+450*cam+(n<=3?100:0)+(dz?150:0))/50)*50,idle=ecu0&&S.ecuIdle?S.ecuIdle:idle0,idleLow=idle<idle0-120,limiter=S.limiter;
  const curve=[];let peakP=0,peakPrpm=0,peakT=0,peakTrpm=0;
  for(let rpm=1000;rpm<=limiter+1;rpm+=100){
    const t=tq(rpm),p=t*rpm*Math.PI/30/1000*1.3596;
    curve.push({rpm,tq:t,pw:p});
    if(p>peakP){peakP=p;peakPrpm=rpm;} if(t>peakT){peakT=t;peakTrpm=rpm;}
  }
  const two=c.lay!=='I',k=two?n/2:n;
  let mass=(18+22*L+4*n)*blk.mf+(blk.mf<.6?n*lin.m:0)+(dry?9:0)+(turbo?tt.m*nt:0)+(8+7*L+2.5*n)*(S.headMat==='alu'?.6:1)*vt.hm*(two?1.2:1)+(6+9*L)*{cast:1,forged:.95,ti:.8}[S.internals]+25;
  if(dz) mass*=1.18;
  if(rot) mass=mass*.8+30;
  mass+=tmMass+oilCap*oilQ*.86;
  mass+=turbo?13+9*(nt-1)+(stg!=='par'?4:0):sc?19:0; if(boosted&&S.intercooler!=='none') mass+=S.intercooler==='water'?9:6;
  const nv=rot?0:n*(S.valvetrain==='dohc5'?5:S.valvetrain==='dohc4'?4:2);
  let cost=n*lin.cost+nv*vm.cost+spg.cost+itk.cost+(dry?1800:0)+(S.cda?400:0)+(turbo?(tt.cost+tbr.cost)*nt+(stg==='seq'?600:stg==='comp'?900:0):sc?sct.cost:0)+(300+90*n+250*L)*blk.cf+(200+60*n)*vt.hc*(S.headMat==='alu'?1.25:1)*(two?1.45:1)+(150+55*n+100*L)*{cast:1,forged:2.4,ti:6}[S.internals]
    +fs.cost+30*n+(S.vvt?220:0)+(S.vvl?380:0)+(turbo?100+900*nt:sc?1400:0)+(boosted?{none:0,air:300,water:650}[S.intercooler]:0)
    +EXH.man[S.manifold].c+EXH.cat[S.cat].c+EXH.muf[S.muffler].c+250+tm.cost*tmF;
  const spLim=2*stroke*limiter/60000,spMax={cast:19,forged:24,ti:28}[S.internals];
  const specT=peakT/Ls,tMax={cast:120,forged:200,ti:240}[S.internals]*blk.st*(dz?1.5:1);
  let rel=96;
  if(spLim/spMax>.85) rel-=(spLim/spMax-.85)*120;
  if(specT/tMax>.8) rel-=(specT/tMax-.8)*110;
  rel-=knock*(ecu?12:20)+8*cam+boost*5+(turbo?3:0)+(nt>1?nt:0)+(stg!=='par'?1:0)+(sc?2:0);
  if(limiter>floatRpm) rel-=(limiter-floatRpm)/100*1.5;
  rel-=(S.fuelSys==='carb'?3:S.fuelSys==='di'?2:0)+(S.vvt?1:0)+(S.vvl?2:0)+.4*(n-4);
  const oilReq=6.5+4*(peakP/Ls/100)+(turbo?1.5:0)+(dz?1:0);
  rel-=Math.max(0,oilReq-oil.h)*4+(oil.c>250?2:0)+(oilQ<.6?40:oilQ<.85?(.85-oilQ)*60:0)+(oilQ>1.3?25:oilQ>1.1?5+(oilQ-1.1)*40:0);
  rel+=blk.rel+tm.rel+lin.rel+vm.rel+spg.rel+(dry?3:0)+(turbo?tt.rel:0)-(S.cda?1:0)-(rot?8+boost*6:0)-(mism==='lean'?12:0)-(duty>1?15:duty>.85?4:0)-Math.max(0,adv-4)*1.5-Math.max(0,S.fuelPress-4.5)*4-(fOn('misfire')?15:0)-(fOn('boost')&&boosted?8:0)-(fOn('coolant')?30:0)-(fOn('oilpump')?35:0)-(fOn('lambda')&&ecu0&&!dz?6:0)-(fOn('cat')&&S.cat!=='none'?12:0)-(fOn('fuelpump')?8:0)-(fOn('timing')?20:0)-(fOn('headgasket')?40:0); rel=clamp(rel,0,100);
  const smooth=clamp(c.sm-14*cam-Math.max(0,disp/n-550)*.02-(dz?8:0)-(fOn('misfire')?25:0)-(fOn('timing')?10:0)-(fOn('headgasket')?8:0)-(mism==='lean'?20:0)-(idleLow?10:0)-(injBig?6:0),0,100);
  const resp=turbo?clamp(86-46*ts*(stg==='par'?1:.55)-8*boost+tt.resp+(S.turboBearing==='ball'?5:0),10,100):sc?(S.scType==='centri'?82:92):clamp(94+itk.resp,0,100);
  let sum=0,cnt=0;for(let r=1500;r<=3500;r+=250){sum+=tq(r);cnt++;}
  const flat=clamp((sum/cnt/peakT-.45)/.5*100,0,100);
  const agr=clamp(.45*flat+.3*resp+.25*smooth,0,100);
  const mf=EXH.muf[S.muffler];
  const noise=clamp(mf.noise+10*cam+(S.cat==='none'?5:0)+(S.manifold==='race'?4:0)-(turbo?6:0)+(dz?8:0)+tm.noise,0,100);
  const sound=clamp(c.snd*.72+mf.snd+10*cam-(turbo?5:0)+(S.manifold!=='cast'?4:0)+10-(dz?18:0),0,100);
  const etaW=.385*otto*fs.eff*(dz?1:mix*lam/.968);
  const lamC=S.fuelSys==='carb'?lam:lerp(1,lam,.35);
  const cdaK=(injBig?.97:1)*(S.pops&&ecu0?.98:1)*(mism==='rich'?.9:1)*(rot?.85:1)*(S.cda&&n>=4?(n>=6?1.06:1.03):1)*(fOn('misfire')?(n-1)/n:1);
  const etaC=cdaK*(dz?etaW*(1-.1*Math.pow(cam,1.5)):.385*otto*fs.eff*(mixF(lamC)*lamC/.968)*(1-.2*Math.pow(cam,1.5)));
  const bmepMax=peakT*4*Math.PI/dispM3/1e5;
  const etaB=etaW*bmepMax/(bmepMax+fmep(peakTrpm));
  // ── résistance des organes (1 = limite de la pièce)
  const rodLim={cast:120,forged:200,ti:240}[S.internals]*(dz?1.5:1),gasLim={iron:260,cgi:300,alu:235,mg:200}[S.blockMat]*(dz?1.4:1)*(S.headMat==='iron'?1.05:1);
  const egtLim=Math.min({steel:1000,sodium:1060,ti:1000}[S.valveMat],turbo?(S.turboType==='vgt'&&!dz?950:1020):9999);
  const prCap=1.7*(S.turboType==='vgt'?1.2:1)*(S.turboBearing==='ball'?1.05:1)*(dz?1.1:1),nPar=stg==='comp'?Math.max(1,nt-nSm):Math.max(1,nt),capF=8.2*(.3+(stg==='par'?ts:ts2)),turboCap=prCap;
  const coolLim=(S.headMat==='alu'?200:140)*(S.intercooler==='water'&&boosted?1.05:1)*(dry?1.05:1)*(rot?.75:1)*(dz?1.1:1);
  const apexLim={cast:1,forged:1.1,ti:1.2}[S.internals],lspiOn=!dz&&turbo&&(S.fuelSys==='di'||S.fuelSys==='dual');
  const nuAt=To=>Math.exp(Math.log(oil.c)+(Math.log(oil.h)-Math.log(oil.c))*(To-20)/80);
  const oilP=(rpm,To)=>{const rf=rpm/limiter;let p=Math.min(Math.max(6,.8*limiter/1000),(.5+rpm/1000*.85)*Math.sqrt(nuAt(To)/11));if(oilQ<.6) p*=(.25+.75*oilQ/.6)*(1-.5*rf);else if(oilQ<.85) p*=1-(.85-oilQ)*.6*rf;if(oilQ>1.3) p*=.7;if(fOn('oilpump')) p*=.35;return p;};
  const pReqAt=rpm=>Math.max(.8,.7*rpm/1000);
  const egtAt=(rpm,ld,la)=>{const rf=rpm/limiter;la=la||lam;return (dz?180+520*ld*(.6+.4*rf):420+480*Math.pow(ld,.7)*(.55+.45*rf)-Math.max(0,.9-la)*500*ld+Math.max(0,la-.9)*600*ld+(turbo?40*ld:0))+(mism==='lean'?90*ld:0)-adv*8*ld+(rot?50*ld:0);};
  const stressAt=(rpm,ld,bf,To)=>{
    if(bf==null) bf=1;if(To==null) To=110;
    const t=tq(rpm,bf)*ld,tl=t/Ls,pr=1+(prAt(rpm)-1)*bf*Math.pow(ld,.8);
    const dR=S.fuelSys==='carb'||dz?0:duty*tq0(rpm,bf)*ld*rpm*Math.PI/30/Math.max(1,pkW),la=lam*Math.max(1,dR);
    const st={egt:egtAt(rpm,ld,la)/egtLim,oil:pReqAt(rpm)/Math.max(.05,oilP(rpm,To)),cool:t*rpm*Math.PI/30/735.5/Ls/coolLim};
    if(rot) st.apex=rpm/10000*(1+(pr-1)*.5)/apexLim;
    else{st.rods=tl/rodLim;st.gasket=tl/gasLim;st.speed=2*stroke*rpm/60000/spMax;st.valves=rpm/floatRpm;}
    if(!dz){st.knock=ld>.6?(S.cr*Math.pow(pr,boosted?icT:0)+.12*adv)/(limit+(ecu0?.6:.2))*(.9+.1*ld):0;if(S.fuelSys!=='carb') st.lean=la/(boosted?1.02:1.1)*(ld>.7?1:.9);}
    if(lspiOn) st.lspi=rpm<2600?tl/185*(oil.h<9?1.06:1):0;
    if(turbo){const hp=stg==='comp'?Math.min(pr-1,bl):0,lp=(pr)/(1+hp);st.turbo=Math.max(Math.max(hp,lp-1)/prCap,Ls*rpm/6000*lp/nPar/capF);}
    return st;
  };
  let rMax=limiter;for(let r=1000;r<=limiter;r+=100) if(tq(r)<peakT*.06){rMax=Math.max(1000,r-100);break;}
  const fails={};for(let r=1000;r<=rMax;r+=250){const st=stressAt(r,1,1,115);for(const k in st) if(!fails[k]||st[k]>fails[k].r) fails[k]={r:st[k],rpm:r};}
  // ── durée de vie
  const recBase={'0w20':20000,'5w30':20000,'5w40':15000,'10w40':10000,'20w50':7500,'10w60':10000}[S.oilGrade]||15000;
  const oilRec=Math.max(3000,Math.round(recBase*(turbo?.85:1)*(peakP/Ls>100?.85:1)*(rot?.5:1)*(dry?1.1:1)*(S.fuel==='e85'?.8:1)/500)*500);
  const oilInt=S.oilInt||oilRec,qI=oilInt/oilRec;
  let life=dz?450000:rot?160000:300000;const lifeF=[];
  const lfac=(lab,v)=>{life*=v;if(v<.97||v>1.03) lifeF.push([lab,v]);};
  for(const k in fails) lfac(FAILS[k].n,Math.exp(-3*Math.max(0,fails[k].r-.9)));
  lfac('Intervalle de vidange',qI<=1?1+.12*(1-qI):Math.pow(qI,-1.3));
  lfac("Viscosité de l'huile",oil.h<oilReq?Math.exp(-(oilReq-oil.h)*.08):1);
  lfac("Niveau d'huile",oilQ<.85?.6:oilQ>1.15?.8:1);
  lfac('Arbre à cames pointu',1-.18*cam*cam);
  lfac('Matériaux du bloc et des cylindres',(S.blockMat==='iron'||S.blockMat==='cgi'?1.08:1)*(S.liner==='nikasil'||S.liner==='plasma'?1.05:1));
  lfac('Fiabilité générale',clamp(rel/85,.1,1.1));
  life=Math.max(5000,Math.round(life/5000)*5000);lifeF.sort((a,b)=>a[1]-b[1]);
  // ── entretien
  const oilPrice={'0w20':16,'5w30':13,'5w40':12,'10w40':9,'20w50':8,'10w60':20}[S.oilGrade]||12;
  const lay=rot?'R':c.lay==='I'?'I':c.w?'W':c.lay,lab={I:1,V:1.8,F:1.6,W:2.4,R:.9}[lay]||1;
  const mnt=[],mi=(nm,every,price,note)=>mnt.push({n:nm,every,price:Math.round(price/5)*5,note:note||''});
  mi('Vidange et filtre à huile',oilInt,(oilCap+(dry?3:0))*oilPrice+65+(dry?40:0),`${nf(oilCap+(dry?3:0),1)} l de ${oil.n}`);
  if(!dz) mi(rot?'Bougies (2 par rotor)':"Bougies d'allumage",rot?30000:turbo?40000:60000,(rot?2*rot:n)*(rot?25:14)+70*lab);
  else mi('Bougies de préchauffage',120000,n*25+120*lab);
  mi('Filtre à air',30000,45);
  mi('Filtre à carburant',dz?60000:90000,dz?70:60);
  if(!rot&&S.timing==='belt') mi('Kit de distribution (courroie, galets, pompe à eau)',Math.round(120000*(limiter>7500?.8:1)*(dz?1.1:1)/10000)*10000,350+380*lab,'Si la courroie casse, les soupapes heurtent les pistons.');
  if(!rot&&S.timing==='chain') mi('Chaîne de distribution et tendeurs',250000,600+500*lab,"Contrôle de l'allongement, puis remplacement.");
  mi('Liquide de refroidissement',100000,110);
  if(!rot&&(cam>.65||S.valveMat==='ti')) mi('Réglage du jeu aux soupapes',40000,nv*5+250*lab);
  if(!rot&&S.springs==='pneu') mi('Recharge du rappel pneumatique des soupapes',20000,450);
  if(S.fuelSys==='di'&&!dz) mi("Nettoyage de la calamine des soupapes d'admission",80000,350*lab);
  if(S.cat==='gpf') mi(dz?'Nettoyage du filtre à particules et de la vanne EGR':'Filtre à particules essence',dz?120000:160000,dz?450:500);
  if(turbo) mi(nt>1?`Révision des ${nt} turbos`:'Révision du turbo',Math.round(clamp(230000*(1-.35*Math.min(1.3,fails.turbo.r))*(S.turboBearing==='ball'?1.1:1),50000,260000)/10000)*10000,nt*(700+tt.cost*.6+tbr.cost*.5));
  if(rot) mi("Appoints d'huile (injectée dans les chambres)",1000,.4*oilPrice,'Environ 0,4 l tous les 1 000 km.');
  const kmY=S.kmYear||15000;let mYear=0,mLife=0;
  for(const m of mnt){m.inLife=m.every<=life;if(m.inLife){mYear+=m.price*kmY/m.every;mLife+=Math.floor(life/m.every)*m.price;}}
  const rebuild=Math.round((cost*.45+900*lab)/50)*50;
  // ── points d'attention
  const notes=[];
  if(cam>.75&&!rot) notes.push("Arbre à cames très pointu : ralenti instable, consommation d'huile et usure des cames plus élevées.");
  if(rot) notes.push("Un moteur rotatif brûle volontairement de l'huile pour graisser ses segments (environ 0,4 l aux 1 000 km) : surveillez le niveau à chaque plein.");
  if(S.fuelSys==='di'&&!dz) notes.push("Injection directe seule : l'essence ne lave plus les soupapes d'admission, la calamine s'y dépose.");
  if(!rot&&S.timing==='belt') notes.push("Distribution par courroie : son remplacement est impératif à l'échéance, sinon soupapes et pistons se percutent.");
  if(smooth<45) notes.push('Vibrations marquées : supports moteur, échappement et accessoires fatiguent plus vite.');
  if(oil.c>250) notes.push("Huile très épaisse à froid : démarrages difficiles en hiver et usure accrue dans les premières secondes.");
  if(dz&&S.cat==='gpf') notes.push("Filtre à particules : les trajets courts l'encrassent, il doit régulièrement rouler sur route pour se régénérer.");
  if(turbo&&S.turboBearing==='journal') notes.push("Turbo sur paliers lisses : laissez tourner le moteur au ralenti quelques secondes après un usage soutenu, sinon l'huile cuit dans les paliers.");
  if(boosted&&S.intercooler==='none') notes.push("Sans refroidisseur d'air, l'air comprimé arrive chaud : plus de cliquetis et moins de puissance.");
  if(S.pops&&ecu0) notes.push("Pétarades codées : du carburant brûle dans l'échappement, le catalyseur et le turbo vieillissent vite.");
  if(S.fuel==='e85') notes.push("E85 : l'éthanol lave les parois des cylindres et dilue l'huile, les vidanges doivent être plus rapprochées.");
  if(qI>1.3) notes.push(`Vidanges espacées de ${nf(oilInt)} km pour ${nf(oilRec)} conseillés : l'huile usée forme des boues qui bouchent la crépine et usent les coussinets.`);
  let len,wid,hgt;
  if(rot){len=rot*(S.stroke+75)+190;wid=2.3*S.bore+150;hgt=2.3*S.bore+170;}
  else if(c.lay==='I'){len=k*(bore+9)+110;wid=430+(boosted?90:0)+(vt.hm>1.2?40:0);hgt=2.3*stroke+380;}
  else if(c.lay==='V'){const a=c.ang/2*Math.PI/180;len=k*(bore+9)*(c.w?.62:1)+150;wid=380+(c.w?bore*.55:0)+2*(1.9*stroke+140)*Math.sin(a);hgt=(1.9*stroke+160)*Math.cos(a)+330;}
  else{len=k*(bore+9)+140;wid=2*(2*stroke+180)+100;hgt=bore+330;}
  if(dry) hgt-=60;
  return {c,n,disp,L,dispM3,tq,fmep,idle,limiter,curve,peakP,peakPrpm,peakT,peakTrpm,mass,cost,rel,smooth,resp,agr,noise,sound,etaC,etaB,bmepMax,
    spLim,spMax,specT,tMax,knock,effCR,limit,floatRpm,len,wid,hgt,turbo,sc,boosted,dz,rot,nt,stg,nSm,ecuOn:ecu0,mism,lamAct:lam,adv,duty,injNeed,injFlow,injBig,nInj,idle0,idleLow,tauK:tt.tau*tbr.tau*(nt>1?(stg==='par'?[1,1,.7,.6,.55][nt]:.5):1),tmMass,oil,oilCap,oilQ,oilReq,prAt,etaW,fails,stressAt,oilP,pReqAt,egtAt,turboCap,life,lifeF,oilRec,oilInt,maint:mnt,mYear,mLife,rebuild,kmY,notes,pumpK:dz?.12:.62,emis:S.cat!=='none'&&S.fuelSys!=='carb'};
}
