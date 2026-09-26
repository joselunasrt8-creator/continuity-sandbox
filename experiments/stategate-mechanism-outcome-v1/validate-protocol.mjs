#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const readJson = async name => JSON.parse(await readFile(join(root, name), 'utf8'))
const [scenarios, schema, classifier, manifest, freeze, evidence, fixtures, baseTrees] = await Promise.all([
  readJson('SCENARIOS.json'), readJson('OUTCOME_OBJECT.schema.json'), readJson('TERMINAL_CLASSIFIER.json'),
  readJson('experiment-manifest.json'), readJson('freeze-manifest.json'), readJson('evidence-fields.json'),
  readJson('fixtures/FIXTURE_MANIFEST.json'), readJson('fixtures/BASE_TREE_MANIFEST.json')
])
const errors = []
const assert = (condition, message) => { if (!condition) errors.push(message) }
const sha = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const getPath = (object, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], object)
const isUtcRfc3339 = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value))

const ids = scenarios.scenarios.map(row => row.scenario_id)
assert(ids.length === 24 && new Set(ids).size === 24, 'must contain exactly 24 unique scenario IDs')
assert(scenarios.scenario_classes.length === 6, 'must contain six scenario classes')
assert(scenarios.design.matched_sets === 24 && scenarios.design.maximum_pr_episodes === 72, 'design count mismatch')
for (const cls of scenarios.scenario_classes) {
  const rows = scenarios.scenarios.filter(row => row.scenario_class_id === cls.scenario_class_id)
  assert(rows.length === 4, cls.scenario_class_id + ' must have four repetitions')
  assert(new Set(rows.map(row => row.semantic_class)).size === 1, cls.scenario_class_id + ' semantic label drift')
}
for (const row of scenarios.scenarios) {
  const match = row.scenario_id.match(/^SG-MO1-(C[1-6])-R0([1-4])$/)
  assert(Boolean(match), row.scenario_id + ' invalid ID')
  assert(Number(match?.[2]) === row.repetition, row.scenario_id + ' repetition does not match Rxx suffix')
  assert(match?.[1] === row.scenario_class_id, row.scenario_id + ' class does not match ID')
  const planned = scenarios.scenario_classes.find(cls => cls.scenario_class_id === row.scenario_class_id)?.planned_eligible
  assert(row.ground_truth.eligible === planned, row.scenario_id + ' ground truth disagrees with frozen class')
  assert(row.matched_arms.join(',') === 'A,B,C', row.scenario_id + ' arm coverage invalid')
  assert(row.ground_truth.source.includes('arm output is excluded'), row.scenario_id + ' ground truth not arm-independent')
  for (const field of ['setup_procedure', 'ground_truth', 'event_mutation_sequence', 'evidence_requirements', 'expected_observations', 'stopping_behavior', 'permitted_deviations']) {
    assert(row[field] != null, row.scenario_id + ' missing ' + field)
  }
}
assert(scenarios.fixture_binding.manifest === 'fixtures/FIXTURE_MANIFEST.json', 'scenario fixture binding missing')
assert(scenarios.offline_replay.classes.join(',') === 'C6', 'offline replay class drift')
assert(scenarios.offline_replay.network_rule.includes('disabled'), 'offline replay must prohibit network')

const pin = 'dd6a607533b0c5c31eb99840e39d0a443998541a'
assert(/^[0-9a-f]{40}$/.test(manifest.stategate.immutable_commit_sha), 'StateGate pin must be full commit SHA')
assert(manifest.stategate.immutable_commit_sha === pin, 'StateGate pin drift')
assert(manifest.stategate.uses.endsWith('@' + pin), 'StateGate uses ref not immutable pin')
assert(manifest.scenario_execution_authorized === false && manifest.outcomes_collected === false, 'protocol-only terminal must be explicit')
assert(scenarios.design.execution_authorized === false, 'scenario execution must remain unauthorized')
assert(classifier.terminal_values.join(',') === 'MEASURABLE_IMPROVEMENT,NO_MATERIAL_DIFFERENCE,MEASURABLE_HARM,TOO_COSTLY,BLOCKED,INDETERMINATE', 'terminal classifier values/order changed')
assert(classifier.improvement_gate.all_required.length === 5, 'improvement gate incomplete')
assert(classifier.precedence.length === 6 && classifier.harm_rules.false_allow, 'terminal harm/precedence definitions incomplete')

