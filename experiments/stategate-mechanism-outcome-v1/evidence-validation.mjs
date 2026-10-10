// Offline evidence checks: hashes bind retained bytes, not external provenance authenticity.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
export const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex')
export const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x)
const equal = (a, b) => canonical(a) === canonical(b)
const get = (x, path) => path.replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((v,k) => v != null && Object.hasOwn(v,k) ? v[k] : undefined, x)
export const utc = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(Date.parse(x)).toISOString().slice(0,19) === x.slice(0,19)
const projection = rows => rows.map(r => ({ id:r.id, state:r.state, commit_id:r.commit_id, submitted_at:r.submitted_at, dismissed_at:r.dismissed_at ?? null, user_id:r.user?.id ?? null, user_login:r.user?.login ?? null })).sort((a,b) => canonical(a).localeCompare(canonical(b)))
const sourceKinds = ['native-context','raw-event','native-repository','native-pr','native-diff','native-reviews','native-checks','native-commits','native-timeline','native-runs','native-artifacts','native-protection','native-rulesets','packet-provenance','snapshot','stategate-proof']
export function artifact(outcome, id) {
  const matches = (outcome.artifacts || []).filter(a => a.artifact_id === id)
  if (matches.length !== 1) throw new Error('artifact must exist exactly once: ' + id)
  const a = matches[0]
  if (typeof a.bytes_base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.bytes_base64)) throw new Error('retained artifact bytes required: ' + id)
  const bytes = Buffer.from(a.bytes_base64, 'base64')
  if (hash(bytes) !== a.sha256) throw new Error('artifact byte hash mismatch: ' + id)
  let data
  try { data = JSON.parse(bytes.toString('utf8')) } catch { data = null }
  return { ...a, bytes, data }
}
function permitted(a, arm, key) {
  if (!sourceKinds.includes(a.kind) || a.kind === 'snapshot' && arm !== 'B' || a.kind === 'stategate-proof' && arm !== 'C') throw new Error('ineligible source kind: ' + a.kind)
  if (a.sha256 === key.sha256 || a.data?.packet_version || a.data?.provenance?.collector?.startsWith('common-collector') || /common-evidence|common-collector/.test(a.source)) throw new Error('common collector forbidden as source')
  if (!utc(a.captured_at) || typeof a.source !== 'string' || !a.source.length) throw new Error('source identity/capture time absent')
  if (a.kind.startsWith('native-') && !['native-context','native-diff'].includes(a.kind) && a.http_status !== 200) throw new Error('native source HTTP 200 required')
  if (['native-reviews','native-checks','native-commits','native-timeline','native-runs','native-artifacts','native-rulesets'].includes(a.kind) && a.pagination_complete !== true) throw new Error('complete pagination required')
  if (a.kind === 'snapshot' && (a.data?.snapshot_version !== '1.1.0' || a.data?.collection_status !== 'CONSISTENT')) throw new Error('inconsistent snapshot')
  if (a.kind === 'stategate-proof' && a.data?.record_type !== 'MERGE_GUARD_PROOF') throw new Error('invalid StateGate proof source')
}
function extract(a, path, o) {
  if (path === '$bytes') return hash(a.bytes)
  if (path === '$canonical_diff_sha256') return hash(a.bytes.toString('utf8').replace(/\r\n?/g,'\n').replace(/\n*$/,'\n'))
  if (path === '$canonicalization') return 'LF_NORMALIZE_TERMINAL_LF_PRESERVE_PATCH_TEXT_AND_ORDER'
  if (path === '$http_status') return a.http_status
  if (path === '$reviews') { if (!Array.isArray(a.data)) throw new Error('reviews array absent'); return projection(a.data) }
  return get(a.data, path)
}
function consistency(o, meta) {
  if (!meta || !utc(meta.collection_started_at) || !utc(meta.collection_ended_at) || Date.parse(meta.collection_ended_at) < Date.parse(meta.collection_started_at)) throw new Error('packet collection times invalid')
  const start = artifact(o,meta.pr_start_artifact_id), end = artifact(o,meta.pr_end_artifact_id)
  const rs = artifact(o,meta.reviews_start_artifact_id), re = artifact(o,meta.reviews_end_artifact_id)
  if (start.kind !== 'native-pr' || end.kind !== 'native-pr' || rs.kind !== 'native-reviews' || re.kind !== 'native-reviews' || rs.pagination_complete !== true || re.pagination_complete !== true || [start,end,rs,re].some(a=>a.http_status!==200)) throw new Error('packet bracket source mismatch')
  return start.data.head?.sha === end.data.head?.sha && start.data.base?.sha === end.data.base?.sha && start.data.updated_at === end.data.updated_at && equal(projection(rs.data),projection(re.data))
}
export function verifyCompleteness(o, catalog) {
  const errors = []
  if (o.evidence_completeness == null) return errors
  try {
    const key = artifact(o,o.evidence_answer_key)
    if (key.kind !== 'common-answer-key' || key.data?.packet_version !== '1.4.0' || key.data.collection_status !== 'CONSISTENT' || key.data.context?.scenario_id !== o.scenario_id || key.data.context.arm !== o.arm || key.data.context.repetition !== o.repetition) throw new Error('independent answer key identity/status mismatch')
    if (key.data.fetched_object?.repository?.full_name !== `${o.repository.owner}/${o.repository.name}` || key.data.fetched_object?.pull_request?.number !== o.pull_request.number) throw new Error('answer key repository/PR mismatch')
    for (const row of o.evidence_completeness.fields || []) {
      if (!row.valid) continue
      try {
        const spec = catalog.fields.find(f=>f.id===row.id)
        if (!spec || !row.source_bindings?.length) throw new Error('catalog/binding absent')
        for (const b of row.source_bindings) {
          const a = artifact(o,b.artifact_id); permitted(a,o.arm,key)
          if (!spec.source_mappings.some(m=>m.kind===a.kind && m.path===b.source_path)) throw new Error('source path/kind is not the frozen field adapter')
          const value = extract(a,b.source_path,o)
          if (value == null) throw new Error('bound source path absent/null')
          const expected = get(key.data,spec.path)
          if (!['E28','E29','E30','E32'].includes(row.id) && (expected == null || !equal(value,expected))) throw new Error('source value disagrees with independent catalog field')
          if (row.id === 'E01' && value !== o.scenario_id || row.id === 'E02' && value !== o.repetition || row.id === 'E03' && value !== o.arm) throw new Error('context mismatch')
          if (['E14','E15'].includes(row.id) && (key.data.consistency?.stable_object !== true || a.kind === 'snapshot' && a.data.consistency?.stable_object !== true)) throw new Error('unstable PR identity')
          if (row.id === 'E18' && key.data.consistency?.stable_reviews !== true) throw new Error('unstable reviews')
          if (['E28','E29','E30','E32'].includes(row.id)) {
            const stable = consistency(o,a.data)
            if (a.data.collection_status !== (stable ? 'CONSISTENT' : 'INCONSISTENT_NOT_EVIDENCE')) throw new Error('collection status not derived from bracket')
            if (row.id === 'E30' && value !== 'CONSISTENT') throw new Error('inconsistent packet')
            if (row.id === 'E32') {
              if (!Array.isArray(value) || !value.length || new Set(value.map(e=>e.artifact_id)).size !== value.length) throw new Error('source inventory missing/duplicate')
              for (const entry of value) {
                const source = artifact(o,entry.artifact_id); permitted(source,o.arm,key)
                if (source.kind === 'packet-provenance' || entry.source_kind !== source.kind || entry.sha256 !== source.sha256 || entry.source !== source.source || entry.captured_at !== source.captured_at) throw new Error('inventory source metadata mismatch')
              }
              const used = new Set(o.evidence_completeness.fields.filter(f=>f.valid && f.id!=='E32').flatMap(f=>f.source_bindings).map(b=>b.artifact_id).filter(id=>artifact(o,id).kind!=='packet-provenance'))
              if ([...used].some(id=>!value.some(e=>e.artifact_id===id))) throw new Error('inventory omits a used source')
            }
          }
          if (row.id === 'E24' && value !== 200) throw new Error('branch protection unavailable')
          if (row.id === 'E25' && (value.status !== 200 || !Array.isArray(value.summaries) || value.summaries.length || !Array.isArray(value.definitions) || value.definitions.length)) throw new Error('ruleset prerequisite not satisfied')
          if (row.id === 'E31' && value !== '2022-11-28') throw new Error('API version mismatch')
          if (row.id === 'E32') continue
          if (row.id === 'E04' || row.id === 'E05' || row.id === 'E26') { if (typeof value!=='string' || !value.length) throw new Error('nonempty text required') }
          if (['E07','E10','E12'].includes(row.id) && (!Number.isInteger(value) || value<1)) throw new Error('positive integer required')
          if (['E08','E09','E14','E15'].includes(row.id) && !/^[0-9a-f]{40}$/.test(value)) throw new Error('invalid SHA')
          if (['E06','E16'].includes(row.id) && !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error('invalid digest')
          if (['E18','E19','E20','E21','E22','E23'].includes(row.id) && !Array.isArray(value)) throw new Error('array required')
          if (row.id === 'E27' && typeof value!=='boolean') throw new Error('boolean required')
          if (row.id === 'E13' && value !== `https://github.com/${o.repository.owner}/${o.repository.name}/pull/${o.pull_request.number}`) throw new Error('PR URL mismatch')
        }
      } catch (e) { errors.push(row.id + ': ' + e.message) }
    }
  } catch (e) { errors.push('completeness: ' + e.message) }
  return errors
}
export function operatorSeconds(ledger) {
  if (!ledger || !Array.isArray(ledger.intervals) || typeof ledger.clock_id!=='string' || !ledger.clock_id || ledger.intervals.length===0) throw new Error('operator ledger missing')
  const ids = new Set(), actors = new Set(), intervals = []
  for (const r of ledger.intervals) {
    if (typeof r.id!=='string' || !r.id || ids.has(r.id) || typeof r.actor!=='string' || !r.actor || typeof r.activity!=='string' || !r.activity || !['arm-specific','common','passive'].includes(r.scope)) throw new Error('operator interval identity/scope invalid')
    ids.add(r.id); actors.add(r.actor)
    if (!utc(r.started_at) || !utc(r.ended_at) || Date.parse(r.ended_at)<Date.parse(r.started_at) || !/^\d+$/.test(r.start_monotonic_ns) || !/^\d+$/.test(r.end_monotonic_ns)) throw new Error('operator interval time invalid')
    const a=BigInt(r.start_monotonic_ns), b=BigInt(r.end_monotonic_ns)
    if (b<a || !Number.isFinite(ledger.clock_precision_seconds) || ledger.clock_precision_seconds<0 || ledger.clock_precision_seconds>1 || Math.abs(Number(b-a)/1e9-(Date.parse(r.ended_at)-Date.parse(r.started_at))/1000)>ledger.clock_precision_seconds) throw new Error('operator clock duration mismatch')
    if(r.scope==='arm-specific') intervals.push([a,b])
  }
  if (actors.size!==1) throw new Error('mixed operator clocks/actors forbidden')
  intervals.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)
  let sum=0n, left=null, right=null
  for(const [a,b] of intervals) { if(left===null){left=a;right=b} else if(a<=right){if(b>right)right=b} else {sum+=right-left;left=a;right=b} }
  if(left!==null)sum+=right-left
  return Number(sum)/1e9
}
export function reconstructionCorrect(o, contract) {
  const r=o.reconstruction_record
  if (!r || !utc(r.key_frozen_at) || !utc(r.submitted_at) || Date.parse(r.key_frozen_at)>Date.parse(r.submitted_at)) throw new Error('reconstruction key not prospectively frozen')
  const key=artifact(o,r.answer_key_artifact_id), submission=artifact(o,r.submission_artifact_id)
  if (key.kind!=='reconstruction-key' || submission.kind!=='reconstruction-submission' || key.captured_at!==r.key_frozen_at || submission.captured_at!==r.submitted_at || typeof r.completed!=='boolean') throw new Error('reconstruction record/artifact mismatch')
  const names=contract.reconstruction.questions
  if (!key.data || !submission.data || Object.keys(key.data).sort().join(',')!==[...names].sort().join(',') || Object.keys(submission.data).sort().join(',')!==[...names].sort().join(',')) throw new Error('reconstruction questions mismatch')
  return r.completed && names.every(q=>key.data[q]!=null && submission.data[q]!=null && submission.data[q]!=='unknown' && equal(key.data[q],submission.data[q]))
}
export function verifyReplay(o) {
  const errors=[]
  if (!/^SG-MO1-C6-/.test(o.scenario_id)) { if(o.replay_record!==null)errors.push('C1-C5 replay record must be null'); return errors }
  if (o.reproducibility==='MISSING') { if(o.replay_record!==null)errors.push('MISSING replay must have null record'); return errors }
  let directory
  try {
    const r=o.replay_record
    if(!r || !Array.isArray(r.output_artifact_ids) || r.output_artifact_ids.length!==2 || !Array.isArray(r.commands) || r.commands.length!==2 || !/^v\d+\.\d+\.\d+$/.test(r.node_version) || r.network_disabled!==true) throw new Error('performed replay command/runtime/input/two-output records required')
    const input=artifact(o,r.input_artifact_id), outputs=r.output_artifact_ids.map(id=>artifact(o,id))
    if(input.kind!=='replay-input' || outputs.some(a=>a.kind!=='replay-output'))throw new Error('replay source kind mismatch')
    if(input.data?.scenario_id!==o.scenario_id || input.data.arm!==o.arm)throw new Error('replay input identity mismatch')
    const pin='dd6a607533b0c5c31eb99840e39d0a443998541a'
    if(o.arm==='C' && (r.stategate_commit!==pin || r.stategate_tree!=='ea9e6482f88dc8c41c4d2a5fe3e20f4c27808cf5' || r.clean_checkout!==true || typeof r.stategate_directory!=='string'))throw new Error('replay StateGate checkout evidence missing')
    directory=mkdtempSync(join(tmpdir(),'stategate-verify-'))
    const inputPath=join(directory,'input.json'); writeFileSync(inputPath,input.bytes)
    const script=join(dirname(fileURLToPath(import.meta.url)),'replay-evidence.mjs')
    for(let i=0;i<2;i++) {
      const expected=['node','replay-evidence.mjs','--input',r.input_artifact_id,'--output',r.output_artifact_ids[i],...(o.arm==='C'?['--stategate-dir',pin]:[])]
      if(!equal(r.commands[i],expected))throw new Error('replay command differs from frozen argv')
      const outPath=join(directory,'output'+i+'.json')
      execFileSync(process.execPath,[script,'--input',inputPath,'--output',outPath,...(o.arm==='C'?['--stategate-dir',r.stategate_directory]:[])],{stdio:'pipe',timeout:30000})
      if(!readFileSync(outPath).equals(outputs[i].bytes))throw new Error('recorded replay output does not reproduce')
    }
    const checks=['decision_event','repository','pull_request','head','base','diff','review','policy','workflow_inputs']
    const pass=outputs[0].bytes.equals(outputs[1].bytes) && outputs.every(a=>a.data?.input_sha256===input.sha256 && a.data.scenario_id===o.scenario_id && a.data.arm===o.arm && a.data.observed_eligible===o.ground_truth_eligible && (o.arm!=='C' || a.data.stategate?.archived_proof_equal===true && checks.every(k=>a.data.stategate.binding_checks[k]===true)))
    if(o.reproducibility!==(pass?'PASS':'FAIL'))throw new Error('reproducibility must equal derived replay result')
  } catch(e) {errors.push('replay: '+e.message)} finally {if(directory)rmSync(directory,{recursive:true,force:true})}
  return errors
}
export function verifyMeasurements(o,contract) {
  const errors=[]
  try {if(o.operator_handling_seconds!==null && (o.operator_ledger===null || Math.abs(operatorSeconds(o.operator_ledger)-o.operator_handling_seconds)>1e-9))throw new Error('operator seconds not derived from interval union')}catch(e){errors.push(e.message)}
  if(o.operator_handling_seconds===null && o.operator_ledger!==null)errors.push('operator ledger/scalar missingness mismatch')
  try {if(o.reconstruction_record!==null && reconstructionCorrect(o,contract)!==o.audit_reconstruction_correct)throw new Error('reconstruction correctness not derived from all five answers'); if(o.audit_reconstruction_correct!==null && o.reconstruction_record===null)throw new Error('reconstruction evidence missing')}catch(e){errors.push(e.message)}
  try {
    if(o.ci_elapsed_seconds!==null || o.ci_billable_minutes!==null) {
      const key=artifact(o,o.evidence_answer_key)
      if(key.kind!=='common-answer-key' || key.data?.context?.scenario_id!==o.scenario_id || key.data.context.arm!==o.arm)throw new Error('CI answer key mismatch')
      const derived=ciMeasurements(key.data)
      if(derived.ci_elapsed_seconds!==o.ci_elapsed_seconds || derived.ci_billable_minutes!==o.ci_billable_minutes)throw new Error('CI scalar not derived from jobs/usage')
    }
  } catch(e){errors.push(e.message)}
  return errors
}
export function ciMeasurements(packet) {
  const f=packet.fetched_object
  if (!Array.isArray(f?.workflow_jobs) || !Array.isArray(f?.workflow_usage) || !Array.isArray(f?.workflow_runs)) throw new Error('CI jobs/usage archive missing')
  const included=f.workflow_runs.filter(r=>['Fixture CI','Evidence snapshot (Arm B)','StateGate required check'].includes(r.name))
  let elapsed=0, billable=0, missingElapsed=false, missingBilling=false
  const seen=new Set()
  for(const run of included) {
    for(let attempt=1;attempt<=run.run_attempt;attempt++) {
      const records=f.workflow_jobs.filter(r=>r.workflow_run_id===run.id && r.run_attempt===attempt)
      if(records.length!==1 || !Array.isArray(records[0].jobs))throw new Error('CI attempt jobs missing/duplicated')
      for(const job of records[0].jobs) {
        const key=run.id+':'+attempt+':'+job.id
        if(seen.has(key))throw new Error('duplicate job accounting');seen.add(key)
        if(job.status!=='completed' || !utc(job.started_at) || !utc(job.completed_at)){missingElapsed=true;continue}
        const seconds=(Date.parse(job.completed_at)-Date.parse(job.started_at))/1000
        if(seconds<0)throw new Error('reversed job timing')
        elapsed+=seconds
      }
    }
    const usage=f.workflow_usage.filter(r=>r.workflow_run_id===run.id)
    if(usage.length!==1)throw new Error('CI usage missing/duplicated')
    if(usage[0].status!==200 || !usage[0].body?.billable){missingBilling=true;continue}
    const rows=Object.values(usage[0].body.billable)
    if(!rows.length){missingBilling=true;continue}
    for(const row of rows) {if(!Number.isFinite(row.total_ms) || row.total_ms<0)throw new Error('billing duration invalid');billable+=row.total_ms/60000}
  }
  return {ci_elapsed_seconds:missingElapsed?null:elapsed,ci_billable_minutes:missingBilling?null:billable}
}

export function verifySurfaceContracts(classifier, workflows, collector) {
  const errors=[]
  const anchor=classifier.improvement_gate?.all_required?.[3] || ''
  if(!anchor.includes('timestamps.evaluation_ready_at') || !anchor.includes('timestamps.decision_at') || anchor.includes('last common native'))errors.push('terminal delay anchor drift')
  for(const workflow of workflows)if(/^\s+(actions|contents|pull-requests|checks): write$/m.test(workflow))errors.push('unmatched repository-token write permission')
  if(!collector.includes('/attempts/${attempt}/jobs?per_page=100') || !collector.includes('/timing') || !collector.includes('workflowJobs') || !collector.includes('workflowUsage'))errors.push('job/usage acquisition incomplete')
  return errors
}
