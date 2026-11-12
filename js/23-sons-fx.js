'use strict';
/* ───────────── Sons du lancement et du journal ─────────────
   Tout est synthétisé avec WebAudio : roulement de tambour, moteur qui arrive,
   cymbale et fanfare, déclencheurs d'appareils photo, applaudissements, papier. */
const SFX={ctx:null,on:true,bus:null,nb:null};
try{SFX.on=localStorage.getItem('bea.fx')!=='0';}catch(e){}
function fxCtx(){
  if(!SFX.on) return null;
  if(!SFX.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC) return null;try{SFX.ctx=new AC();}catch(e){return null;}}
  if(SFX.ctx.state==='suspended'){try{SFX.ctx.resume();}catch(e){}}
  if(!SFX.nb){const c=SFX.ctx,n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++) d[i]=Math.random()*2-1;SFX.nb=b;}
  return SFX.ctx;
}
function fxBus(){const c=fxCtx();if(!c) return null;fxStop();const g=c.createGain();g.gain.value=.9;const comp=c.createDynamicsCompressor();g.connect(comp);comp.connect(c.destination);SFX.bus=g;return g;}
function fxStop(){if(SFX.bus&&SFX.ctx){const g=SFX.bus,t=SFX.ctx.currentTime;try{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.15);}catch(e){}setTimeout(()=>{try{g.disconnect();}catch(e){}},400);SFX.bus=null;}}
function fxSetOn(v){SFX.on=v;try{localStorage.setItem('bea.fx',v?'1':'0');}catch(e){}if(!v) fxStop();}
// bruit filtré avec enveloppe
function nz(out,t,dur,o){
  const c=SFX.ctx,s=c.createBufferSource();s.buffer=SFX.nb;s.loop=true;
  const f=c.createBiquadFilter();f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f||1000,t);if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2,t+dur);f.Q.value=o.q||1;
  const g=c.createGain(),a=o.a||.005,pk=o.g||.3;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(pk,t+a);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
  s.connect(f);f.connect(g);g.connect(out);s.start(t,Math.random()*1.5);s.stop(t+dur+.05);
}
function tone(out,t,dur,o){
  const c=SFX.ctx,os=c.createOscillator();os.type=o.type||'sine';os.frequency.setValueAtTime(o.f,t);if(o.f2) os.frequency.exponentialRampToValueAtTime(o.f2,t+(o.glide||dur));
  const g=c.createGain(),a=o.a||.01,pk=o.g||.2;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(pk,t+a);if(o.hold) g.gain.setValueAtTime(pk,t+a+o.hold);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
  let n=os;if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;f.Q.value=o.lq||.7;os.connect(f);n=f;}
  n.connect(g);g.connect(out);os.start(t);os.stop(t+dur+.05);return os;
}
function fxShutter(out,t){nz(out,t,.025,{type:'highpass',f:3500,g:.5,a:.001});nz(out,t+.045,.03,{type:'bandpass',f:2200,q:2,g:.35,a:.001});tone(out,t+.08,.9,{f:2400,f2:7200,g:.025,a:.05});}
function fxLaunch(){
  const out=fxBus();if(!out) return;const c=SFX.ctx,t0=c.currentTime+.05;
  // roulement de tambour en crescendo
  for(let t=.2,i=0;t<2.25;t+=.045,i++) nz(out,t0+t,.06,{type:'bandpass',f:1800+Math.random()*400,q:.9,g:.04+.22*(t/2.25)**2,a:.002});
  // moteur qui arrive : deux dents de scie graves qui montent puis redescendent
  for(const [k,dt] of [[1,0],[1.5,.004]]){const os=tone(out,t0+.6+dt,2.2,{type:'sawtooth',f:34*k,f2:78*k,glide:1.2,g:.16,a:.25,hold:.9,lp:420,lq:3});os.frequency.exponentialRampToValueAtTime(42*k,t0+2.7);}
  nz(out,t0+.6,2.1,{type:'lowpass',f:220,f2:500,g:.18,a:.4});
  // cymbale + fanfare au moment où le nom apparaît
  nz(out,t0+2.3,2.4,{type:'highpass',f:5200,g:.32,a:.004});
  nz(out,t0+2.3,.25,{type:'lowpass',f:160,g:.5,a:.002});
  const brass=(f,t,d,g)=>{for(const det of [-4,4]) {const os=tone(out,t0+t,d,{type:'sawtooth',f,g:g/2,a:.04,hold:d*.6,lp:2400,lq:1});os.detune.value=det;}};
  brass(392,2.3,.16,.14);brass(392,2.48,.16,.14);
  for(const f of [261.6,329.6,392,523.3]) brass(f,2.66,1.9,.11);
  // déclencheurs d'appareils photo sur les flashs
  for(const t of [2.4,2.82,3.27,3.5,3.9,4.3]) fxShutter(out,t0+t+(Math.random()*.05));
  // applaudissements
  for(let i=0;i<260;i++){const t=2.55+Math.random()*2.6,env=Math.min(1,(t-2.55)/.5)*Math.min(1,(5.2-t)/.8);nz(out,t0+t,.03,{type:'bandpass',f:1200+Math.random()*2200,q:1.4,g:.09*env+.01,a:.001});}
  nz(out,t0+2.6,2.6,{type:'lowpass',f:700,g:.05,a:.6});
}
function fxPaper(){
  const out=fxBus();if(!out) return;const t0=SFX.ctx.currentTime+.03;
  nz(out,t0,.55,{type:'bandpass',f:600,f2:3800,q:.7,g:.22,a:.08});
  for(let i=0;i<26;i++) nz(out,t0+.05+Math.random()*.6,.05+Math.random()*.06,{type:'bandpass',f:2500+Math.random()*3500,q:1.5,g:.07+Math.random()*.08,a:.003});
  tone(out,t0+.62,.25,{f:95,f2:60,g:.22,a:.004});
  nz(out,t0+.62,.12,{type:'lowpass',f:400,g:.12,a:.002});
}
