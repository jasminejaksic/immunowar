import { useState, useEffect, useRef } from "react";

const CW = 640, CH = 430, CX = CW/2, CY = CH/2, CR = 32;
const MAX_C = 15, ECAP = 200;

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const LB_KEY = "immunowar_lb_v3";
async function loadScores(){try{const r=await window.storage.get(LB_KEY);return r?JSON.parse(r.value):[];}catch{return[];}}
async function saveScore(e){try{const s=await loadScores();s.push(e);s.sort((a,b)=>b.score-a.score);const t=s.slice(0,10);await window.storage.set(LB_KEY,JSON.stringify(t));return t;}catch{return[];}}

// ─── SFX ─────────────────────────────────────────────────────────────────────
const SFX={ctx:null,muted:false,gc(){if(!this.ctx)try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return this.ctx;},play(type){if(this.muted)return;const ac=this.gc();if(!ac)return;try{if(ac.state==="suspended")ac.resume();const t=ac.currentTime;const T=(f,w,g,d,e,a=0)=>{const o=ac.createOscillator(),gn=ac.createGain();o.connect(gn);gn.connect(ac.destination);o.type=w;o.frequency.setValueAtTime(f,t+a);if(e)o.frequency.exponentialRampToValueAtTime(e,t+a+d);gn.gain.setValueAtTime(g,t+a);gn.gain.exponentialRampToValueAtTime(0.001,t+a+d);o.start(t+a);o.stop(t+a+d+0.01);};switch(type){case"place":T(440,"sine",0.10,0.09,220);break;case"kill":T(290,"sine",0.15,0.13,80);break;case"split":T(600,"sine",0.08,0.07,180);break;case"coreHit":T(90,"sine",0.22,0.20,45);break;case"splash":T(320,"sine",0.08,0.12,120);break;case"gameOver":[440,350,220].forEach((f,i)=>T(f,"sawtooth",0.07,0.24,null,i*0.18));break;case"waveEnd":[440,550,660].forEach((f,i)=>T(f,"sine",0.10,0.14,null,i*0.08));break;case"levelEnd":[523,659,784].forEach((f,i)=>T(f,"sine",0.09,0.45,null,i*0.03));break;case"bonusStart":[200,160,130,100].forEach((f,i)=>T(f,"sine",0.11,0.35,null,i*0.14));break;case"victory":[523,659,784,1047].forEach((f,i)=>T(f,"sine",0.10,0.50,null,i*0.09));break;}}catch(e){}}};

// ─── CELLS ───────────────────────────────────────────────────────────────────
const CELLS={
  neutrophil:{name:"Neutrophil",cost:15,maxHp:60, dmg:9, range:88, aps:1.3, col:"#26C6DA",r:14,desc:"AoE splash. +25% vs bacteria.",splash:true,splashR:38,splashMult:0.45,catBonus:{bacteria:1.25}},
  macrophage:{name:"Macrophage",cost:30,maxHp:150,dmg:28,range:60, aps:0.55,col:"#66BB6A",r:21,desc:"Tank. +25% vs bacteria & fungi.",catBonus:{bacteria:1.25,fungi:1.25}},
  tcell:     {name:"T-Cell",    cost:25,maxHp:44, dmg:15,range:140,aps:2.2, col:"#FFA726",r:13,desc:"Rapid-fire. +25% vs virus & cancer.",catBonus:{virus:1.25,cancer:1.25}},
  bcell:     {name:"B-Cell",    cost:40,maxHp:38, dmg:25,range:215,aps:0.85,col:"#AB47BC",r:14,desc:"Long range. +25% vs virus.",catBonus:{virus:1.25}},
};

// ─── PATHOGENS ───────────────────────────────────────────────────────────────
// virus=red/orange  bacteria=brown/earth  fungi=purple  parasite=amber/warm
const PATHS={
  flu:        {name:"Influenza A",    cat:"virus",   hp:26, spd:0.65,dmg:3, rew:10,col:"#EF5350",r:9 },
  rhinovirus: {name:"Rhinovirus",     cat:"virus",   hp:20, spd:1.05,dmg:2, rew:8, col:"#FF7043",r:7 },
  rsv:        {name:"RSV",            cat:"virus",   hp:30, spd:0.80,dmg:4, rew:12,col:"#FF8A65",r:9 },
  norovirus:  {name:"Norovirus",      cat:"virus",   hp:22, spd:1.12,dmg:3, rew:10,col:"#FFAB91",r:7 },
  adenovirus: {name:"Adenovirus",     cat:"virus",   hp:35, spd:0.70,dmg:4, rew:14,col:"#FF5722",r:10},
  measles:    {name:"Measles Virus",  cat:"virus",   hp:44, spd:0.88,dmg:5, rew:18,col:"#E53935",r:11},
  chickenpox: {name:"Varicella",      cat:"virus",   hp:38, spd:0.75,dmg:4, rew:15,col:"#F44336",r:10},
  mumps:      {name:"Mumps Virus",    cat:"virus",   hp:50, spd:0.60,dmg:6, rew:20,col:"#E57373",r:12},
  dengue:     {name:"Dengue Virus",   cat:"virus",   hp:60, spd:0.95,dmg:8, rew:24,col:"#D32F2F",r:11},
  hepatitisB: {name:"Hepatitis B",    cat:"virus",   hp:80, spd:0.50,dmg:9, rew:28,col:"#B71C1C",r:13},
  corona:     {name:"Coronavirus",    cat:"virus",   hp:170,spd:0.72,dmg:16,rew:62,col:"#C62828",r:18},
  ebola:      {name:"Ebola Virus",    cat:"virus",   hp:195,spd:0.55,dmg:20,rew:75,col:"#7f0000",r:17},
  ecoli:      {name:"E. coli",        cat:"bacteria",hp:55, spd:0.42,dmg:6, rew:20,col:"#8B4513",r:12},
  salmonella: {name:"Salmonella",     cat:"bacteria",hp:60, spd:0.45,dmg:6, rew:20,col:"#A0522D",r:12},
  staph:      {name:"Staph Aureus",   cat:"bacteria",hp:70, spd:0.35,dmg:7, rew:22,col:"#795548",r:13},
  strep:      {name:"Streptococcus",  cat:"bacteria",hp:100,spd:0.27,dmg:9, rew:30,col:"#6D4C41",r:16},
  listeria:   {name:"Listeria",       cat:"bacteria",hp:75, spd:0.38,dmg:8, rew:25,col:"#5D4037",r:13},
  cdiff:      {name:"C. difficile",   cat:"bacteria",hp:90, spd:0.30,dmg:10,rew:28,col:"#4E342E",r:14},
  hpylori:    {name:"H. pylori",      cat:"bacteria",hp:80, spd:0.32,dmg:8, rew:26,col:"#8D6E63",r:13},
  lyme:       {name:"Lyme Borrelia",  cat:"bacteria",hp:110,spd:0.35,dmg:11,rew:35,col:"#558B2F",r:15},
  pneumo:     {name:"Pneumococcus",   cat:"bacteria",hp:120,spd:0.25,dmg:12,rew:38,col:"#33691E",r:16},
  tb:         {name:"Tuberculosis",   cat:"bacteria",hp:145,spd:0.20,dmg:14,rew:50,col:"#827717",r:17},
  resistant:  {name:"MRSA",           cat:"bacteria",hp:130,spd:0.43,dmg:13,rew:42,col:"#BF360C",r:14},
  superbug:   {name:"Super Bug",      cat:"bacteria",hp:240,spd:0.50,dmg:22,rew:85,col:"#4E342E",r:21},
  candida:    {name:"Candida",        cat:"fungi",   hp:60, spd:0.25,dmg:7, rew:22,col:"#CE93D8",r:13},
  aspergillus:{name:"Aspergillus",    cat:"fungi",   hp:85, spd:0.20,dmg:9, rew:28,col:"#AB47BC",r:15},
  crypto:     {name:"Cryptococcus",   cat:"fungi",   hp:110,spd:0.22,dmg:11,rew:35,col:"#8E24AA",r:16},
  malaria:    {name:"Plasmodium",     cat:"parasite",hp:70, spd:0.85,dmg:10,rew:28,col:"#FFB300",r:12},
  giardia:    {name:"Giardia",        cat:"parasite",hp:45, spd:0.60,dmg:5, rew:16,col:"#FF8F00",r:10},
  toxo:       {name:"Toxoplasma",     cat:"parasite",hp:90, spd:0.50,dmg:10,rew:30,col:"#F57F17",r:14},
  cancerCell: {name:"Cancer Cell",    cat:"cancer",  hp:90, spd:0.28,dmg:10,rew:20,col:"#8B0000",r:14,splits:true},
  microCancer:{name:"Micro Cancer",   cat:"cancer",  hp:38, spd:0.46,dmg:5, rew:8, col:"#8B0000",r:8 },
  metastatic: {name:"Metastatic Cell",cat:"cancer",  hp:65, spd:0.80,dmg:12,rew:30,col:"#CC0044",r:11},
  tumor:      {name:"Tumor",          cat:"cancer",  hp:360,spd:0.07,dmg:18,rew:80,col:"#3D0040",r:26,spawner:true,spawnInt:4500},
  leukemia:   {name:"Leukemia Cell",  cat:"cancer",  hp:50, spd:1.18,dmg:14,rew:25,col:"#AA0020",r:9 },
};

const CAT_META={
  virus:   {label:"VIRUS",   col:"#EF5350",bg:"rgba(239,83,80,0.10)"},
  bacteria:{label:"BACTERIA",col:"#A0522D",bg:"rgba(139,69,19,0.12)"},
  fungi:   {label:"FUNGI",   col:"#AB47BC",bg:"rgba(171,71,188,0.10)"},
  parasite:{label:"PARASITE",col:"#FFB300",bg:"rgba(255,179,0,0.10)"},
  cancer:  {label:"CANCER",  col:"#CC0044",bg:"rgba(204,0,68,0.10)"},
};

