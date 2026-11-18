'use strict';
// No control imports, tools, evaluation, or mutation. A mock is explicitly not an LLM.
function explain(snapshot,provider='mock') {
  const fallback='Explanation service unavailable. Review recorded readings, rule ratings and detection events. Check sensor calibration and seek laboratory testing when concerned. This prototype cannot certify drinking-water safety.';
  if(provider!=='mock')return {provider:'fallback',service_status:'unavailable',text:fallback};
  return {provider:'mock',service_status:'available',text:`Mock explanation (template, not an LLM): the recorded rule rating is ${snapshot.last_rating||'unavailable'}; the model class is ${snapshot.last_model||'unavailable'}. Persistence count: ${snapshot.count}. Decision state: ${snapshot.outcome}. The virtual valve command is ${snapshot.valve.commanded||'none'}, acknowledgment is ${snapshot.valve.acknowledged||'none'}, and simulated verification is ${snapshot.valve.verified||'unknown'}. These are separate signals. Thresholds and synthetic model outputs are provisional; they do not establish potability. Check sensors and consult laboratory testing.`};
}
module.exports={explain};
