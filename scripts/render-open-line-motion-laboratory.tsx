import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createOpenLineMotionPlan } from "../data/open-line/motion";
import { createOpenLineMotionLaboratoryScenarios, OpenLineRenderer } from "../components/open-line";

const scenarios = createOpenLineMotionLaboratoryScenarios().map((scenario) => {
  const plan = createOpenLineMotionPlan(scenario.previousGeometry, scenario.geometry, { cause: scenario.cause, preference: scenario.preference, allowDeveloperReplay: true });
  return {
    id: scenario.id,
    label: scenario.label,
    description: scenario.description,
    plan,
    previous: scenario.previousGeometry ? renderToStaticMarkup(<OpenLineRenderer geometry={scenario.previousGeometry} idPrefix={`lab-${scenario.id}-previous`} background="paper" motionPlan={plan} motionLayer="previous" decorativeMarkers />) : "",
    current: renderToStaticMarkup(<OpenLineRenderer geometry={scenario.geometry} idPrefix={`lab-${scenario.id}-current`} background="paper" motionPlan={plan} motionLayer="current" />),
  };
});

const serialized = JSON.stringify(scenarios).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Line Motion Laboratory</title>
<style>
:root{color-scheme:light;font-family:Avenir Next,Avenir,Segoe UI,sans-serif;background:#f6f0e6;color:#2b211a}*{box-sizing:border-box}body{margin:0;padding:32px}.shell{max-width:1180px;margin:auto}.eyebrow{font-size:11px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:#1f5f43}h1{font:48px/1.05 Iowan Old Style,Baskerville,Georgia,serif;margin:8px 0 10px}.lead{max-width:720px;color:#655d55}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:24px 0}select,button{min-height:42px;border:1px solid #d8cfc1;background:#fff;padding:0 14px;font:inherit}button{cursor:pointer;color:#fff;background:#0b3b2d}button.secondary{color:#0b3b2d;background:transparent}.stage{position:relative;min-height:420px;border:1px solid #d8cfc1;background:#fff;border-radius:8px;overflow:hidden}.layer.previous{position:absolute;inset:0;pointer-events:none}.layer.current{position:relative}.stage svg{display:block;max-height:680px}.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:16px;background:#d8cfc1;border:1px solid #d8cfc1}.meta div{background:#fff;padding:14px}.meta b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#655d55}.meta span{display:block;margin-top:4px}.description{margin:14px 0;color:#655d55}@media(max-width:700px){body{padding:18px}h1{font-size:34px}.meta{grid-template-columns:1fr 1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><main class="shell"><p class="eyebrow">Developer-only preview</p><h1>Open Line Motion Laboratory</h1><p class="lead">Motion explains a verified state change. Choose a scenario, replay its deterministic plan, interrupt it, or skip directly to the canonical final state.</p>
<div class="controls"><label>Scenario <select id="scenario"></select></label><button id="replay">Replay</button><button id="interrupt" class="secondary">Interrupt with next state</button><button id="skip" class="secondary">Skip</button></div><p id="description" class="description"></p>
<div id="stage" class="stage"><div class="layer previous" data-motion-layer="previous"></div><div class="layer current" data-motion-layer="current"></div></div>
<div class="meta"><div><b>Transition</b><span id="transition"></span></div><div><b>Preference</b><span id="preference"></span></div><div><b>Phases</b><span id="phases"></span></div><div><b>Duration</b><span id="duration"></span></div></div>
</main><script>
const scenarios=${serialized};const select=document.querySelector('#scenario');const stage=document.querySelector('#stage');const previous=stage.querySelector('[data-motion-layer="previous"]');const current=stage.querySelector('[data-motion-layer="current"]');let animations=[];
for(const item of scenarios){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;select.append(option)}
function selected(){return scenarios.find(item=>item.id===select.value)||scenarios[0]}
function cancel(){for(const animation of animations)animation.cancel();animations=[]}
function selector(type,id){const escaped=id.replaceAll('"','\\"');if(['line_reveal','line_extend','line_fade','branch_create','branch_rejoin','branch_pause','branch_close'].includes(type))return '[data-segment-id="'+escaped+'"]';if(type==='intersection_draw')return '[data-intersection-id="'+escaped+'"],[data-validation-axis][data-node-id="'+escaped+'"]';if(type==='validation_ring')return '[data-open-line-marker][data-node-id="'+escaped+'"] .marker-validation-ring';if(type==='marker_fill')return '[data-open-line-marker][data-node-id="'+escaped+'"] .marker-center';if(type==='label_fade')return '[data-label-anchor][data-node-id="'+escaped+'"]';return '[data-open-line-marker][data-node-id="'+escaped+'"]'}
function frames(phase){const length=Math.max(1,phase.pathLength||120);if(['line_reveal','line_extend','branch_create','branch_rejoin','intersection_draw','validation_ring'].includes(phase.type))return[{strokeDasharray:length+' '+length,strokeDashoffset:length,opacity:.82},{strokeDasharray:length+' '+length,strokeDashoffset:0,opacity:1}];if(phase.type==='line_fade'||phase.source==='previous')return[{opacity:1},{opacity:0}];if(phase.type==='branch_close')return[{opacity:1},{opacity:.68}];return[{opacity:.2},{opacity:1}]}
function load(){cancel();const item=selected();previous.innerHTML=item.previous;current.innerHTML=item.current;previous.style.display=item.previous?'block':'none';document.querySelector('#description').textContent=item.description;document.querySelector('#transition').textContent=item.plan.transitionKind;document.querySelector('#preference').textContent=item.plan.preference;document.querySelector('#phases').textContent=String(item.plan.phases.length);document.querySelector('#duration').textContent=item.plan.totalDurationMs+'ms'}
function replay(){load();const item=selected();for(const phase of item.plan.phases){const layer=phase.source==='previous'?previous:current;for(const id of phase.targetIds){for(const element of layer.querySelectorAll(selector(phase.type,id))){animations.push(element.animate(frames(phase),{delay:phase.delayMs,duration:phase.durationMs,easing:phase.easing,fill:'none'}))}}}setTimeout(()=>{previous.style.display='none';animations=[]},item.plan.totalDurationMs+30)}
select.addEventListener('change',replay);document.querySelector('#replay').addEventListener('click',replay);document.querySelector('#skip').addEventListener('click',()=>{cancel();previous.style.display='none'});document.querySelector('#interrupt').addEventListener('click',()=>{cancel();select.selectedIndex=(select.selectedIndex+1)%scenarios.length;replay()});select.value=scenarios[0].id;load();
</script></body></html>`;

writeFileSync(new URL("../docs/open-line-motion-laboratory.html", import.meta.url), html);
console.log(`Wrote docs/open-line-motion-laboratory.html with ${scenarios.length} deterministic motion scenarios.`);