const FACTS={
  flu:        {icon:"🦠",fact:"Influenza A mutates every season via antigenic drift, making last year's immunity only partially effective. It spreads via droplets and can survive on surfaces for up to 24 hours."},
  rhinovirus: {icon:"💨",fact:"Rhinovirus causes roughly half of all common colds. It replicates best at 33°C — exactly the temperature of your nasal passages, making your nose its ideal incubator."},
  rsv:        {icon:"🫁",fact:"RSV is the leading cause of infant hospitalization. It causes airway cells to fuse into large masses called syncytia, blocking airflow and making breathing difficult."},
  norovirus:  {icon:"🤢",fact:"Norovirus is extraordinarily contagious — just 18 viral particles can cause infection. It survives on surfaces for weeks and resists many standard disinfectants."},
  adenovirus: {icon:"👁️",fact:"Adenovirus causes conjunctivitis, respiratory illness, and gastroenteritis depending on which of its 50+ strains you encounter. Broad immunity is nearly impossible to build."},
  measles:    {icon:"🔴",fact:"Measles can linger airborne in a room for two hours after an infected person leaves. It also causes immune amnesia — erasing memory of infections you've already cleared."},
  chickenpox: {icon:"🌀",fact:"Varicella-zoster stays dormant in nerve cells for decades. It can reactivate later in life as shingles when the immune system weakens with age or stress."},
  mumps:      {icon:"🧸",fact:"Mumps targets salivary glands but also infects testes, ovaries, and brain. It reaches peak contagiousness before symptoms even appear."},
  dengue:     {icon:"🦟",fact:"Dengue infects 400 million people annually. A second infection with a different strain can trigger severe hemorrhagic fever due to cross-reactive antibodies."},
  hepatitisB: {icon:"🫀",fact:"Hepatitis B is 100x more transmissible than HIV and can persist for decades without symptoms, eventually causing cirrhosis and liver cancer."},
  corona:     {icon:"👑",fact:"Coronavirus spike proteins mimic host cell receptors to gain entry. B-Cells respond by producing antibodies that physically block these spikes — but the virus evolves quickly."},
  ebola:      {icon:"☣️",fact:"Ebola disables the interferon response first — the very alarm system that would call in immune backup. By the time the immune system mobilizes, it's already overwhelmed."},
  ecoli:      {icon:"💩",fact:"Most E. coli strains are harmless gut residents — but pathogenic strains like O157:H7 produce Shiga toxin that destroys red blood cells and causes kidney failure."},
  salmonella: {icon:"🐔",fact:"Salmonella hides inside macrophages — the cells meant to destroy it — and uses them as transport to reach the lymph nodes and spread through the body."},
  staph:      {icon:"🔶",fact:"Staph aureus colonizes skin and nasal passages silently in 30% of people. It only becomes dangerous when immunity drops, producing toxins that punch holes in cell membranes."},
  strep:      {icon:"🫁",fact:"Streptococcus produces enzymes that digest connective tissue, letting it spread rapidly. If it reaches the bloodstream it can trigger sepsis within hours."},
  listeria:   {icon:"🥶",fact:"Listeria is the only bacterium that reproduces in your refrigerator. It crosses the blood-brain barrier and is especially dangerous during pregnancy."},
  cdiff:      {icon:"🧫",fact:"C. difficile produces spores that survive bleach for months. Antibiotic overuse wipes out protective gut bacteria, giving it room to explode in the colon."},
  hpylori:    {icon:"🔩",fact:"H. pylori neutralizes stomach acid around itself using urease, carving out a protected niche to cause ulcers. It infects roughly half the world's population."},
  lyme:       {icon:"🕷️",fact:"Lyme bacteria change their outer surface proteins to evade antibody targeting. Without treatment it spreads from the bite site to joints, heart, and brain."},
  pneumo:     {icon:"🫧",fact:"Pneumococcus has over 90 distinct capsular types, each requiring separate immunity. It causes pneumonia, meningitis, and sepsis — over a million deaths annually."},
  tb:         {icon:"🫁",fact:"TB can remain dormant for decades inside macrophages — the cells meant to destroy it. It kills 1.5 million people per year and only 10% of latent infections ever activate."},
  aspergillus:{icon:"🍄",fact:"Aspergillus spores are inhaled constantly. Healthy immune systems clear them instantly, but in immunocompromised people the spores form invasive fungal masses in the lungs."},
  candida:    {icon:"🕯️",fact:"Candida lives harmlessly in your gut microbiome but overgrows into systemic infection when defenses drop. It switches between yeast and filamentous form to penetrate tissue."},
  crypto:     {icon:"🧠",fact:"Cryptococcus crosses the blood-brain barrier to cause fungal meningitis — a leading cause of death in HIV patients. It hides inside macrophages to travel through the body."},
  malaria:    {icon:"🦟",fact:"Plasmodium bursts red blood cells in coordinated waves — causing malaria's cyclical fevers. It also hides surface antigens to evade immune detection between cycles."},
  giardia:    {icon:"💧",fact:"Giardia uses a disc-shaped sucker to attach to the intestinal wall, disrupting nutrient absorption for weeks. It spreads through contaminated water and resists chlorine treatment."},
  toxo:       {icon:"🐱",fact:"Toxoplasma infects roughly a third of all humans. In mice it manipulates brain chemistry to attract them to cats — its definitive host. The effects on human behavior are still debated."},
  resistant:  {icon:"⚠️",fact:"MRSA produces enzymes that neutralize most antibiotics. Your T-Cells must attack directly — there is no chemical shortcut and each generation becomes more resistant."},
  cancerCell: {icon:"🧬",fact:"Cancer cells disable the apoptosis switch that triggers self-destruction. Because they originate from your own cells, the immune system struggles to identify them as foreign."},
  metastatic: {icon:"🩸",fact:"Metastatic cells detach from tumors and enter the bloodstream. They secrete proteins that help them survive in circulation and establish new colonies in distant organs."},
  tumor:      {icon:"⬤", fact:"Solid tumors grow their own blood supply via angiogenesis. They emit immunosuppressive signals that disable local T-Cell activity — creating a protected exclusion zone."},
  leukemia:   {icon:"💉",fact:"Leukemia floods the bloodstream with non-functional white blood cells that crowd out healthy ones — destroying the body's own immune capacity from the inside."},
  superbug:   {icon:"💀",fact:"Superbugs combine resistance to multiple drug classes with high replication speed. They acquire resistance genes from neighboring bacteria via horizontal gene transfer — evolution in real time."},
};

const TIERS={
  1:["flu","rhinovirus","rsv","norovirus","adenovirus"],
  2:["measles","chickenpox","mumps","ecoli","salmonella","giardia"],
  3:["staph","strep","listeria","cdiff","hpylori","dengue","candida","malaria"],
  4:["lyme","pneumo","tb","hepatitisB","aspergillus","toxo","resistant","crypto"],
  5:["corona","ebola","superbug"],
};

const LEVEL_TEMPLATES=[
  {name:"First Contact",   waves:2,waveScale:0.18,tiers:[1],  types:1,count:6, bonus:30},
  {name:"Viral Spread",    waves:3,waveScale:0.20,tiers:[1],  types:2,count:7, bonus:35},
  {name:"Early Infection", waves:3,waveScale:0.22,tiers:[1,2],types:2,count:7, bonus:35},
  {name:"Bacterial Breach",waves:4,waveScale:0.25,tiers:[2],  types:2,count:6, bonus:40},
  {name:"Mixed Outbreak",  waves:4,waveScale:0.28,tiers:[2,3],types:2,count:6, bonus:45},
  {name:"Resistant Front", waves:5,waveScale:0.30,tiers:[3],  types:3,count:5, bonus:50},
  {name:"Viral Surge",     waves:5,waveScale:0.34,tiers:[3,4],types:3,count:5, bonus:55},
  {name:"Perfect Storm",   waves:6,waveScale:0.38,tiers:[3,4],types:3,count:5, bonus:60},
  {name:"Super Infection", waves:6,waveScale:0.44,tiers:[4,5],types:3,count:5, bonus:75},
  {name:"Final Immunity",  waves:7,waveScale:0.50,tiers:[4,5],types:4,count:5, bonus:100},
];

const LEVEL_TIPS=[
  "Neutrophils splash nearby enemies — great vs swarms. Place them in a ring first.",
  "Fast viruses die quickly to T-Cells. Save energy for a second ring mid-wave.",
  "Mixed tiers mean mixed speeds. B-Cells for range, Macrophages up close.",
  "Bacteria hit hard up close. Cluster cells so multiple fire on the same target.",
  "Parasite zigzag makes them hard to hit — place cells to intercept their path.",
  "Resistant types shrug off weak attacks. Stack damage, don't spread thin.",
  "Wave scaling at this level hits 60%+ by wave 4. Hold 80E in reserve.",
  "Multiple threat types simultaneously. Overlap cell ranges for combined fire.",
  "Tier 5 enemies have massive HP. Three Macrophages on the same target is the answer.",
  "Everything at once. Full mixed army, energy held for waves 5+. No spreading thin.",
];

const BONUS_LEVELS=[
  {name:"Tumor Formation",waves:2,waveScale:0.22,s:[["cancerCell",5]],                                            bonus:50, tip:"Cancer cells split on death. Kill them near defenders, not near the core."},
  {name:"Metastasis",     waves:3,waveScale:0.28,s:[["cancerCell",5],["leukemia",5]],                             bonus:60, tip:"Leukemia are the fastest cancer type. T-Cells essential here."},
  {name:"Tumor Growth",   waves:3,waveScale:0.30,s:[["tumor",1],["leukemia",6]],                                  bonus:70, tip:"Kill the Tumor first — it spawns Cancer Cells every 4.5 seconds until dead."},
  {name:"Stage III",      waves:4,waveScale:0.35,s:[["metastatic",4],["cancerCell",5],["leukemia",4]],            bonus:80, tip:"Metastatic cells are fast and bypass outer defenders. Place cells deeper."},
  {name:"Terminal Stage", waves:5,waveScale:0.40,s:[["tumor",1],["metastatic",4],["cancerCell",6],["leukemia",5]],bonus:100,tip:"Kill the Tumor immediately or it floods the board. Then clean up the rest."},
];

function generateCompositions(){
  return LEVEL_TEMPLATES.map((t,i)=>{
    const pool=[...new Set(t.tiers.flatMap(tr=>TIERS[tr]))];
    const chosen=pool.sort(()=>Math.random()-0.5).slice(0,t.types);
    return{...t,s:chosen.map(type=>[type,t.count]),tip:LEVEL_TIPS[i]};
  });
}

let _uid=0;
const uid=()=>++_uid;

function edgePt(){const s=Math.floor(Math.random()*4);if(s===0)return{x:Math.random()*CW,y:-20};if(s===1)return{x:CW+20,y:Math.random()*CH};if(s===2)return{x:Math.random()*CW,y:CH+20};return{x:-20,y:Math.random()*CH};}

function getMods(ch){
  const m={maxHp:100,eStart:60,eRegen:2.0,cMult:{},atkMult:1};
  if(ch.gender==="female")m.cMult.bcell=1.15;
  if(ch.gender==="male")m.cMult.tcell=1.15;
  if(ch.age==="child") {m.maxHp=80; m.eStart=85;m.eRegen=2.6;}
  if(ch.age==="young") {m.maxHp=100;m.eStart=60;m.eRegen=2.0;}
  if(ch.age==="adult") {m.maxHp=120;m.eStart=60;m.eRegen=1.8;}
  if(ch.age==="senior"){m.maxHp=75; m.eStart=75;m.eRegen=1.5;m.atkMult=0.82;}
  return m;
}

function buildQ(lev,wave,now){
  const q=[],ws=1+(wave-1)*lev.waveScale;
  for(const [type,count] of lev.s){
    const spread=7000+wave*500;
    for(let i=0;i<count;i++)q.push({type,at:now+600+(i/Math.max(count-1,1))*spread+Math.random()*700,scale:ws});
  }
  return q.sort((a,b)=>a.at-b.at);
}

function getBriefingEnemies(lev){
  const seen=[];
  for(const [type] of lev.s)if(!seen.find(e=>e.type===type))seen.push({type,...PATHS[type],...(FACTS[type]||{icon:"🦠",fact:""})});
  return seen;
}

