'use strict';
/* ───────────── Dessin de la voiture ───────────── */
function rpath(pts){
  let d='';const n=pts.length;
  for(let i=0;i<n;i++){
    const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n];
    const v1=[p0[0]-p1[0],p0[1]-p1[1]],v2=[p2[0]-p1[0],p2[1]-p1[1]],l1=Math.hypot(v1[0],v1[1])||1,l2=Math.hypot(v2[0],v2[1])||1;
    const rr=Math.min(p1[2]||0,l1/2,l2/2);
    const a=[p1[0]+v1[0]/l1*rr,p1[1]+v1[1]/l1*rr],b=[p1[0]+v2[0]/l2*rr,p1[1]+v2[1]/l2*rr];
    d+=(i?'L':'M')+a[0].toFixed(1)+' '+(-a[1]).toFixed(1)+'Q'+p1[0].toFixed(1)+' '+(-p1[1]).toFixed(1)+' '+b[0].toFixed(1)+' '+(-b[1]).toFixed(1);
  }
  return d+'Z';
}
const poly=pts=>'M'+pts.map(p=>p[0].toFixed(1)+' '+(-p[1]).toFixed(1)).join('L')+'Z';
const STY_SHAPE={hippo:{nose:1.3,H:170,r:.5,sill:170},classique:{nose:1.2,H:90,r:.7,sill:110},profile:{nose:1.04,H:20,r:1.7,sill:30},ponton:{nose:1.02,H:0,r:1.1},ailerons:{nose:.98,H:-20,r:.9},tendu:{nose:.84,H:-10,r:.55},aero:{nose:.9,H:0,r:1.3},bio:{nose:.95,H:10,r:1.8},moderne:{nose:1.04,H:0,r:.85}};
function outline(B,dz,gc,sty){
  const sh=STY_SHAPE[sty]||STY_SHAPE.moderne,p0=B.p,p=Object.assign({},p0,{noseH:Math.min(p0.cowlH-20,p0.noseH*sh.nose)});
  const L=B.L,H=B.H+dz+(B.kind==='roadster'?Math.min(sh.H,0):sh.H),Y=v=>v+dz,sill0=gc+25,sill=sill0+(sh.sill||0);
  const pt=[[30,sill,45],[0,sill+.45*(Y(p.noseH)-sill),80],[45,Y(p.noseH),120],[p.cowlX*.5,Y(p.noseH+(p.cowlH-p.noseH)*.7),500],[p.cowlX,Y(p.cowlH),170]];
  let glass=null,ws=null;
  if(B.kind==='roadster'){
    pt.push([2700,Y(p.cowlH-25),260],[3060,Y(p.deckH+50),260],[p.deckX,Y(p.deckH),150]);
    ws=[[p.cowlX+40,Y(p.cowlH)+5,0],[p.roofX1-30,H-10,20],[p.roofX1+25,H-10,20],[p.cowlX+170,Y(p.cowlH)+5,0]];
  }else{
    const pk=B.kind==='pickup';
    pt.push([p.roofX1,H,270],[p.roofX2,H-p.drop,pk?90:300],[p.deckX,Y(p.deckH),pk?40:130]);
    const gA=[p.cowlX+75,Y(p.cowlH)+28,30],gB=[p.roofX1+55,H-62,110];let gC,gD;
    if(pk){gC=[p.roofX2-70,H-p.drop-62,80];gD=[p.roofX2-40,Y(p.deckH)+28,30];}
    else{const f=B.gl||.8;gC=[p.roofX2-45,H-p.drop-66,130];gD=[lerp(p.roofX2,p.deckX,f)-55,Math.max(Y(p.deckH)+28,lerp(H-p.drop,Y(p.deckH),f)-48),40];}
    glass=[gA,gB,gC,gD];
  }
  pt.push([L-20,Y(p.tailH),70],[L,sill+.5*(Y(p.tailH)-sill),70],[L-35,sill,45]);
  for(const q of pt) if(q[2]) q[2]*=sh.r;
  return {body:pt,glass,ws,H,sill,sill0,noseY:Y(p.noseH),tailY:Y(p.tailH),cowlX:p.cowlX,cowlY:Y(p.cowlH)};
}
// éléments de carrosserie : ailes, chromes, pare-chocs, phares, rétroviseurs
function kitSVG(B,ol,o){
  const L=B.L,sill=ol.sill,s0=ol.sill0,nY=ol.noseY,tY=ol.tailY,fx=o.fx,rx=o.rx,R=o.R,aR=o.aR,sty=o.style,pf=o.paint,mini=!!o.mini;
  const cls=c=>mini?`class="k-${c} m-k"`:`class="k-${c}"`;
  let s='';
  // ailes séparées et marchepieds
  if(sty==='hippo'||sty==='classique'){
    const fen=(cx)=>{const r1=aR+38,r2=aR-12,yb=Math.min(R,s0+40);return `<path d="M${cx-r1-90} ${-(s0+5)}Q${cx-r1} ${-(s0+10)} ${cx-r1} ${-yb}A${r1} ${r1} 0 0 1 ${cx+r1} ${-yb}L${cx+r1+40} ${-(s0+5)}L${cx+r2} ${-(s0+5)}L${cx+r2} ${-yb}A${r2} ${r2} 0 0 0 ${cx-r2} ${-yb}L${cx-r2} ${-(s0+5)}Z" ${sty==='hippo'?cls('dark'):cls('paint')} ${!mini&&sty!=='hippo'?`fill="${pf}"`:''}/>`;};
    s+=fen(fx)+fen(rx);
    s+=`<rect x="${fx+R+60}" y="${-(s0+22)}" width="${rx-fx-2*R-120}" height="34" rx="10" ${cls('dark')}/>`;
    s+=`<rect x="-20" y="${-(nY+30)}" width="70" height="${Math.max(80,nY+30-sill+20)}" rx="18" ${cls('chrome')}/>`;
  }
  if(sty==='profile') s+=`<path d="M${rx-aR-10} ${-R}A${aR+10} ${aR+10} 0 0 1 ${rx+aR+10} ${-R}Z" ${cls('paint')} ${mini?'':`fill="${pf}"`}/><path d="M${rx-aR-10} ${-R}H${rx+aR+10}" ${cls('line')}/>`;
  if(sty==='ponton'||sty==='ailerons'){const y=sill+.55*(nY-sill);s+=`<path d="M${fx+aR+40} ${-y}L${L-260} ${-(y+30)}" ${cls('strip')}/>`;}
  if(sty==='ailerons') s+=`<path d="M${L-760} ${-tY}Q${L-200} ${-(tY+40)} ${L-30} ${-(tY+190)}L${L-10} ${-tY}Z" ${cls('paint')} ${mini?'':`fill="${pf}"`}/>`;
  if(sty==='tendu'||sty==='moderne'){const y=sill+.72*(nY-sill);s+=`<path d="M${180} ${-(y+10)}L${L-180} ${-(y+60)}" ${cls('crease')}/>`;}
  if(sty==='moderne') s+=`<path d="M${fx+aR+30} ${-(sill+30)}L${rx-aR-30} ${-(sill+30)}" ${cls('sill')}/>`;
  // pare-chocs
  const by=sill+.32*(nY-sill),bty=sill+.32*(tY-sill),bp=o.bumper;
  const bump=(x0,x1,y,h)=>{
    if(bp==='chrome') return `<rect x="${x0}" y="${-(y+h/2)}" width="${x1-x0}" height="${h}" rx="${h/2}" ${cls('chrome')}/>`;
    if(bp==='massif') return `<rect x="${x0-20}" y="${-(y+h*.8)}" width="${x1-x0+40}" height="${h*1.6}" rx="${h*.6}" ${cls('chrome')}/>`;
    if(bp==='caout') return `<rect x="${x0-30}" y="${-(y+h*.75)}" width="${x1-x0+60}" height="${h*1.5}" rx="14" ${cls('rubber')}/>`;
    if(bp==='carbone') return `<rect x="${x0}" y="${-(y+h*.35)}" width="${x1-x0}" height="${h*.7}" rx="8" ${cls('carbon')}/>`;
    if(bp==='bouclier') return `<path d="M${x0+40} ${-(y+h*.6)}H${x1-20}" ${cls('seam')}/>`;
    return '';
  };
  s+=bump(-45,240,by,46)+bump(L-240,L+45,bty,46);
  // phares
  const lt=o.lights,hx=sty==='hippo'||sty==='classique'?150:120;
  if(lt==='acet'||lt==='elec'){const r=lt==='acet'?62:80,cy=nY+(sty==='hippo'||sty==='classique'?r+20:-r-10);s+=`<path d="M${hx} ${-(cy-r)}V${-(nY-10)}" ${cls('stalk')}/><circle cx="${hx}" cy="${-cy}" r="${r}" ${cls('lampcase')}/><circle cx="${hx-r*.55}" cy="${-cy}" r="${r*.62}" ${cls('lamp')}/>`;}
  else if(lt==='rond') s+=`<circle cx="95" cy="${-(nY-75)}" r="64" ${cls('lamp')}/>`;
  else if(lt==='escam') s+=`<path d="M60 ${-(nY+4)}L300 ${-(nY+14)}L300 ${-(nY-6)}L70 ${-(nY-14)}Z" ${cls('dark')}/>`;
  else if(lt==='halo') s+=`<rect x="10" y="${-(nY-30)}" width="200" height="78" rx="6" ${cls('lamp')}/>`;
  else if(lt==='xenon') s+=`<path d="M8 ${-(nY-120)}L40 ${-(nY-22)}L260 ${-(nY+2)}L240 ${-(nY-70)}Z" ${cls('xenon')}/>`;
  else if(lt==='led'||lt==='laser') s+=`<path d="M10 ${-(nY-60)}L40 ${-(nY-18)}L300 ${-(nY+4)}L285 ${-(nY-30)}Z" ${cls('dark')}/><path d="M40 ${-(nY-30)}L290 ${-(nY-10)}" ${cls(lt==='laser'?'laser':'drl')}/>`;
  // feu arrière
  s+=`<path d="M${L-10} ${-(tY-110)}L${L-30} ${-(tY-26)}L${L-200} ${-(tY-20)}L${L-190} ${-(tY-84)}Z" ${cls('tail')}/>`;
  // rétroviseurs
  const mi=o.mirrors;
  if(mi==='aile') s+=`<path d="M${fx+40} ${-(nY+10)}V${-(nY+90)}" ${cls('stalk')}/><ellipse cx="${fx+40}" cy="${-(nY+105)}" rx="34" ry="24" ${cls('chrome')}/>`;
  else if(mi==='porte'||mi==='elec'||mi==='camera'){const mx=o.mx,my=o.my;s+=mi==='camera'?`<path d="M${mx} ${-my}l60 -10l0 -26l-60 6z" ${cls('dark')}/>`:`<path d="M${mx-10} ${-my}q-20 -70 50 -78q70 -4 66 46q-4 34 -50 40z" ${mi==='elec'?cls('paint')+(mini?'':` fill="${pf}"`):cls('chrome')}/>`;}
  return s;
}
function miniCar(id,s0){
  const B=BODY[id],st=s0&&s0.style||'',o=outline(B,0,B.gc0,st),R=B.tireMax/2*.93,fx=B.FO,rx=B.FO+B.WB;
  const kit=s0&&s0.style?kitSVG(B,o,{fx,rx,R,aR:R+45,style:s0.style,bumper:s0.bumper,lights:s0.lights,mirrors:s0.mirrors,mini:true,mx:(o.glass?o.glass[0][0]:o.cowlX+60)-20,my:(o.glass?o.glass[0][1]:o.cowlY)+10}):'';
  const H=o.H+60;
  return `<svg viewBox="${(B.L-5500)/2} ${-Math.max(1960,H+200)} 5500 ${Math.max(2020,H+260)}" aria-hidden="true"><path d="${rpath(o.body)}" class="m-b"/>${o.glass?`<path d="${rpath(o.glass)}" class="m-g"/>`:`<path d="${rpath(o.ws)}" class="m-b"/>`}<circle cx="${fx}" cy="${-R}" r="${R+45}" class="m-w"/><circle cx="${rx}" cy="${-R}" r="${R+45}" class="m-w"/><circle cx="${fx}" cy="${-R}" r="${R}" class="m-t"/><circle cx="${rx}" cy="${-R}" r="${R}" class="m-t"/>${kit}</svg>`;
}
function carSVG(o){
  const B=BODY[S.body],C=M.C,E=M.E,L=B.L,dz=S.gc-B.gc0,Y=v=>v+dz;let p=B.p;
  const ol=outline(B,dz,S.gc,S.style),H=ol.H,sill=ol.sill,id=o.id||'c';
  p=Object.assign({},p,{noseH:ol.noseY-dz});
  const R=Math.min(C.od,B.tireMax)/2,rimR=Math.min(S.rim*12.7,R-28);
  const aR=R+clamp(48+dz*.5,30,130)+({hippo:110,classique:80}[S.style]||0),fx=B.FO,rx=B.FO+B.WB;
  const vx=-300,vw=L+300+(o.dims?540:200),fs=clamp(11.5*vw/(o.pxw||600),70,270);
  const vy=-(H+340),vh=H+340+(o.dims?170+fs*3.7:110);
  const bd=rpath(ol.body),front=S.enginePos==='FT'||S.enginePos==='FL';
  const roofSp=B.kind==='hatch'||B.kind==='wagon'||B.kind==='suv';
  let s=`<svg class="car" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="Vue de profil : ${B.n}, moteur ${POS[S.enginePos].n.replace(/^./,c=>c.toLocaleLowerCase())}, ${DRV[S.drive].replace(/^./,c=>c.toLocaleLowerCase())}">`;
  s+=`<defs><clipPath id="${id}b"><path d="${bd}"/></clipPath>${ol.glass?`<clipPath id="${id}g"><path d="${rpath(ol.glass)}"/></clipPath>`:''}<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></linearGradient></defs>`;
  s+=`<ellipse cx="${L/2}" cy="8" rx="${L*.52}" ry="36" class="c-shadow"/><line x1="${vx+40}" x2="${vx+vw-40}" y1="0" y2="0" class="c-ground"/>`;
  // aileron derrière la caisse
  if(S.wing==='wing'&&!roofSp){const ty=Y(p.tailH);s+=`<path d="${poly([[L-330,ty-10],[L-290,ty-10],[L-250,ty+200],[L-300,ty+200]])}" class="c-trim"/><path d="${rpath([[L-480,ty+215,14],[L-50,ty+262,14],[L-42,ty+232,14],[L-470,ty+186,14]])}" class="c-trim"/>`;}
  if(S.splitter) s+=`<path d="${poly([[-80,sill-10],[300,sill-10],[300,sill+16],[-80,sill+6]])}" class="c-trim"/>`;
  s+=`<path d="${bd}" fill="${S.paint}" class="c-body"/><path d="${bd}" fill="url(#${id}s)"/>`;
  // feux, bas de caisse
  s+=`<g clip-path="url(#${id}b)">`;
  if(S.flatFloor) s+=`<path d="${poly([[L-580,sill-4],[L-4,sill+108],[L-4,sill-4]])}" class="c-trim"/>`;
  s+=`<circle cx="${fx}" cy="${-R}" r="${aR}" class="c-well"/><circle cx="${rx}" cy="${-R}" r="${aR}" class="c-well"/></g>`;
  // vitrage, montants, portes
  const xF=Math.max(fx+aR+35,(ol.glass?ol.glass[0][0]:p.cowlX+60)-70),xRmax=rx-aR-28;
  let doors=[];
  if(ol.glass){
    const [gA,gB,gC,gD]=ol.glass,belt=x=>lerp(gA[1],gD[1],clamp((x-gA[0])/(gD[0]-gA[0]),0,1));
    s+=`<path d="${rpath(ol.glass)}" class="c-glass"/><g clip-path="url(#${id}g)"><path d="${poly([[gA[0],gA[1]],[gB[0],gB[1]],[gB[0]+260,gB[1]],[gA[0]+420,gA[1]]])}" class="c-pane"/>`;
    const px=B.pill.map(t=>lerp(gA[0],gD[0],t));
    for(const x of px) s+=`<rect x="${x-30}" y="${-H}" width="60" height="${H}" fill="${S.paint}"/>`;
    s+='</g>';
    doors=B.kind==='super'?[gC[0]+30]:B.kind==='pickup'?[px[0],gD[0]+10]:B.kind==='wagon'||B.kind==='suv'?px.slice(0,2):px.slice(0,2);
    doors=doors.map(x=>Math.min(x,xRmax));
    let prev=xF;
    s+=`<path d="M${xF} ${-(belt(xF)-8)}L${xF} ${-(sill+60)}" class="c-cut"/>`;
    for(const x of doors){s+=`<path d="M${x} ${-(belt(x)-8)}L${x} ${-(sill+60)}" class="c-cut"/><rect x="${x-250}" y="${-(belt(x)-70)}" width="130" height="24" rx="10" class="c-trim"/>`;prev=x;}
    s+=`<ellipse cx="${gA[0]+15}" cy="${-(gA[1]+38)}" rx="72" ry="42" fill="${S.paint}" class="c-body"/>`;
  }else{
    s+=`<path d="${rpath(ol.ws)}" class="c-glass"/>`;
    const by=Y(p.cowlH-25);
    s+=`<path d="${rpath([[2560,by-10,20],[2575,by+175,40],[2700,by+175,40],[2740,by-10,20]])}" class="c-trim"/>`;
    s+=`<path d="M${xF} ${-(Y(p.cowlH)-30)}L${xF} ${-(sill+60)}M2620 ${-(by-12)}L2620 ${-(sill+60)}" class="c-cut"/><rect x="2370" y="${-(by-80)}" width="130" height="24" rx="10" class="c-trim"/>`;
    s+=`<ellipse cx="${p.cowlX+120}" cy="${-(Y(p.cowlH)+60)}" rx="68" ry="40" fill="${S.paint}" class="c-body"/>`;
  }
  s+=`<path d="M${fx+aR+25} ${-(sill+.5*(Y(p.noseH)-sill)+40)}L${rx-aR-20} ${-(sill+.5*(Y(p.noseH)-sill)+75)}" class="c-cut"/>`;
  // becquets
  if(S.wing!=='none'&&roofSp){const ext=S.wing==='lip'?150:310,ry=H-p.drop;s+=`<path d="${poly([[p.roofX2-90,ry+4],[p.roofX2+ext,ry-14],[p.roofX2+ext-12,ry-44],[p.roofX2-40,ry-34]])}" class="c-trim"/>`;}
  if(S.wing==='lip'&&!roofSp){const ty=Y(p.tailH);s+=`<path d="${poly([[L-250,ty+2],[L-18,ty+64],[L-6,ty+44],[L-40,ty-6]])}" class="c-trim"/>`;}
  // roues
  const wheel=(cx,drv,type,dd)=>{
    let w=`<g transform="translate(${cx} ${-R})"><g class="wheel"><circle r="${R}" class="c-tire"/><circle r="${rimR}" class="c-rim"/>`;
    const dR=Math.max(60,Math.min(dd/2,rimR-22));
    w+=type==='drum'?`<circle r="${Math.max(60,Math.min(dd/2,rimR-30))}" class="c-drum"/>`:`<circle r="${dR}" class="c-disc${type==='ccm'?' ccm':''}"/>`;
    if(S.rimType==='steel'){w+=`<circle r="${rimR-14}" class="c-steel"/>`;for(let i=0;i<8;i++){const a=i*Math.PI/4;w+=`<circle cx="${(Math.cos(a)*rimR*.62).toFixed(1)}" cy="${(Math.sin(a)*rimR*.62).toFixed(1)}" r="${rimR*.1}" class="c-hole"/>`;}}
    else{const ns=S.rimType==='forged'?10:5,sw=S.rimType==='forged'?rimR*.1:rimR*.24;for(let i=0;i<ns;i++){const a=i*2*Math.PI/ns-Math.PI/2;w+=`<line x2="${(Math.cos(a)*(rimR-10)).toFixed(1)}" y2="${(Math.sin(a)*(rimR-10)).toFixed(1)}" stroke-width="${sw}" class="c-spoke"/>`;}w+=`<circle r="${rimR-8}" class="c-rimedge"/>`;}
    w+=`<circle r="${rimR*.2}" class="c-hub"/></g>`;
    if(type!=='drum'&&S.rimType!=='steel'){const r2=dR-22,a1=-2.5,a2=-1.75;w+=`<path d="M${(Math.cos(a1)*r2).toFixed(1)} ${(Math.sin(a1)*r2).toFixed(1)}A${r2} ${r2} 0 0 1 ${(Math.cos(a2)*r2).toFixed(1)} ${(Math.sin(a2)*r2).toFixed(1)}" stroke-width="40" class="c-cal"/>`;}
    if(o.cut&&drv) w+=`<circle r="${R+26}" class="x-drv"/>`;
    return w+'</g>';
  };
  s+=wheel(fx,S.drive!=='rwd',S.brakeF,S.brakeFd)+wheel(rx,S.drive!=='fwd',S.brakeR,S.brakeRd);
  s+=kitSVG(B,ol,{fx,rx,R,aR,style:S.style,bumper:S.bumper,lights:S.lights,mirrors:S.mirrors,paint:S.paint,mx:(ol.glass?ol.glass[0][0]:ol.cowlX+60)-20,my:(ol.glass?ol.glass[0][1]:ol.cowlY)+10});
  // écorché
  if(o.cut){
    const eLen=S.enginePos==='FT'?E.wid:E.len;
    const x0=S.enginePos==='FL'?Math.max(140,fx-.3*eLen):S.enginePos==='FT'?Math.max(140,fx-.6*eLen):S.enginePos==='MR'?rx-170-eLen:rx-40;
    const y0=S.gc+95,eh=clamp(Math.min(E.hgt,(front?Y(p.noseH):Y(p.deckH))-y0-30),160,900),ys=S.gc+165;
    let gx0,gx1;
    if(S.enginePos==='FL'||S.enginePos==='MR'){gx0=x0+eLen;gx1=gx0+(S.enginePos==='FL'?430:380);s+=`<path d="${poly([[gx0,y0+eh*.78],[gx1,y0+eh*.5],[gx1,y0+eh*.14],[gx0,y0+eh*.04]])}" class="x-gbx"/>`;}
    else if(S.enginePos==='FT'){gx0=x0+eLen-70;gx1=gx0+250;s+=`<rect x="${gx0}" y="${-(y0+eh*.5)}" width="250" height="${eh*.46}" rx="30" class="x-gbx"/>`;}
    else{gx1=x0;gx0=x0-400;s+=`<path d="${poly([[gx1,y0+eh*.78],[gx0,y0+eh*.5],[gx0,y0+eh*.14],[gx1,y0+eh*.04]])}" class="x-gbx"/>`;}
    if(front&&(S.drive==='rwd'||S.drive==='awd')) s+=`<path d="M${gx1} ${-ys}L${rx} ${-ys}" class="x-shaft"/>`;
    if(!front&&S.drive==='awd') s+=`<path d="M${Math.min(gx0,x0)} ${-ys}L${fx} ${-ys}" class="x-shaft"/>`;
    const tx=front?rx-640:fx+340;
    s+=`<rect x="${tx}" y="${-(S.gc+270)}" width="440" height="200" rx="40" class="x-tank"/>`;
    s+=`<rect x="${x0}" y="${-(y0+eh)}" width="${eLen}" height="${eh}" rx="34" class="x-eng"/><text x="${x0+eLen/2}" y="${-(y0+eh/2)+fs*.3}" text-anchor="middle" font-size="${fs*.95}" class="x-lab">${E.c.lab}</text>`;
  }
  // cotes
  if(o.dims){
    const y1=150,y2=150+fs*1.9,tk=fs*.3;
    const hdim=(a,b,y,txt)=>`<path d="M${a} ${y-tk}V${y+tk}M${b} ${y-tk}V${y+tk}M${a} ${y}H${b}" class="c-dim"/><text x="${(a+b)/2}" y="${y+fs*1.15}" text-anchor="middle" font-size="${fs}" class="c-dimt">${txt}</text>`;
    s+=hdim(fx,rx,y1,`Empattement ${nf(B.WB)}`)+hdim(0,L,y2,`Longueur ${nf(L)}`);
    const xh=L+170;
    s+=`<path d="M${xh-tk} 0H${xh+tk}M${xh-tk} ${-H}H${xh+tk}M${xh} 0V${-H}" class="c-dim"/><text transform="translate(${xh+fs*1.2} ${-H/2}) rotate(-90)" text-anchor="middle" font-size="${fs}" class="c-dimt">Hauteur ${nf(H)}</text>`;
  }
  return s+'</svg>';
}
