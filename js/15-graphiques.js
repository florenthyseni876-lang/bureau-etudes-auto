'use strict';
/* ───────────── Graphiques ───────────── */
function niceAxis(max,nt){const raw=max/nt,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p,st=(f<1.5?1:f<3?2:f<7?5:10)*p,top=Math.ceil(max*1.06/st)*st,t=[];for(let v=0;v<=top+1e-9;v+=st) t.push(Math.round(v*1e6)/1e6);return {top,t};}
function lineChart(o){
  const w=o.w,h=o.h,m={l:46,r:18,t:18,b:26},pw=w-m.l-m.r,ph=h-m.t-m.b;
  const X=v=>m.l+(v-o.x0)/(o.x1-o.x0)*pw,Y=v=>m.t+ph-v/o.y1*ph;
  let s=`<svg class="ch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${o.aria}" data-l="${m.l}" data-pw="${pw}" data-b="${m.t+ph}" data-ph="${ph}" data-x0="${o.x0}" data-x1="${o.x1}" data-y1="${o.y1}">`;
  for(const t of o.yt) s+=`<line class="ch-g" x1="${m.l}" x2="${w-m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ch-t" x="${m.l-7}" y="${Y(t)+3.5}" text-anchor="end">${nf(t)}</text>`;
  for(const t of o.xt) s+=`<text class="ch-t" x="${X(t)}" y="${h-7}" text-anchor="middle">${o.fx?o.fx(t):nf(t)}</text>`;
  s+=`<line class="ch-a" x1="${m.l}" x2="${w-m.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  if(o.extra) s+=o.extra(X,Y,m,w,h);
  if(o.pts&&o.pts.length){
    const d=o.pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join('');
    if(o.area!==false) s+=`<path d="${d}L${X(o.pts[o.pts.length-1][0]).toFixed(1)} ${Y(0)}L${X(o.pts[0][0]).toFixed(1)} ${Y(0)}Z" fill="var(--${o.col})" opacity=".1"/>`;
    s+=`<path class="ch-line" d="${d}" fill="none" stroke="var(--${o.col})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }else s+=`<path class="ch-fill" d="" fill="var(--${o.col})" opacity=".1"/><path class="ch-line" d="" fill="none" stroke="var(--${o.col})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  for(const k of (o.marks||[])){const x=X(k.x),y=Y(k.y),end=k.end||x>w-150;s+=`<circle class="ch-ring" cx="${x}" cy="${y}" r="4.5" fill="var(--${o.col})"/><text class="ch-lab" x="${x+(end?-9:9)}" y="${y<m.t+16?y+16:y-9}" text-anchor="${end?'end':'start'}">${k.label}</text>`;}
  s+=`<line class="ch-x" y1="${m.t}" y2="${m.t+ph}" style="display:none"/><circle class="ch-d ch-ring" r="4.5" fill="var(--${o.col})" style="display:none"/></svg>`;
  return s;
}
function wireCross(box,xs,ysList,label,readEl){
  const svgs=$$('svg.ch',box);if(!svgs.length) return;
  const def=readEl.innerHTML;let idx=-1;
  const show=i=>{idx=i;svgs.forEach((sv,k)=>{const d=sv.dataset,x=+d.l+(xs[i]-d.x0)/(d.x1-d.x0)*d.pw,y=+d.b-ysList[k][i]/d.y1*d.ph,cx=sv.querySelector('.ch-x'),cd=sv.querySelector('.ch-d');cx.setAttribute('x1',x);cx.setAttribute('x2',x);cx.style.display='';cd.setAttribute('cx',x);cd.setAttribute('cy',y);cd.style.display='';});readEl.innerHTML=label(i);};
  const hide=()=>{idx=-1;svgs.forEach(sv=>{sv.querySelector('.ch-x').style.display='none';sv.querySelector('.ch-d').style.display='none';});readEl.innerHTML=def;};
  const near=xv=>{let b=0,bd=1e9;for(let i=0;i<xs.length;i++){const d=Math.abs(xs[i]-xv);if(d<bd){bd=d;b=i;}}return b;};
  svgs.forEach(sv=>{
    sv.addEventListener('pointermove',e=>{const q=elXY(e,sv),d=sv.dataset,px=q.x/q.w*(+sv.getAttribute('width'));show(near(+d.x0+clamp((px-d.l)/d.pw,0,1)*(d.x1-d.x0)));});
    sv.addEventListener('pointerleave',hide);
  });
  box.tabIndex=0;
  box.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(clamp((idx<0?0:idx)+(e.key==='ArrowRight'?1:-1),0,xs.length-1));}else if(e.key==='Escape') hide();});
  box.addEventListener('blur',hide);
}
const chartW=()=>clamp(($('#stageData').clientWidth||600)-32,260,760);
const facts=a=>`<dl class="facts">${a.map(f=>`<div><dt>${f[0]}</dt><dd>${f[1]}${f[2]?` <small>${f[2]}</small>`:''}</dd></div>`).join('')}</dl>`;
const meters=a=>`<div class="meters">${a.map(f=>`<div class="meter${f[2]?' best':''}"><span class="m-l">${f[0]}${f[2]?'<span class="tag">meilleur usage</span>':''}</span><span class="m-bar"><i style="width:${clamp(f[1],0,100).toFixed(0)}%"></i></span><span class="m-v">${nf(f[1])}</span></div>`).join('')}</div>`;