// ─── ENEMY DRAWING ────────────────────────────────────────────────────────────
function drawEnemy(ctx,p,now){
  const isCancer=p.cat==="cancer";
  const glowR=p.type==="tumor"?p.r*3.8:p.r*2.8;

  // Glow
  const pg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,glowR);
  pg.addColorStop(0,p.col+(isCancer?"66":"44"));pg.addColorStop(1,"transparent");
  ctx.fillStyle=pg;ctx.beginPath();ctx.arc(p.x,p.y,glowR,0,Math.PI*2);ctx.fill();

  if(p.type==="tumor"){
    // Lumpy pulsing blob
    ctx.beginPath();
    for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;const lump=p.r*(1+0.25*Math.sin(i*3+now/900)+0.12*Math.sin(i*5-now/650));const px=p.x+Math.cos(a)*lump,py=p.y+Math.sin(a)*lump;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
    ctx.closePath();ctx.fillStyle=p.col;ctx.fill();ctx.strokeStyle="#660066";ctx.lineWidth=2.5;ctx.stroke();
    if(p.nextSpawn>0){const prog=Math.min(1,1-((p.nextSpawn-now)/p.spawnInt));ctx.beginPath();ctx.arc(p.x,p.y,p.r+6+prog*20,0,Math.PI*2);ctx.strokeStyle=`rgba(120,0,120,${0.15+prog*0.3})`;ctx.lineWidth=2;ctx.stroke();}
    return;
  }

  if(isCancer){
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.fill();
    const spk=p.type==="leukemia"?5:9;ctx.strokeStyle=p.col+"cc";ctx.lineWidth=1.5;
    for(let i=0;i<spk;i++){const a=i/spk*Math.PI*2+0.38*Math.sin(now/270+i*1.8+p.id*0.45),len=3+5*Math.abs(Math.sin(i*2.4+now/620));ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r);ctx.lineTo(p.x+Math.cos(a)*(p.r+len),p.y+Math.sin(a)*(p.r+len));ctx.stroke();}
    if(p.splits){const rp=(Math.sin(now/380)+1)/2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+4+rp*4,0,Math.PI*2);ctx.strokeStyle=`rgba(200,0,50,${0.3+rp*0.2})`;ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);}
    return;
  }

  if(p.cat==="virus"){
    // Spiky sphere with animated spike proteins
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.fill();
    const spk=p.r>13?12:8;
    for(let i=0;i<spk;i++){
      const base=i/spk*Math.PI*2;
      const wobble=0.18*Math.sin(now/400+i*2.1+p.id);
      const a=base+wobble;
      const tip=p.r+5+3*Math.abs(Math.sin(now/500+i*1.7));
      ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r);
      ctx.lineTo(p.x+Math.cos(a)*tip,p.y+Math.sin(a)*tip);
      ctx.strokeStyle=p.col+"ee";ctx.lineWidth=2;ctx.stroke();
      // Spike tip dot
      ctx.beginPath();ctx.arc(p.x+Math.cos(a)*tip,p.y+Math.sin(a)*tip,1.5,0,Math.PI*2);
      ctx.fillStyle=p.col+"cc";ctx.fill();
    }
  } else if(p.cat==="bacteria"){
    // Rotating pill/rod shape oriented toward core
    const angle=p.angle||Math.atan2(CY-p.y,CX-p.x);
    const hl=p.r*1.4,hw=p.r*0.72;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-hl,-hw);ctx.lineTo(hl,-hw);
    ctx.arc(hl,0,hw,-Math.PI/2,Math.PI/2);
    ctx.lineTo(-hl,hw);
    ctx.arc(-hl,0,hw,Math.PI/2,-Math.PI/2);
    ctx.closePath();ctx.fillStyle=p.col;ctx.fill();
    ctx.strokeStyle=p.col+"99";ctx.lineWidth=1;ctx.stroke();
    // Flagella from back end
    const flCount=Math.max(1,Math.floor(p.r/7));
    for(let i=0;i<flCount;i++){
      const yOff=(i-(flCount-1)/2)*hw*0.9;
      const wag=now/600+i*1.4;
      ctx.beginPath();ctx.moveTo(-hl,yOff);
      ctx.bezierCurveTo(-hl-8,yOff+Math.sin(wag)*7,-hl-14,yOff+Math.sin(wag+1)*10,-hl-20,yOff+Math.sin(wag+2)*6);
      ctx.strokeStyle=p.col+"77";ctx.lineWidth=1.5;ctx.stroke();
    }
    ctx.restore();
  } else if(p.cat==="fungi"){
    // Irregular amoeba blob with hyphae tips
    ctx.beginPath();
    for(let i=0;i<=20;i++){
      const a=i/20*Math.PI*2;
      const lump=p.r*(1+0.28*Math.sin(i*2.1+now/1100+p.id)+0.14*Math.sin(i*3.7-now/800));
      i===0?ctx.moveTo(p.x+Math.cos(a)*lump,p.y+Math.sin(a)*lump):ctx.lineTo(p.x+Math.cos(a)*lump,p.y+Math.sin(a)*lump);
    }
    ctx.closePath();ctx.fillStyle=p.col;ctx.fill();ctx.strokeStyle=p.col+"88";ctx.lineWidth=1;ctx.stroke();
    // Hyphae (branching filaments)
    const hyph=6;
    for(let i=0;i<hyph;i++){
      const a=i/hyph*Math.PI*2+now/2200;
      const base=p.r*(1+0.2*Math.sin(i*2.1+now/1100));
      ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*base,p.y+Math.sin(a)*base);
      ctx.lineTo(p.x+Math.cos(a)*(base+7),p.y+Math.sin(a)*(base+7));
      ctx.strokeStyle=p.col+"88";ctx.lineWidth=1.5;ctx.stroke();
      ctx.beginPath();ctx.arc(p.x+Math.cos(a)*(base+7),p.y+Math.sin(a)*(base+7),2,0,Math.PI*2);
      ctx.fillStyle=p.col+"99";ctx.fill();
    }
  } else if(p.cat==="parasite"){
    // Segmented worm — draw trail segments first, then head
    if(p.trail&&p.trail.length>0){
      for(let i=p.trail.length-1;i>=0;i--){
        const seg=p.trail[i];
        const frac=1-(i/p.trail.length);
        const sr=p.r*(0.45+frac*0.55);
        const alpha=Math.floor(frac*160).toString(16).padStart(2,"0");
        const g2=ctx.createRadialGradient(seg.x,seg.y,0,seg.x,seg.y,sr*2);
        g2.addColorStop(0,p.col+alpha);g2.addColorStop(1,"transparent");
        ctx.fillStyle=g2;ctx.beginPath();ctx.arc(seg.x,seg.y,sr*2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(seg.x,seg.y,sr,0,Math.PI*2);ctx.fillStyle=p.col+alpha;ctx.fill();
        // Segment divider
        if(i>0){ctx.strokeStyle=p.col+"44";ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(seg.x,seg.y,sr,0,Math.PI*2);ctx.stroke();}
      }
    }
    // Head
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.fill();
    ctx.strokeStyle=p.col+"cc";ctx.lineWidth=1.5;ctx.stroke();
    // Eyes on head
    const eyeA=Math.atan2(CY-p.y,CX-p.x);
    const ex=p.x+Math.cos(eyeA)*p.r*0.35,ey=p.y+Math.sin(eyeA)*p.r*0.35;
    ctx.beginPath();ctx.arc(ex+Math.cos(eyeA+Math.PI/2)*p.r*0.25,ey+Math.sin(eyeA+Math.PI/2)*p.r*0.25,p.r*0.18,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
    ctx.beginPath();ctx.arc(ex+Math.cos(eyeA-Math.PI/2)*p.r*0.25,ey+Math.sin(eyeA-Math.PI/2)*p.r*0.25,p.r*0.18,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
  }

  // HP bar (for non-tumor, non-cancer)
  const phr=p.hp/p.maxHp;
  ctx.fillStyle="#1008";ctx.fillRect(p.x-p.r,p.y-p.r-6,p.r*2,3);
  ctx.fillStyle=p.col;ctx.fillRect(p.x-p.r,p.y-p.r-6,p.r*2*phr,3);
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ImmunoWar(){
  const [screen,     setScreen]    = useState("title");
  const [chr,        setChr]       = useState({gender:"female",age:"young",name:""});
  const [sel,        setSel]       = useState("neutrophil");
  const [sfxOn,      setSfxOn]     = useState(true);
  const [briefing,   setBriefing]  = useState(null);
  const [placeMsg,   setPlaceMsg]  = useState(null);
  const [lb,         setLb]        = useState([]);
  const [checkpoint, setCheckpoint]= useState(null);
  const [cpLeft,     setCpLeft]    = useState(2);
  const [adminMode,  setAdminMode] = useState(false);
  const [showLb,     setShowLb]    = useState(false);
  const [canvCss,    setCanvCss]   = useState({w:CW,h:CH});
  const [ui,setUi]=useState({hp:100,maxHp:100,energy:60,cells:0,lvl:0,wave:0,totalWaves:2,score:0,phase:"waveIdle",countdown:4,isBonus:false,levName:""});

  const [gameSpeed,    setGameSpeed]    = useState(1);
  const [selectedCell, setSelectedCell] = useState(null);
  const gameSpeedRef = useRef(1);
  const cvsRef=useRef(null),rafRef=useRef(null),gRef=useRef(null);
  const selRef=useRef("neutrophil"),scrRef=useRef("title");
  const mRef=useRef({x:-999,y:-999}),fRef=useRef(0);
  const adminKeysRef=useRef(""),retryRef=useRef(null);

  useEffect(()=>{gameSpeedRef.current=gameSpeed;},[gameSpeed]);

  useEffect(()=>{loadScores().then(setLb);},[]);
  useEffect(()=>{selRef.current=sel;},[sel]);

  // Responsive canvas sizing
  useEffect(()=>{
    const fit=()=>{
      const sw=216,hh=38;
      const aw=Math.max(280,window.innerWidth-sw-2);
      const ah=Math.max(180,window.innerHeight-hh);
      const scale=Math.min(aw/CW,ah/CH,1.5);
      setCanvCss({w:Math.floor(CW*scale),h:Math.floor(CH*scale)});
    };
    fit();window.addEventListener("resize",fit);return()=>window.removeEventListener("resize",fit);
  },[]);

  useEffect(()=>{
    const h=e=>{
      const map={n:"neutrophil",m:"macrophage",t:"tcell",b:"bcell"};
      if(map[e.key?.toLowerCase()])setSel(map[e.key.toLowerCase()]);
      adminKeysRef.current=(adminKeysRef.current+e.key).slice(-5);
      if(adminKeysRef.current==="admin"){setAdminMode(true);adminKeysRef.current="";}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[]);

  const getLev=(g,lvl)=>g.isBonus?BONUS_LEVELS[lvl]:g.compositions[lvl];

  const makeG=(mods,lvl,isBonus,compositions,energy,adminRun=false)=>{
    const lev=isBonus?BONUS_LEVELS[lvl]:compositions[lvl];
    return{cells:[],pathogens:[],projs:[],parts:[],bodyHp:mods.maxHp,maxHp:mods.maxHp,energy,eRegen:mods.eRegen,mods,lvl,wave:0,totalWaves:lev.waves,phase:"waveIdle",wideStart:null,spawnQ:[],score:0,countdown:4000,isBonus,compositions,adminRun};
  };

  const initGame=ch=>{
    const mods=getMods(ch);
    const comp=generateCompositions();
    gRef.current=makeG(mods,0,false,comp,mods.eStart);
    retryRef.current={ch,lvl:0,isBonus:false,comp,checkpoint:null,cpLeft:2};
    setCheckpoint(null);setCpLeft(2);
    setBriefing({lvl:0,isBonus:false});scrRef.current="briefing";setScreen("briefing");
  };

  const quickRetry=()=>{
    const r=retryRef.current;if(!r)return;
    const mods=getMods(r.ch);
    const prevScore=gRef.current?.score||0;
    gRef.current=makeG(mods,r.lvl,r.isBonus,r.comp,ECAP);
    gRef.current.score=prevScore; // carry score forward — already saved to LB on death
    setCheckpoint(r.checkpoint);setCpLeft(r.cpLeft);
    setSelectedCell(null);setGameSpeed(1);gameSpeedRef.current=1;
    scrRef.current="game";setScreen("game");
  };

  const respawnAtCheckpoint=()=>{
    const g=gRef.current,cp=checkpoint;
    const lev=getLev(g,cp.lvl);
    g.lvl=cp.lvl;g.wave=0;g.totalWaves=lev.waves;
    g.phase="waveIdle";g.wideStart=null;g.pathogens=[];g.projs=[];g.cells=[];
    g.bodyHp=Math.round(g.maxHp*0.65);g.energy=ECAP;g.isBonus=cp.isBonus;
    const newLeft=cpLeft-1;setCpLeft(newLeft);
    retryRef.current={...retryRef.current,lvl:cp.lvl,isBonus:cp.isBonus,checkpoint,cpLeft:newLeft};
    setBriefing({lvl:cp.lvl,isBonus:cp.isBonus});scrRef.current="briefing";setScreen("briefing");
  };

  const jumpToLevel=(lvl,isBonus)=>{
    const mods=getMods(chr);
    const comp=generateCompositions();
    gRef.current=makeG(mods,lvl,isBonus,comp,ECAP,true);
    setBriefing({lvl,isBonus});scrRef.current="briefing";setScreen("briefing");
  };

  const addParts=(g,x,y,col,n)=>{for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=40+Math.random()*100;g.parts.push({x,y,col,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.3+Math.random()*0.5,r:1+Math.random()*3});}};

  const spawnPath=(g,type,x,y,scale=1)=>{
    const pd=PATHS[type];
    g.pathogens.push({
      id:uid(),type,x,y,cat:pd.cat,
      hp:Math.round(pd.hp*scale),maxHp:Math.round(pd.hp*scale),
      spd:pd.spd*(1+(scale-1)*0.4),dmg:pd.dmg,rew:pd.rew,col:pd.col,r:pd.r,name:pd.name,
      splits:pd.splits||false,spawner:pd.spawner||false,spawnInt:pd.spawnInt||0,nextSpawn:0,
      wb:Math.random()*Math.PI*2,wbS:0.5+Math.random(),
      angle:0,trail:[],trailT:0,
    });
  };

  const update=(dt,now)=>{
    const g=gRef.current;if(!g||scrRef.current!=="game")return;
    g.energy=Math.min(ECAP,g.energy+g.eRegen*dt);
    const lev=getLev(g,g.lvl);

    if(g.phase==="waveIdle"){
      if(!g.wideStart)g.wideStart=now;
      g.countdown=Math.max(0,4000-(now-g.wideStart));
      if(now-g.wideStart>4000){g.wave++;g.phase="spawning";g.wideStart=null;g.spawnQ=buildQ(lev,g.wave,now);}
    }
    if(g.phase==="spawning"){
      while(g.spawnQ.length&&g.spawnQ[0].at<=now){const{type,scale}=g.spawnQ.shift();const{x,y}=edgePt();spawnPath(g,type,x,y,scale);}
      if(!g.spawnQ.length)g.phase="fighting";
    }
    if(g.phase==="fighting"&&!g.pathogens.length&&!g.projs.length){
      if(g.wave>=g.totalWaves){g.phase="levelDone";SFX.play("levelEnd");}
      else{g.phase="waveIdle";g.wideStart=null;SFX.play("waveEnd");}
    }

    for(const p of g.pathogens){
      const dx=CX-p.x,dy=CY-p.y,dist=Math.sqrt(dx*dx+dy*dy)||1;
      if(dist<CR+p.r){g.bodyHp=Math.max(0,g.bodyHp-p.dmg);p.hp=0;addParts(g,p.x,p.y,"#ff2222",8);SFX.play("coreHit");continue;}

      const nx=dx/dist,ny=dy/dist;
      p.wb+=p.wbS*dt;

      // ── Category-specific movement ──
      if(p.cat==="virus"){
        // Wobbly dart — light angular drift
        p.x+=(nx*p.spd+(-ny)*Math.sin(p.wb)*0.28)*60*dt;
        p.y+=(ny*p.spd+nx*Math.sin(p.wb)*0.28)*60*dt;
      } else if(p.cat==="bacteria"){
        // Steady sinusoidal weave — like a rod swimming
        const wave=Math.sin(p.wb*2.2)*0.55;
        p.x+=(nx*p.spd+(-ny)*wave)*60*dt;
        p.y+=(ny*p.spd+nx*wave)*60*dt;
        p.angle=Math.atan2(dy,dx);
      } else if(p.cat==="fungi"){
        // Slow ooze — very low wobble, irregular
        const ooze=Math.sin(p.wb*0.7)*0.18+Math.sin(p.wb*1.9)*0.08;
        p.x+=(nx*p.spd+(-ny)*ooze)*60*dt;
        p.y+=(ny*p.spd+nx*ooze)*60*dt;
      } else if(p.cat==="parasite"){
        // Aggressive S-curve zigzag
        const zig=Math.sin(p.wb*3.2)*0.85;
        p.x+=(nx*p.spd+(-ny)*zig)*60*dt;
        p.y+=(ny*p.spd+nx*zig)*60*dt;
        // Trail for segmented body
        p.trailT++;
        if(p.trailT%2===0){
          p.trail.unshift({x:p.x,y:p.y});
          if(p.trail.length>8)p.trail.pop();
        }
      } else {
        // cancer / default
        p.x+=(nx*p.spd+(-ny)*Math.sin(p.wb)*0.28)*60*dt;
        p.y+=(ny*p.spd+nx*Math.sin(p.wb)*0.28)*60*dt;
      }

      // Tumor spawner
      if(p.spawner&&p.hp>0){
        if(!p.nextSpawn)p.nextSpawn=now+p.spawnInt;
        if(now>=p.nextSpawn){p.nextSpawn=now+p.spawnInt;const a=Math.random()*Math.PI*2;spawnPath(g,"cancerCell",p.x+Math.cos(a)*(p.r+30),p.y+Math.sin(a)*(p.r+30),1);}
      }
    }

    // Cell-pathogen melee
    for(const p of g.pathogens)for(const c of g.cells)if(Math.hypot(p.x-c.x,p.y-c.y)<p.r+CELLS[c.type].r+2){c.hp-=p.dmg*dt*3;if(c.hp<=0)addParts(g,c.x,c.y,CELLS[c.type].col,18);}
    g.cells=g.cells.filter(c=>c.hp>0);g.pathogens=g.pathogens.filter(p=>p.hp>0);

    // Cell attack — targeting modes + category bonus
    for(const c of g.cells){
      if(c.cd>0){c.cd-=dt;continue;}
      const def=CELLS[c.type];
      const inRange=g.pathogens.filter(p=>Math.hypot(p.x-c.x,p.y-c.y)<=def.range);
      if(!inRange.length)continue;
      const mode=c.target||"first";
      let near=null;
      if(mode==="first")     near=inRange.reduce((a,b)=>(Math.hypot(b.x-CX,b.y-CY)<Math.hypot(a.x-CX,a.y-CY)?b:a));
      else if(mode==="last") near=inRange.reduce((a,b)=>(Math.hypot(b.x-CX,b.y-CY)>Math.hypot(a.x-CX,a.y-CY)?b:a));
      else if(mode==="strong")near=inRange.reduce((a,b)=>b.hp>a.hp?b:a);
      else                    near=inRange.reduce((a,b)=>Math.hypot(b.x-c.x,b.y-c.y)<Math.hypot(a.x-c.x,a.y-c.y)?b:a);
      c.cd=1/def.aps;
      const catMult=def.catBonus?.[near.cat]||1;
      const dmg=Math.round(def.dmg*(g.mods.cMult[c.type]||1)*g.mods.atkMult*catMult);
      g.projs.push({id:uid(),x:c.x,y:c.y,tx:near.x,ty:near.y,tid:near.id,dmg,spd:300,col:catMult>1?"#ffffff":def.col,splash:def.splash||false,splashR:def.splashR||0,splashMult:def.splashMult||0});
    }

    // Projectile movement + hit
    const died=[];
    for(const pj of g.projs){
      const tgt=g.pathogens.find(p=>p.id===pj.tid);
      if(tgt){pj.tx=tgt.x;pj.ty=tgt.y;}
      const dx=pj.tx-pj.x,dy=pj.ty-pj.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      if(d<10){
        if(tgt&&tgt.hp>0){
          tgt.hp-=pj.dmg;addParts(g,tgt.x,tgt.y,pj.col,3);
          if(tgt.hp<=0){g.energy=Math.min(ECAP,g.energy+tgt.rew);g.score+=tgt.rew*10;addParts(g,tgt.x,tgt.y,tgt.col,14);SFX.play("kill");if(tgt.splits)died.push({x:tgt.x,y:tgt.y});}
        }
        // Neutrophil splash AoE
        if(pj.splash&&pj.splashR>0){
          SFX.play("splash");
          addParts(g,pj.tx,pj.ty,"#80DEFF",6);
          for(const p2 of g.pathogens){
            if(p2.id===pj.tid)continue;
            if(Math.hypot(p2.x-pj.tx,p2.y-pj.ty)<pj.splashR){
              const sd=Math.round(pj.dmg*pj.splashMult);
              p2.hp-=sd;addParts(g,p2.x,p2.y,"#80DEFF",2);
              if(p2.hp<=0){g.energy=Math.min(ECAP,g.energy+p2.rew);g.score+=p2.rew*10;addParts(g,p2.x,p2.y,p2.col,10);SFX.play("kill");if(p2.splits)died.push({x:p2.x,y:p2.y});}
            }
          }
        }
        pj.dead=true;
      } else {const st=Math.min(pj.spd*dt,d);pj.x+=dx/d*st;pj.y+=dy/d*st;}
    }
    g.projs=g.projs.filter(p=>!p.dead);g.pathogens=g.pathogens.filter(p=>p.hp>0);
    for(const d of died){SFX.play("split");for(let i=0;i<2;i++){const a=Math.random()*Math.PI*2;spawnPath(g,"microCancer",d.x+Math.cos(a)*22,d.y+Math.sin(a)*22,1);}}

    for(const p of g.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;}
    g.parts=g.parts.filter(p=>p.life>0);
    if(g.bodyHp<=0){g.phase="gameOver";SFX.play("gameOver");}
  };

  const draw=(ctx,now,selId)=>{
    const g=gRef.current;if(!g)return;
    // DPR scale already set on canvas.width/height — just draw in logical coords
    ctx.fillStyle=g.isBonus?"#120005":"#030f1d";ctx.fillRect(0,0,CW,CH);
    ctx.strokeStyle=g.isBonus?"rgba(180,0,50,0.05)":"rgba(0,130,190,0.05)";ctx.lineWidth=0.5;
    for(let r=-1;r<CH/26+2;r++)for(let c=-1;c<CW/38+2;c++){
      const hx=c*38,hy=r*26+(c%2?13:0);ctx.beginPath();
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/6;i===0?ctx.moveTo(hx+Math.cos(a)*15,hy+Math.sin(a)*15):ctx.lineTo(hx+Math.cos(a)*15,hy+Math.sin(a)*15);}
      ctx.closePath();ctx.stroke();
    }

    // Hover range preview — bright dotted circle
    const mx=mRef.current.x,my=mRef.current.y,sd=CELLS[selRef.current];
    if(mx>0&&mx<CW&&my>0&&my<CH){
      ctx.beginPath();ctx.arc(mx,my,sd.r,0,Math.PI*2);ctx.fillStyle=sd.col+"40";ctx.fill();
      ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.arc(mx,my,sd.range,0,Math.PI*2);
      ctx.strokeStyle=sd.col+"cc";ctx.lineWidth=1.5;ctx.stroke();
      ctx.setLineDash([]);
    }

    // Core
    const pulse=(Math.sin(now/700)+1)/2;
    const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,CR*4);
    cg.addColorStop(0,`rgba(0,180,255,${0.22+pulse*0.08})`);cg.addColorStop(0.6,"rgba(0,80,180,0.06)");cg.addColorStop(1,"transparent");
    ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,CR*4,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(CX,CY,CR,0,Math.PI*2);ctx.fillStyle=`rgba(0,140,230,${0.65+pulse*0.15})`;ctx.fill();
    ctx.strokeStyle=`rgba(0,210,255,${0.8+pulse*0.2})`;ctx.lineWidth=2.5;ctx.stroke();
    ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
    const hr=g.bodyHp/g.maxHp;ctx.fillStyle=hr>0.5?"#fff":hr>0.25?"#FFD54F":"#EF5350";
    ctx.fillText(`${Math.ceil(g.bodyHp)}`,CX,CY);

    // Cells
    for(const c of g.cells){
      const def=CELLS[c.type];
      ctx.beginPath();ctx.arc(c.x,c.y,def.range,0,Math.PI*2);ctx.strokeStyle=def.col+"18";ctx.lineWidth=1;ctx.stroke();
      const g2=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,def.r*2.2);g2.addColorStop(0,def.col+"40");g2.addColorStop(1,"transparent");
      ctx.fillStyle=g2;ctx.beginPath();ctx.arc(c.x,c.y,def.r*2.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(c.x,c.y,def.r,0,Math.PI*2);ctx.fillStyle=def.col;ctx.fill();
      ctx.strokeStyle="#ffffffcc";ctx.lineWidth=1.5;ctx.stroke();
      // Neutrophil: splash ring indicator
      if(def.splash){ctx.setLineDash([2,3]);ctx.beginPath();ctx.arc(c.x,c.y,def.splashR,0,Math.PI*2);ctx.strokeStyle=def.col+"44";ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);}
      const hp2=c.hp/c.maxHp;
      ctx.fillStyle="#0008";ctx.fillRect(c.x-def.r,c.y+def.r+2,def.r*2,3);
      ctx.fillStyle=hp2>0.5?"#66BB6A":hp2>0.25?"#FFD54F":"#EF5350";ctx.fillRect(c.x-def.r,c.y+def.r+2,def.r*2*hp2,3);
      // Targeting mode label
      const tm=c.target||"close";
      ctx.font="6px monospace";ctx.textAlign="center";ctx.textBaseline="top";
      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.fillText(tm.toUpperCase(),c.x,c.y+def.r+7);
      // Selection ring
      if(c.id===selId){
        const sp=(Math.sin(now/200)+1)/2;
        ctx.beginPath();ctx.arc(c.x,c.y,def.r+5+sp*2,0,Math.PI*2);
        ctx.strokeStyle=`rgba(255,255,255,${0.7+sp*0.3})`;ctx.lineWidth=2;ctx.stroke();
      }
    }

    // Pathogens
    for(const p of g.pathogens)drawEnemy(ctx,p,now);

    // Projectiles
    for(const pj of g.projs){
      const pg2=ctx.createRadialGradient(pj.x,pj.y,0,pj.x,pj.y,7);pg2.addColorStop(0,pj.col+"cc");pg2.addColorStop(1,"transparent");
      ctx.fillStyle=pg2;ctx.beginPath();ctx.arc(pj.x,pj.y,7,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(pj.x,pj.y,3,0,Math.PI*2);ctx.fillStyle=pj.col;ctx.fill();
    }

    // Particles
    for(const p of g.parts){const a=Math.max(0,p.life/0.7);ctx.beginPath();ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);ctx.fillStyle=p.col+Math.floor(a*200).toString(16).padStart(2,"0");ctx.fill();}
  };

  // ─── GAME LOOP ──────────────────────────────────────────────────────────────
  const selCellRef=useRef(null);
  useEffect(()=>{selCellRef.current=selectedCell;},[selectedCell]);

  useEffect(()=>{
    if(screen!=="game")return;
    const canvas=cvsRef.current;if(!canvas)return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=CW*dpr;canvas.height=CH*dpr;
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    let last=performance.now();
    const loop=now=>{
      const rawDt=Math.min((now-last)/1000,0.05);
      const dt=rawDt*gameSpeedRef.current;
      last=now;
      update(dt,now);draw(ctx,now,selCellRef.current);
      const g=gRef.current;
      if(g){
        fRef.current++;
        if(fRef.current%4===0){
          const ld=getLev(g,g.lvl);
          setUi({hp:Math.ceil(g.bodyHp),maxHp:g.maxHp,energy:Math.floor(g.energy),cells:g.cells.length,lvl:g.lvl,wave:g.wave,totalWaves:g.totalWaves,score:g.score,phase:g.phase,countdown:Math.ceil(g.countdown/1000),isBonus:g.isBonus,levName:ld?.name||""});
        }
        if(g.phase==="gameOver"){
          if(!g.adminRun){saveScore({name:chr.name||"Anonymous",score:g.score,lvl:g.lvl+1,isBonus:g.isBonus,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()}).then(setLb);}
          setScreen("gameOver");scrRef.current="gameOver";return;
        }
        if(g.phase==="levelDone"){
          g.energy=Math.min(ECAP,g.energy+getLev(g,g.lvl).bonus);
          const next=g.lvl+1;
          if(!g.isBonus&&next>=LEVEL_TEMPLATES.length){if(!g.adminRun)saveScore({name:chr.name||"Anonymous",score:g.score,lvl:10,completed:true,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()}).then(setLb);setScreen("bonusUnlock");scrRef.current="bonusUnlock";return;}
          if(g.isBonus&&next>=BONUS_LEVELS.length){SFX.play("victory");if(!g.adminRun)saveScore({name:chr.name||"Anonymous",score:g.score,lvl:10,bonusCompleted:true,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()}).then(setLb);setScreen("bonusVictory");scrRef.current="bonusVictory";return;}
          const ld=getLev(g,next);
          g.lvl=next;g.wave=0;g.totalWaves=ld.waves;g.phase="waveIdle";g.wideStart=null;g.pathogens=[];g.projs=[];
          retryRef.current={...retryRef.current,lvl:next,isBonus:g.isBonus};
          setBriefing({lvl:next,isBonus:g.isBonus});scrRef.current="briefing";setScreen("briefing");return;
        }
      }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[screen]);

  const startPlay=()=>{scrRef.current="game";setScreen("game");};
  const showMsg=(text,color="#EF9A9A")=>{setPlaceMsg({text,color});setTimeout(()=>setPlaceMsg(null),1400);};

  const TARGET_MODES=["close","first","last","strong"];
  const TARGET_LABELS={close:"CLOSE",first:"FIRST",last:"LAST",strong:"STRONG"};

  const sellCell=()=>{
    const g=gRef.current;if(!g||!selectedCell)return;
    const idx=g.cells.findIndex(c=>c.id===selectedCell);if(idx<0)return;
    const c=g.cells[idx];
    const refund=Math.round(CELLS[c.type].cost*0.6);
    g.energy=Math.min(ECAP,g.energy+refund);
    g.cells.splice(idx,1);
    addParts(g,c.x,c.y,CELLS[c.type].col,12);
    setSelectedCell(null);
  };

  const cycleTarget=()=>{
    const g=gRef.current;if(!g||!selectedCell)return;
    const c=g.cells.find(c=>c.id===selectedCell);if(!c)return;
    const cur=c.target||"close";
    const next=TARGET_MODES[(TARGET_MODES.indexOf(cur)+1)%TARGET_MODES.length];
    c.target=next;
    setSelectedCell(selectedCell); // force re-render
  };

  const handleClick=e=>{
    const g=gRef.current;if(!g||scrRef.current!=="game")return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(CW/rect.width),y=(e.clientY-rect.top)*(CH/rect.height);

    // Check if clicking on an existing cell first
    for(const c of g.cells){
      const def=CELLS[c.type];
      if(Math.hypot(x-c.x,y-c.y)<def.r+4){
        setSelectedCell(prev=>prev===c.id?null:c.id);
        return;
      }
    }

    // Deselect if clicking empty space while something selected
    if(selectedCell){setSelectedCell(null);return;}

    const type=selRef.current,def=CELLS[type];
    if(g.cells.length>=MAX_C){showMsg("No cell slots left");return;}
    if(g.energy<def.cost){showMsg(`Need ${def.cost}E (have ${Math.floor(g.energy)}E)`);return;}
    if(Math.hypot(x-CX,y-CY)<CR+def.r+8){showMsg("Too close to the core");return;}
    for(const c of g.cells)if(Math.hypot(x-c.x,y-c.y)<def.r+CELLS[c.type].r){showMsg("Too close to another cell");return;}
    g.energy-=def.cost;
    const newCell={id:uid(),type,x,y,hp:def.maxHp,maxHp:def.maxHp,cd:0,target:"close"};
    g.cells.push(newCell);SFX.play("place");
  };
  const handleMM=e=>{const rect=e.currentTarget.getBoundingClientRect();mRef.current={x:(e.clientX-rect.left)*(CW/rect.width),y:(e.clientY-rect.top)*(CH/rect.height)};};
  const toggleSfx=()=>{SFX.muted=!SFX.muted;setSfxOn(v=>!v);};
  const startBonus=()=>{
    const g=gRef.current;
    g.isBonus=true;g.lvl=0;g.wave=0;g.totalWaves=BONUS_LEVELS[0].waves;
    g.phase="waveIdle";g.wideStart=null;g.pathogens=[];g.projs=[];g.energy=Math.min(ECAP,g.energy+60);
    SFX.play("bonusStart");setBriefing({lvl:0,isBonus:true});scrRef.current="briefing";setScreen("briefing");
  };

  const BS=(grad,extra={})=>({padding:"12px 40px",fontSize:13,fontWeight:700,letterSpacing:3,background:grad,border:"none",borderRadius:4,color:"#fff",cursor:"pointer",fontFamily:"monospace",...extra});
  const ghostBtn=(onClick,label)=><button onClick={onClick} style={{padding:"10px 28px",fontSize:11,fontWeight:700,letterSpacing:2,background:"transparent",border:"1px solid rgba(255,255,255,0.22)",borderRadius:4,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"monospace"}}>{label}</button>;

  // ─── SCREENS ─────────────────────────────────────────────────────────────────

  if(screen==="title")return(
    <div style={{minHeight:"100vh",background:"#030c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#fff",position:"relative",overflow:"hidden",padding:24}}>
      <FloatingBg/>
      <div style={{zIndex:1,textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:8,color:"#80DEEA",marginBottom:14}}>DEFEND THE HUMAN BODY</div>
        <div style={{fontSize:60,fontWeight:900,letterSpacing:4,lineHeight:1,background:"linear-gradient(135deg,#00E5FF,#7B1FA2,#EF5350)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>IMMUNOWAR</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:10,marginBottom:14,letterSpacing:3}}>10 LEVELS + BONUS CANCER ROUND — ROTATING CAST</div>
        <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:36,flexWrap:"wrap"}}>
          {Object.entries(CAT_META).filter(([k])=>k!=="cancer").map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:9,color:v.col,letterSpacing:2}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:v.col}}/>
              {v.label}
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <button onClick={()=>setScreen("character")} style={BS("linear-gradient(135deg,#00B0D8,#7B1FA2)")}>DEPLOY IMMUNE SYSTEM</button>
          <button onClick={()=>setShowLb(v=>!v)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,color:"rgba(255,255,255,0.5)",fontSize:10,letterSpacing:3,padding:"8px 28px",cursor:"pointer",fontFamily:"monospace"}}>
            {showLb?"HIDE LEADERBOARD":"LEADERBOARD"}
          </button>
        </div>
        {showLb&&(
          <div style={{marginTop:16,maxWidth:480,width:"100%"}}>
            <Leaderboard scores={lb} currentScore={null} currentName={null}/>
          </div>
        )}
        {adminMode&&(
          <div style={{marginTop:24,padding:"16px 20px",background:"rgba(255,100,0,0.08)",border:"1px solid rgba(255,100,0,0.3)",borderRadius:8,maxWidth:480}}>
            <div style={{fontSize:9,letterSpacing:4,color:"#FF9800",marginBottom:10}}>ADMIN — LEVEL SELECT</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",marginBottom:6,letterSpacing:2}}>MAIN LEVELS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",marginBottom:10}}>
              {LEVEL_TEMPLATES.map((_,i)=><button key={i} onClick={()=>jumpToLevel(i,false)} style={{padding:"4px 9px",fontSize:9,fontWeight:"bold",background:"rgba(0,150,200,0.15)",border:"1px solid rgba(0,150,200,0.3)",borderRadius:3,color:"#80DEEA",cursor:"pointer",fontFamily:"monospace"}}>L{i+1}</button>)}
            </div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",marginBottom:6,letterSpacing:2}}>CANCER STAGES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",marginBottom:10}}>
              {BONUS_LEVELS.map((_,i)=><button key={i} onClick={()=>jumpToLevel(i,true)} style={{padding:"4px 9px",fontSize:9,fontWeight:"bold",background:"rgba(139,0,0,0.2)",border:"1px solid rgba(200,0,50,0.35)",borderRadius:3,color:"#FF6B6B",cursor:"pointer",fontFamily:"monospace"}}>C{i+1}</button>)}
            </div>
            <button onClick={()=>setAdminMode(false)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontFamily:"monospace",fontSize:9}}>CLOSE</button>
          </div>
        )}
      </div>
    </div>
  );

  if(screen==="character"){
    const mods=getMods(chr);
    return(
      <div style={{minHeight:"100vh",background:"#030c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#80DEEA",marginBottom:8}}>MISSION CONFIGURATION</div>
        <h2 style={{fontSize:26,margin:"0 0 22px",letterSpacing:3,color:"#fff"}}>CHOOSE YOUR HOST</h2>

        {/* Player name */}
        <div style={{marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.55)",marginBottom:8}}>YOUR NAME</div>
          <input value={chr.name} onChange={e=>setChr(c=>({...c,name:e.target.value}))} placeholder="Enter name for leaderboard" maxLength={20}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:5,color:"#e8f4f8",fontFamily:"monospace",fontSize:12,padding:"8px 16px",textAlign:"center",outline:"none",width:220}}/>
        </div>

        <div style={{marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.55)",marginBottom:10}}>BIOLOGICAL SEX</div>
          <div style={{display:"flex",gap:14}}>
            {[["female","FEMALE","+15% B-Cell damage"],["male","MALE","+15% T-Cell damage"]].map(([v,l,t])=>(
              <button key={v} onClick={()=>setChr(c=>({...c,gender:v}))} style={{padding:"10px 22px",border:`2px solid ${chr.gender===v?"#00E5FF":"rgba(255,255,255,0.18)"}`,background:chr.gender===v?"rgba(0,229,255,0.1)":"transparent",borderRadius:6,color:"#e8f4f8",cursor:"pointer",fontFamily:"monospace"}}>
                <div style={{fontSize:13,fontWeight:"bold",marginBottom:3}}>{l}</div>
                <div style={{fontSize:9,color:"#80DEEA"}}>{t}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:22,textAlign:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.55)",marginBottom:10}}>AGE GROUP</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
            {[["child","CHILD","High energy regen\nLow HP (80)"],["young","YOUNG ADULT","Balanced\nRecommended"],["adult","ADULT","High HP (120)\nSlower regen"],["senior","SENIOR","Low HP (75)\nImmune memory"]].map(([v,l,t])=>(
              <button key={v} onClick={()=>setChr(c=>({...c,age:v}))} style={{padding:"8px 12px",border:`2px solid ${chr.age===v?"#AB47BC":"rgba(255,255,255,0.18)"}`,background:chr.age===v?"rgba(171,71,188,0.1)":"transparent",borderRadius:6,color:"#e8f4f8",cursor:"pointer",fontFamily:"monospace",minWidth:110}}>
                <div style={{fontSize:11,fontWeight:"bold",marginBottom:3}}>{l}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",whiteSpace:"pre-line"}}>{t}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:20,marginBottom:24,padding:"12px 22px",background:"rgba(255,255,255,0.05)",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",fontSize:10}}>
          {[["MAX HP",mods.maxHp,"#EF9A9A"],["START ENERGY",mods.eStart,"#FFE082"],["REGEN/s",mods.eRegen.toFixed(1),"#A5D6A7"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.6)",marginBottom:3}}>{l}</div><div style={{fontSize:20,fontWeight:"bold",color:c}}>{v}</div></div>
          ))}
          {mods.atkMult!==1&&<div style={{textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.6)",marginBottom:3}}>ATK POWER</div><div style={{fontSize:20,fontWeight:"bold",color:"#FFCC80"}}>{Math.round(mods.atkMult*100)}%</div></div>}
        </div>
        <button onClick={()=>initGame(chr)} style={BS("linear-gradient(135deg,#00B0D8,#7B1FA2)")}>BEGIN MISSION</button>
        <button onClick={()=>setScreen("title")} style={{marginTop:10,background:"transparent",border:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontFamily:"monospace",fontSize:10}}>BACK</button>
      </div>
    );
  }

  if(screen==="briefing"&&briefing!==null){
    const g=gRef.current;
    const levData=g?getLev(g,briefing.lvl):(briefing.isBonus?BONUS_LEVELS[briefing.lvl]:null);
    if(!levData)return null;
    const enemies=getBriefingEnemies(levData);
    const acCol=briefing.isBonus?"#FF6B6B":"#80DEEA";
    return(
      <div style={{minHeight:"100vh",background:briefing.isBonus?"#0d0004":"#020c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:"20px 16px"}}>
        <div style={{fontSize:9,letterSpacing:6,color:acCol,marginBottom:5}}>{briefing.isBonus?"CANCER STAGE BRIEFING":"INCOMING THREAT REPORT"}</div>
        <h2 style={{fontSize:26,margin:"0 0 3px",letterSpacing:3,color:"#fff"}}>{briefing.isBonus?`Cancer Stage ${briefing.lvl+1}`:`Level ${briefing.lvl+1}`}: {levData.name}</h2>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",marginBottom:18}}>{levData.waves} waves incoming</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:560,width:"100%",marginBottom:16}}>
          {enemies.map(e=>{
            const cm=CAT_META[e.cat]||CAT_META.virus;
            return(
              <div key={e.type} style={{display:"flex",gap:13,padding:"12px 15px",background:"rgba(255,255,255,0.04)",borderRadius:8,border:`1px solid ${e.col}35`,alignItems:"flex-start"}}>
                <div style={{flexShrink:0,width:42,height:42,borderRadius:"50%",background:e.col+"22",border:`2px solid ${e.col}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>{e.icon||"🦠"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:"bold",color:e.col}}>{e.name}</span>
                    <span style={{fontSize:7,letterSpacing:2,color:cm.col,background:cm.bg,padding:"2px 6px",borderRadius:3}}>{cm.label}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.78)",lineHeight:1.6}}>{e.fact}</div>
                  <div style={{display:"flex",gap:12,marginTop:5,fontSize:9,color:"rgba(255,255,255,0.5)"}}>
                    <span>HP: {e.hp}</span><span>SPD: {e.spd.toFixed(2)}</span><span>DMG: {e.dmg}</span>
                    <span style={{color:cm.col}}>Movement: {e.cat==="virus"?"dart/wobble":e.cat==="bacteria"?"sinusoidal":e.cat==="fungi"?"slow ooze":e.cat==="parasite"?"zigzag":"direct"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {levData.tip&&(
          <div style={{maxWidth:560,width:"100%",padding:"10px 15px",background:"rgba(255,220,100,0.06)",border:"1px solid rgba(255,220,100,0.2)",borderRadius:6,marginBottom:16,fontSize:11,color:"rgba(255,235,180,0.9)",lineHeight:1.6}}>
            <span style={{color:"#FFE082",fontWeight:"bold"}}>STRATEGY: </span>{levData.tip}
          </div>
        )}
        <button onClick={startPlay} style={BS(briefing.isBonus?"linear-gradient(135deg,#8B0000,#3D0040)":"linear-gradient(135deg,#00B0D8,#7B1FA2)")}>
          {briefing.lvl===0&&!briefing.isBonus?"DEPLOY NOW":"START"}
        </button>
        {briefing.lvl>0&&cpLeft>0&&(
          <div style={{marginTop:12,textAlign:"center"}}>
            {checkpoint?.lvl===briefing.lvl&&checkpoint?.isBonus===briefing.isBonus
              ?<div style={{fontSize:10,color:"#FFE082",fontFamily:"monospace",letterSpacing:2}}>CHECKPOINT SET HERE ({cpLeft} {cpLeft===1?"retry":"retries"} remaining)</div>
              :<button onClick={()=>setCheckpoint({lvl:briefing.lvl,isBonus:briefing.isBonus})} style={{background:"transparent",border:"1px dashed rgba(255,220,100,0.4)",borderRadius:4,color:"rgba(255,220,100,0.7)",fontSize:10,letterSpacing:2,padding:"6px 16px",cursor:"pointer",fontFamily:"monospace"}}>
                {checkpoint?`MOVE CHECKPOINT HERE (currently L${checkpoint.lvl})`:"SET CHECKPOINT HERE (2 retries)"}
              </button>
            }
          </div>
        )}
      </div>
    );
  }

  if(screen==="game"){
    const g=gRef.current;
    const hpP=ui.hp/ui.maxHp,eP=ui.energy/ECAP,cellsLeft=MAX_C-ui.cells;
    const pMsg=ui.phase==="waveIdle"?`NEXT WAVE IN ${ui.countdown}s`:ui.phase==="spawning"?"INCOMING":"FIGHTING";
    const pCol=ui.phase==="waveIdle"?"#FFE082":ui.phase==="fighting"?"#EF9A9A":"#A5D6A7";
    return(
      <div style={{background:ui.isBonus?"#120005":"#020b16",height:"100vh",display:"flex",flexDirection:"column",fontFamily:"monospace",color:"#e8f4f8",overflow:"hidden"}}>
        <div style={{padding:"5px 12px",background:"rgba(0,0,0,0.55)",borderBottom:`1px solid ${ui.isBonus?"rgba(200,0,50,0.2)":"rgba(0,200,255,0.08)"}`,display:"flex",gap:14,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
          {ui.isBonus?<span style={{fontSize:10,color:"#FF6B6B",letterSpacing:2,fontWeight:"bold"}}>CANCER {ui.lvl+1} — {ui.levName}</span>:<span style={{fontSize:10,color:"#80DEEA",letterSpacing:2}}>LVL {ui.lvl+1}/10 — {ui.levName}</span>}
          <span style={{fontSize:10,color:"rgba(255,255,255,0.65)"}}>WAVE {ui.wave}/{ui.totalWaves}</span>
          <span style={{fontSize:10,color:pCol}}>{pMsg}</span>
          {checkpoint&&cpLeft>0&&<span style={{fontSize:9,color:"rgba(255,220,100,0.55)",border:"1px solid rgba(255,220,100,0.2)",borderRadius:3,padding:"1px 6px"}}>CP L{checkpoint.lvl+1} ×{cpLeft}</span>}
          <span style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>SCORE <span style={{color:"#fff",fontWeight:"bold"}}>{ui.score.toLocaleString()}</span></span>
            {g?.adminRun&&<span style={{fontSize:8,color:"#FF9800",letterSpacing:1}}>ADMIN</span>}
            <button onClick={()=>{const s=gameSpeed===1?2:1;setGameSpeed(s);gameSpeedRef.current=s;}} style={{background:gameSpeed===2?"rgba(255,220,100,0.15)":"transparent",border:`1px solid ${gameSpeed===2?"rgba(255,220,100,0.5)":"rgba(255,255,255,0.2)"}`,borderRadius:3,color:gameSpeed===2?"#FFE082":"rgba(255,255,255,0.5)",fontSize:9,letterSpacing:2,padding:"2px 8px",cursor:"pointer",fontFamily:"monospace",fontWeight:"bold"}}>{gameSpeed===2?"2× SPEED":"1× SPEED"}</button>
            <button onClick={toggleSfx} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:3,color:sfxOn?"#80DEEA":"rgba(255,255,255,0.4)",fontSize:8,letterSpacing:2,padding:"2px 6px",cursor:"pointer",fontFamily:"monospace"}}>{sfxOn?"SFX ON":"SFX OFF"}</button>
          </span>
        </div>
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",background:ui.isBonus?"#120005":"#030f1d"}}>
            <canvas ref={cvsRef}
              style={{display:"block",width:canvCss.w,height:canvCss.h,cursor:"crosshair"}}
              onClick={handleClick} onMouseMove={handleMM} onMouseLeave={()=>{mRef.current={x:-999,y:-999};setSelectedCell(null);}}/>
            {placeMsg&&<div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.82)",border:`1px solid ${placeMsg.color}55`,borderRadius:5,padding:"5px 16px",fontSize:11,color:placeMsg.color,fontFamily:"monospace",pointerEvents:"none",whiteSpace:"nowrap"}}>{placeMsg.text}</div>}
          </div>
          <div style={{width:216,background:"rgba(0,0,0,0.58)",borderLeft:`1px solid ${ui.isBonus?"rgba(200,0,50,0.1)":"rgba(0,200,255,0.07)"}`,padding:12,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",flexShrink:0}}>
            <div>
              <div style={{fontSize:7,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:3}}>BODY HEALTH</div>
              <div style={{background:"rgba(255,255,255,0.1)",borderRadius:3,height:8}}>
                <div style={{width:`${hpP*100}%`,height:"100%",borderRadius:3,transition:"width 0.2s",background:hpP>0.5?"#81C784":hpP>0.25?"#FFD54F":"#EF5350"}}/>
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:1}}>{ui.hp}/{ui.maxHp}</div>
            </div>
            <div>
              <div style={{fontSize:7,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:3}}>ENERGY</div>
              <div style={{background:"rgba(255,255,255,0.1)",borderRadius:3,height:8}}>
                <div style={{width:`${eP*100}%`,height:"100%",borderRadius:3,background:"#FFD54F",transition:"width 0.1s"}}/>
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:1}}>{ui.energy}/{ECAP}</div>
            </div>

            {/* Selected cell action panel */}
            {selectedCell&&(()=>{
              const sc=gRef.current?.cells.find(c=>c.id===selectedCell);
              if(!sc)return null;
              const def=CELLS[sc.type];
              const refund=Math.round(def.cost*0.6);
              const mode=sc.target||"close";
              const bonus=def.catBonus?Object.entries(def.catBonus).map(([k,v])=>`+${Math.round((v-1)*100)}% vs ${k}`).join(", "):null;
              return(
                <div style={{padding:"9px 10px",background:"rgba(255,255,255,0.06)",borderRadius:7,border:`2px solid ${def.col}55`}}>
                  <div style={{fontSize:10,fontWeight:"bold",color:def.col,marginBottom:5}}>{def.name} SELECTED</div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,0.55)",marginBottom:6}}>{bonus||"No category bonus"}</div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",marginBottom:8}}>
                    HP: {Math.ceil(sc.hp)}/{sc.maxHp}
                  </div>
                  <div style={{fontSize:7,color:"rgba(255,255,255,0.4)",marginBottom:4,letterSpacing:2}}>TARGETING</div>
                  <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                    {TARGET_MODES.map(m=>(
                      <button key={m} onClick={()=>{if(sc){sc.target=m;setSelectedCell(selectedCell);}}} style={{padding:"3px 7px",fontSize:8,background:mode===m?def.col+"33":"transparent",border:`1px solid ${mode===m?def.col:"rgba(255,255,255,0.15)"}`,borderRadius:3,color:mode===m?def.col:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"monospace"}}>{TARGET_LABELS[m]}</button>
                    ))}
                  </div>
                  <button onClick={sellCell} style={{width:"100%",padding:"5px",fontSize:9,fontWeight:"bold",background:"rgba(239,83,80,0.15)",border:"1px solid rgba(239,83,80,0.35)",borderRadius:4,color:"#EF9A9A",cursor:"pointer",fontFamily:"monospace"}}>SELL (+{refund}E)</button>
                  <button onClick={()=>setSelectedCell(null)} style={{width:"100%",marginTop:4,padding:"4px",fontSize:8,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"rgba(255,255,255,0.35)",cursor:"pointer",fontFamily:"monospace"}}>DESELECT</button>
                </div>
              );
            })()}

            {/* Cell slots */}
            <div style={{padding:"8px 10px",background:"rgba(255,255,255,0.05)",borderRadius:6,border:"1px solid rgba(255,255,255,0.12)"}}>
              <div style={{fontSize:7,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:5}}>CELL SLOTS</div>
              <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:6}}>
                <span style={{fontSize:24,fontWeight:"bold",color:cellsLeft===0?"#EF5350":cellsLeft<=3?"#FFD54F":"#80DEEA",lineHeight:1}}>{cellsLeft}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.55)"}}>of {MAX_C} left</span>
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {Array.from({length:MAX_C}).map((_,i)=><div key={i} style={{width:8,height:8,borderRadius:2,background:i<ui.cells?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.55)",border:"1px solid rgba(255,255,255,0.18)"}}/>)}
              </div>
            </div>

            {/* Cell selector */}
            <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:9}}>
              <div style={{fontSize:7,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:7}}>DEPLOY CELL</div>
              {Object.entries(CELLS).map(([type,def])=>{
                const canA=ui.energy>=def.cost,isSel=sel===type;
                return(
                  <button key={type} onClick={()=>setSel(type)} style={{width:"100%",marginBottom:6,padding:"6px 8px",textAlign:"left",border:`2px solid ${isSel?def.col:"rgba(255,255,255,0.12)"}`,background:isSel?`${def.col}18`:"rgba(255,255,255,0.02)",borderRadius:5,color:canA?"#e8f4f8":"rgba(255,255,255,0.38)",cursor:"pointer",fontFamily:"monospace"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                      <span style={{fontSize:10,fontWeight:"bold",color:def.col}}>{def.name}</span>
                      <span style={{fontSize:9,color:canA?"#FFE082":"rgba(255,255,255,0.3)"}}>{def.cost}E</span>
                    </div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.6)",marginBottom:1}}>{def.desc}</div>
                    <div style={{fontSize:7,color:"rgba(255,255,255,0.38)"}}>HP:{def.maxHp} DMG:{def.dmg} RNG:{def.range}</div>
                  </button>
                );
              })}
            </div>

            {/* Enemy type legend */}
            <div style={{padding:"7px 9px",background:"rgba(255,255,255,0.03)",borderRadius:5,border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(255,255,255,0.4)",marginBottom:5}}>ENEMY TYPES</div>
              {Object.entries(CAT_META).filter(([k])=>k!=="cancer").map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:v.col,flexShrink:0}}/>
                  <span style={{fontSize:8,color:v.col}}>{v.label}</span>
                  <span style={{fontSize:7,color:"rgba(255,255,255,0.3)",marginLeft:"auto"}}>{k==="virus"?"wobble":k==="bacteria"?"weave":k==="fungi"?"ooze":"zigzag"}</span>
                </div>
              ))}
            </div>
            {ui.isBonus&&<div style={{padding:"7px 9px",background:"rgba(139,0,0,0.2)",borderRadius:5,border:"1px solid rgba(200,0,50,0.25)",fontSize:8,color:"rgba(255,170,170,0.85)",lineHeight:1.6}}>Cancer cells split on death. Tumors spawn reinforcements.</div>}
            <div style={{marginTop:"auto",fontSize:7,color:"rgba(255,255,255,0.35)",lineHeight:1.8}}>Click arena to place.<br/>Keys: N M T B</div>
          </div>
        </div>
      </div>
    );
  }

  if(screen==="bonusUnlock")return(
    <div style={{minHeight:"100vh",background:"#0d0005",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
      <div style={{fontSize:10,letterSpacing:6,color:"#A5D6A7",marginBottom:12}}>10 LEVELS CLEARED</div>
      <h2 style={{fontSize:42,margin:"0 0 6px",color:"#81C784",letterSpacing:3}}>IMMUNITY ACHIEVED</h2>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:36}}>Viruses, bacteria, fungi, parasites: defeated.</div>
      <div style={{padding:"18px 28px",background:"rgba(139,0,0,0.15)",borderRadius:8,border:"1px solid rgba(200,0,50,0.3)",marginBottom:32,textAlign:"center",maxWidth:400}}>
        <div style={{fontSize:11,letterSpacing:4,color:"#FF6B6B",marginBottom:10}}>NEW THREAT DETECTED</div>
        <div style={{fontSize:20,fontWeight:"bold",color:"#fff",marginBottom:8}}>CANCER CELLS</div>
        <div style={{fontSize:11,color:"rgba(255,210,210,0.8)",lineHeight:1.7}}>5 bonus stages of mutated cancer cells.<br/>They split on death. Tumors spawn reinforcements.<br/>+60 energy granted.</div>
      </div>
      <div style={{display:"flex",gap:12}}>
        <button onClick={startBonus} style={BS("linear-gradient(135deg,#8B0000,#3D0040)")}>ACCEPT CHALLENGE</button>
        {ghostBtn(()=>{SFX.play("victory");setScreen("victory");scrRef.current="victory";},"CLAIM VICTORY")}
      </div>
    </div>
  );

  if(screen==="gameOver"){
    const g=gRef.current;
    const canRespawn=checkpoint&&cpLeft>0;
    return(
      <div style={{minHeight:"100vh",background:"#130208",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:20}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#EF9A9A",marginBottom:6}}>IMMUNE SYSTEM OVERWHELMED</div>
        <h2 style={{fontSize:48,margin:"0 0 6px",color:"#EF5350",letterSpacing:3}}>INFECTED</h2>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:3}}>{g?.isBonus?`Cancer Stage ${(g?.lvl??0)+1}`:`Level ${(g?.lvl??0)+1}`} — Wave {g?.wave??0}</div>
        <div style={{fontSize:18,color:"#FFE082",marginBottom:canRespawn?12:18}}>
          Score: {(g?.score??0).toLocaleString()}
          {g?.adminRun&&<span style={{fontSize:9,color:"rgba(255,150,50,0.7)",marginLeft:8}}>ADMIN — NOT SAVED</span>}
        </div>

        {canRespawn&&(
          <div style={{marginBottom:16,padding:"12px 20px",background:"rgba(255,220,100,0.07)",border:"1px solid rgba(255,220,100,0.25)",borderRadius:8,textAlign:"center"}}>
            <div style={{fontSize:9,color:"rgba(255,220,100,0.6)",letterSpacing:3,marginBottom:7}}>CHECKPOINT AVAILABLE — {cpLeft} {cpLeft===1?"RETRY":"RETRIES"} LEFT</div>
            <button onClick={respawnAtCheckpoint} style={{...BS("linear-gradient(135deg,#B8860B,#8B6914)"),padding:"9px 24px",fontSize:11}}>
              RESPAWN AT LEVEL {checkpoint.lvl+1}{checkpoint.isBonus?" (Cancer)":""}
            </button>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:6}}>65% HP · full energy · fresh army</div>
          </div>
        )}

        {/* Quick retry */}
        <div style={{marginBottom:16,padding:"10px 18px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,textAlign:"center"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:2,marginBottom:7}}>RETRY THIS LEVEL INSTANTLY</div>
          <button onClick={quickRetry} style={{...BS("linear-gradient(135deg,#37474F,#546E7A)"),padding:"8px 24px",fontSize:11}}>QUICK RETRY</button>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.28)",marginTop:5}}>same level · fresh start · no briefing</div>
        </div>

        <div style={{marginBottom:16,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score} currentName={chr.name}/></div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{scrRef.current="character";setScreen("character");}} style={BS("linear-gradient(135deg,#D32F2F,#7B1FA2)")}>NEW RUN</button>
          {ghostBtn(()=>{scrRef.current="title";setScreen("title");},"MAIN MENU")}
        </div>
      </div>
    );
  }

  if(screen==="victory"){
    const g=gRef.current;
    return(
      <div style={{minHeight:"100vh",background:"#011208",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#A5D6A7",marginBottom:8}}>ALL PATHOGENS ELIMINATED</div>
        <h2 style={{fontSize:48,margin:"0 0 8px",color:"#81C784",letterSpacing:3}}>IMMUNITY</h2>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4}}>10 Levels Cleared.</div>
        <div style={{fontSize:18,color:"#FFE082",marginBottom:22}}>Score: {(g?.score??0).toLocaleString()}</div>
        <div style={{marginBottom:22,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score} currentName={chr.name}/></div>
        <button onClick={()=>{scrRef.current="title";setScreen("title");}} style={BS("linear-gradient(135deg,#00B0D8,#66BB6A)")}>PLAY AGAIN</button>
      </div>
    );
  }

  if(screen==="bonusVictory"){
    const g=gRef.current;
    return(
      <div style={{minHeight:"100vh",background:"#04100a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",position:"relative",overflow:"hidden",padding:24}}>
        <CancerVictoryArt/>
        <div style={{zIndex:1,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",maxWidth:520}}>
          <div style={{fontSize:9,letterSpacing:6,color:"#81C784",marginBottom:14}}>BONUS STAGE COMPLETE</div>
          <div style={{fontSize:50,fontWeight:900,letterSpacing:4,lineHeight:1.05,background:"linear-gradient(135deg,#A5D6A7,#FFE082,#80DEEA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:10}}>
            THE BODY<br/>PREVAILED
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.8,marginBottom:8}}>All cancer cells eliminated. All tumors destroyed.</div>
          <div style={{fontSize:11,color:"rgba(200,230,200,0.55)",lineHeight:1.75,marginBottom:22,padding:"12px 18px",background:"rgba(129,199,132,0.05)",border:"1px solid rgba(129,199,132,0.12)",borderRadius:8}}>
            In real life, this battle happens in your body every day.<br/>
            The immune system destroys thousands of cancerous cells<br/>
            before they can form tumors — silently, without you knowing.
          </div>
          <div style={{fontSize:18,color:"#FFE082",marginBottom:20}}>Final Score: {(g?.score??0).toLocaleString()}</div>
          <div style={{marginBottom:22,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score} currentName={chr.name}/></div>
          <button onClick={()=>{scrRef.current="title";setScreen("title");}} style={BS("linear-gradient(135deg,#388E3C,#00B0D8)")}>PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function Leaderboard({scores,currentScore,currentName}){
  if(!scores.length)return<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",textAlign:"center",padding:"10px 0"}}>No scores yet — you're the first!</div>;
  const medals=["🥇","🥈","🥉"];
  return(
    <div style={{width:"100%"}}>
      <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.4)",marginBottom:7,fontFamily:"monospace",textAlign:"center"}}>LEADERBOARD</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {scores.map((s,i)=>{
          const isCur=currentScore&&s.score===currentScore&&s.name===(currentName||"Anonymous")&&i===scores.findIndex(x=>x.score===currentScore);
          return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",background:isCur?"rgba(255,220,100,0.08)":"rgba(255,255,255,0.03)",borderRadius:5,border:`1px solid ${isCur?"rgba(255,220,100,0.25)":"rgba(255,255,255,0.07)"}`,fontFamily:"monospace"}}>
              <span style={{fontSize:13,width:20,textAlign:"center"}}>{i<3?medals[i]:<span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{i+1}</span>}</span>
              <span style={{fontSize:11,fontWeight:"bold",color:"#FFE082",minWidth:55}}>{s.score.toLocaleString()}</span>
              <span style={{fontSize:10,fontWeight:"bold",color:isCur?"#FFE082":"rgba(255,255,255,0.75)",minWidth:70}}>{s.name||"Anonymous"}</span>
              <span style={{fontSize:8,color:"rgba(255,255,255,0.45)",flex:1}}>Lvl {s.lvl}{s.bonusCompleted?" + Cancer":s.isBonus?" (bonus)":""}</span>
              {s.completed&&<span style={{fontSize:7,color:"#81C784",letterSpacing:1}}>CLEARED</span>}
              <span style={{fontSize:7,color:"rgba(255,255,255,0.25)"}}>{s.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CANCER VICTORY ART ───────────────────────────────────────────────────────
function CancerVictoryArt(){
  const ref=useRef(null);
  useEffect(()=>{
    const cv=ref.current,ctx=cv.getContext("2d");
    const resize=()=>{cv.width=window.innerWidth;cv.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    const pts=Array.from({length:55},()=>({x:Math.random()*window.innerWidth,y:window.innerHeight+Math.random()*200,r:2+Math.random()*6,vx:(Math.random()-0.5)*0.5,vy:-(0.3+Math.random()*0.8),col:["#81C784","#A5D6A7","#FFE082","#FFD54F","#80DEEA","#4DB6AC"][Math.floor(Math.random()*6)],ph:Math.random()*Math.PI*2,wobble:0.2+Math.random()*0.4}));
    const strands=Array.from({length:6},(_,i)=>({x:window.innerWidth*0.1+i*(window.innerWidth*0.16),phase:i*1.1,col:["#81C784","#FFE082","#80DEEA","#A5D6A7","#FFD54F","#4DB6AC"][i],spd:0.0005+i*0.0002}));
    let raf,t=0;
    const loop=()=>{
      t++;ctx.clearRect(0,0,cv.width,cv.height);
      for(const s of strands){ctx.beginPath();for(let x=0;x<cv.width;x+=4){const y=cv.height*0.5+Math.sin(x*0.008+s.phase+t*s.spd*60)*cv.height*0.22+Math.sin(x*0.015+t*s.spd*40)*cv.height*0.08;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=s.col+"18";ctx.lineWidth=2;ctx.stroke();}
      for(const p of pts){p.x+=p.vx+Math.sin(t*0.02+p.ph)*p.wobble;p.y+=p.vy;if(p.y<-20){p.y=cv.height+10;p.x=Math.random()*cv.width;}const fade=Math.max(0,Math.min(1,(cv.height-p.y)/(cv.height*0.7)));const g2=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.2);g2.addColorStop(0,p.col+Math.floor(fade*200).toString(16).padStart(2,"0"));g2.addColorStop(1,"transparent");ctx.fillStyle=g2;ctx.beginPath();ctx.arc(p.x,p.y,p.r*2.2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r*fade,0,Math.PI*2);ctx.fillStyle=p.col+Math.floor(fade*180).toString(16).padStart(2,"0");ctx.fill();}
      const cx2=cv.width/2,cy2=cv.height/2,pulse=(Math.sin(t*0.04)+1)/2;
      const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cv.width*0.38);cg.addColorStop(0,`rgba(129,199,132,${0.06+pulse*0.04})`);cg.addColorStop(1,"transparent");ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx2,cy2,cv.width*0.38,0,Math.PI*2);ctx.fill();
      // Ribbon
      const rx=cx2,ry=90,rs=28,rc=`rgba(129,199,132,${0.55+pulse*0.2})`;
      ctx.strokeStyle=rc;ctx.lineWidth=4;ctx.lineCap="round";
      ctx.save();ctx.translate(rx,ry);
      ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.bezierCurveTo(-rs,rs*0.6,-rs*1.4,-rs*0.5,-rs*0.15,-rs*1.1);ctx.bezierCurveTo(0,-rs*1.6,rs*0.15,-rs*1.1,0,-rs*0.4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.bezierCurveTo(rs,rs*0.6,rs*1.4,-rs*0.5,rs*0.15,-rs*1.1);ctx.bezierCurveTo(0,-rs*1.6,-rs*0.15,-rs*1.1,0,-rs*0.4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.lineTo(-rs*0.5,rs*1.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.lineTo(rs*0.5,rs*1.5);ctx.stroke();
      ctx.restore();
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return<canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}

// ─── FLOATING BG ──────────────────────────────────────────────────────────────
function FloatingBg({cancer=false}){
  const ref=useRef(null);
  useEffect(()=>{
    const cv=ref.current,ctx=cv.getContext("2d");
    const resize=()=>{cv.width=window.innerWidth;cv.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    const cols=cancer?["#8B0000","#CC0044","#3D0040","#AA0020","#660033"]:["#26C6DA","#66BB6A","#FFA726","#AB47BC","#EF5350","#8B4513","#FFB300","#AB47BC"];
    const its=Array.from({length:24},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:5+Math.random()*20,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,col:cols[Math.floor(Math.random()*cols.length)],ph:Math.random()*Math.PI*2}));
    let raf;
    const loop=t=>{
      ctx.clearRect(0,0,cv.width,cv.height);
      for(const it of its){it.x+=it.vx;it.y+=it.vy;if(it.x<-40)it.x=cv.width+40;if(it.x>cv.width+40)it.x=-40;if(it.y<-40)it.y=cv.height+40;if(it.y>cv.height+40)it.y=-40;const a=((Math.sin(t/1300+it.ph)+1)/2)*0.12+0.03;const g2=ctx.createRadialGradient(it.x,it.y,0,it.x,it.y,it.r*1.5);g2.addColorStop(0,it.col+Math.floor(a*255).toString(16).padStart(2,"0"));g2.addColorStop(1,"transparent");ctx.fillStyle=g2;ctx.beginPath();ctx.arc(it.x,it.y,it.r*1.5,0,Math.PI*2);ctx.fill();}
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return<canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}
