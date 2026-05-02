import { useState, useEffect, useRef } from "react";

const CW = 640, CH = 430, CX = CW/2, CY = CH/2, CR = 32;
const MAX_C = 15, ECAP = 200;

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
const LB_KEY = "immunowar_leaderboard_v2";
async function loadScores() { try { const r=await window.storage.get(LB_KEY); return r?JSON.parse(r.value):[]; } catch{return[];} }
async function saveScore(e) { try { const s=await loadScores(); s.push(e); s.sort((a,b)=>b.score-a.score); const t=s.slice(0,10); await window.storage.set(LB_KEY,JSON.stringify(t)); return t; } catch{return[];} }

// ─── SOUND ────────────────────────────────────────────────────────────────────
const SFX = {
  ctx:null, muted:false,
  gc(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return this.ctx;},
  play(type){
    if(this.muted)return; const ac=this.gc();if(!ac)return;
    try{
      if(ac.state==="suspended")ac.resume();
      const t=ac.currentTime;
      const tone=(freq,wave,gain,dur,end,at=0)=>{const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type=wave;o.frequency.setValueAtTime(freq,t+at);if(end)o.frequency.exponentialRampToValueAtTime(end,t+at+dur);g.gain.setValueAtTime(gain,t+at);g.gain.exponentialRampToValueAtTime(0.001,t+at+dur);o.start(t+at);o.stop(t+at+dur+0.01);};
      switch(type){
        case"place":    tone(440,"sine",0.10,0.09,220);break;
        case"kill":     tone(290,"sine",0.15,0.13,80);break;
        case"split":    tone(600,"sine",0.08,0.07,180);break;
        case"coreHit":  tone(90,"sine",0.22,0.20,45);break;
        case"gameOver": [440,350,220].forEach((f,i)=>tone(f,"sawtooth",0.07,0.24,null,i*0.18));break;
        case"waveEnd":  [440,550,660].forEach((f,i)=>tone(f,"sine",0.10,0.14,null,i*0.08));break;
        case"levelEnd": [523,659,784].forEach((f,i)=>tone(f,"sine",0.09,0.45,null,i*0.03));break;
        case"bonusStart":[200,160,130,100].forEach((f,i)=>tone(f,"sine",0.11,0.35,null,i*0.14));break;
        case"victory":  [523,659,784,1047].forEach((f,i)=>tone(f,"sine",0.10,0.50,null,i*0.09));break;
      }
    }catch(e){}
  }
};

// ─── IMMUNE CELLS ─────────────────────────────────────────────────────────────
const CELLS = {
  neutrophil:{ name:"Neutrophil", cost:15, maxHp:60,  dmg:9,  range:88,  aps:1.3,  col:"#26C6DA", r:14, desc:"Versatile. Fast attack." },
  macrophage:{ name:"Macrophage", cost:30, maxHp:150, dmg:28, range:60,  aps:0.55, col:"#66BB6A", r:21, desc:"Tank. High HP and damage." },
  tcell:     { name:"T-Cell",     cost:25, maxHp:44,  dmg:15, range:140, aps:2.2,  col:"#FFA726", r:13, desc:"Rapid-fire specialist." },
  bcell:     { name:"B-Cell",     cost:40, maxHp:38,  dmg:25, range:215, aps:0.85, col:"#AB47BC", r:14, desc:"Long-range antibody launcher." },
};

// ─── PATHOGENS ────────────────────────────────────────────────────────────────
// Category color families:
//   virus    → warm reds / oranges
//   bacteria → browns / earths / olives
//   fungi    → purples / magentas
//   parasite → teals / cyans

const PATHS = {
  // TIER 1 — light viruses
  flu:         { name:"Influenza A",     cat:"virus",    hp:26,  spd:0.65, dmg:3,  rew:10, col:"#EF5350", r:9  },
  rhinovirus:  { name:"Rhinovirus",      cat:"virus",    hp:20,  spd:1.05, dmg:2,  rew:8,  col:"#FF8A65", r:7  },
  rsv:         { name:"RSV",             cat:"virus",    hp:30,  spd:0.80, dmg:4,  rew:12, col:"#FF7043", r:9  },
  norovirus:   { name:"Norovirus",       cat:"virus",    hp:22,  spd:1.12, dmg:3,  rew:10, col:"#FFAB91", r:7  },
  adenovirus:  { name:"Adenovirus",      cat:"virus",    hp:35,  spd:0.70, dmg:4,  rew:14, col:"#FF5722", r:10 },
  // TIER 2 — medium viruses + light bacteria
  measles:     { name:"Measles Virus",   cat:"virus",    hp:44,  spd:0.88, dmg:5,  rew:18, col:"#E53935", r:11 },
  chickenpox:  { name:"Varicella",       cat:"virus",    hp:38,  spd:0.75, dmg:4,  rew:15, col:"#EF9A9A", r:10 },
  mumps:       { name:"Mumps Virus",     cat:"virus",    hp:50,  spd:0.60, dmg:6,  rew:20, col:"#E57373", r:12 },
  ecoli:       { name:"E. coli",         cat:"bacteria", hp:55,  spd:0.42, dmg:6,  rew:20, col:"#8B4513", r:12 },
  salmonella:  { name:"Salmonella",      cat:"bacteria", hp:60,  spd:0.45, dmg:6,  rew:20, col:"#A0522D", r:12 },
  giardia:     { name:"Giardia",         cat:"parasite", hp:45,  spd:0.60, dmg:5,  rew:16, col:"#4DD0E1", r:10 },
  // TIER 3 — harder bacteria, fungi, parasites
  staph:       { name:"Staph Aureus",    cat:"bacteria", hp:70,  spd:0.35, dmg:7,  rew:22, col:"#795548", r:13 },
  strep:       { name:"Streptococcus",   cat:"bacteria", hp:100, spd:0.27, dmg:9,  rew:30, col:"#6D4C41", r:16 },
  listeria:    { name:"Listeria",        cat:"bacteria", hp:75,  spd:0.38, dmg:8,  rew:25, col:"#5D4037", r:13 },
  cdiff:       { name:"C. difficile",    cat:"bacteria", hp:90,  spd:0.30, dmg:10, rew:28, col:"#4E342E", r:14 },
  hpylori:     { name:"H. pylori",       cat:"bacteria", hp:80,  spd:0.32, dmg:8,  rew:26, col:"#8D6E63", r:13 },
  dengue:      { name:"Dengue Virus",    cat:"virus",    hp:60,  spd:0.95, dmg:8,  rew:24, col:"#D32F2F", r:11 },
  candida:     { name:"Candida",         cat:"fungi",    hp:60,  spd:0.25, dmg:7,  rew:22, col:"#CE93D8", r:13 },
  malaria:     { name:"Plasmodium",      cat:"parasite", hp:70,  spd:0.85, dmg:10, rew:28, col:"#00BCD4", r:12 },
  // TIER 4 — serious pathogens
  lyme:        { name:"Lyme Borrelia",   cat:"bacteria", hp:110, spd:0.35, dmg:11, rew:35, col:"#558B2F", r:15 },
  pneumo:      { name:"Pneumococcus",    cat:"bacteria", hp:120, spd:0.25, dmg:12, rew:38, col:"#33691E", r:16 },
  tb:          { name:"Tuberculosis",    cat:"bacteria", hp:145, spd:0.20, dmg:14, rew:50, col:"#827717", r:17 },
  hepatitisB:  { name:"Hepatitis B",     cat:"virus",    hp:80,  spd:0.50, dmg:9,  rew:28, col:"#B71C1C", r:13 },
  aspergillus: { name:"Aspergillus",     cat:"fungi",    hp:85,  spd:0.20, dmg:9,  rew:28, col:"#AB47BC", r:15 },
  toxo:        { name:"Toxoplasma",      cat:"parasite", hp:90,  spd:0.50, dmg:10, rew:30, col:"#0097A7", r:14 },
  resistant:   { name:"MRSA",           cat:"bacteria", hp:130, spd:0.43, dmg:13, rew:42, col:"#BF360C", r:14 },
  crypto:      { name:"Cryptococcus",    cat:"fungi",    hp:110, spd:0.22, dmg:11, rew:35, col:"#8E24AA", r:16 },
  // TIER 5 — boss tier
  corona:      { name:"Coronavirus",     cat:"virus",    hp:170, spd:0.72, dmg:16, rew:62, col:"#C62828", r:18 },
  ebola:       { name:"Ebola Virus",     cat:"virus",    hp:195, spd:0.55, dmg:20, rew:75, col:"#7f0000", r:17 },
  superbug:    { name:"Super Bug",       cat:"bacteria", hp:240, spd:0.50, dmg:22, rew:85, col:"#4E342E", r:21 },
  // CANCER (bonus only)
  cancerCell:  { name:"Cancer Cell",     cat:"cancer",   hp:90,  spd:0.28, dmg:10, rew:20, col:"#8B0000", r:14, splits:true },
  microCancer: { name:"Micro Cancer",    cat:"cancer",   hp:38,  spd:0.46, dmg:5,  rew:8,  col:"#8B0000", r:8  },
  metastatic:  { name:"Metastatic Cell", cat:"cancer",   hp:65,  spd:0.80, dmg:12, rew:30, col:"#CC0044", r:11 },
  tumor:       { name:"Tumor",           cat:"cancer",   hp:360, spd:0.07, dmg:18, rew:80, col:"#3D0040", r:26, spawner:true, spawnInt:4500 },
  leukemia:    { name:"Leukemia Cell",   cat:"cancer",   hp:50,  spd:1.18, dmg:14, rew:25, col:"#AA0020", r:9  },
};

