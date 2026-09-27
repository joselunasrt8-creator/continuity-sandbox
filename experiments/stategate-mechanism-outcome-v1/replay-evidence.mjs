#!/usr/bin/env node
// Offline C6 replay. This file contains no network call and accepts only archived inputs.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const rawArgs = process.argv.slice(2)
const args = {}
for (let i = 0; i < rawArgs.length; i += 2) {
  if (!rawArgs[i].startsWith('--') || rawArgs[i + 1] === undefined) throw new Error('Arguments must be --name value pairs')
  args[rawArgs[i].slice(2)] = rawArgs[i + 1]
}
if (!args.input || !args.output) throw new Error('Usage: node replay-evidence.mjs --input replay-input.json --output replay-output.json [--stategate-dir /pinned/checkout]')
const inputBytes = await readFile(resolve(args.input))
const input = JSON.parse(inputBytes)
if (input.replay_input_version !== '1.0.0' || !['A', 'B', 'C'].includes(input.arm)) throw new Error('Invalid replay input version or arm')
if (input.common_packet?.collection_status !== 'CONSISTENT') throw new Error('Replay requires a CONSISTENT archived common packet')
const sha256 = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex')
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)
const normalize = value => typeof value === 'string' ? value.trim() : ''
const packet = input.common_packet
const native = input.native_input
if (packet.packet_version !== '1.2.0') throw new Error('Replay requires common packet version 1.2.0')
const nativeKeys = Object.keys(native || {}).sort()
if (nativeKeys.join(',') !== 'expected_base_sha,expected_diff_sha256,expected_head_sha' ||
    !/^[0-9a-f]{40}$/.test(native.expected_head_sha) || !/^[0-9a-f]{40}$/.test(native.expected_base_sha) ||
    !/^sha256:[0-9a-f]{64}$/.test(native.expected_diff_sha256)) {
  throw new Error('native_input must contain only exact expected head/base/diff identities')
}
if (!/^SG-MO1-C6-R0[1-4]$/.test(input.scenario_id || '') || packet.context?.scenario_id !== input.scenario_id || packet.context?.arm !== input.arm) {
  throw new Error('Replay scenario/arm must match the archived C6 packet')
}
if (!Array.isArray(packet.fetched_object?.checks) || !Array.isArray(packet.fetched_object?.reviews) || !Array.isArray(packet.fetched_object?.workflow_runs)) throw new Error('Archived check, review and workflow-run arrays are required')
if (input.arm === 'C' ? (!input.stategate_input || !input.archived_stategate_proof) : (input.stategate_input !== undefined || input.archived_stategate_proof !== undefined)) {
  throw new Error('StateGate input and proof are required only for Arm C')
}
const nativeReasons = []
if (packet.fetched_object.head_sha !== native.expected_head_sha) nativeReasons.push('HEAD_MISMATCH')
if (packet.fetched_object.base_sha !== native.expected_base_sha) nativeReasons.push('BASE_MISMATCH')
if (packet.fetched_object.diff_sha256 !== native.expected_diff_sha256) nativeReasons.push('DIFF_MISMATCH')
if (packet.fetched_object.base_ref !== `bench/${input.scenario_id}/base`) nativeReasons.push('TARGET_BRANCH_MISMATCH')

const headSha = packet.fetched_object.head_sha
const fixtureRuns = packet.fetched_object.workflow_runs.filter(run => run.name === 'Fixture CI' && run.head_sha === headSha)
  .sort((a, b) => Number(a.run_number) - Number(b.run_number) || Number(a.run_attempt) - Number(b.run_attempt) || Number(a.id) - Number(b.id))
const latestFixtureRun = fixtureRuns.at(-1) || null
const fixtureChecks = packet.fetched_object.checks.filter(check => check.name === 'fixture-ci' && check.head_sha === headSha &&
  latestFixtureRun && check.check_suite?.id === latestFixtureRun.check_suite_id).sort((a, b) => Number(a.id) - Number(b.id))
const latestFixtureCheck = fixtureChecks.at(-1) || null
const fixtureCiSuccess = latestFixtureRun?.status === 'completed' && latestFixtureRun?.conclusion === 'success' &&
  latestFixtureCheck?.status === 'completed' && latestFixtureCheck?.conclusion === 'success'
if (!fixtureCiSuccess) nativeReasons.push('FIXTURE_CI_NOT_SUCCESSFUL')

const latestReviewByUser = new Map()
for (const review of packet.fetched_object.reviews) {
  if (review.user_id == null) continue
  const current = latestReviewByUser.get(review.user_id)
  const order = `${review.submitted_at || ''}:${String(review.id).padStart(20, '0')}`
  if (!current || order > current.order) latestReviewByUser.set(review.user_id, { order, review })
}
const authorUserId = packet.fetched_object.pull_request.author_user_id
const currentHeadApprovals = [...latestReviewByUser.values()].filter(({ review }) =>
  review.state === 'APPROVED' && review.commit_id === headSha && review.user_id !== authorUserId).length
