// Read-only counterfactual replay: same recorded states, sources and settings.
// Usage: node tests/grammar-replay.cjs /path/to/before-game.js [completed-log.json]
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { harness } = require('./ai-harness.cjs');
const { state, score, cases } = require('./grammar-consolidation.test.cjs');
(async () => {
  const before = await harness(process.argv[2]);
  const after = await harness();
  if (!process.argv[3]) {
    for (const [name,text,index,good,bad] of cases) {
      const results=[];
      for (const h of [before,after]) {
        const s=state(h,text,index);
        h.puzzleList=[text.includes('mat')?'puzzles/puzzle-002.json':'puzzles/puzzle-004.json'];
        const pool=await h.buildAiCandidatePool(s.target);
        const d=h.getAiCandidateDistribution(pool,6);
        results.push({
          confidence:s.roles.confidence,profile:s.roles.ranked.slice(0,4),
          scores:Object.fromEntries([...good,...bad].map(w=>[w,score(h,s,w)])),
          candidates:d.filter(x=>[...good,...bad].some(w=>w.toLowerCase()===x.candidate.word.toLowerCase()))
            .map(x=>({word:x.candidate.word,prior:x.candidate.sourcePrior,g:x.grammarWeight,q:x.heuristicProbability,p:x.probability})),
        });
      }
      console.log(JSON.stringify({name,before:results[0],after:results[1]}));
    }
  } else {
    const log=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
    for(const h of [before,after]){
      h.aiLogicSettings=JSON.parse(JSON.stringify(log.settings));
      h.puzzleList=['puzzles/puzzle-'+String(log.session.puzzleNumber).padStart(3,'0')+'.json'];
    }
    let checks=0;
    for(const event of log.events.filter(e=>e.type==='guess'&&e.isAi)){
      const results=[],priors=[];
      for(const h of [before,after]){
        const visible=event.neighboringWordsBefore.map((word,i)=>word?i:-1).filter(i=>i>=0);
        const s=state(h,log.session.puzzleText,event.targetSlot,visible,event.revealedLettersBefore.map(x=>x||'_').join(''));
        const pool=await h.buildAiCandidatePool(s.target);
        priors.push(JSON.stringify(pool.candidates.map(c=>[c.word,c.sources,c.sourcePrior])));
        const d=h.getAiCandidateDistribution(pool,event.decision.guessNumber);
        const info=x=>x?{word:x.candidate.word,prior:x.candidate.sourcePrior,g:x.grammarWeight,q:x.heuristicProbability,p:x.probability}:null;
        results.push({confidence:s.roles.confidence,profile:s.roles.ranked.slice(0,3),
          correct:info(d.find(x=>x.isCorrect)),selected:info(d.find(x=>x.candidate.word.toLowerCase()===event.guessedWord.toLowerCase())),
          top:d.slice().sort((a,b)=>b.heuristicProbability-a.heuristicProbability).slice(0,5).map(info)});
        if(event.result==='incorrect') h.recordWrongAiGuessForSlot(event.targetSlot,event.guessedWord);
      }
      assert.equal(priors[0],priors[1],'candidate eligibility, sources and priors are frozen');
      checks++;
      console.log(JSON.stringify({guess:event.decision.guessNumber,word:event.guessedWord,answer:event.actualAnswer,
        result:event.result,pattern:event.revealedLettersBefore,before:results[0],after:results[1]}));
    }
    console.error('PASS '+checks+' recorded states preserve candidate eligibility, sources and source priors');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