// ─── CATEGORY META ─────────────────────────────────────────────────────────────
const CAT_META = {
  virus:    { label:"VIRUS",    col:"#EF5350", bg:"rgba(239,83,80,0.10)"  },
  bacteria: { label:"BACTERIA", col:"#A0522D", bg:"rgba(139,69,19,0.12)" },
  fungi:    { label:"FUNGI",    col:"#AB47BC", bg:"rgba(171,71,188,0.10)" },
  parasite: { label:"PARASITE", col:"#00BCD4", bg:"rgba(0,188,212,0.10)"  },
  cancer:   { label:"CANCER",   col:"#CC0044", bg:"rgba(204,0,68,0.10)"  },
};

// ─── FACTS ────────────────────────────────────────────────────────────────────
const FACTS = {
  flu:         { icon:"🦠", fact:"Influenza A mutates every season via antigenic drift — tiny changes to its surface proteins — making last year's immunity only partially effective. It spreads via droplets and can survive on surfaces for up to 24 hours." },
  rhinovirus:  { icon:"💨", fact:"Rhinovirus causes roughly half of all common colds. It replicates best at 33°C, which is exactly the temperature of your nasal passages — making your nose its ideal incubator." },
  rsv:         { icon:"🫁", fact:"Respiratory Syncytial Virus is the leading cause of hospitalization in infants. It causes cells in the airway to fuse together into large masses called syncytia, obstructing breathing." },
  norovirus:   { icon:"🤢", fact:"Norovirus is extraordinarily contagious — just 18 viral particles can cause infection. It can survive on surfaces for weeks and is resistant to many standard disinfectants." },
  adenovirus:  { icon:"👁️", fact:"Adenovirus causes conjunctivitis (pink eye), respiratory illness, and gastroenteritis depending on the strain. Over 50 distinct strains exist, making broad immunity nearly impossible." },
  measles:     { icon:"🔴", fact:"Measles virus is airborne and can linger in a room for up to two hours after an infected person leaves. It also causes 'immune amnesia' — erasing memory of previous infections." },
  chickenpox:  { icon:"🌀", fact:"Varicella-zoster virus stays dormant in nerve cells for decades after infection. It can reactivate later in life as shingles when the immune system weakens." },
  mumps:       { icon:"🧸", fact:"Mumps targets salivary glands but can also infect the testes, ovaries, and brain. The virus spreads through saliva and reaches peak contagiousness before symptoms even appear." },
  dengue:      { icon:"🦟", fact:"Dengue is transmitted by Aedes mosquitoes and infects around 400 million people annually. A second infection with a different strain can trigger severe hemorrhagic fever." },
  hepatitisB:  { icon:"🫀", fact:"Hepatitis B infects liver cells and can persist for decades without symptoms. Chronic infection is 100 times more transmissible than HIV and can lead to cirrhosis and liver cancer." },
  corona:      { icon:"👑", fact:"Coronavirus spike proteins mimic host cell receptors to gain entry. Your B-Cells counter by producing antibodies that physically block these spikes — but the virus evolves quickly." },
  ebola:       { icon:"☣️", fact:"Ebola has a fatality rate of up to 90% in untreated cases. It attacks the immune system first, disabling the interferon response before spreading to organs." },
  ecoli:       { icon:"💩", fact:"Most E. coli strains are harmless gut residents — but pathogenic strains like O157:H7 produce Shiga toxin that destroys red blood cells and can cause kidney failure." },
  salmonella:  { icon:"🐔", fact:"Salmonella survives stomach acid by hiding inside immune cells called macrophages. It hijacks its own predator and uses it as transport to reach the lymph nodes." },
  staph:       { icon:"🔶", fact:"Staphylococcus aureus produces toxins that punch holes in cell membranes. It colonizes skin and nasal passages silently in ~30% of people, becoming dangerous only when immunity drops." },
  strep:       { icon:"🫁", fact:"Streptococcus produces enzymes that digest connective tissue, letting it spread rapidly. If it reaches the bloodstream, it can trigger sepsis within hours." },
  listeria:    { icon:"🥶", fact:"Listeria thrives at refrigerator temperatures — the only bacterium that actively reproduces in your fridge. It crosses the blood-brain barrier and is especially dangerous in pregnancy." },
  cdiff:       { icon:"🧫", fact:"C. difficile produces spores that survive bleach and heat for months. Antibiotic overuse wipes out protective gut bacteria, giving it room to explode in the colon." },
  hpylori:     { icon:"🔩", fact:"H. pylori infects roughly half the world's population. It neutralizes stomach acid around itself using urease, carving out a protected niche in the stomach lining to cause ulcers." },
  lyme:        { icon:"🕷️", fact:"Lyme disease bacteria change their outer surface proteins to evade antibody targeting — a strategy called antigenic variation. Without treatment it can spread to joints, heart, and brain." },
  pneumo:      { icon:"🫧", fact:"Pneumococcus has over 90 distinct capsular types, each requiring separate immunity. It causes pneumonia, meningitis, and sepsis — responsible for over a million deaths annually." },
  tb:          { icon:"🫁", fact:"Tuberculosis can remain dormant for decades inside macrophages — the very cells meant to destroy it. Only about 10% of latent infections ever activate, but globally it kills 1.5 million per year." },
  aspergillus: { icon:"🍄", fact:"Aspergillus is a mold whose spores are inhaled constantly. Healthy immune systems clear it effortlessly, but in immunocompromised people it forms invasive fungal masses in the lungs." },
  candida:     { icon:"🕯️", fact:"Candida lives harmlessly in your gut microbiome but can overgrow into systemic infection when immune defenses drop. It switches between yeast and filamentous forms to penetrate tissue." },
  crypto:      { icon:"🧠", fact:"Cryptococcus neoformans is inhaled from soil or bird droppings. It can cross the blood-brain barrier and cause fungal meningitis, a leading cause of death in HIV-positive patients." },
  malaria:     { icon:"🦟", fact:"Plasmodium completes part of its lifecycle inside red blood cells, bursting them in coordinated waves — the source of malaria's cyclical fevers. It also hides surface antigens to evade detection." },
  giardia:     { icon:"💧", fact:"Giardia lamblia is a gut parasite transmitted through contaminated water. It uses a disc-shaped sucker to attach to the intestinal wall, disrupting nutrient absorption for weeks." },
  toxo:        { icon:"🐱", fact:"Toxoplasma gondii infects roughly a third of all humans. In mice it manipulates brain chemistry to make them attracted to cats — its definitive host. In humans the effects are still being studied." },
  resistant:   { icon:"⚠️", fact:"MRSA (Methicillin-Resistant Staph Aureus) produces enzymes that disable most antibiotics. Your T-Cells must attack directly — there is no chemical shortcut." },
  cancerCell:  { icon:"🧬", fact:"Cancer cells disable the apoptosis pathway — the protein switch that normally triggers self-destruction. Because they originate from your own cells, the immune system struggles to identify them as foreign." },
  metastatic:  { icon:"🩸", fact:"Metastatic cells detach from a primary tumor and enter the bloodstream. They secrete proteins that help them survive in circulation and establish new colonies in distant organs." },
  tumor:       { icon:"⬤",  fact:"Solid tumors grow their own blood supply via angiogenesis. They also emit immunosuppressive signals that disable local T-Cell activity, creating a protected exclusion zone." },
  leukemia:    { icon:"💉", fact:"Leukemia floods the bloodstream with non-functional white blood cells that crowd out healthy ones — destroying the body's own immune capacity from the inside." },
  superbug:    { icon:"💀", fact:"Superbugs combine resistance to multiple drug classes with high replication speed. They acquire resistance genes from neighboring bacteria via horizontal gene transfer — evolution in real time." },
  ebola2:      { icon:"☣️", fact:"" },
};

// ─── TIER POOLS ──────────────────────────────────────────────────────────────
const TIERS = {
  1: ["flu","rhinovirus","rsv","norovirus","adenovirus"],
  2: ["measles","chickenpox","mumps","ecoli","salmonella","giardia"],
  3: ["staph","strep","listeria","cdiff","hpylori","dengue","candida","malaria"],
  4: ["lyme","pneumo","tb","hepatitisB","aspergillus","toxo","resistant","crypto"],
  5: ["corona","ebola","superbug"],
};

// ─── LEVEL TEMPLATES (fixed difficulty metadata, random composition) ──────────
const LEVEL_TEMPLATES = [
  { name:"First Contact",    waves:2, waveScale:0.18, tiers:[1],   types:1, count:6,  bonus:30  },
  { name:"Viral Spread",     waves:3, waveScale:0.20, tiers:[1],   types:2, count:7,  bonus:35  },
  { name:"Early Infection",  waves:3, waveScale:0.22, tiers:[1,2], types:2, count:7,  bonus:35  },
  { name:"Bacterial Breach", waves:4, waveScale:0.25, tiers:[2],   types:2, count:6,  bonus:40  },
  { name:"Mixed Outbreak",   waves:4, waveScale:0.28, tiers:[2,3], types:2, count:6,  bonus:45  },
  { name:"Resistant Front",  waves:5, waveScale:0.30, tiers:[3],   types:3, count:5,  bonus:50  },
  { name:"Viral Surge",      waves:5, waveScale:0.34, tiers:[3,4], types:3, count:5,  bonus:55  },
  { name:"Perfect Storm",    waves:6, waveScale:0.38, tiers:[3,4], types:3, count:5,  bonus:60  },
  { name:"Super Infection",  waves:6, waveScale:0.44, tiers:[4,5], types:3, count:5,  bonus:75  },
  { name:"Final Immunity",   waves:7, waveScale:0.50, tiers:[4,5], types:4, count:5,  bonus:100 },
];

