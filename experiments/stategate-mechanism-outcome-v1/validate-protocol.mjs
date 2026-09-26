import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const readJson = async (name) => JSON.parse(await readFile(join(root, name), 'utf8'))
const [scenarios, schema, classifier, manifest] = await Promise.all([
  readJson('SCENARIOS.json'), readJson('OUTCOME_OBJECT.schema.json'),
  readJson('TERMINAL_CLASSIFIER.json'), readJson('experiment-manifest.json'),
])
const errors = []
const assert = (condition, message) => { if (!condition) errors.push(message) }
const ids = scenarios.scenarios.map(s => s.scenario_id)
assert(ids.length === 24 && new Set(ids).size === 24, 'must contain exactly 24 unique scenario IDs')
assert(scenarios.scenario_classes.length === 6, 'must contain six scenario classes')
assert(scenarios.design.matched_sets === 24 && scenarios.design.maximum_pr_episodes === 72, 'design count mismatch')
for (const cls of scenarios.scenario_classes) {
  const rows = scenarios.scenarios.filter(s => s.scenario_class_id === cls.scenario_class_id)
  assert(rows.length === 4, `${cls.scenario_class_id} must have four repetitions`)
  assert(new Set(rows.map(s => s.semantic_class)).size === 1, `${cls.scenario_class_id} semantic label drift`)
}
for (const row of scenarios.scenarios) {
  assert(row.matched_arms.join(',') === 'A,B,C', `${row.scenario_id} arm coverage invalid`)
  assert(row.ground_truth.source.includes('arm output is excluded'), `${row.scenario_id} ground truth not arm-independent`)
  for (const field of ['setup_procedure','ground_truth','event_mutation_sequence','evidence_requirements','expected_observations','stopping_behavior','permitted_deviations']) assert(row[field] != null, `${row.scenario_id} missing ${field}`)
}
const pin = 'dd6a607533b0c5c31eb99840e39d0a443998541a'
assert(/^[0-9a-f]{40}$/.test(manifest.stategate.immutable_commit_sha), 'StateGate pin must be full commit SHA')
assert(manifest.stategate.immutable_commit_sha === pin, 'StateGate pin drift')
assert(manifest.stategate.uses.endsWith(`@${pin}`), 'StateGate uses ref not immutable pin')
assert(manifest.scenario_execution_authorized === false && manifest.outcomes_collected === false, 'protocol-only terminal must be explicit')
assert(scenarios.design.execution_authorized === false, 'scenario execution must remain unauthorized')
assert(classifier.terminal_values.join(',') === 'MEASURABLE_IMPROVEMENT,NO_MATERIAL_DIFFERENCE,MEASURABLE_HARM,TOO_COSTLY,BLOCKED,INDETERMINATE', 'terminal classifier values/order changed')
assert(classifier.improvement_gate.all_required.length === 5, 'improvement gate incomplete')
assert(classifier.technical_review_of_proposed_thresholds.decision.includes('Retain'), 'threshold review rationale missing')
assert(classifier.precedence.length === 6 && classifier.harm_rules.false_allow, 'terminal harm/precedence definitions incomplete')
const requiredFields = schema.required
for (const name of ['scenario_id','arm','trial_id','repository','pull_request','head','base','diff_identity','review_state','timestamps','ground_truth_eligible','observed_eligible','execution_outcome','false_allow','false_block','decision_time_seconds','added_gating_delay_seconds','operator_handling_seconds','event_counts','rework','evidence_completeness_percent','proof_fidelity','audit_reconstruction_seconds','ci_elapsed_seconds','ci_billable_minutes','manual_interventions','reproducibility','decision_changed_vs_A','economic_proxy','missingness','deviations','provenance','artifacts']) assert(requiredFields.includes(name), `outcome schema missing ${name}`)
for (const file of manifest.protocol_artifacts) {
  assert(typeof file === 'string' && file.endsWith('.json') || typeof file === 'string' && (file.endsWith('.md') || file.endsWith('.mjs') || file.endsWith('.yml')), `invalid artifact path: ${file}`)
  try { await readFile(join(root,file)) } catch { errors.push(`missing declared artifact: ${file}`) }
}
const protocol = await readFile(join(root, 'PROTOCOL.md'), 'utf8')
const plan = await readFile(join(root, 'analysis-plan.md'), 'utf8')
for (const n of ['false allow','false block','decision time','added gating delay','operator overhead','rework','missed invalid state','evidence completeness','proof fidelity','audit reconstruction time','CI/runtime burden','manual intervention','reproducibility','Decision changes','economic proxy']) assert(plan.toLowerCase().includes(n.toLowerCase()), `analysis plan missing metric: ${n}`)
for (const f of ['SCENARIOS.json','OUTCOME_OBJECT.schema.json','TERMINAL_CLASSIFIER.json','evidence-requirements.md','analysis-plan.md','snapshot-collector.mjs','snapshot-collector.yml','fixture-ci.yml','stategate-required-check.yml']) assert(protocol.includes(f), `protocol does not reference ${f}`)
const stategateWorkflow = await readFile(join(root,'stategate-required-check.yml'),'utf8')
assert(stategateWorkflow.includes(`stategate@${pin}`), 'workflow StateGate SHA drift')
assert(stategateWorkflow.includes('pull_request_review:'), 'StateGate must re-evaluate after review updates')
assert(!/contents:\s*write|pull-requests:\s*write|checks:\s*write/.test(stategateWorkflow), 'workflow has write authority beyond artifact upload')
const snapshot = await readFile(join(root,'snapshot-collector.mjs'),'utf8')
assert(!/mergePullRequest|merge_pull_request|decision\s*=\s*['"]eligible/i.test(snapshot), 'snapshot comparator must not decide or merge')
assert(snapshot.includes('diff_sha256') && snapshot.includes('submitted_at') && snapshot.includes('head_sha') && snapshot.includes('base_sha'), 'snapshot lacks required object/review evidence')

function validate(value, s, at='$') {
  if (s.const !== undefined && value !== s.const) errors.push(`${at}: const mismatch`)
  if (s.enum && !s.enum.some(x => Object.is(x,value))) errors.push(`${at}: enum mismatch`)
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type]
    const ok = types.some(t => t==='null' ? value===null : t==='object' ? value!==null && typeof value==='object' && !Array.isArray(value) : t==='array' ? Array.isArray(value) : t==='integer' ? Number.isInteger(value) : t==='number' ? typeof value==='number' : typeof value===t)
    if (!ok) { errors.push(`${at}: type mismatch`); return }
  }
  if (typeof value==='string') { if (s.pattern && !(new RegExp(s.pattern).test(value))) errors.push(`${at}: pattern mismatch`); if (s.minLength && value.length<s.minLength) errors.push(`${at}: minLength`) }
  if (typeof value==='number') { if (s.minimum!==undefined && value<s.minimum) errors.push(`${at}: minimum`); if (s.maximum!==undefined && value>s.maximum) errors.push(`${at}: maximum`) }
  if (Array.isArray(value) && s.minItems!==undefined && value.length<s.minItems) errors.push(`${at}: minItems`)
  if (Array.isArray(value) && s.items) value.forEach((v,i)=>validate(v,s.items,`${at}[${i}]`))
  if (value && typeof value==='object' && !Array.isArray(value)) {
    for (const req of s.required||[]) if (!(req in value)) errors.push(`${at}: missing ${req}`)
    if (s.additionalProperties===false) for (const k of Object.keys(value)) if (!(k in (s.properties||{}))) errors.push(`${at}: additional property ${k}`)
    for (const [k,v] of Object.entries(value)) if (s.properties?.[k]) validate(v,s.properties[k],`${at}.${k}`)
  }
}
// Validate a structural placeholder only; this is not an experimental outcome record and is not written.
const placeholder = Object.fromEntries(requiredFields.map(k => [k, null]))
placeholder.schema_version='1.0.0'; placeholder.scenario_id='SG-MO1-C1-R01'; placeholder.arm='A'; placeholder.trial_id='STRUCTURAL_SCHEMA_CHECK'; placeholder.repetition=1
placeholder.repository={owner:'owner',name:'repo',id:null,url:'https://example.invalid/repo'}
placeholder.pull_request={number:null,url:null,event_id:null}; placeholder.head={event_sha:null,decision_sha:null,executed_sha:null}; placeholder.base={event_sha:null,decision_sha:null}; placeholder.diff_identity={intended_sha256:null,observed_sha256:null,executed_sha256:null,canonicalization:null}; placeholder.review_state={decision_head_sha:null,approval_count:null,latest_approval_ids:[],evidence_sha256:null}
placeholder.timestamps=Object.fromEntries(['opened_at','event_at','decision_at','execution_at','collection_started_at','collection_ended_at','native_checks_success_at'].map(k=>[k,null]))
placeholder.ground_truth_eligible=true; placeholder.economic_proxy={labor_cost:null,ci_cost:null,currency:null,rate_source:null}
placeholder.missingness=[]; placeholder.deviations=[]; placeholder.artifacts=[{artifact_id:'SCHEMA-ONLY',kind:'schema-structure',sha256:'sha256:'+'0'.repeat(64),source:'ephemeral structural validation',captured_at:'2026-09-26T00:00:00Z'}]; placeholder.provenance={collector_version:null,collector_sha256:null,workflow_sha:null,stategate_sha:null,observed_at:'2026-09-26T00:00:00Z'}
for (const k of ['event_counts','rework']) placeholder[k]=Object.fromEntries(Object.keys(schema.properties[k].properties).map(f=>[f,null]))
validate(placeholder,schema)
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`Protocol consistency PASS: ${ids.length} scenarios, ${scenarios.scenario_classes.length} classes, 24 matched sets, 72 maximum episodes, ${requiredFields.length} required outcome fields.`)
console.log('Structural outcome-schema check PASS (placeholder only; no experimental outcome created).')
