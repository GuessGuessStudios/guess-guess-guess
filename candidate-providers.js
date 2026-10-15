// Replaceable language competence boundary. Turn code uses only rank/band,
// opportunity/relative priority, choose, revision and revalidation contracts.
(function(global){
 'use strict';
 const engine=global.GGGHumanPlaytest;
 const repair=Object.freeze({version:engine.POLICY.version,rank:engine.rank,choose:engine.choose,
  opportunity:engine.opportunity,noteAttempt:engine.noteAttempt,reset:engine.reset});
 const pilot=global.GGGSituationPilot.create(engine);
 global.GGGCandidateProviders=Object.freeze({Repair4CandidateProvider:repair,SituationPilotCandidateProvider:pilot,
  get:search=>/(?:^\?|&)humanPlaytestMode=1(?:&|$)/.test(search)&&/(?:^\?|&)situationPilot=1(?:&|$)/.test(search)?pilot:repair});
})(globalThis);
