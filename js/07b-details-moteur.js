'use strict';
/* ───────────── Détails des moteurs 3D ─────────────
   Petites géométries (vis, poulies à gorges, courroie, volutes de turbo, lettres en relief…) construites en
   coordonnées absolues du moteur (mm), puis fusionnées par pièce et par matière : un seul maillage par couple
   (pièce, matière) au lieu de centaines de petits cylindres. Utilisé par build3D (js/07). */
const DET3=(()=>{
  const T=THREE,V=(x,y,z)=>new T.Vector3(x,y,z),UP=V(0,1,0),XA=V(1,0,0),ZA=V(0,0,1);
  const put=(g,p,q)=>{g.applyMatrix4(new T.Matrix4().compose(p,q||new T.Quaternion(),V(1,1,1)));return g;};
  const qv=(d,from)=>new T.Quaternion().setFromUnitVectors(from||UP,d.clone().normalize());
  /* nombre de facettes selon le rayon : peu pour les petites pièces */
  const sg=r=>qSeg(Math.max(8,Math.min(22,Math.round(r*.9)+6)),6);
  /* cylindre (ou cône) de p (rayon r) à q (rayon rt) */
  const cyl=(p,q,r,rt,n)=>{const d=q.clone().sub(p),L=d.length()||.01;return put(new T.CylinderGeometry(rt==null?r:rt,r,L,n||sg(r)),p.clone().addScaledVector(d,.5),qv(d.lengthSq()?d:UP));};
  const box=(c,sx,sy,sz,q)=>put(new T.BoxGeometry(sx,sy,sz),c,q);
  /* tête hexagonale (vis, écrou) centrée en p, d'axe d */
  const hex=(p,d,r,h)=>{const u=d.clone().normalize();return cyl(p.clone().addScaledVector(u,-h/2),p.clone().addScaledVector(u,h/2),r,r,6);};
  /* anneau (collier, joint torique) autour de l'axe d */
  const ring=(p,d,R,r)=>put(new T.TorusGeometry(R,r,6,qSeg(Math.max(12,Math.min(24,Math.round(R)+8)),8)),p,qv(d,ZA));
  /* solide de révolution autour de l'axe X : prof = [[position axiale, rayon], …] */
  const lathe=(prof,p,n)=>{const g=new T.LatheGeometry(prof.map(a=>new T.Vector2(Math.max(.01,a[1]),a[0])),qSeg(n||24,10));return put(g,p,qv(XA));};
  /* ruban fermé (courroie plate) : path = points dans un plan x = cte, w = largeur selon x, t = épaisseur vers l'extérieur */
  const belt=(path,w,t)=>{
    const N=path.length;let A=0;for(let i=0;i<N;i++){const a=path[i],b=path[(i+1)%N];A+=a.y*b.z-b.y*a.z;}const sgn=A>=0?1:-1;
    const pos=[],nor=[],idx=[];
    const face=(fn)=>{const o=pos.length/3;for(let i=0;i<N;i++){const a=path[(i+N-1)%N],b=path[(i+1)%N],p=path[i],tg=b.clone().sub(a).normalize(),n=V(0,tg.z*sgn,-tg.y*sgn),r=fn(p,n);pos.push(r[0].x,r[0].y,r[0].z,r[1].x,r[1].y,r[1].z);for(const nn of [r[2],r[2]]) nor.push(nn.x,nn.y,nn.z);}
      for(let i=0;i<N;i++){const j=(i+1)%N,a=o+2*i,b=o+2*j;idx.push(a,b,a+1,b,b+1,a+1);}};
    face((p,n)=>[p.clone().addScaledVector(XA,-w/2),p.clone().addScaledVector(XA,w/2),n.clone().negate()]);
    face((p,n)=>[p.clone().addScaledVector(XA,w/2).addScaledVector(n,t),p.clone().addScaledVector(XA,-w/2).addScaledVector(n,t),n]);
    face((p,n)=>[p.clone().addScaledVector(XA,w/2),p.clone().addScaledVector(XA,w/2).addScaledVector(n,t),XA]);
    face((p,n)=>[p.clone().addScaledVector(XA,-w/2).addScaledVector(n,t),p.clone().addScaledVector(XA,-w/2),XA.clone().negate()]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setIndex(idx);return g;};
  /* tracé d'une courroie qui épouse des poulies : ps = [{y,z,r}], dans l'ordre antihoraire ; retire les poulies qui ne touchent pas le tracé tendu.
     Renvoie {pts, used} : points (y,z) du tracé et poulies réellement enroulées. */
  const wrap=ps=>{
    let L=ps.slice();
    for(let it=0;it<6&&L.length>2;it++){
      const n=L.length,psi=L.map((a,i)=>{const b=L[(i+1)%n],dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dy,dz)||1,ph=Math.atan2(dz,dy);return ph-Math.acos(Math.max(-1,Math.min(1,(a.r-b.r)/d)));});
      let bad=-1,worst=0;
      for(let i=0;i<n;i++){let d=psi[i]-psi[(i+n-1)%n];d=Math.atan2(Math.sin(d),Math.cos(d));if(d<worst-1e-6){worst=d;bad=i;}}
      if(bad<0) break;L.splice(bad,1);}
    const n=L.length,psi=L.map((a,i)=>{const b=L[(i+1)%n],dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dy,dz)||1,ph=Math.atan2(dz,dy);return ph-Math.acos(Math.max(-1,Math.min(1,(a.r-b.r)/d)));});
    const pts=[];
    L.forEach((a,i)=>{let s=psi[(i+n-1)%n],e=psi[i];while(e<s) e+=2*Math.PI;const m=Math.max(2,Math.ceil((e-s)/.2));for(let j=0;j<=m;j++){const an=s+(e-s)*j/m;pts.push({y:a.y+a.r*Math.cos(an),z:a.z+a.r*Math.sin(an)});}});
    return {pts,used:L};};
  /* volute de turbo : spirale de section croissante autour de l'axe X ; la plus grande section est à l'angle `ph1` (0 = vers +y, tourne vers +z) */
  const volute=(c,R0,R1,r0,r1,ph1,steps)=>{
    steps=steps||36;const K=12,pos=[],idx=[];
    for(let i=0;i<=steps;i++){const s=i/steps,ph=ph1-(1-s)*2*Math.PI*.96,R=R0+(R1-R0)*s,rho=r0+(r1-r0)*Math.pow(s,.8),er=V(0,Math.cos(ph),Math.sin(ph)),cp=V(c.x,c.y+R*er.y,c.z+R*er.z);
      for(let j=0;j<K;j++){const a=j/K*2*Math.PI,q=cp.clone().addScaledVector(er,rho*Math.cos(a)).addScaledVector(XA,rho*Math.sin(a));pos.push(q.x,q.y,q.z);}}
    for(let i=0;i<steps;i++) for(let j=0;j<K;j++){const j2=(j+1)%K,a=i*K+j,b=(i+1)*K+j,a2=i*K+j2,b2=(i+1)*K+j2;idx.push(a,a2,b,a2,b2,b);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;};
  /* chiffres à sept segments, V, T, L et point : lettres en relief. o = origine du texte, r = direction d'écriture, u = « haut », h = hauteur, e = épaisseur */
  const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg',L:'def'};
  const text=(str,o,r,u,h,e)=>{
    const out=[],nrm=r.clone().cross(u).normalize(),w=h*.55,s=h*.15,gap=h*.3,bs=new T.Matrix4().makeBasis(r.clone().normalize(),u.clone().normalize(),nrm),q=new T.Quaternion().setFromRotationMatrix(bs);
    let x=0;
    const bx=(cx,cy,sx,sy,rot)=>{const p=o.clone().addScaledVector(r,cx).addScaledVector(u,cy).addScaledVector(nrm,e/2);const qq=rot?q.clone().multiply(new T.Quaternion().setFromAxisAngle(ZA,rot)):q;out.push(box(p,sx,sy,e,qq));};
    for(const ch of String(str)){
      if(ch===' '){x+=w*.6;continue;}
      if(ch==='.'){bx(x+s/2,s/2,s,s);x+=s+gap;continue;}
      if(ch==='V'){const an=Math.atan2(w/2,h);bx(x+w*.25,h/2,s,Math.hypot(h,w/2),-an);bx(x+w*.75,h/2,s,Math.hypot(h,w/2),an);x+=w+gap;continue;}
      if(ch==='T'){bx(x+w/2,h-s/2,w,s);bx(x+w/2,h/2,s,h);x+=w+gap;continue;}
      const sg2=SEG[ch];if(!sg2) continue;
      for(const c of sg2){
        if(c==='a') bx(x+w/2,h-s/2,w,s);else if(c==='d') bx(x+w/2,s/2,w,s);else if(c==='g') bx(x+w/2,h/2,w,s);
        else if(c==='b') bx(x+w-s/2,h*.75,s,h/2);else if(c==='c') bx(x+w-s/2,h*.25,s,h/2);
        else if(c==='f') bx(x+s/2,h*.75,s,h/2);else if(c==='e') bx(x+s/2,h*.25,s,h/2);}
      x+=w+gap;}
    return {geos:out,width:x};};
  /* couronne dentée d'axe X : N dents en créneaux triangulaires de profondeur 4,5 % du rayon */
  const gear=(p,R,h,N)=>{
    const g=new T.CylinderGeometry(R,R,h,2*N),pa=g.attributes.position,n=2*N;
    for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);if(Math.hypot(x,z)<R*.5) continue;const j=((Math.round(Math.atan2(z,x)/(2*Math.PI/n))%n)+n)%n,f=(j%2)?1:.955;pa.setX(i,x*f);pa.setZ(i,z*f);}
    g.computeVertexNormals();return put(g,p,qv(XA));};
  /* fusion de géométries (position + normale) en un seul BufferGeometry indexé */
  const merge=list=>{
    const pos=[],nor=[],idx=[];let off=0;
    for(const g of list){if(!g) continue;const p=g.attributes.position.array,n=g.attributes.normal?g.attributes.normal.array:null,cnt=g.attributes.position.count;
      for(let i=0;i<p.length;i++){pos.push(p[i]);nor.push(n?n[i]:0);}
      if(g.index){const a=g.index.array;for(let i=0;i<a.length;i++) idx.push(a[i]+off);}else for(let i=0;i<cnt;i++) idx.push(off+i);
      off+=cnt;g.dispose();}
    const o=new T.BufferGeometry();o.setAttribute('position',new T.Float32BufferAttribute(pos,3));o.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
    o.setIndex(new T.BufferAttribute(off>65000?new Uint32Array(idx):new Uint16Array(idx),1));return o;};
  /* lot : accumule des géométries par (pièce, parent, matière) puis crée un maillage par groupe */
  const batch=()=>{
    const m=new Map();
    return {
      add(part,mat,g,parent){if(!g) return;const k=part.name+'|'+(parent?parent.id:0)+'|'+mat.uuid;let e=m.get(k);if(!e){e={part,mat,parent,list:[]};m.set(k,e);}e.list.push(g);},
      flush(root,mkEdges){
        for(const e of m.values()){const g=merge(e.list),me=new T.Mesh(g,e.mat);(e.parent||root).add(me);e.part.meshes.push(me);
          if(!e.part.pin){g.computeBoundingBox();e.part.pin=g.boundingBox.getCenter(V(0,0,0));}
          if(mkEdges) mkEdges(me);}
        m.clear();}};};
  return {V,put,cyl,box,hex,ring,lathe,belt,wrap,volute,gear,text,merge,batch,qv};
})();