assert(evidence.fields.length === 32, 'evidence completeness catalog must have exactly 32 atomic fields')
assert(new Set(evidence.fields.map(field => field.id)).size === 32, 'evidence field IDs must be unique')
for (const cls of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
  const denominator = evidence.fields.filter(field => field.terminal_metric && field.applicable_classes.includes(cls)).length
  assert(evidence.denominators[cls] === denominator && denominator === 32, cls + ' completeness denominator drift')
}

function gitObjectHash(type, bytes) {
  return sha('sha1', Buffer.concat([Buffer.from(type + ' ' + bytes.length + '\0'), bytes]))
}
for (const [state, spec] of Object.entries(fixtures.states)) {
  const bytes = await readFile(join(root, spec.source_file))
  assert(bytes.length === spec.byte_length, state + ' fixture byte length drift')
  assert('sha256:' + sha('sha256', bytes) === spec.sha256, state + ' fixture SHA-256 drift')
  const blob = gitObjectHash('blob', bytes)
  assert(blob === spec.git_blob_sha1, state + ' git blob drift')
  const entry = Buffer.concat([Buffer.from('100644 benchmark-fixture.txt\0'), Buffer.from(blob, 'hex')])
  assert(gitObjectHash('tree', entry) === spec.single_file_tree_sha1, state + ' fixture tree drift')
}
for (const [name, spec] of Object.entries(fixtures.patches)) {
  const bytes = await readFile(join(root, spec.source_file))
  assert(bytes.length === spec.byte_length, name + ' patch byte length drift')
  assert('sha256:' + sha('sha256', bytes) === spec.sha256, name + ' patch SHA-256 drift')
}

async function virtualTreeHash(pathMap) {
  const rootNode = {}
  for (const [destination, source] of Object.entries(pathMap)) {
    const parts = destination.split('/')
    let node = rootNode
    for (const part of parts.slice(0, -1)) node = node[part] ||= {}
    node[parts.at(-1)] = { bytes: await readFile(join(root, source)) }
  }
  function hashNode(node) {
    const entries = Object.entries(node).map(([name, value]) => {
      const directory = !('bytes' in value)
      const hash = directory ? hashNode(value) : gitObjectHash('blob', value.bytes)
      return { name, directory, hash }
    }).sort((a, b) => Buffer.compare(Buffer.from(a.name + (a.directory ? '/' : '')), Buffer.from(b.name + (b.directory ? '/' : ''))))
    const bytes = Buffer.concat(entries.map(entry => Buffer.concat([
      Buffer.from((entry.directory ? '40000' : '100644') + ' ' + entry.name + '\0'),
      Buffer.from(entry.hash, 'hex')
    ])))
    return gitObjectHash('tree', bytes)
  }
  return hashNode(rootNode)
}
for (const arm of ['A', 'B', 'C']) {
  const files = { ...baseTrees.common_files, ...baseTrees.arms[arm].additional_files }
  assert(await virtualTreeHash(files) === baseTrees.arms[arm].root_git_tree_sha1, 'Arm ' + arm + ' frozen base root tree drift')
}

const requiredFields = schema.required
assert(schema.allOf.length === schema['x-null-requires-missingness'].length + 5, 'schema null-missingness conditional count drift')
for (const path of schema['x-null-requires-missingness']) {
  assert(schema.allOf.some(rule => JSON.stringify(rule.then || {}).includes('"const":"' + path + '"')), 'schema lacks standard missingness conditional: ' + path)
}
for (const name of ['scenario_id', 'arm', 'trial_id', 'repository', 'pull_request', 'head', 'base', 'diff_identity', 'review_state', 'timestamps', 'ground_truth_eligible', 'observed_eligible', 'execution_outcome', 'false_allow', 'false_block', 'decision_time_seconds', 'added_gating_delay_seconds', 'operator_handling_seconds', 'event_counts', 'rework', 'evidence_completeness_percent', 'proof_fidelity', 'audit_reconstruction_seconds', 'ci_elapsed_seconds', 'ci_billable_minutes', 'manual_interventions', 'reproducibility', 'decision_changed_vs_A', 'economic_proxy', 'missingness', 'deviations', 'provenance', 'artifacts']) {
  assert(requiredFields.includes(name), 'outcome schema missing ' + name)
}