const currentHeadApproval = authorUserId != null && currentHeadApprovals >= 1
if (!currentHeadApproval) nativeReasons.push('CURRENT_HEAD_APPROVAL_MISSING')

const protection = packet.fetched_object.branch_protection
const reviewRule = protection?.body?.required_pull_request_reviews
const checkRule = protection?.body?.required_status_checks
const requiredCheckNames = [
  ...(checkRule?.contexts || []),
  ...(checkRule?.checks || []).map(check => check.context)
]
const bypass = reviewRule?.bypass_pull_request_allowances
const noBypass = bypass && ['users', 'teams', 'apps'].every(kind => Array.isArray(bypass[kind]) && bypass[kind].length === 0)
const rulesets = packet.fetched_object.rulesets
const noRepositoryRulesets = rulesets?.status === 200 && Array.isArray(rulesets.summaries) && rulesets.summaries.length === 0 &&
  Array.isArray(rulesets.definitions) && rulesets.definitions.length === 0
const nativeRulesVerified = protection?.status === 200 &&
  reviewRule?.dismiss_stale_reviews === true &&
  reviewRule?.require_last_push_approval === true &&
  reviewRule?.required_approving_review_count >= 1 &&
  checkRule?.strict === true && requiredCheckNames.includes('fixture-ci') &&
  noBypass &&
  noRepositoryRulesets &&
  protection?.body?.enforce_admins?.enabled === true &&
  protection?.body?.allow_force_pushes?.enabled === false &&
  protection?.body?.allow_deletions?.enabled === false
if (!nativeRulesVerified) nativeReasons.push('NATIVE_RULES_UNVERIFIED')
const nativeEligible = nativeReasons.length === 0

