// Allowlisted, immutable public representation. No DOM or answer access here.
(function(global){
 'use strict';
 function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
 function snapshot(raw){
  let sentence=0,clause=0;
  const slots=raw.slots.map((s,i)=>{
   const letters=s.letters.map(l=>({capital:!!l.capital,visible:l.visible===null?null:String(l.visible)}));
   const gaps=s.gaps.map(String),trailing=gaps.at(-1);
   const out={slotId:'slot-'+i,slotIndex:i,length:letters.length,letters,gaps,trailing,solved:!!s.solved,
    revealedPositions:letters.flatMap((l,j)=>l.visible===null?[]:[j]),sentence,clause,
    rejectedGuesses:[...new Set(raw.rejectedWordsBySlot[i]||[])].sort()};
   if(/[.!?]/.test(trailing)){sentence++;clause++;}else if(/[;:]/.test(trailing))clause++;
   return out;
  });
  const spacing=raw.spacing.map(String),rejectedWordsBySlot=Object.fromEntries(slots.map(s=>[s.slotIndex,s.rejectedGuesses]));
  const state={slots:slots.map(({letters,gaps,trailing,solved})=>({letters,gaps,trailing,solved})),spacing,targetSlotIndex:raw.targetSlotIndex,rejectedWordsBySlot};
  const engine=global.GGGHumanPlaytest;
  const key=engine.boardKey(state);
  return freeze({schemaVersion:'public-board-v1',revision:engine.boardId(state),key,slots,spacing,targetSlot:raw.targetSlotIndex,state});
 }
 global.GGGPublicBoard=Object.freeze({snapshot,
  matchesCasePattern:global.GGGHumanPlaytest.matchesCasePattern,
  surfaceForSlot:global.GGGHumanPlaytest.surfaceForSlot});
})(globalThis);