const LEVEL_TIPS = [
  "Place Neutrophils in a ring around the core first — they are cheap and versatile.",
  "Cold and fast viruses die to T-Cells. Save energy for a second ring of Neutrophils.",
  "Mixed tiers mean mixed speeds. Use B-Cells for long range and Macrophages up close.",
  "Bacteria hit hard. Don't spread cells thin — cluster for combined fire.",
  "Mixed outbreaks: let B-Cells soften fast movers before they reach your front line.",
  "Resistant pathogens shrug off weak attacks. Stack multiple cells on the same target.",
  "At this tier, wave scaling makes later waves 60%+ stronger. Hold energy in reserve.",
  "Multiple threat types. Overlap cell ranges so every intruder gets hit from two angles.",
  "Tier 5 enemies have massive HP. Three Macrophages on the same target is the key.",
  "Everything at once. Full mixed army, energy held for waves 5+. No spreading thin.",
];

const BONUS_LEVELS = [
  { name:"Tumor Formation",  waves:2, waveScale:0.22, s:[["cancerCell",5]],                                              bonus:50,  tip:"Cancer cells split on death. Kill them near your defenders, not near the core." },
  { name:"Metastasis",       waves:3, waveScale:0.28, s:[["cancerCell",5],["leukemia",5]],                               bonus:60,  tip:"Leukemia cells are the fastest cancer type. T-Cells are essential here." },
  { name:"Tumor Growth",     waves:3, waveScale:0.30, s:[["tumor",1],["leukemia",6]],                                    bonus:70,  tip:"Kill the Tumor first — it spawns Cancer Cells every 4.5 seconds until dead." },
  { name:"Stage III",        waves:4, waveScale:0.35, s:[["metastatic",4],["cancerCell",5],["leukemia",4]],              bonus:80,  tip:"Metastatic cells are fast and bypass outer defenders. Place cells deeper." },
  { name:"Terminal Stage",   waves:5, waveScale:0.40, s:[["tumor",1],["metastatic",4],["cancerCell",6],["leukemia",5]], bonus:100, tip:"Kill the Tumor the moment it appears — it spawns reinforcements every 4.5 seconds. Then clean up the rest." },
];

// ─── GENERATE LEVEL COMPOSITIONS FOR A RUN ───────────────────────────────────
function generateCompositions() {
  return LEVEL_TEMPLATES.map((tmpl, i) => {
    const pool = [...new Set(tmpl.tiers.flatMap(t => TIERS[t]))];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, tmpl.types);
    const s = chosen.map(type => [type, tmpl.count]);
    return { ...tmpl, s, tip: LEVEL_TIPS[i] };
  });
}

let _uid = 0;
const uid = () => ++_uid;

function edgePt(){const s=Math.floor(Math.random()*4);if(s===0)return{x:Math.random()*CW,y:-18};if(s===1)return{x:CW+18,y:Math.random()*CH};if(s===2)return{x:Math.random()*CW,y:CH+18};return{x:-18,y:Math.random()*CH};}

function getMods(ch){
  const m={maxHp:100,eStart:60,eRegen:2.0,cMult:{},atkMult:1};
  if(ch.gender==="female")m.cMult.bcell=1.15;
  if(ch.gender==="male")m.cMult.tcell=1.15;
  if(ch.age==="child"){m.maxHp=80;m.eStart=85;m.eRegen=2.6;}
  if(ch.age==="young"){m.maxHp=100;m.eStart=60;m.eRegen=2.0;}
  if(ch.age==="adult"){m.maxHp=120;m.eStart=60;m.eRegen=1.8;}
  if(ch.age==="senior"){m.maxHp=75;m.eStart=75;m.eRegen=1.5;m.atkMult=0.82;}
  return m;
}

function buildQ(levData, wave, now){
  const q=[],ws=1+(wave-1)*levData.waveScale;
  for(const [type,count] of levData.s){
    const spread=7000+wave*500;
    for(let i=0;i<count;i++)q.push({type,at:now+600+(i/Math.max(count-1,1))*spread+Math.random()*700,scale:ws});
  }
  return q.sort((a,b)=>a.at-b.at);
}

