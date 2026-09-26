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
const packet = input.common_packet
const native = input.native_input
const nativeReasons = []
if (packet.fetched_object.head_sha !== native.expected_head_sha) nativeReasons.push('HEAD_MISMATCH')
if (packet.fetched_object.base_sha !== native.expected_base_sha) nativeReasons.push('BASE_MISMATCH')
if (packet.fetched_object.diff_sha256 !== native.expected_diff_sha256) nativeReasons.push('DIFF_MISMATCH')
if (!native.fixture_ci_success) nativeReasons.push('FIXTURE_CI_NOT_SUCCESSFUL')
if (!native.current_head_approval) nativeReasons.push('CURRENT_HEAD_APPROVAL_MISSING')
if (!native.native_rules_verified) nativeReasons.push('NATIVE_RULES_UNVERIFIED')
const nativeEligible = nativeReasons.length === 0

let stategate = null
if (input.arm === 'C') {
  if (!args['stategate-dir']) throw new Error('Arm C requires --stategate-dir at immutable commit dd6a607533b0c5c31eb99840e39d0a443998541a')
  const directory = resolve(args['stategate-dir'])
  const release = JSON.parse(await readFile(resolve(directory, 'release/RELEASE_MANIFEST.json'), 'utf8'))
  const commit = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (commit !== 'dd6a607533b0c5c31eb99840e39d0a443998541a') throw new Error('StateGate checkout is not the frozen commit')
  if (release.release !== 'v1.1.1' || release.source_tree !== 'bc464b469320e6fcb2b0160b97b283f05fc4c59f' || release.release_hash !== 'sha256:e5faa5c90dfb275a9c7628a13c801a62f5fb6ea60cb098dc11d4ab016cf0ce50') {
    throw new Error('StateGate release manifest identity mismatch')
  }
  const guard = await import(pathToFileURL(resolve(directory, 'guard.mjs')).href)
  const decision = guard.validateMergeGuard(input.stategate_input)
  const proof = guard.proofFromDecision(decision)
  stategate = { decision, proof, archived_proof_equal: JSON.stringify(proof) === JSON.stringify(input.archived_stategate_proof) }
}
const observedEligible = input.arm === 'C' ? nativeEligible && stategate.decision.result === 'VALID' : nativeEligible
const output = {
  replay_output_version: '1.0.0', scenario_id: input.scenario_id, arm: input.arm,
  input_sha256: sha256(inputBytes), native: { eligible: nativeEligible, reasons: nativeReasons },
  stategate, observed_eligible: observedEligible
}
const bytes = JSON.stringify(output, null, 2) + '\n'
await writeFile(resolve(args.output), bytes, { mode: 0o600 })
process.stdout.write(sha256(bytes) + '\n')