const protocolArtifacts = new Set(manifest.protocol_artifacts)
const frozenArtifacts = new Set(Object.keys(freeze.protocol_artifact_hashes))
assert(/^[0-9a-f]{40}$/.test(freeze.protocol_commit_sha), 'freeze protocol_commit_sha must be full SHA')
for (const file of protocolArtifacts) {
  try { await readFile(join(root, file)) } catch { errors.push('missing declared artifact: ' + file) }
  if (file !== 'freeze-manifest.json') assert(frozenArtifacts.has(file), 'freeze manifest missing hash: ' + file)
}
for (const file of frozenArtifacts) {
  assert(protocolArtifacts.has(file), 'freeze manifest hashes undeclared artifact: ' + file)
  const bytes = await readFile(join(root, file))
  assert('sha256:' + sha('sha256', bytes) === freeze.protocol_artifact_hashes[file], 'freeze hash mismatch: ' + file)
  try {
    const committed = execFileSync('git', ['show', freeze.protocol_commit_sha + ':experiments/stategate-mechanism-outcome-v1/' + file])
    assert('sha256:' + sha('sha256', committed) === freeze.protocol_artifact_hashes[file], 'payload commit hash mismatch: ' + file)
  } catch {
    errors.push('cannot verify artifact at protocol_commit_sha: ' + file)
  }
}
assert(!frozenArtifacts.has('freeze-manifest.json'), 'freeze manifest must not hash itself')

function validate(value, currentSchema, at, out) {
  if (currentSchema.const !== undefined && !Object.is(value, currentSchema.const)) out.push(at + ': const mismatch')
  if (currentSchema.enum && !currentSchema.enum.some(item => Object.is(item, value))) out.push(at + ': enum mismatch')
  if (currentSchema.type) {
    const types = Array.isArray(currentSchema.type) ? currentSchema.type : [currentSchema.type]
    const ok = types.some(type => type === 'null' ? value === null : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : type === 'array' ? Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' : typeof value === type)
    if (!ok) { out.push(at + ': type mismatch'); return }
  }
  if (typeof value === 'string') {
    if (currentSchema.pattern && !(new RegExp(currentSchema.pattern).test(value))) out.push(at + ': pattern mismatch')
    if (currentSchema.minLength && value.length < currentSchema.minLength) out.push(at + ': minLength')
    if (currentSchema.format === 'date-time' && !isUtcRfc3339(value)) out.push(at + ': invalid UTC RFC 3339 date-time')
    if (currentSchema.format === 'uri') { try { new URL(value) } catch { out.push(at + ': invalid URI') } }
  }
  if (typeof value === 'number') {
    if (currentSchema.minimum !== undefined && value < currentSchema.minimum) out.push(at + ': minimum')
    if (currentSchema.maximum !== undefined && value > currentSchema.maximum) out.push(at + ': maximum')
  }
  if (Array.isArray(value)) {
    if (currentSchema.minItems !== undefined && value.length < currentSchema.minItems) out.push(at + ': minItems')
    if (currentSchema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) out.push(at + ': uniqueItems')
    if (currentSchema.items) value.forEach((item, index) => validate(item, currentSchema.items, at + '[' + index + ']', out))
    if (currentSchema.contains && !value.some(item => { const candidate = []; validate(item, currentSchema.contains, at, candidate); return candidate.length === 0 })) out.push(at + ': contains')
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of currentSchema.required || []) if (!(required in value)) out.push(at + ': missing ' + required)
    if (currentSchema.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in (currentSchema.properties || {}))) out.push(at + ': additional property ' + key)
    for (const [key, child] of Object.entries(value)) if (currentSchema.properties?.[key]) validate(child, currentSchema.properties[key], at + '.' + key, out)
  }
  for (const condition of currentSchema.allOf || []) {
    const conditionErrors = []
    validate(value, condition.if || {}, at, conditionErrors)
    if (conditionErrors.length === 0 && condition.then) validate(value, condition.then, at, out)
  }
}

