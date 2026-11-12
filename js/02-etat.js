'use strict';
/* ───────────── État ───────────── */
const S=Object.assign({},DEF);
const M={E:null,C:null};
const ui={tab:'moteur',cut:true,run:true,rpm:0,load:0,therm:false,snd:false,noAnim:false,broken:null,dmg:{},faults:{},cruiseV:130,sweep:null,cyc:0,cycPlay:true,T:null,engSel:'',eview:'3d',az:-.85,el:.32,zoom:1,pins:true,sel:null};
const TABS=[['moteur','Moteur'],['carrosserie','Carrosserie'],['transmission','Transmission'],['trains','Trains roulants'],['habitacle','Habitacle'],['essais','Essais']];

function sanitize(){
  const B=BODY[S.body]||BODY.coupe; if(!BODY[S.body]) S.body='coupe';
  if(!CFG[S.config]) S.config='I4';
  if(!B.bay[S.enginePos]) S.enginePos=Object.keys(B.bay)[0];
  if(!POS[S.enginePos].drv.includes(S.drive)) S.drive=POS[S.enginePos].drv[0];
  if(!B.seats.includes(S.seats)) S.seats=B.seats[B.seats.length-1];
  if(S.suspR==='torsion'&&S.drive!=='fwd') S.suspR='mac';
  if(S.suspR==='dedion'&&S.drive==='fwd') S.suspR='torsion';
  if(!S.abs) S.esp=false;
  for(const [k,tb,df] of [['blockMat',BLOCK,'alu'],['liner',LINER,'alusil'],['sump',SUMP,'wet'],['valveMat',VALVE,'steel'],['springs',SPRING,'coil'],['intake',INTAKE,'std'],['turboType',TURBO,'wg'],['turboBearing',BEAR,'journal'],['scType',SCT,'roots'],['gearbox',GBX,'man']]) if(!tb[S[k]]) S[k]=df;
  if(NT[S.aspiration]==null) S.aspiration='na';if(!STAGE[S.turboStage]) S.turboStage='par';
  if(S.blockMat==='iron'||S.blockMat==='cgi') S.liner='cast';
  if(S.gearSet&&!GEARSETS[S.gearSet]) S.gearSet='';if(S.gearbox==='cvt'&&S.gearSet&&GEARSETS[S.gearSet].type!=='cvt') S.gearSet='';
  if(!FUEL[S.ecuFuel]||FUEL[S.ecuFuel].diesel) S.ecuFuel='sp98';
  if(!TIMING[S.timing]) S.timing='chain';if(!OIL[S.oilGrade]) S.oilGrade='5w40';
  if(CFG[S.config].rot){if(FUEL[S.fuel]&&FUEL[S.fuel].diesel) S.fuel='sp98';S.cda=false;}
  if(!FUEL[S.fuel]) S.fuel='sp98';if(!FS[S.fuelSys]) S.fuelSys='mpi';
  if(FUEL[S.fuel].diesel&&!FS[S.fuelSys].d) S.fuelSys='cr';
  if(!FUEL[S.fuel].diesel&&FS[S.fuelSys].d) S.fuelSys='mpi';
  if(S.gearbox==='man'&&S.gears>7) S.gears=7;
  if(FUEL[S.fuel].diesel&&S.intake==='itb') S.intake='std';
}