function getBriefingEnemies(levData){
  const seen=[];
  for(const [type] of levData.s)if(!seen.find(e=>e.type===type))seen.push({type,...PATHS[type],...(FACTS[type]||{icon:"🦠",fact:""})});
  return seen;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function ImmunoWar(){
  const [screen,   setScreen]   = useState("title");
  const [chr,      setChr]      = useState({gender:"female",age:"young"});
  const [sel,      setSel]      = useState("neutrophil");
  const [sfxOn,    setSfxOn]    = useState(true);
  const [briefing, setBriefing] = useState(null);
  const [placeMsg, setPlaceMsg] = useState(null);
  const [lb,       setLb]       = useState([]);
  const [checkpoint,    setCheckpoint]    = useState(null);
  const [checkpointUsed,setCheckpointUsed]= useState(false);
  const [adminMode,setAdminMode]= useState(false);
  const [ui, setUi] = useState({hp:100,maxHp:100,energy:60,cells:0,lvl:0,wave:0,totalWaves:2,score:0,phase:"waveIdle",countdown:4,isBonus:false,levName:""});

  const cvsRef=useRef(null),rafRef=useRef(null),gRef=useRef(null);
  const selRef=useRef("neutrophil"),scrRef=useRef("title");
  const mRef=useRef({x:-999,y:-999}),fRef=useRef(0);
  const adminKeysRef=useRef("");

  useEffect(()=>{loadScores().then(setLb);},[]);
  useEffect(()=>{selRef.current=sel;},[sel]);
  useEffect(()=>{
    const h=e=>{
      const map={n:"neutrophil",m:"macrophage",t:"tcell",b:"bcell"};
      if(map[e.key?.toLowerCase()])setSel(map[e.key.toLowerCase()]);
      adminKeysRef.current=(adminKeysRef.current+e.key).slice(-5);
      if(adminKeysRef.current==="admin"){setAdminMode(true);adminKeysRef.current="";}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[]);

  const getLevData=(g,lvl)=>g.isBonus?BONUS_LEVELS[lvl]:g.compositions[lvl];

  const initGame=ch=>{
    const mods=getMods(ch);
    const compositions=generateCompositions();
    gRef.current={cells:[],pathogens:[],projs:[],parts:[],bodyHp:mods.maxHp,maxHp:mods.maxHp,energy:mods.eStart,eRegen:mods.eRegen,mods,lvl:0,wave:0,totalWaves:compositions[0].waves,phase:"waveIdle",wideStart:null,spawnQ:[],score:0,countdown:4000,isBonus:false,compositions,adminRun:false};
    setCheckpoint(null);setCheckpointUsed(false);
    setBriefing({lvl:0,isBonus:false});scrRef.current="briefing";setScreen("briefing");
  };

  const respawnAtCheckpoint=()=>{
    const g=gRef.current,cp=checkpoint;
    const levData=getLevData(g,cp.lvl);
    g.lvl=cp.lvl;g.wave=0;g.totalWaves=levData.waves;
    g.phase="waveIdle";g.wideStart=null;g.pathogens=[];g.projs=[];g.cells=[];
    g.bodyHp=Math.round(g.maxHp*0.65);g.energy=ECAP;g.isBonus=cp.isBonus;
    setCheckpointUsed(true);
    setBriefing({lvl:cp.lvl,isBonus:cp.isBonus});scrRef.current="briefing";setScreen("briefing");
  };

  const jumpToLevel=(lvl,isBonus)=>{
    const mods=getMods(chr);
    const compositions=generateCompositions();
    const levData=isBonus?BONUS_LEVELS[lvl]:compositions[lvl];
    gRef.current={cells:[],pathogens:[],projs:[],parts:[],bodyHp:mods.maxHp,maxHp:mods.maxHp,energy:ECAP,eRegen:mods.eRegen,mods,lvl,wave:0,totalWaves:levData.waves,phase:"waveIdle",wideStart:null,spawnQ:[],score:0,countdown:4000,isBonus,compositions,adminRun:true};
    setBriefing({lvl,isBonus});scrRef.current="briefing";setScreen("briefing");
  };

  const addParts=(g,x,y,col,n)=>{for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=40+Math.random()*100;g.parts.push({x,y,col,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.3+Math.random()*0.5,r:1+Math.random()*3});}};

  const spawnPath=(g,type,x,y,scale=1)=>{const pd=PATHS[type];g.pathogens.push({id:uid(),type,x,y,hp:Math.round(pd.hp*scale),maxHp:Math.round(pd.hp*scale),spd:pd.spd*(1+(scale-1)*0.4),dmg:pd.dmg,rew:pd.rew,col:pd.col,r:pd.r,name:pd.name,cat:pd.cat,splits:pd.splits||false,spawner:pd.spawner||false,spawnInt:pd.spawnInt||0,nextSpawn:0,wb:Math.random()*Math.PI*2,wbS:0.5+Math.random()});};

  const update=(dt,now)=>{
    const g=gRef.current;if(!g||scrRef.current!=="game")return;
    g.energy=Math.min(ECAP,g.energy+g.eRegen*dt);
    const levData=getLevData(g,g.lvl);

    if(g.phase==="waveIdle"){
      if(!g.wideStart)g.wideStart=now;
      g.countdown=Math.max(0,4000-(now-g.wideStart));
      if(now-g.wideStart>4000){g.wave++;g.phase="spawning";g.wideStart=null;g.spawnQ=buildQ(levData,g.wave,now);}
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
      if(dist<CR+p.r){g.bodyHp=Math.max(0,g.bodyHp-p.dmg);p.hp=0;addParts(g,p.x,p.y,"#ff2222",8);SFX.play("coreHit");}
      else{p.wb+=p.wbS*dt;const nx=dx/dist,ny=dy/dist;p.x+=(nx*p.spd+(-ny)*Math.sin(p.wb)*0.28)*60*dt;p.y+=(ny*p.spd+nx*Math.sin(p.wb)*0.28)*60*dt;}
      if(p.spawner&&p.hp>0){if(!p.nextSpawn)p.nextSpawn=now+p.spawnInt;if(now>=p.nextSpawn){p.nextSpawn=now+p.spawnInt;const a=Math.random()*Math.PI*2;spawnPath(g,"cancerCell",p.x+Math.cos(a)*(p.r+30),p.y+Math.sin(a)*(p.r+30),1);}}
    }
    for(const p of g.pathogens)for(const c of g.cells)if(Math.hypot(p.x-c.x,p.y-c.y)<p.r+CELLS[c.type].r+2){c.hp-=p.dmg*dt*3;if(c.hp<=0)addParts(g,c.x,c.y,CELLS[c.type].col,18);}
    g.cells=g.cells.filter(c=>c.hp>0);g.pathogens=g.pathogens.filter(p=>p.hp>0);

    for(const c of g.cells){
      if(c.cd>0){c.cd-=dt;continue;}
      const def=CELLS[c.type];let near=null,nd=Infinity;
      for(const p of g.pathogens){const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<=def.range&&d<nd){near=p;nd=d;}}
      if(!near)continue;
      c.cd=1/def.aps;
      g.projs.push({id:uid(),x:c.x,y:c.y,tx:near.x,ty:near.y,tid:near.id,dmg:Math.round(def.dmg*(g.mods.cMult[c.type]||1)*g.mods.atkMult),spd:300,col:def.col});
    }

    const died=[];
    for(const pj of g.projs){
      const tgt=g.pathogens.find(p=>p.id===pj.tid);
      if(tgt){pj.tx=tgt.x;pj.ty=tgt.y;}
      const dx=pj.tx-pj.x,dy=pj.ty-pj.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      if(d<10){
        if(tgt&&tgt.hp>0){tgt.hp-=pj.dmg;addParts(g,tgt.x,tgt.y,pj.col,3);if(tgt.hp<=0){g.energy=Math.min(ECAP,g.energy+tgt.rew);g.score+=tgt.rew*10;addParts(g,tgt.x,tgt.y,tgt.col,14);SFX.play("kill");if(tgt.splits)died.push({x:tgt.x,y:tgt.y});}}
        pj.dead=true;
      }else{const st=Math.min(pj.spd*dt,d);pj.x+=dx/d*st;pj.y+=dy/d*st;}
    }
    g.projs=g.projs.filter(p=>!p.dead);g.pathogens=g.pathogens.filter(p=>p.hp>0);
    for(const d of died){SFX.play("split");for(let i=0;i<2;i++){const a=Math.random()*Math.PI*2;spawnPath(g,"microCancer",d.x+Math.cos(a)*22,d.y+Math.sin(a)*22,1);}}

    for(const p of g.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;}
    g.parts=g.parts.filter(p=>p.life>0);
    if(g.bodyHp<=0){g.phase="gameOver";SFX.play("gameOver");}
  };

  const draw=(ctx,now)=>{
    const g=gRef.current;if(!g)return;
    ctx.fillStyle=g.isBonus?"#120005":"#030f1d";ctx.fillRect(0,0,CW,CH);
    ctx.strokeStyle=g.isBonus?"rgba(180,0,50,0.06)":"rgba(0,130,190,0.06)";ctx.lineWidth=0.5;
    for(let r=-1;r<CH/26+2;r++)for(let c=-1;c<CW/38+2;c++){
      const hx=c*38,hy=r*26+(c%2?13:0);ctx.beginPath();
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/6;i===0?ctx.moveTo(hx+Math.cos(a)*15,hy+Math.sin(a)*15):ctx.lineTo(hx+Math.cos(a)*15,hy+Math.sin(a)*15);}
      ctx.closePath();ctx.stroke();
    }
    const mx=mRef.current.x,my=mRef.current.y,sd=CELLS[selRef.current];
    if(mx>0&&mx<CW&&my>0&&my<CH){
      ctx.beginPath();ctx.arc(mx,my,sd.r,0,Math.PI*2);ctx.fillStyle=sd.col+"30";ctx.fill();
      ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(mx,my,sd.range,0,Math.PI*2);ctx.strokeStyle=sd.col+"40";ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
    }
    const pulse=(Math.sin(now/700)+1)/2;
    const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,CR*3.8);
    cg.addColorStop(0,`rgba(0,180,255,${0.2+pulse*0.08})`);cg.addColorStop(0.5,"rgba(0,80,180,0.08)");cg.addColorStop(1,"transparent");
    ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,CR*3.8,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(CX,CY,CR,0,Math.PI*2);ctx.fillStyle=`rgba(0,140,230,${0.65+pulse*0.15})`;ctx.fill();
    ctx.strokeStyle=`rgba(0,210,255,${0.8+pulse*0.2})`;ctx.lineWidth=2.5;ctx.stroke();
    const hr=g.bodyHp/g.maxHp;
    ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle=hr>0.5?"#fff":hr>0.25?"#FFD54F":"#EF5350";ctx.fillText(`${Math.ceil(g.bodyHp)}`,CX,CY);

    for(const c of g.cells){
      const def=CELLS[c.type];
      ctx.beginPath();ctx.arc(c.x,c.y,def.range,0,Math.PI*2);ctx.strokeStyle=def.col+"10";ctx.lineWidth=1;ctx.stroke();
      const g2=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,def.r*2.2);g2.addColorStop(0,def.col+"35");g2.addColorStop(1,"transparent");
      ctx.fillStyle=g2;ctx.beginPath();ctx.arc(c.x,c.y,def.r*2.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(c.x,c.y,def.r,0,Math.PI*2);ctx.fillStyle=def.col;ctx.fill();
      ctx.strokeStyle="#ffffffbb";ctx.lineWidth=1.5;ctx.stroke();
      const hp2=c.hp/c.maxHp;
      ctx.fillStyle="#0008";ctx.fillRect(c.x-def.r,c.y+def.r+2,def.r*2,3);
      ctx.fillStyle=hp2>0.5?"#66BB6A":hp2>0.25?"#FFD54F":"#EF5350";ctx.fillRect(c.x-def.r,c.y+def.r+2,def.r*2*hp2,3);
    }

    for(const p of g.pathogens){
      const spin=now/1300,isCancer=p.cat==="cancer";
      const glowR=p.type==="tumor"?p.r*3.5:p.r*2.8;
      const pg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,glowR);pg.addColorStop(0,p.col+"55");pg.addColorStop(1,"transparent");
      ctx.fillStyle=pg;ctx.beginPath();ctx.arc(p.x,p.y,glowR,0,Math.PI*2);ctx.fill();

      if(p.type==="tumor"){
        ctx.beginPath();
        for(let i=0;i<=20;i++){const a=i/20*Math.PI*2,lump=p.r*(1+0.22*Math.sin(i*3+now/900)+0.14*Math.sin(i*5-now/650));const px2=p.x+Math.cos(a)*lump,py2=p.y+Math.sin(a)*lump;i===0?ctx.moveTo(px2,py2):ctx.lineTo(px2,py2);}
        ctx.closePath();ctx.fillStyle=p.col;ctx.fill();ctx.strokeStyle="#660066";ctx.lineWidth=2.5;ctx.stroke();
        if(p.nextSpawn>0){const prog=Math.min(1,1-((p.nextSpawn-now)/p.spawnInt));ctx.beginPath();ctx.arc(p.x,p.y,p.r+6+prog*18,0,Math.PI*2);ctx.strokeStyle=`rgba(120,0,120,${0.2+prog*0.25})`;ctx.lineWidth=1.5;ctx.stroke();}
      } else if(isCancer){
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.fill();
        const spk=p.type==="leukemia"?5:9;ctx.strokeStyle=p.col+"cc";ctx.lineWidth=1.5;
        for(let i=0;i<spk;i++){const baseA=i/spk*Math.PI*2,wobble=0.38*Math.sin(now/270+i*1.8+p.id*0.45),a=baseA+wobble,len=3+5*Math.abs(Math.sin(i*2.4+now/620));ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r);ctx.lineTo(p.x+Math.cos(a)*(p.r+len),p.y+Math.sin(a)*(p.r+len));ctx.stroke();}
        if(p.splits){const rp=(Math.sin(now/380)+1)/2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+4+rp*4,0,Math.PI*2);ctx.strokeStyle=`rgba(200,0,50,${0.3+rp*0.2})`;ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);}
      } else {
        // Draw by category: bacteria = pill, fungi = spore ring, parasite = segmented, virus = spike
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.fill();
        const cat=p.cat;
        ctx.strokeStyle=p.col+"cc";ctx.lineWidth=1.5;
        if(cat==="virus"){
          const spk=p.r>12?8:6;
          for(let i=0;i<spk;i++){const a=i/spk*Math.PI*2+spin*(p.r>15?0.4:0.9);ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r);ctx.lineTo(p.x+Math.cos(a)*(p.r+5),p.y+Math.sin(a)*(p.r+5));ctx.stroke();}
        } else if(cat==="bacteria"){
          // dashed ring to suggest cell wall
          ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+3,0,Math.PI*2);ctx.strokeStyle=p.col+"88";ctx.stroke();ctx.setLineDash([]);
          // flagella
          const fl=2+Math.floor(p.r/6);
          for(let i=0;i<fl;i++){
            const a=i/fl*Math.PI*2+spin*0.6;
            ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r);
            ctx.quadraticCurveTo(p.x+Math.cos(a+0.8)*(p.r+10),p.y+Math.sin(a+0.8)*(p.r+10),p.x+Math.cos(a+1.4)*(p.r+14),p.y+Math.sin(a+1.4)*(p.r+14));
            ctx.strokeStyle=p.col+"66";ctx.lineWidth=1;ctx.stroke();
          }
        } else if(cat==="fungi"){
          // spore bumps around edge
          const bumps=8;
          for(let i=0;i<bumps;i++){
            const a=i/bumps*Math.PI*2;
            const bx=p.x+Math.cos(a)*(p.r+3),by=p.y+Math.sin(a)*(p.r+3);
            ctx.beginPath();ctx.arc(bx,by,2.5,0,Math.PI*2);ctx.fillStyle=p.col+"99";ctx.fill();
          }
        } else if(cat==="parasite"){
          // segmented look
          const segs=4;
          for(let i=0;i<segs;i++){
            const a=i/segs*Math.PI*2+spin*0.4;
            ctx.beginPath();ctx.arc(p.x+Math.cos(a)*(p.r*0.55),p.y+Math.sin(a)*(p.r*0.55),p.r*0.35,0,Math.PI*2);
            ctx.fillStyle=p.col+"55";ctx.fill();
          }
        }
      }
      const phr=p.hp/p.maxHp;
      ctx.fillStyle="#1005";ctx.fillRect(p.x-p.r,p.y-p.r-5,p.r*2,3);
      ctx.fillStyle=isCancer?"#CC0033":p.col;ctx.fillRect(p.x-p.r,p.y-p.r-5,p.r*2*phr,3);
    }

    for(const pj of g.projs){
      const pg2=ctx.createRadialGradient(pj.x,pj.y,0,pj.x,pj.y,7);pg2.addColorStop(0,pj.col+"bb");pg2.addColorStop(1,"transparent");
      ctx.fillStyle=pg2;ctx.beginPath();ctx.arc(pj.x,pj.y,7,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(pj.x,pj.y,3,0,Math.PI*2);ctx.fillStyle=pj.col;ctx.fill();
    }
    for(const p of g.parts){const a=Math.max(0,p.life/0.7);ctx.beginPath();ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);ctx.fillStyle=p.col+Math.floor(a*200).toString(16).padStart(2,"0");ctx.fill();}
  };

  // ─── GAME LOOP ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(screen!=="game")return;
    const canvas=cvsRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");let last=performance.now();
    const loop=now=>{
      const dt=Math.min((now-last)/1000,0.05);last=now;
      update(dt,now);draw(ctx,now);
      const g=gRef.current;
      if(g){
        fRef.current++;
        if(fRef.current%4===0){
          const ld=getLevData(g,g.lvl);
          setUi({hp:Math.ceil(g.bodyHp),maxHp:g.maxHp,energy:Math.floor(g.energy),cells:g.cells.length,lvl:g.lvl,wave:g.wave,totalWaves:g.totalWaves,score:g.score,phase:g.phase,countdown:Math.ceil(g.countdown/1000),isBonus:g.isBonus,levName:ld?.name||""});
        }
        if(g.phase==="gameOver"){
          if(!g.adminRun){const e={score:g.score,lvl:(g.lvl+1),isBonus:g.isBonus,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()};saveScore(e).then(setLb);}
          setScreen("gameOver");scrRef.current="gameOver";return;
        }
        if(g.phase==="levelDone"){
          const levData=getLevData(g,g.lvl);
          g.energy=Math.min(ECAP,g.energy+levData.bonus);
          const nextLvl=g.lvl+1;
          if(!g.isBonus&&nextLvl>=LEVEL_TEMPLATES.length){
            if(!g.adminRun){saveScore({score:g.score,lvl:10,completed:true,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()}).then(setLb);}
            setScreen("bonusUnlock");scrRef.current="bonusUnlock";return;
          }
          if(g.isBonus&&nextLvl>=BONUS_LEVELS.length){
            SFX.play("victory");
            if(!g.adminRun){saveScore({score:g.score,lvl:10,bonusCompleted:true,gender:chr.gender,age:chr.age,date:new Date().toLocaleDateString()}).then(setLb);}
            setScreen("bonusVictory");scrRef.current="bonusVictory";return;
          }
          const nextLevData=getLevData(g,nextLvl);
          g.lvl=nextLvl;g.wave=0;g.totalWaves=nextLevData.waves;g.phase="waveIdle";g.wideStart=null;g.pathogens=[];g.projs=[];
          setBriefing({lvl:nextLvl,isBonus:g.isBonus});scrRef.current="briefing";setScreen("briefing");return;
        }
      }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[screen]);

  const startPlay=()=>{scrRef.current="game";setScreen("game");};
  const showMsg=(text,color="#EF9A9A")=>{setPlaceMsg({text,color});setTimeout(()=>setPlaceMsg(null),1400);};

  const handleClick=e=>{
    const g=gRef.current;if(!g||scrRef.current!=="game")return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(CW/rect.width),y=(e.clientY-rect.top)*(CH/rect.height);
    const type=selRef.current,def=CELLS[type];
    if(g.cells.length>=MAX_C){showMsg("No cell slots left");return;}
    if(g.energy<def.cost){showMsg(`Need ${def.cost}E (have ${Math.floor(g.energy)}E)`);return;}
    if(Math.hypot(x-CX,y-CY)<CR+def.r+8){showMsg("Too close to the core");return;}
    for(const c of g.cells)if(Math.hypot(x-c.x,y-c.y)<def.r+CELLS[c.type].r){showMsg("Too close to another cell");return;}
    g.energy-=def.cost;g.cells.push({id:uid(),type,x,y,hp:def.maxHp,maxHp:def.maxHp,cd:0});SFX.play("place");
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

  // ─── TITLE ───────────────────────────────────────────────────────────────────
  if(screen==="title")return(
    <div style={{minHeight:"100vh",background:"#030c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#fff",position:"relative",overflow:"hidden",padding:24}}>
      <FloatingBg/>
      <div style={{zIndex:1,textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:8,color:"#80DEEA",marginBottom:14}}>DEFEND THE HUMAN BODY</div>
        <div style={{fontSize:62,fontWeight:900,letterSpacing:4,lineHeight:1,background:"linear-gradient(135deg,#00E5FF,#7B1FA2,#EF5350)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>IMMUNOWAR</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:10,marginBottom:16,letterSpacing:3}}>10 LEVELS + BONUS CANCER ROUND — ROTATING CAST</div>
        {/* Legend */}
        <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:36,flexWrap:"wrap"}}>
          {Object.entries(CAT_META).filter(([k])=>k!=="cancer").map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:9,color:v.col,letterSpacing:2}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:v.col}}/>
              {v.label}
            </div>
          ))}
        </div>
        <button onClick={()=>setScreen("character")} style={BS("linear-gradient(135deg,#00B0D8,#7B1FA2)")}>DEPLOY IMMUNE SYSTEM</button>
        {adminMode&&(
          <div style={{marginTop:28,padding:"16px 20px",background:"rgba(255,100,0,0.08)",border:"1px solid rgba(255,100,0,0.3)",borderRadius:8,maxWidth:500}}>
            <div style={{fontSize:9,letterSpacing:4,color:"#FF9800",marginBottom:10}}>ADMIN MODE — LEVEL SELECT</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",marginBottom:6,letterSpacing:2}}>MAIN LEVELS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",marginBottom:10}}>
              {LEVEL_TEMPLATES.map((_,i)=><button key={i} onClick={()=>jumpToLevel(i,false)} style={{padding:"4px 9px",fontSize:9,fontWeight:"bold",background:"rgba(0,150,200,0.15)",border:"1px solid rgba(0,150,200,0.3)",borderRadius:3,color:"#80DEEA",cursor:"pointer",fontFamily:"monospace"}}>L{i+1}</button>)}
            </div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.45)",marginBottom:6,letterSpacing:2}}>CANCER STAGES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",marginBottom:10}}>
              {BONUS_LEVELS.map((_,i)=><button key={i} onClick={()=>jumpToLevel(i,true)} style={{padding:"4px 9px",fontSize:9,fontWeight:"bold",background:"rgba(139,0,0,0.2)",border:"1px solid rgba(200,0,50,0.35)",borderRadius:3,color:"#FF6B6B",cursor:"pointer",fontFamily:"monospace"}}>C{i+1}</button>)}
            </div>
            <button onClick={()=>setAdminMode(false)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontFamily:"monospace",fontSize:9}}>CLOSE ADMIN</button>
          </div>
        )}
        {!adminMode&&<div style={{marginTop:14,fontSize:8,color:"rgba(255,255,255,0.12)",letterSpacing:1}}>type "admin" to unlock dev mode</div>}
      </div>
    </div>
  );

  // ─── CHARACTER ───────────────────────────────────────────────────────────────
  if(screen==="character"){
    const mods=getMods(chr);
    return(
      <div style={{minHeight:"100vh",background:"#030c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#80DEEA",marginBottom:8}}>MISSION CONFIGURATION</div>
        <h2 style={{fontSize:26,margin:"0 0 28px",letterSpacing:3,color:"#fff"}}>CHOOSE YOUR HOST</h2>
        <div style={{marginBottom:22,textAlign:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.55)",marginBottom:10}}>BIOLOGICAL SEX</div>
          <div style={{display:"flex",gap:14}}>
            {[["female","FEMALE","+15% B-Cell damage"],["male","MALE","+15% T-Cell damage"]].map(([v,l,t])=>(
              <button key={v} onClick={()=>setChr(c=>({...c,gender:v}))} style={{padding:"11px 26px",border:`2px solid ${chr.gender===v?"#00E5FF":"rgba(255,255,255,0.18)"}`,background:chr.gender===v?"rgba(0,229,255,0.1)":"transparent",borderRadius:6,color:"#e8f4f8",cursor:"pointer",fontFamily:"monospace"}}>
                <div style={{fontSize:14,fontWeight:"bold",marginBottom:4}}>{l}</div>
                <div style={{fontSize:9,color:"#80DEEA"}}>{t}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:26,textAlign:"center"}}>
          <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.55)",marginBottom:10}}>AGE GROUP</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
            {[["child","CHILD","High energy regen\nLow HP (80)"],["young","YOUNG ADULT","Balanced\nRecommended"],["adult","ADULT","High HP (120)\nSlower regen"],["senior","SENIOR","Low HP (75)\nImmune memory"]].map(([v,l,t])=>(
              <button key={v} onClick={()=>setChr(c=>({...c,age:v}))} style={{padding:"9px 14px",border:`2px solid ${chr.age===v?"#AB47BC":"rgba(255,255,255,0.18)"}`,background:chr.age===v?"rgba(171,71,188,0.1)":"transparent",borderRadius:6,color:"#e8f4f8",cursor:"pointer",fontFamily:"monospace",minWidth:115}}>
                <div style={{fontSize:12,fontWeight:"bold",marginBottom:3}}>{l}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",whiteSpace:"pre-line"}}>{t}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:22,marginBottom:28,padding:"12px 26px",background:"rgba(255,255,255,0.05)",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",fontSize:10}}>
          {[["MAX HP",mods.maxHp,"#EF9A9A"],["START ENERGY",mods.eStart,"#FFE082"],["REGEN/s",mods.eRegen.toFixed(1),"#A5D6A7"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.6)",marginBottom:3}}>{l}</div><div style={{fontSize:21,fontWeight:"bold",color:c}}>{v}</div></div>
          ))}
          {mods.atkMult!==1&&<div style={{textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.6)",marginBottom:3}}>ATK POWER</div><div style={{fontSize:21,fontWeight:"bold",color:"#FFCC80"}}>{Math.round(mods.atkMult*100)}%</div></div>}
        </div>
        <button onClick={()=>initGame(chr)} style={BS("linear-gradient(135deg,#00B0D8,#7B1FA2)")}>BEGIN MISSION</button>
        <button onClick={()=>setScreen("title")} style={{marginTop:12,background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"monospace",fontSize:10}}>BACK</button>
      </div>
    );
  }

  // ─── BRIEFING ────────────────────────────────────────────────────────────────
  if(screen==="briefing"&&briefing!==null){
    const g=gRef.current;
    const levData=g?getLevData(g,briefing.lvl):(briefing.isBonus?BONUS_LEVELS[briefing.lvl]:null);
    if(!levData)return null;
    const enemies=getBriefingEnemies(levData);
    const acCol=briefing.isBonus?"#FF6B6B":"#80DEEA";
    return(
      <div style={{minHeight:"100vh",background:briefing.isBonus?"#0d0004":"#020c18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:"24px 16px"}}>
        <div style={{fontSize:9,letterSpacing:6,color:acCol,marginBottom:6}}>{briefing.isBonus?"CANCER STAGE BRIEFING":"INCOMING THREAT REPORT"}</div>
        <h2 style={{fontSize:28,margin:"0 0 4px",letterSpacing:3,color:"#fff"}}>{briefing.isBonus?`Cancer Stage ${briefing.lvl+1}`:`Level ${briefing.lvl+1}`}: {levData.name}</h2>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",marginBottom:20}}>{levData.waves} waves incoming</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:560,width:"100%",marginBottom:20}}>
          {enemies.map(e=>{
            const cm=CAT_META[e.cat]||CAT_META.virus;
            return(
              <div key={e.type} style={{display:"flex",gap:14,padding:"13px 16px",background:"rgba(255,255,255,0.04)",borderRadius:8,border:`1px solid ${e.col}35`,alignItems:"flex-start"}}>
                <div style={{flexShrink:0,width:44,height:44,borderRadius:"50%",background:e.col+"22",border:`2px solid ${e.col}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{e.icon||"🦠"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:"bold",color:e.col}}>{e.name}</span>
                    <span style={{fontSize:7,letterSpacing:2,color:cm.col,background:cm.bg,padding:"2px 6px",borderRadius:3}}>{cm.label}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.78)",lineHeight:1.65}}>{e.fact}</div>
                  <div style={{display:"flex",gap:12,marginTop:6,fontSize:9,color:"rgba(255,255,255,0.5)"}}>
                    <span>HP: {e.hp}</span><span>SPD: {e.spd.toFixed(2)}</span><span>DMG: {e.dmg}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {levData.tip&&(
          <div style={{maxWidth:560,width:"100%",padding:"10px 16px",background:"rgba(255,220,100,0.06)",border:"1px solid rgba(255,220,100,0.2)",borderRadius:6,marginBottom:20,fontSize:11,color:"rgba(255,235,180,0.9)",lineHeight:1.6}}>
            <span style={{color:"#FFE082",fontWeight:"bold"}}>STRATEGY: </span>{levData.tip}
          </div>
        )}
        <button onClick={startPlay} style={BS(briefing.isBonus?"linear-gradient(135deg,#8B0000,#3D0040)":"linear-gradient(135deg,#00B0D8,#7B1FA2)")}>
          {briefing.lvl===0&&!briefing.isBonus?"DEPLOY NOW":"START"}
        </button>
        {briefing.lvl>0&&!checkpointUsed&&(
          <div style={{marginTop:12,textAlign:"center"}}>
            {checkpoint?.lvl===briefing.lvl&&checkpoint?.isBonus===briefing.isBonus
              ?<div style={{fontSize:10,color:"#FFE082",fontFamily:"monospace",letterSpacing:2}}>CHECKPOINT SET HERE</div>
              :<button onClick={()=>setCheckpoint({lvl:briefing.lvl,isBonus:briefing.isBonus})} style={{background:"transparent",border:"1px dashed rgba(255,220,100,0.4)",borderRadius:4,color:"rgba(255,220,100,0.7)",fontSize:10,letterSpacing:2,padding:"7px 18px",cursor:"pointer",fontFamily:"monospace"}}>
                {checkpoint?`MOVE CHECKPOINT HERE (currently L${checkpoint.lvl})`:"SET CHECKPOINT HERE (once per run)"}
              </button>
            }
          </div>
        )}
      </div>
    );
  }

  // ─── GAME ────────────────────────────────────────────────────────────────────
  if(screen==="game"){
    const g=gRef.current;
    const hpP=ui.hp/ui.maxHp,eP=ui.energy/ECAP,cellsLeft=MAX_C-ui.cells;
    const pMsg=ui.phase==="waveIdle"?`NEXT WAVE IN ${ui.countdown}s`:ui.phase==="spawning"?"INCOMING":"FIGHTING";
    const pCol=ui.phase==="waveIdle"?"#FFE082":ui.phase==="fighting"?"#EF9A9A":"#A5D6A7";
    return(
      <div style={{background:ui.isBonus?"#120005":"#020b16",minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"monospace",color:"#e8f4f8"}}>
        <div style={{padding:"6px 14px",background:"rgba(0,0,0,0.5)",borderBottom:`1px solid ${ui.isBonus?"rgba(200,0,50,0.2)":"rgba(0,200,255,0.08)"}`,display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
          {ui.isBonus?<span style={{fontSize:10,color:"#FF6B6B",letterSpacing:2,fontWeight:"bold"}}>CANCER STAGE {ui.lvl+1} — {ui.levName}</span>:<span style={{fontSize:10,color:"#80DEEA",letterSpacing:2}}>LVL {ui.lvl+1}/10 — {ui.levName}</span>}
          <span style={{fontSize:10,color:"rgba(255,255,255,0.65)"}}>WAVE {ui.wave}/{ui.totalWaves}</span>
          <span style={{fontSize:10,color:pCol}}>{pMsg}</span>
          <span style={{marginLeft:"auto",display:"flex",gap:16,alignItems:"center"}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>SCORE <span style={{color:"#fff",fontWeight:"bold"}}>{ui.score.toLocaleString()}</span></span>
            {g?.adminRun&&<span style={{fontSize:8,color:"#FF9800",letterSpacing:1}}>ADMIN</span>}
            <button onClick={toggleSfx} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:3,color:sfxOn?"#80DEEA":"rgba(255,255,255,0.4)",fontSize:8,letterSpacing:2,padding:"2px 7px",cursor:"pointer",fontFamily:"monospace"}}>{sfxOn?"SFX ON":"SFX OFF"}</button>
          </span>
        </div>
        <div style={{display:"flex",flex:1}}>
          <div style={{flex:1,position:"relative"}}>
            <canvas ref={cvsRef} width={CW} height={CH} style={{display:"block",width:"100%",height:"auto",cursor:"crosshair"}} onClick={handleClick} onMouseMove={handleMM} onMouseLeave={()=>{mRef.current={x:-999,y:-999};}}/>
            {placeMsg&&<div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.78)",border:`1px solid ${placeMsg.color}55`,borderRadius:5,padding:"6px 18px",fontSize:11,color:placeMsg.color,fontFamily:"monospace",letterSpacing:1,pointerEvents:"none",whiteSpace:"nowrap"}}>{placeMsg.text}</div>}
          </div>
          <div style={{width:214,background:"rgba(0,0,0,0.55)",borderLeft:`1px solid ${ui.isBonus?"rgba(200,0,50,0.1)":"rgba(0,200,255,0.07)"}`,padding:13,display:"flex",flexDirection:"column",gap:11,overflowY:"auto"}}>
            <div>
              <div style={{fontSize:8,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:4}}>BODY HEALTH</div>
              <div style={{background:"rgba(255,255,255,0.1)",borderRadius:3,height:9}}>
                <div style={{width:`${hpP*100}%`,height:"100%",borderRadius:3,transition:"width 0.2s",background:hpP>0.5?"#81C784":hpP>0.25?"#FFD54F":"#EF5350"}}/>
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:2}}>{ui.hp}/{ui.maxHp}</div>
            </div>
            <div>
              <div style={{fontSize:8,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:4}}>ENERGY</div>
              <div style={{background:"rgba(255,255,255,0.1)",borderRadius:3,height:9}}>
                <div style={{width:`${eP*100}%`,height:"100%",borderRadius:3,background:"#FFD54F",transition:"width 0.1s"}}/>
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:2}}>{ui.energy}/{ECAP}</div>
            </div>
            <div style={{padding:"9px 11px",background:"rgba(255,255,255,0.05)",borderRadius:6,border:"1px solid rgba(255,255,255,0.12)"}}>
              <div style={{fontSize:8,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:6}}>CELL SLOTS</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
                <span style={{fontSize:26,fontWeight:"bold",color:cellsLeft===0?"#EF5350":cellsLeft<=3?"#FFD54F":"#80DEEA",lineHeight:1}}>{cellsLeft}</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>of {MAX_C} remaining</span>
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {Array.from({length:MAX_C}).map((_,i)=>(
                  <div key={i} style={{width:9,height:9,borderRadius:2,background:i<ui.cells?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.55)",border:"1px solid rgba(255,255,255,0.18)"}}/>
                ))}
              </div>
            </div>
            <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:10}}>
              <div style={{fontSize:8,letterSpacing:3,color:"rgba(255,255,255,0.55)",marginBottom:8}}>DEPLOY CELL</div>
              {Object.entries(CELLS).map(([type,def])=>{
                const canA=ui.energy>=def.cost,isSel=sel===type;
                return(
                  <button key={type} onClick={()=>setSel(type)} style={{width:"100%",marginBottom:7,padding:"7px 9px",textAlign:"left",border:`2px solid ${isSel?def.col:"rgba(255,255,255,0.12)"}`,background:isSel?`${def.col}18`:"rgba(255,255,255,0.02)",borderRadius:5,color:canA?"#e8f4f8":"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:"monospace"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:10,fontWeight:"bold",color:def.col}}>{def.name}</span>
                      <span style={{fontSize:9,color:canA?"#FFE082":"rgba(255,255,255,0.35)"}}>{def.cost}E</span>
                    </div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{def.desc}</div>
                    <div style={{fontSize:7,color:"rgba(255,255,255,0.4)"}}>HP:{def.maxHp} DMG:{def.dmg} RNG:{def.range}</div>
                  </button>
                );
              })}
            </div>
            {/* Color legend */}
            <div style={{padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:5,border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(255,255,255,0.4)",marginBottom:6}}>ENEMY TYPES</div>
              {Object.entries(CAT_META).filter(([k])=>k!=="cancer").map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:v.col,flexShrink:0}}/>
                  <span style={{fontSize:8,color:v.col}}>{v.label}</span>
                </div>
              ))}
            </div>
            {ui.isBonus&&<div style={{padding:"8px 10px",background:"rgba(139,0,0,0.2)",borderRadius:5,border:"1px solid rgba(200,0,50,0.25)",fontSize:8,color:"rgba(255,170,170,0.85)",lineHeight:1.7}}>Cancer cells split on death. Tumors spawn reinforcements.</div>}
            <div style={{marginTop:"auto",fontSize:7,color:"rgba(255,255,255,0.38)",lineHeight:1.8}}>Click arena to place.<br/>Keys: N M T B</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── BONUS UNLOCK ────────────────────────────────────────────────────────────
  if(screen==="bonusUnlock")return(
    <div style={{minHeight:"100vh",background:"#0d0005",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
      <div style={{fontSize:10,letterSpacing:6,color:"#A5D6A7",marginBottom:12}}>10 LEVELS CLEARED</div>
      <h2 style={{fontSize:42,margin:"0 0 6px",color:"#81C784",letterSpacing:3}}>IMMUNITY ACHIEVED</h2>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:40}}>Viruses, bacteria, fungi, parasites: defeated.</div>
      <div style={{padding:"20px 32px",background:"rgba(139,0,0,0.15)",borderRadius:8,border:"1px solid rgba(200,0,50,0.3)",marginBottom:36,textAlign:"center",maxWidth:420}}>
        <div style={{fontSize:11,letterSpacing:4,color:"#FF6B6B",marginBottom:10}}>NEW THREAT DETECTED</div>
        <div style={{fontSize:22,fontWeight:"bold",color:"#fff",marginBottom:8}}>CANCER CELLS</div>
        <div style={{fontSize:11,color:"rgba(255,210,210,0.8)",lineHeight:1.7}}>5 bonus stages of mutated cancer cells.<br/>They split on death. Tumors spawn reinforcements.<br/>+60 energy granted.</div>
      </div>
      <div style={{display:"flex",gap:14}}>
        <button onClick={startBonus} style={BS("linear-gradient(135deg,#8B0000,#3D0040)")}>ACCEPT CHALLENGE</button>
        <button onClick={()=>{SFX.play("victory");setScreen("victory");scrRef.current="victory";}} style={{padding:"12px 28px",fontSize:12,fontWeight:700,letterSpacing:2,background:"transparent",border:"1px solid rgba(255,255,255,0.22)",borderRadius:4,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"monospace"}}>CLAIM VICTORY</button>
      </div>
    </div>
  );

  // ─── GAME OVER ───────────────────────────────────────────────────────────────
  if(screen==="gameOver"){
    const g=gRef.current;
    const canRespawn=checkpoint&&!checkpointUsed;
    return(
      <div style={{minHeight:"100vh",background:"#130208",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#EF9A9A",marginBottom:8}}>IMMUNE SYSTEM OVERWHELMED</div>
        <h2 style={{fontSize:50,margin:"0 0 8px",color:"#EF5350",letterSpacing:3}}>INFECTED</h2>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4}}>{g?.isBonus?`Cancer Stage ${(g?.lvl??0)+1}`:`Level ${(g?.lvl??0)+1}`} — Wave {g?.wave??0}</div>
        <div style={{fontSize:20,color:"#FFE082",marginBottom:canRespawn?14:20}}>
          Score: {(g?.score??0).toLocaleString()}
          {g?.adminRun&&<span style={{fontSize:10,color:"rgba(255,150,50,0.7)",marginLeft:10,letterSpacing:2}}>ADMIN RUN — NOT SAVED</span>}
        </div>
        {canRespawn&&(
          <div style={{marginBottom:18,padding:"14px 24px",background:"rgba(255,220,100,0.07)",border:"1px solid rgba(255,220,100,0.25)",borderRadius:8,textAlign:"center"}}>
            <div style={{fontSize:9,color:"rgba(255,220,100,0.6)",letterSpacing:3,marginBottom:8}}>IMMUNITY CHECKPOINT AVAILABLE</div>
            <button onClick={respawnAtCheckpoint} style={{...BS("linear-gradient(135deg,#B8860B,#8B6914)"),padding:"10px 28px",fontSize:12}}>RESPAWN AT LEVEL {checkpoint.lvl+1}{checkpoint.isBonus?" (Cancer)":""}</button>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:8}}>65% HP · full energy · one use only</div>
          </div>
        )}
        <div style={{marginBottom:20,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score}/></div>
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>{scrRef.current="character";setScreen("character");}} style={BS("linear-gradient(135deg,#D32F2F,#7B1FA2)")}>TRY AGAIN</button>
          <button onClick={()=>{scrRef.current="title";setScreen("title");}} style={{padding:"12px 28px",fontSize:12,fontWeight:700,letterSpacing:2,background:"transparent",border:"1px solid rgba(255,255,255,0.22)",borderRadius:4,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"monospace"}}>MAIN MENU</button>
        </div>
      </div>
    );
  }

  // ─── VICTORY ─────────────────────────────────────────────────────────────────
  if(screen==="victory"){
    const g=gRef.current;
    return(
      <div style={{minHeight:"100vh",background:"#011208",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",padding:24}}>
        <div style={{fontSize:10,letterSpacing:6,color:"#A5D6A7",marginBottom:8}}>ALL PATHOGENS ELIMINATED</div>
        <h2 style={{fontSize:50,margin:"0 0 8px",color:"#81C784",letterSpacing:3}}>IMMUNITY</h2>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:4}}>10 Levels Cleared.</div>
        <div style={{fontSize:20,color:"#FFE082",marginBottom:24}}>Score: {(g?.score??0).toLocaleString()}</div>
        <div style={{marginBottom:24,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score}/></div>
        <button onClick={()=>{scrRef.current="title";setScreen("title");}} style={BS("linear-gradient(135deg,#00B0D8,#66BB6A)")}>PLAY AGAIN</button>
      </div>
    );
  }

  // ─── BONUS VICTORY ───────────────────────────────────────────────────────────
  if(screen==="bonusVictory"){
    const g=gRef.current;
    return(
      <div style={{minHeight:"100vh",background:"#04100a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#e8f4f8",position:"relative",overflow:"hidden",padding:24}}>
        <CancerVictoryArt/>
        <div style={{zIndex:1,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",maxWidth:520}}>
          <div style={{fontSize:9,letterSpacing:6,color:"#81C784",marginBottom:16}}>BONUS STAGE COMPLETE</div>
          <div style={{fontSize:52,fontWeight:900,letterSpacing:4,lineHeight:1.05,background:"linear-gradient(135deg,#A5D6A7,#FFE082,#80DEEA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:12}}>
            THE BODY<br/>PREVAILED
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.8,marginBottom:8}}>
            All cancer cells eliminated. All tumors destroyed.
          </div>
          <div style={{fontSize:11,color:"rgba(200,230,200,0.55)",lineHeight:1.75,marginBottom:28,padding:"14px 20px",background:"rgba(129,199,132,0.05)",border:"1px solid rgba(129,199,132,0.12)",borderRadius:8}}>
            In real life, this battle happens in your body every day.<br/>
            The immune system destroys thousands of cancerous cells<br/>
            before they can form tumors — silently, without you ever knowing.
          </div>
          <div style={{fontSize:20,color:"#FFE082",marginBottom:24}}>Final Score: {(g?.score??0).toLocaleString()}</div>
          <div style={{marginBottom:28,width:"100%",maxWidth:480}}><Leaderboard scores={lb} currentScore={g?.score}/></div>
          <button onClick={()=>{scrRef.current="title";setScreen("title");}} style={BS("linear-gradient(135deg,#388E3C,#00B0D8)")}>PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── LEADERBOARD COMPONENT ────────────────────────────────────────────────────
function Leaderboard({scores,currentScore}){
  if(!scores.length)return<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",textAlign:"center",padding:"12px 0"}}>No scores yet. You're the first!</div>;
  const medals=["🥇","🥈","🥉"];
  return(
    <div style={{width:"100%"}}>
      <div style={{fontSize:9,letterSpacing:4,color:"rgba(255,255,255,0.4)",marginBottom:8,fontFamily:"monospace",textAlign:"center"}}>LEADERBOARD</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {scores.map((s,i)=>{
          const isCur=currentScore&&s.score===currentScore&&i===scores.findIndex(x=>x.score===currentScore);
          return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:isCur?"rgba(255,220,100,0.08)":"rgba(255,255,255,0.03)",borderRadius:5,border:`1px solid ${isCur?"rgba(255,220,100,0.25)":"rgba(255,255,255,0.07)"}`,fontFamily:"monospace"}}>
              <span style={{fontSize:13,width:20,textAlign:"center"}}>{i<3?medals[i]:<span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{i+1}</span>}</span>
              <span style={{fontSize:13,fontWeight:"bold",color:"#FFE082",minWidth:65}}>{s.score.toLocaleString()}</span>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.55)",flex:1}}>Lvl {s.lvl}{s.bonusCompleted?" + Cancer":s.isBonus?" (bonus)":""} · {s.gender} {s.age}</span>
              {s.completed&&<span style={{fontSize:7,color:"#81C784",letterSpacing:1}}>CLEARED</span>}
              <span style={{fontSize:8,color:"rgba(255,255,255,0.28)"}}>{s.date}</span>
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

    // Rising particles — green/gold/teal, gentle upward drift
    const pts=Array.from({length:55},()=>({
      x:Math.random()*window.innerWidth,
      y:window.innerHeight+Math.random()*200,
      r:2+Math.random()*6,
      vx:(Math.random()-0.5)*0.5,
      vy:-(0.3+Math.random()*0.8),
      col:["#81C784","#A5D6A7","#FFE082","#FFD54F","#80DEEA","#4DB6AC"][Math.floor(Math.random()*6)],
      ph:Math.random()*Math.PI*2,
      wobble:0.2+Math.random()*0.4,
    }));

    // Ribbon strands — slow diagonal arcs
    const strands=Array.from({length:6},(_,i)=>({
      x:window.innerWidth*0.1+i*(window.innerWidth*0.16),
      phase:i*1.1,
      col:["#81C784","#FFE082","#80DEEA","#A5D6A7","#FFD54F","#4DB6AC"][i],
      spd:0.0005+i*0.0002,
    }));

    let raf,t=0;
    const loop=()=>{
      t++;
      ctx.clearRect(0,0,cv.width,cv.height);

      // Draw gentle ribbon waves
      for(const s of strands){
        ctx.beginPath();
        for(let x=0;x<cv.width;x+=4){
          const y=cv.height*0.5+Math.sin(x*0.008+s.phase+t*s.spd*60)*cv.height*0.22+Math.sin(x*0.015+t*s.spd*40)*cv.height*0.08;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.strokeStyle=s.col+"18";ctx.lineWidth=2;ctx.stroke();
      }

      // Rising particles
      for(const p of pts){
        p.x+=p.vx+Math.sin(t*0.02+p.ph)*p.wobble;
        p.y+=p.vy;
        if(p.y<-20){p.y=cv.height+10;p.x=Math.random()*cv.width;}
        const fade=Math.max(0,Math.min(1,(cv.height-p.y)/(cv.height*0.7)));
        const g2=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.2);
        g2.addColorStop(0,p.col+Math.floor(fade*200).toString(16).padStart(2,"0"));
        g2.addColorStop(1,"transparent");
        ctx.fillStyle=g2;ctx.beginPath();ctx.arc(p.x,p.y,p.r*2.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(p.x,p.y,p.r*fade,0,Math.PI*2);
        ctx.fillStyle=p.col+Math.floor(fade*180).toString(16).padStart(2,"0");ctx.fill();
      }

      // Soft central glow — the healthy body core
      const cx2=cv.width/2,cy2=cv.height/2;
      const pulse=(Math.sin(t*0.04)+1)/2;
      const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cv.width*0.38);
      cg.addColorStop(0,`rgba(129,199,132,${0.06+pulse*0.04})`);
      cg.addColorStop(0.5,`rgba(77,182,172,${0.03+pulse*0.02})`);
      cg.addColorStop(1,"transparent");
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx2,cy2,cv.width*0.38,0,Math.PI*2);ctx.fill();

      // Ribbon/awareness symbol — simplified loop at top center
      const rx=cx2,ry=90,rs=28;
      const drawRibbon=()=>{
        ctx.save();ctx.translate(rx,ry);
        const rc=`rgba(129,199,132,${0.55+pulse*0.2})`;
        ctx.strokeStyle=rc;ctx.lineWidth=4;ctx.lineCap="round";
        // Left loop
        ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.bezierCurveTo(-rs,rs*0.6,-rs*1.4,-rs*0.5,-rs*0.15,-rs*1.1);ctx.bezierCurveTo(0,-rs*1.6,rs*0.15,-rs*1.1,0,-rs*0.4);ctx.stroke();
        // Right loop
        ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.bezierCurveTo(rs,rs*0.6,rs*1.4,-rs*0.5,rs*0.15,-rs*1.1);ctx.bezierCurveTo(0,-rs*1.6,-rs*0.15,-rs*1.1,0,-rs*0.4);ctx.stroke();
        // Tails
        ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.lineTo(-rs*0.5,rs*1.5);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,rs*0.6);ctx.lineTo(rs*0.5,rs*1.5);ctx.stroke();
        ctx.restore();
      };
      drawRibbon();

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
    const cols=cancer?["#8B0000","#CC0044","#3D0040","#AA0020","#660033"]:["#26C6DA","#66BB6A","#FFA726","#AB47BC","#EF5350","#8B4513","#00BCD4","#AB47BC"];
    const its=Array.from({length:24},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:5+Math.random()*20,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,col:cols[Math.floor(Math.random()*cols.length)],ph:Math.random()*Math.PI*2}));
    let raf;
    const loop=t=>{
      ctx.clearRect(0,0,cv.width,cv.height);
      for(const it of its){
        it.x+=it.vx;it.y+=it.vy;
        if(it.x<-40)it.x=cv.width+40;if(it.x>cv.width+40)it.x=-40;
        if(it.y<-40)it.y=cv.height+40;if(it.y>cv.height+40)it.y=-40;
        const a=((Math.sin(t/1300+it.ph)+1)/2)*0.12+0.03;
        const g2=ctx.createRadialGradient(it.x,it.y,0,it.x,it.y,it.r*1.5);
        g2.addColorStop(0,it.col+Math.floor(a*255).toString(16).padStart(2,"0"));g2.addColorStop(1,"transparent");
        ctx.fillStyle=g2;ctx.beginPath();ctx.arc(it.x,it.y,it.r*1.5,0,Math.PI*2);ctx.fill();
      }
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return<canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}