function validateOutcome(outcome) {
  const outcomeErrors = []
  validate(outcome, schema, '$', outcomeErrors)
  const scenario = scenarios.scenarios.find(row => row.scenario_id === outcome.scenario_id)
  if (!scenario) outcomeErrors.push('$.scenario_id: not found in SCENARIOS.json')
  if (scenario && outcome.repetition !== scenario.repetition) outcomeErrors.push('$.repetition: does not match scenario')
  if (scenario && outcome.ground_truth_eligible !== scenario.ground_truth.eligible) outcomeErrors.push('$.ground_truth_eligible: does not match frozen scenario')
  const expectedFalseAllow = outcome.observed_eligible === null ? null : !outcome.ground_truth_eligible && outcome.observed_eligible
  const expectedFalseBlock = outcome.observed_eligible === null ? null : outcome.ground_truth_eligible && !outcome.observed_eligible
  if (outcome.false_allow !== expectedFalseAllow) outcomeErrors.push('$.false_allow: must be derived from eligibility')
  if (outcome.false_block !== expectedFalseBlock) outcomeErrors.push('$.false_block: must be derived from eligibility')
  const missingPaths = new Set((outcome.missingness || []).map(item => item.field_path))
  for (const path of schema['x-null-requires-missingness']) {
    if (getPath(outcome, path) === null && !missingPaths.has(path)) outcomeErrors.push('$.' + path + ': null lacks matching missingness record')
  }
  return outcomeErrors
}