let stategate = null
if (input.arm === 'C') {
  if (!args['stategate-dir']) throw new Error('Arm C requires --stategate-dir at immutable commit dd6a607533b0c5c31eb99840e39d0a443998541a')
  const directory = resolve(args['stategate-dir'])
  const release = JSON.parse(await readFile(resolve(directory, 'release/RELEASE_MANIFEST.json'), 'utf8'))
  const commit = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const tree = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const worktreeStatus = execFileSync('git', ['-C', directory, 'status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' })
  if (commit !== 'dd6a607533b0c5c31eb99840e39d0a443998541a') throw new Error('StateGate checkout is not the frozen commit')
  if (tree !== 'ea9e6482f88dc8c41c4d2a5fe3e20f4c27808cf5' || worktreeStatus !== '') throw new Error('StateGate checkout tree is not the frozen clean worktree')
  if (release.release !== 'v1.1.1' || release.source_tree !== 'bc464b469320e6fcb2b0160b97b283f05fc4c59f' || release.release_hash !== 'sha256:e5faa5c90dfb275a9c7628a13c801a62f5fb6ea60cb098dc11d4ab016cf0ce50') {
    throw new Error('StateGate release manifest identity mismatch')
  }
  for (const file of release.files) {
    const bytes = await readFile(resolve(directory, file.path))
    if (sha256(bytes) !== `sha256:${file.sha256}`) throw new Error(`StateGate release file mismatch: ${file.path}`)
  }
  const releaseManifestBytes = await readFile(resolve(directory, 'release/RELEASE_MANIFEST.json'))
  if (sha256(releaseManifestBytes) !== 'sha256:f797073269e75d14e3be80824e1cb37a75ce81f44fbcc5c8f5e0d2f3e40449e5') throw new Error('StateGate release manifest byte identity mismatch')
  const stateGateInput = input.stategate_input
  const expectedStateGateKeys = [
    'actor', 'author_kind', 'base_sha', 'commit_trailers', 'diff_acquisition_failed', 'diff_source', 'evaluated_base_sha', 'evaluated_head_sha',
    'expected_diff_hash', 'expected_proof_hash', 'expected_review_evidence_hash', 'expected_validated_object_hash', 'head_ref', 'head_sha', 'minimum_approvals',
    'operator_id', 'pr_author', 'pr_body', 'pr_diff', 'pr_labels', 'pr_number', 'repo', 'require_agent_authored', 'require_review_approval',
    'review_acquisition_failed', 'review_evidence'
  ].sort()
  if (Object.keys(stateGateInput).sort().join(',') !== expectedStateGateKeys.join(',')) throw new Error('StateGate replay input key set differs from frozen post-acquisition input')
  const commonReviewEvidence = {
    head_sha: headSha,
    reviews: packet.fetched_object.reviews.map(review => ({
      reviewer: normalize(review.user_login).toLowerCase(),
      state: normalize(review.state).toUpperCase(),
      submitted_at: normalize(review.submitted_at),
      commit_id: normalize(review.commit_id)
    })).sort((a, b) => a.reviewer.localeCompare(b.reviewer) || a.submitted_at.localeCompare(b.submitted_at) || a.commit_id.localeCompare(b.commit_id) || a.state.localeCompare(b.state))
  }
  let stateGateReviewEvidence = stateGateInput.review_evidence
  if (typeof stateGateReviewEvidence === 'string') {
    try { stateGateReviewEvidence = JSON.parse(stateGateReviewEvidence) } catch { throw new Error('StateGate review evidence is malformed') }
  }
  if (stateGateReviewEvidence?.reviews) {
    stateGateReviewEvidence = {
      head_sha: normalize(stateGateReviewEvidence.head_sha),
      reviews: stateGateReviewEvidence.reviews.map(review => ({
        reviewer: normalize(review.reviewer).toLowerCase(), state: normalize(review.state).toUpperCase(),
        submitted_at: normalize(review.submitted_at), commit_id: normalize(review.commit_id)
      })).sort((a, b) => a.reviewer.localeCompare(b.reviewer) || a.submitted_at.localeCompare(b.submitted_at) || a.commit_id.localeCompare(b.commit_id) || a.state.localeCompare(b.state))
    }
  }
  const canonicalStateGateDiff = (typeof stateGateInput.pr_diff === 'string' ? stateGateInput.pr_diff : '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
  const bindingChecks = {
    decision_event: packet.trigger?.event_name === 'pull_request_review' && packet.trigger?.event_action === 'submitted' && packet.trigger?.pr_number === packet.fetched_object.pull_request.number && packet.trigger?.head_sha === headSha && packet.trigger?.base_sha === packet.fetched_object.base_sha && packet.trigger?.review_commit_id === headSha,
    repository: stateGateInput.repo === packet.fetched_object.repository.full_name,
    pull_request: String(stateGateInput.pr_number) === String(packet.fetched_object.pull_request.number),
    head: stateGateInput.head_sha === headSha && stateGateInput.evaluated_head_sha === headSha,
    base: stateGateInput.base_sha === packet.fetched_object.base_sha && stateGateInput.evaluated_base_sha === packet.fetched_object.base_sha,
    diff: sha256(canonicalStateGateDiff) === packet.fetched_object.diff_sha256 && stateGateInput.expected_diff_hash === packet.fetched_object.diff_sha256 && stateGateInput.diff_source === 'github_pull_request_diff_api' && stateGateInput.diff_acquisition_failed === false,
    review: canonical(stateGateReviewEvidence) === canonical(commonReviewEvidence) && stateGateInput.review_acquisition_failed === false,
    policy: String(stateGateInput.require_review_approval) === 'true' && Number(stateGateInput.minimum_approvals) === 1,
    workflow_inputs: stateGateInput.actor === packet.fetched_object.pull_request.author_login && normalize(stateGateInput.author_kind) === 'unknown' && String(stateGateInput.require_agent_authored) === 'false' && normalize(stateGateInput.pr_author) === '' && normalize(stateGateInput.head_ref) === '' && normalize(stateGateInput.pr_body) === '' && normalize(stateGateInput.pr_labels) === '' && normalize(stateGateInput.commit_trailers) === '' && normalize(stateGateInput.operator_id) === '' && normalize(stateGateInput.expected_proof_hash) === '' && normalize(stateGateInput.expected_validated_object_hash) === '' && normalize(stateGateInput.expected_review_evidence_hash) === ''
  }
  const failedBindings = Object.entries(bindingChecks).filter(([, matched]) => !matched).map(([name]) => name)
  if (failedBindings.length) throw new Error(`StateGate/common-packet binding mismatch: ${failedBindings.join(',')}`)
  const guard = await import(pathToFileURL(resolve(directory, 'guard.mjs')).href)
  const decision = guard.validateMergeGuard(stateGateInput)
  const proof = guard.proofFromDecision(decision)
  stategate = { binding_checks: bindingChecks, decision, proof, archived_proof_equal: JSON.stringify(proof) === JSON.stringify(input.archived_stategate_proof) }
}
const observedEligible = input.arm === 'C' ? nativeEligible && stategate.decision.result === 'VALID' : nativeEligible
const output = {
  replay_output_version: '1.0.0', scenario_id: input.scenario_id, arm: input.arm,
  input_sha256: sha256(inputBytes), native: { eligible: nativeEligible, reasons: nativeReasons, derived: { fixture_ci_success: fixtureCiSuccess, fixture_ci_run_id: latestFixtureRun?.id ?? null, fixture_ci_run_attempt: latestFixtureRun?.run_attempt ?? null, fixture_ci_check_id: latestFixtureCheck?.id ?? null, current_head_approval: currentHeadApproval, current_head_approval_count: currentHeadApprovals, native_rules_verified: nativeRulesVerified } },
  stategate, observed_eligible: observedEligible
}
const bytes = JSON.stringify(output, null, 2) + '\n'
await writeFile(resolve(args.output), bytes, { mode: 0o600 })
process.stdout.write(sha256(bytes) + '\n')
