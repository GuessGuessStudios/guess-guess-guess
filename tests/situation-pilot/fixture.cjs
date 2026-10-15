const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {fixture}=require('../human-playtest-fixture.cjs');
const {root}=require('../ai-harness.cjs');
module.exports=async()=>{const f=await fixture();for(const name of ['public-board.js','situation-pilot.js','candidate-providers.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),f.h);f.h.location.search='?humanPlaytestMode=1&situationPilot=1';return {...f,p:f.h.GGGCandidateProviders.SituationPilotCandidateProvider};};