const protocol = await readFile(join(root, 'PROTOCOL.md'), 'utf8')
const plan = await readFile(join(root, 'analysis-plan.md'), 'utf8')
for (const metric of ['false allow', 'false block', 'decision time', 'added gating delay', 'operator overhead', 'rework', 'missed invalid state', 'evidence completeness', 'proof fidelity', 'audit reconstruction time', 'CI/runtime burden', 'manual intervention', 'reproducibility', 'Decision changes', 'economic proxy']) {
  assert(plan.toLowerCase().includes(metric.toLowerCase()), 'analysis plan missing metric: ' + metric)
}
for (const file of ['SCENARIOS.json', 'OUTCOME_OBJECT.schema.json', 'TERMINAL_CLASSIFIER.json', 'evidence-requirements.md', 'evidence-fields.json', 'analysis-plan.md', 'common-collector.mjs', 'common-collector.yml', 'snapshot-collector.mjs', 'snapshot-collector.yml', 'replay-evidence.mjs', 'fixtures/BASE_TREE_MANIFEST.json', 'fixtures/FIXTURE_MANIFEST.json', 'fixture-ci.yml', 'stategate-required-check.yml']) {
  assert(protocol.includes(file), 'protocol does not reference ' + file)
}
const stategateWorkflow = await readFile(join(root, 'stategate-required-check.yml'), 'utf8')
assert(stategateWorkflow.includes('stategate@' + pin), 'workflow StateGate SHA drift')
assert(stategateWorkflow.includes('pull_request_review:'), 'StateGate must re-evaluate after review updates')
assert(!/contents:\s*write|pull-requests:\s*write|checks:\s*write/.test(stategateWorkflow), 'workflow has write authority beyond artifact upload')
const commonCollector = await readFile(join(root, 'common-collector.mjs'), 'utf8')
assert(commonCollector.includes('prStart') && commonCollector.includes('prEnd') && commonCollector.includes('reviewsStart') && commonCollector.includes('reviewsEnd'), 'common collector lacks consistency bracket')
assert(commonCollector.includes('/protection') && commonCollector.includes('/rulesets') && commonCollector.includes('/check-runs') && commonCollector.includes('/artifacts'), 'common collector endpoint coverage incomplete')
const snapshot = await readFile(join(root, 'snapshot-collector.mjs'), 'utf8')
assert(!/mergePullRequest|merge_pull_request|decision\s*=\s*['"]eligible/i.test(snapshot), 'snapshot comparator must not decide or merge')
assert(snapshot.includes('event_payload_sha256') && snapshot.includes('stable_object') && snapshot.includes('stable_reviews'), 'snapshot lacks trigger identity or consistency check')
const replay = await readFile(join(root, 'replay-evidence.mjs'), 'utf8')
assert(!/\bfetch\s*\(/.test(replay), 'offline replay must not contain network fetch')
assert(replay.includes(pin) && replay.includes('validateMergeGuard'), 'offline replay lacks pinned StateGate validation')

const placeholder = {}
for (const key of requiredFields) placeholder[key] = null
placeholder.schema_version = '1.1.0'; placeholder.scenario_id = 'SG-MO1-C1-R01'; placeholder.arm = 'A'; placeholder.trial_id = 'STRUCTURAL_SCHEMA_CHECK'; placeholder.repetition = 1
placeholder.repository = { owner: 'owner', name: 'repo', id: null, url: 'https://example.invalid/repo' }
placeholder.pull_request = { number: null, url: null, event_id: null }
placeholder.head = { event_sha: null, decision_sha: null, executed_sha: null }
placeholder.base = { event_sha: null, decision_sha: null }
placeholder.diff_identity = { intended_sha256: null, observed_sha256: null, executed_sha256: null, canonicalization: null }
placeholder.review_state = { decision_head_sha: null, approval_count: null, latest_approval_ids: [], evidence_sha256: null }
placeholder.timestamps = Object.fromEntries(['opened_at', 'event_at', 'decision_at', 'execution_at', 'collection_started_at', 'collection_ended_at', 'native_checks_success_at'].map(key => [key, null]))
placeholder.ground_truth_eligible = true
placeholder.economic_proxy = { labor_cost: null, ci_cost: null, currency: null, rate_source: null }
placeholder.missingness = schema['x-null-requires-missingness'].map(path => ({ field_path: path, code: 'NOT_COLLECTED', reason: 'ephemeral schema validation', discovered_at: '2026-09-26T00:00:00Z', actor: 'validator' }))
placeholder.deviations = []
placeholder.artifacts = [{ artifact_id: 'SCHEMA-ONLY', kind: 'schema-structure', sha256: 'sha256:' + '0'.repeat(64), source: 'ephemeral structural validation', captured_at: '2026-09-26T00:00:00Z' }]
placeholder.provenance = { collector_version: null, collector_sha256: null, workflow_sha: null, stategate_sha: null, observed_at: '2026-09-26T00:00:00Z' }
for (const key of ['event_counts', 'rework']) placeholder[key] = Object.fromEntries(Object.keys(schema.properties[key].properties).map(field => [field, null]))
const placeholderErrors = validateOutcome(placeholder)
assert(placeholderErrors.length === 0, 'structural placeholder rejected: ' + placeholderErrors.join('; '))

const contradiction = structuredClone(placeholder)
contradiction.observed_eligible = true; contradiction.false_allow = true; contradiction.false_block = false
assert(validateOutcome(contradiction).some(error => error.includes('false_allow')), 'negative test failed: contradictory false allow accepted')
const invalidTime = structuredClone(placeholder)
invalidTime.timestamps.event_at = 'not-a-time'
assert(validateOutcome(invalidTime).some(error => error.includes('date-time')), 'negative test failed: invalid timestamp accepted')
const wrongRepetition = structuredClone(placeholder)
wrongRepetition.repetition = 4
assert(validateOutcome(wrongRepetition).some(error => error.includes('repetition')), 'negative test failed: scenario/repetition mismatch accepted')
const missingReason = structuredClone(placeholder)
missingReason.missingness = missingReason.missingness.filter(item => item.field_path !== 'decision_time_seconds')
assert(validateOutcome(missingReason).some(error => error.includes('decision_time_seconds')), 'negative test failed: unannotated null accepted')

for (const file of process.argv.slice(2)) {
  const outcome = JSON.parse(await readFile(file, 'utf8'))
  const outcomeErrors = validateOutcome(outcome)
  if (outcomeErrors.length) errors.push(file + ': ' + outcomeErrors.join('; '))
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('Protocol consistency PASS: 24 scenarios, 6 classes, 24 matched sets, 72 maximum episodes, 32-field completeness denominator.')
console.log('Outcome invariants PASS: eligibility-derived errors, scenario/repetition/ground-truth binding, UTC RFC 3339 timestamps, and null missingness.')
console.log('Fixture identities PASS: exact bytes, SHA-256, git blobs, single-file trees, and patch bytes.')
console.log('Freeze manifest PASS: every declared non-self artifact hash matches current bytes.')
console.log('No experimental outcomes created or required by this validation.')
