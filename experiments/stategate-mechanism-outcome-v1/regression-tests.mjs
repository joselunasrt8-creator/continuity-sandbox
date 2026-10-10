// Synthetic construction-time regressions only. No scenario PRs or outcomes.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { verifyCompleteness, verifyReplay, operatorSeconds, reconstructionCorrect, verifyMeasurements, hash, ciMeasurements, verifySurfaceContracts } from './evidence-validation.mjs'
import { deriveNative } from './native-eligibility.mjs'
const root=dirname(fileURLToPath(import.meta.url))
const load=f=>JSON.parse(readFileSync(join(root,f),'utf8'))
const catalog=load('evidence-fields.json'), contract=load('measurement-contract.json')
let count=0
function test(name,f){f();count++;console.log('PASS '+name)}
const stamp='2026-10-10T06:00:00Z', head='a'.repeat(40), base='b'.repeat(40), digest='sha256:'+'c'.repeat(64)
const put=(o,id,kind,data,extra={})=>{const bytes=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));o.artifacts.push({artifact_id:id,kind,sha256:hash(bytes),source:'https://github.com/owner/repo/actions/runs/1',captured_at:stamp,bytes_base64:bytes.toString('base64'),...extra});return id}
const clone=x=>structuredClone(x)
const packet={packet_version:'1.4.0',collection_status:'CONSISTENT',context:{scenario_id:'SG-MO1-C1-R01',repetition:1,arm:'A'}, trigger:{event_name:'pull_request',event_action:'opened'},fetched_object:{repository:{full_name:'owner/repo'},pull_request:{number:1}},consistency:{stable_object:true,stable_reviews:true}}
const o={scenario_id:'SG-MO1-C1-R01',arm:'A',repetition:1,repository:{owner:'owner',name:'repo'},pull_request:{number:1},artifacts:[],evidence_answer_key:'KEY',evidence_completeness:{fields:[{id:'E01',valid:true,source_bindings:[{artifact_id:'CTX',source_path:'$.scenario_id'}]}]}}
put(o,'KEY','common-answer-key',packet);put(o,'CTX','native-context',{scenario_id:o.scenario_id})
test('F2 valid retained catalog binding accepted',()=>assert.deepEqual(verifyCompleteness(o,catalog),[]))
test('F2 original arbitrary-artifact 100% probe rejected',()=>{const x=clone(o);put(x,'SCHEMA-ONLY','schema-structure',{});x.evidence_completeness={fields:catalog.fields.map(f=>({id:f.id,valid:true,source_bindings:[{artifact_id:'SCHEMA-ONLY',source_path:'$'}]})),numerator:32,failed_ids:[]};x.evidence_completeness_percent=100;assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 correct kind wrong path rejected',()=>{const x=clone(o);x.evidence_completeness.fields[0].source_bindings[0].source_path='$';assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 absent retained bytes rejected',()=>{const x=clone(o);delete x.artifacts[1].bytes_base64;assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 tampered retained bytes rejected',()=>{const x=clone(o);x.artifacts[1].bytes_base64=Buffer.from('{}').toString('base64');assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 independent answer-key disagreement rejected',()=>{const x=clone(o);x.artifacts.pop();put(x,'CTX','native-context',{scenario_id:'SG-MO1-C2-R01'});assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 relabelled common collector rejected',()=>{const x=clone(o);x.artifacts.pop();put(x,'CTX','native-context',packet);assert.ok(verifyCompleteness(x,catalog).length)})
test('F2 wrong-arm snapshot rejected',()=>{const x=clone(o);put(x,'SNAP','snapshot',{snapshot_version:'1.1.0',collection_status:'CONSISTENT',trigger:{event_name:'pull_request'}});x.evidence_completeness.fields=[{id:'E04',valid:true,source_bindings:[{artifact_id:'SNAP',source_path:'$.trigger.event_name'}]}];assert.ok(verifyCompleteness(x,catalog).length)})
test('F5 exact raw-event bytes provide E06',()=>{const x=clone(o),raw=Buffer.from('{ "action": "opened" }\n');put(x,'EVENT','raw-event',raw);x.artifacts=x.artifacts.filter(a=>a.artifact_id!=='KEY');const k=clone(packet);k.trigger.event_payload_sha256=hash(raw);put(x,'KEY','common-answer-key',k);x.evidence_completeness.fields=[{id:'E06',valid:true,source_bindings:[{artifact_id:'EVENT',source_path:'$bytes'}]}];assert.deepEqual(verifyCompleteness(x,catalog),[]);x.artifacts.find(a=>a.artifact_id==='EVENT').bytes_base64=Buffer.from('{"action":"opened"}').toString('base64');assert.ok(verifyCompleteness(x,catalog).length)})
test('F3 original unsupported C6 PASS rejected',()=>assert.ok(verifyReplay({scenario_id:'SG-MO1-C6-R01',arm:'A',reproducibility:'PASS',replay_record:null}).length))
const nativePacket={packet_version:'1.4.0',collection_status:'CONSISTENT',context:{scenario_id:'SG-MO1-C6-R01',arm:'A'},fetched_object:{head_sha:head,base_sha:base,diff_sha256:digest,base_ref:'bench/SG-MO1-C6-R01/base',pull_request:{author_user_id:1,mergeable:true,mergeable_state:'clean',state:'open',draft:false},authorized_reviewer:{status:200,user_id:2,login:'reviewer',permission:'write'},reviews:[{id:1,user_id:2,user_login:'reviewer',state:'APPROVED',commit_id:head,submitted_at:stamp}],workflow_runs:[{id:5,name:'Fixture CI',head_sha:head,run_number:1,run_attempt:1,status:'completed',conclusion:'success',check_suite_id:10}],checks:[{id:7,name:'fixture-ci',head_sha:head,status:'completed',conclusion:'success',check_suite:{id:10}}],branch_protection:{status:200,body:{required_pull_request_reviews:{dismiss_stale_reviews:true,require_last_push_approval:true,required_approving_review_count:1,bypass_pull_request_allowances:{users:[],teams:[],apps:[]}},required_status_checks:{strict:true,contexts:['fixture-ci'],checks:[]},enforce_admins:{enabled:true},allow_force_pushes:{enabled:false},allow_deletions:{enabled:false}}},rulesets:{status:200,summaries:[],definitions:[]}}}
const input={replay_input_version:'1.0.0',scenario_id:'SG-MO1-C6-R01',arm:'A',common_packet:nativePacket,native_input:{expected_head_sha:head,expected_base_sha:base,expected_diff_sha256:digest}}
test('F6/F7/F8 valid native replay admitted',()=>assert.equal(deriveNative(nativePacket,input).nativeEligible,true))
test('F6 extra required check rejected',()=>{const p=clone(nativePacket);p.fetched_object.branch_protection.body.required_status_checks.contexts.push('other');assert.equal(deriveNative(p,input).nativeEligible,false)})
test('F6 C missing required stategate rejected',()=>assert.equal(deriveNative(nativePacket,{...input,arm:'C'}).nativeRulesVerified,false))
test('F6 latest failed check overrides success',()=>{const p=clone(nativePacket);p.fetched_object.workflow_runs.push({...p.fetched_object.workflow_runs[0],id:8,run_attempt:2,check_suite_id:11,conclusion:'failure'});assert.equal(deriveNative(p,input).nativeEligible,false)})
for(const state of ['dirty','behind','blocked','unknown'])test('F7 mergeability '+state+' rejected',()=>{const p=clone(nativePacket);p.fetched_object.pull_request.mergeable_state=state;assert.equal(deriveNative(p,input).nativeEligible,false)})
test('F7 null mergeability rejected',()=>{const p=clone(nativePacket);p.fetched_object.pull_request.mergeable=null;assert.equal(deriveNative(p,input).nativeEligible,false)})
for(const permission of ['read','triage',null])test('F8 unauthorized '+permission+' approval rejected',()=>{const p=clone(nativePacket);p.fetched_object.authorized_reviewer.permission=permission;assert.equal(deriveNative(p,input).nativeEligible,false)})
test('F8 different reviewer cannot stand in',()=>{const p=clone(nativePacket);p.fetched_object.reviews[0].user_id=3;assert.equal(deriveNative(p,input).nativeEligible,false)})
test('F3 retained replay PASS reproduced twice, forged output rejected',()=>{const dir=mkdtempSync(join(tmpdir(),'stategate-test-'));try{const x={...o,scenario_id:input.scenario_id,ground_truth_eligible:true,reproducibility:'PASS',artifacts:[],replay_record:{input_artifact_id:'IN',output_artifact_ids:['OUT1','OUT2'],commands:[['node','replay-evidence.mjs','--input','IN','--output','OUT1'],['node','replay-evidence.mjs','--input','IN','--output','OUT2']],node_version:process.version,network_disabled:true}};put(x,'IN','replay-input',input);writeFileSync(join(dir,'in.json'),Buffer.from(x.artifacts[0].bytes_base64,'base64'));execFileSync(process.execPath,[join(root,'replay-evidence.mjs'),'--input',join(dir,'in.json'),'--output',join(dir,'out.json')]);const bytes=readFileSync(join(dir,'out.json'));put(x,'OUT1','replay-output',bytes);put(x,'OUT2','replay-output',bytes);assert.deepEqual(verifyReplay(x),[]);x.artifacts=x.artifacts.filter(a=>a.artifact_id!=='OUT2');put(x,'OUT2','replay-output',{observed_eligible:true});assert.ok(verifyReplay(x).length)}finally{rmSync(dir,{recursive:true,force:true})}})
const ledger={clock_id:'synthetic-monotonic',clock_precision_seconds:0,intervals:[{id:'1',actor:'operator',activity:'capture',scope:'arm-specific',started_at:stamp,ended_at:'2026-10-10T06:00:10Z',start_monotonic_ns:'0',end_monotonic_ns:'10000000000'},{id:'2',actor:'operator',activity:'interpret',scope:'arm-specific',started_at:'2026-10-10T06:00:05Z',ended_at:'2026-10-10T06:00:15Z',start_monotonic_ns:'5000000000',end_monotonic_ns:'15000000000'}]}
test('F10 overlap union is 15 seconds, not 20',()=>assert.equal(operatorSeconds(ledger),15))
test('F10 reversed interval rejected',()=>{const x=clone(ledger);x.intervals[1].end_monotonic_ns='1';assert.throws(()=>operatorSeconds(x))})
test('F10 duplicate interval ID rejected',()=>{const x=clone(ledger);x.intervals[1].id='1';assert.throws(()=>operatorSeconds(x))})
test('F10 forged operator scalar rejected',()=>assert.ok(verifyMeasurements({operator_handling_seconds:20,operator_ledger:ledger,audit_reconstruction_correct:null,reconstruction_record:null},contract).length))
const recon={artifacts:[],reconstruction_record:{key_frozen_at:stamp,submitted_at:'2026-10-10T06:00:10Z',completed:true,answer_key_artifact_id:'RK',submission_artifact_id:'RS'}}
const answers=Object.fromEntries(contract.reconstruction.questions.map(q=>[q,{answer:q}]))
put(recon,'RK','reconstruction-key',answers);put(recon,'RS','reconstruction-submission',answers,{captured_at:recon.reconstruction_record.submitted_at})
test('F11 five exact answers score correct',()=>assert.equal(reconstructionCorrect(recon,contract),true))
test('F11 one wrong answer rejects partial credit',()=>{const x=clone(recon);x.artifacts.pop();put(x,'RS','reconstruction-submission',{...answers,eligibility:'unknown'},{captured_at:x.reconstruction_record.submitted_at});assert.equal(reconstructionCorrect(x,contract),false)})
test('F11 key frozen after submission rejected',()=>{const x=clone(recon);x.reconstruction_record.key_frozen_at='2026-10-10T06:00:20Z';assert.throws(()=>reconstructionCorrect(x,contract))})
test('F1 classifier exact evaluation-ready anchor',()=>assert.ok(load('TERMINAL_CLASSIFIER.json').improvement_gate.all_required[3].includes('timestamps.evaluation_ready_at')))
test('F4 neither intervention grants write permission',()=>{for(const file of ['snapshot-collector.yml','stategate-required-check.yml'])assert.ok(!/^\s+(contents|pull-requests|checks|actions): write$/m.test(readFileSync(join(root,file),'utf8')))})
test('F5 event archive preserves bytes equally in all arms',()=>{const trees=load('fixtures/BASE_TREE_MANIFEST.json');assert.equal(trees.common_files['.github/workflows/native-event-archive.yml'],'native-event-archive.yml');assert.ok(readFileSync(join(root,'native-event-archive.yml'),'utf8').includes('cp "$GITHUB_EVENT_PATH" native-event/event.json'))})
test('F9 collector archives exact attempt jobs and unavailable usage',()=>{const s=readFileSync(join(root,'common-collector.mjs'),'utf8');assert.ok(s.includes('/attempts/${attempt}/jobs?per_page=100'));assert.ok(s.includes('/timing'));assert.ok(s.includes('[200, 403, 404, 410, 422]'))})
const workflows=['snapshot-collector.yml','stategate-required-check.yml'].map(f=>readFileSync(join(root,f),'utf8'))
const collector=readFileSync(join(root,'common-collector.mjs'),'utf8')
test('F1 wrong anchor mutant rejected',()=>{const x=load('TERMINAL_CLASSIFIER.json');x.improvement_gate.all_required[3]='last common native check/evidence availability';assert.ok(verifySurfaceContracts(x,workflows,collector).length)})
test('F4 actions-write mutant rejected',()=>assert.ok(verifySurfaceContracts(load('TERMINAL_CLASSIFIER.json'),[workflows[0].replace('actions: read','actions: write')],collector).length))
const ciPacket={fetched_object:{workflow_runs:[{id:1,name:'Fixture CI',run_attempt:1}],workflow_jobs:[{workflow_run_id:1,run_attempt:1,jobs:[{id:1,status:'completed',started_at:stamp,completed_at:'2026-10-10T06:00:10Z'},{id:2,status:'completed',started_at:'2026-10-10T06:00:05Z',completed_at:'2026-10-10T06:00:15Z'}]}],workflow_usage:[{workflow_run_id:1,status:404,body:{}}]}}
test('F9 parallel jobs sum, unavailable billing remains null',()=>assert.deepEqual(ciMeasurements(ciPacket),{ci_elapsed_seconds:20,ci_billable_minutes:null}))
test('F9 absent job records rejected',()=>{const x=clone(ciPacket);x.fetched_object.workflow_jobs=[];assert.throws(()=>ciMeasurements(x))})
test('F9 reversed job timing rejected',()=>{const x=clone(ciPacket);x.fetched_object.workflow_jobs[0].jobs[0].completed_at='2026-10-10T05:59:59Z';assert.throws(()=>ciMeasurements(x))})
test('F9 duplicate usage rejected',()=>{const x=clone(ciPacket);x.fetched_object.workflow_usage.push(x.fetched_object.workflow_usage[0]);assert.throws(()=>ciMeasurements(x))})
const pinDirectory = process.argv[process.argv.indexOf('--stategate-dir')+1]
if(process.argv.includes('--stategate-dir')) {
  const guard=await import(pathToFileURL(join(pinDirectory,'guard.mjs')).href)
  test('F3/F6 C pinned replay and proof equality, forged bindings rejected',()=>{
    const p=clone(nativePacket), i=clone(input)
    i.arm='C';p.context.arm='C';p.fetched_object.pull_request.author_login='author'
    const diff=readFileSync(join(root,'fixtures/patches/base-to-h1.patch'),'utf8'), dh=hash(diff)
    p.fetched_object.diff_sha256=dh;i.native_input.expected_diff_sha256=dh
    p.trigger={event_name:'pull_request_review',event_action:'submitted',pr_number:1,head_sha:head,base_sha:base,review_commit_id:head}
    p.fetched_object.branch_protection.body.required_status_checks.contexts=['fixture-ci','stategate']
    p.fetched_object.workflow_runs.push({id:6,name:'StateGate required check',head_sha:head,run_number:1,run_attempt:1,status:'completed',conclusion:'success',check_suite_id:11})
    p.fetched_object.checks.push({id:8,name:'stategate',head_sha:head,status:'completed',conclusion:'success',check_suite:{id:11}})
    p.fetched_object.repository={full_name:'owner/repo'};p.fetched_object.pull_request.number=1
    i.common_packet=p
    const keys=['repo','pr_number','head_sha','base_sha','actor','author_kind','require_agent_authored','pr_author','head_ref','pr_body','pr_labels','commit_trailers','operator_id','pr_diff','diff_source','expected_diff_hash','expected_proof_hash','expected_validated_object_hash','require_review_approval','minimum_approvals','review_evidence','expected_review_evidence_hash','evaluated_head_sha','evaluated_base_sha','diff_acquisition_failed','review_acquisition_failed']
    i.stategate_input=Object.fromEntries(keys.map(k=>[k,'']))
    Object.assign(i.stategate_input,{repo:'owner/repo',pr_number:1,head_sha:head,base_sha:base,evaluated_head_sha:head,evaluated_base_sha:base,actor:'author',author_kind:'unknown',require_agent_authored:'false',require_review_approval:'true',minimum_approvals:1,pr_diff:diff,diff_source:'github_pull_request_diff_api',expected_diff_hash:dh,diff_acquisition_failed:false,review_acquisition_failed:false,review_evidence:{head_sha:head,reviews:[{reviewer:'reviewer',state:'APPROVED',submitted_at:stamp,commit_id:head}]}})
    i.archived_stategate_proof=guard.proofFromDecision(guard.validateMergeGuard(i.stategate_input))
    const dir=mkdtempSync(join(tmpdir(),'stategate-C-test-'))
    try {
      const x={scenario_id:i.scenario_id,arm:'C',ground_truth_eligible:true,reproducibility:'PASS',artifacts:[],replay_record:{input_artifact_id:'IN',output_artifact_ids:['OUT1','OUT2'],commands:[['node','replay-evidence.mjs','--input','IN','--output','OUT1','--stategate-dir','dd6a607533b0c5c31eb99840e39d0a443998541a'],['node','replay-evidence.mjs','--input','IN','--output','OUT2','--stategate-dir','dd6a607533b0c5c31eb99840e39d0a443998541a']],node_version:process.version,network_disabled:true,stategate_commit:'dd6a607533b0c5c31eb99840e39d0a443998541a',stategate_tree:'ea9e6482f88dc8c41c4d2a5fe3e20f4c27808cf5',clean_checkout:true,stategate_directory:pinDirectory}}
      put(x,'IN','replay-input',i);writeFileSync(join(dir,'in.json'),Buffer.from(x.artifacts[0].bytes_base64,'base64'))
      execFileSync(process.execPath,[join(root,'replay-evidence.mjs'),'--input',join(dir,'in.json'),'--output',join(dir,'out.json'),'--stategate-dir',pinDirectory])
      const bytes=readFileSync(join(dir,'out.json'));put(x,'OUT1','replay-output',bytes);put(x,'OUT2','replay-output',bytes)
      assert.deepEqual(verifyReplay(x),[], bytes.toString())
      x.artifacts=x.artifacts.filter(a=>a.artifact_id!=='OUT2')
      const bad=JSON.parse(bytes);bad.stategate.archived_proof_equal=false;put(x,'OUT2','replay-output',bad)
      assert.ok(verifyReplay(x).length)
    } finally {rmSync(dir,{recursive:true,force:true})}
  })
} else console.log('SKIP pinned C integration: pass --stategate-dir /clean/pinned/checkout')
console.log(`${count} synthetic regressions PASS; no experimental outcomes.`)
