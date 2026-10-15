const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {harness,root}=require('./ai-harness.cjs');
const {installObservations}=require('./prediction-eval.cjs');
async function fixture(){
 const h=await harness();h.location={search:'?humanPlaytestMode=1'};
 for(const f of ['human-playtest-eligibility.js','human-playtest.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),h);
 await h.GGGHumanPlaytest.loadResources();
 function board(tokens){
  h.clearAiWrongGuessMemory();
  const parsed=tokens.map(t=>{
   const raw=typeof t==='string'?t:t.pattern,gaps=[''],letters=[];
   for(const c of raw)if(/[a-z_]/i.test(c)){letters.push({capital:/[A-Z]/.test(c)||(letters.length===0&&Boolean(t.capital)),visible:c==='_'?'':c});gaps.push('');}else gaps[gaps.length-1]+=c;
   return {letters,gaps,solved:!raw.includes('_'),trailing:gaps.at(-1)};
  });
  installObservations(h,parsed);
  h.groups.forEach((g,i)=>{const bs=g.querySelectorAll(),s=parsed[i];g.children=[];
   bs.forEach((b,j)=>{g.children.push(b);if(j<bs.length-1&&s.gaps[j+1])g.children.push({textContent:s.gaps[j+1],classList:{contains:c=>c==='punct'}});});
  });
  return h.getEligibleAiSlots();
 }
 async function rank(tokens,index){const slots=board(tokens);return h.rankHumanPlaytestPool(await h.buildAiCandidatePool(slots.find(s=>s.slotIndex===index)));}
 function turns(){
  Object.assign(h,{gameStarted:true,isGameOver:false,gameEnded:false,humanHandRaised:false,raisedHandCharacter:null,recognizedResponder:null,
   currentAiTargetSlot:null,currentAiSelectedCandidate:null,currentAiCandidatePool:null,aiTurnState:'waiting',aiTurnTimer:null,recognitionTimer:null,
   teacherMessage:null,humanRaiseHandBtn:null,AI_GUESS_DISPLAY_MS:1500,
   HAND_RAISE_STATES:{OPEN:'open',AI_HAND_PENDING:'pending',ANSWER_LOCKED:'locked'},handRaiseState:'open',
   AI_CHARACTERS:['character1','character2','character3','character4'],AI_CHARACTER_NAMES:{character1:'Misaki',character2:'Aoi',character3:'Taiga',character4:'Sho'}});
  const events=[],timers=[],submitted=[];let scheduled=0;
  h.aiHandIndicators=Object.fromEntries(h.AI_CHARACTERS.map(c=>[c,{hidden:true,classList:{add(){},remove(){}},setAttribute(){}}]));
  h.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};h.clearTimeout=()=>{};
  h.scheduleAiTurn=()=>{scheduled++;};h.emitDiagnosticEvent=(type,detail)=>events.push({type,...detail});
  h.currentAttempt=h.createAttempt();h.renderAttemptPreview=()=>{};h.setActiveManualGuesser=()=>{};
  h.submitGuess=(attempt,word)=>submitted.push({attempt,word});h.resetHandRaiseState();
  return {events,timers,submitted,scheduled:()=>scheduled};
 }
 return {h,e:h.GGGHumanPlaytest,board,rank,turns};
}
module.exports={fixture};
