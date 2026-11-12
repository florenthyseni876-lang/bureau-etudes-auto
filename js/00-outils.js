'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
const sstep=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const nf=(x,d=0)=>{x=Number(x);if(!isFinite(x)) return '—';if(d<0){const k=Math.pow(10,-d);x=Math.round(x/k)*k;d=0;}return x.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}).replace(/[  ]/g,' ');};
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const reduced=()=>ui.noAnim;
