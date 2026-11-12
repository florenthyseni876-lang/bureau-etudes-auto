'use strict';
/* ───────────── Son du moteur ───────────── */
// Synthèse par impulsions : chaque combustion produit une bouffée d'échappement (amplitude et instant légèrement
// aléatoires), filtrée par les résonances fixes de la ligne. Admission, bruits mécaniques et claquement diesel à part.
let AU=null;
const sndSig=()=>[S.config,Object.keys(ui.faults).filter(k=>ui.faults[k]).join('+'),S.timing,S.muffler,S.manifold,S.cat,S.fuel,S.aspiration,S.bore,S.stroke].join('|');
function audioInit(){
  if(AU) return true;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC) return false;
  try{
    const ctx=new AC(),sr=ctx.sampleRate,g=v=>{const n=ctx.createGain();n.gain.value=v;return n;};
    const bq=(type,f,q,gain)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=f;if(q!=null) n.Q.value=q;if(gain!=null) n.gain.value=gain;return n;};
    const master=g(0),comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(master);master.connect(ctx.destination);
    const st={ph:0,rpm:900,trpm:900,ld:0,tld:0,on:0,ton:0,cyl:[],n:4,w:.2,vr:.08,mis:0,pop:0,rasp:.15,dz:0,il:0,ml:0,rf:.2};
    const sp=ctx.createScriptProcessor(1024,1,2);
    sp.onaudioprocess=e=>{
      const A=e.outputBuffer.getChannelData(0),B=e.outputBuffer.getChannelData(1),N=A.length,cy=st.cyl,n=cy.length,norm=1.15/Math.sqrt(n||1);
      for(let i=0;i<N;i++){
        st.rpm+=(st.trpm-st.rpm)*.0012;st.ld+=(st.tld-st.ld)*.002;st.on+=(st.ton-st.on)*.0006;
        st.ph+=st.rpm/120/sr;if(st.ph>=1) st.ph-=1;
        const w=st.w,ld=st.ld;let ex=0,ip=0,dk=0;
        for(let k=0;k<n;k++){const c=cy[k];let x=st.ph-c.o-c.j;x-=Math.floor(x);
          if(x<c.px){c.a=c.base*(1+st.vr*(Math.random()*2-1));if(st.mis&&Math.random()<st.mis) c.a*=.3;if(st.pop&&Math.random()<.14) c.a*=3.2;c.j=c.dl*st.rpm/120+(Math.random()-.5)*.006;}
          c.px=x;
          if(x<w){const u=x/w;ex+=c.a*Math.sin(Math.PI*u)*Math.exp(-3*u)*2.4;}else if(x<2*w) ex-=c.a*.22*Math.sin(Math.PI*(x-w)/w);
          let xi=x+.5;if(xi>=1) xi-=1;if(xi<.3) ip+=Math.sin(Math.PI*xi/.3);
          if(st.dz&&x<.05) dk+=Math.exp(-x/.012)*c.a;}
        const n1=Math.random()*2-1,n2=Math.random()*2-1;
        A[i]=ex*(1+st.rasp*n1)*norm*(.42+.58*ld)*st.on;
        st.il+=(n1*ip*norm-st.il)*.22;const hp=n2-st.ml;st.ml+=(n2-st.ml)*.4;
        B[i]=(st.il*(.15+.85*ld)*.55+hp*st.rf*st.rf*.1+dk*n2*norm*st.dz*.55)*st.on;
      }};
    const split=ctx.createChannelSplitter(2);sp.connect(split);
    const hp=bq('highpass',28,.7),p1=bq('peaking',100,2.5,8),p2=bq('peaking',220,2.5,5),p3=bq('peaking',500,2,3),lp=bq('lowpass',1600,.6),lp2=bq('lowpass',3000,.5),eg=g(0);
    split.connect(hp,0);hp.connect(p1);p1.connect(p2);p2.connect(p3);p3.connect(lp);lp.connect(lp2);lp2.connect(eg);eg.connect(comp);
    const mh=bq('highpass',220,.7),ml=bq('lowpass',5200,.7),mg=g(.5);split.connect(mh,1);mh.connect(ml);ml.connect(mg);mg.connect(comp);
    const ot=ctx.createOscillator(),tg=g(0);ot.type='sine';ot.connect(tg);tg.connect(comp);ot.start();
    AU={ctx,master,sp,st,p1,p2,p3,lp,lp2,eg,mg,ot,tg,sig:''};return true;
  }catch(e){AU=null;return false;}
}
function audioCfg(){
  const E=M.E,c=E.c,n=c.n,st=AU.st,eq=S.manifold!=='cast';
  const pat={V8:[[0,1,1,0,1,0,0,1],.0016,.82],F4:[[0,0,1,1],eq?.0008:.0042,eq?.92:.68]}[S.config]||(c.lay==='I'||c.lay==='R'?[[0],0,1]:[[0,1],.0008,.92]);
  const un={cast:.2,tub:.07,race:.04}[S.manifold];
  st.cyl=[];for(let i=0;i<n;i++){const bk=pat[0][i%pat[0].length];st.cyl.push({o:i/n,j:0,dl:bk?pat[1]:0,base:(bk?pat[2]:1)*(1+un*Math.sin(i*2.3+1)),a:1,px:0});}
  if(faultOn('misfire')) st.cyl[0].base=.04;if(faultOn('headgasket')) st.cyl[n>1?1:0].base*=.5;
  const sz=Math.pow(2/E.L,.18),pk={free:[10,8,7],sport:[9,6,4],std:[8,4,1],comf:[6,1,-3],valve:[9,6,4]}[S.muffler],t=AU.ctx.currentTime;
  AU.p1.frequency.setTargetAtTime(98*sz,t,.05);AU.p2.frequency.setTargetAtTime(215*sz,t,.05);AU.p3.frequency.setTargetAtTime(490*sz,t,.05);
  AU.p1.gain.setTargetAtTime(pk[0],t,.05);AU.p2.gain.setTargetAtTime(pk[1],t,.05);AU.p3.gain.setTargetAtTime(pk[2],t,.05);
  st.dz=E.dz?1:0;st.rasp={free:.5,sport:.3,std:.15,comf:.06,valve:.35}[S.muffler]+(S.cat==='none'?.12:0);AU.sig=sndSig();
}
function audioSet(b,on){
  if(!AU) return;
  const E=M.E,t=AU.ctx.currentTime,T=(p,v,k)=>p.setTargetAtTime(v,t,k||.06),st=AU.st;
  T(AU.master.gain,ui.snd?.9:0,.05);
  if(!ui.snd){st.ton=0;return;}
  if(AU.sig!==sndSig()) audioCfg();
  const rf=b.rpm/E.limiter,ld=b.ld,mf=S.muffler==='valve'?(ld>.45||rf>.6?'free':'std'):S.muffler,cam=S.cam/100;
  st.trpm=b.rpm;st.tld=ld;st.ton=on?1:0;st.rf=rf;
  st.w=Math.min(.42,(.17+.08*(1-ld))*(S.manifold==='race'?.8:S.manifold==='cast'?1.1:1)*(E.turbo?1.3:1));
  st.vr=(faultOn('timing')?.2:0)+.06+.28*cam*(1-rf)+(S.fuelSys==='carb'?.05:0)+(E.dz?.04:0);st.mis=(cam>.7&&rf<.3?.07:0)+(E.mism==='lean'?.14:0)+(E.idleLow&&rf<.25?.12:0);
  st.pop=!E.dz&&b.rpm>E.idle*1.8&&((ui.sweep&&ui.sweep.ph===2&&(mf==='free'||mf==='sport'))||(S.pops&&E.ecuOn&&ld<.06))?1:0;
  const vol={free:1,sport:.72,std:.5,comf:.34}[mf]*(E.turbo?.72:1)*(E.dz?.7:1)*(S.cat==='none'?1.1:1);
  const cut={free:4800,sport:2700,std:1500,comf:820}[mf]*(.55+.45*ld)+b.rpm*.06;
  const ck=faultOn('cat')?.5:1;T(AU.lp.frequency,cut*ck);T(AU.lp2.frequency,cut*1.8*ck);T(AU.eg.gain,vol*(.7+.3*rf));
  T(AU.mg.gain,(E.dz?.75:.5)*{belt:.85,chain:1,gear:1.5}[S.timing]);
  const sp=E.boosted?clamp((b.pr-1)/Math.max(.2,S.boost),0,1):0;
  const gearW=S.timing==='gear'&&!E.boosted;
  T(AU.ot.frequency,E.sc?b.rpm/60*21:gearW?b.rpm/60*34:2800+6500*sp,.15);T(AU.tg.gain,on?(E.turbo?.02*sp:E.sc?.02*(.3+.7*ld):gearW?.012*rf:0):0,.1);
}
function setSound(v){
  ui.snd=v;
  if(v){if(!audioInit()){ui.snd=false;return false;}try{AU.ctx.resume();}catch(e){}}
  if(AU&&!v){AU.master.gain.setTargetAtTime(0,AU.ctx.currentTime,.05);AU.st.ton=0;}
  return true;
}
