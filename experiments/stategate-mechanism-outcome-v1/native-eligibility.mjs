export function deriveNative(packet, input) {
  const native = input.native_input
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
const authorizedReviewer = packet.fetched_object.authorized_reviewer
const reviewerAuthorized = authorizedReviewer?.status === 200 &&
  ['write', 'maintain', 'admin'].includes(authorizedReviewer.permission) &&
  Number.isInteger(authorizedReviewer.user_id) && authorizedReviewer.user_id !== authorUserId &&
  typeof authorizedReviewer.login === 'string' && authorizedReviewer.login.length > 0
if (!reviewerAuthorized) nativeReasons.push('AUTHORIZED_REVIEWER_UNVERIFIED')
const currentHeadApprovals = [...latestReviewByUser.values()].filter(({ review }) =>
  reviewerAuthorized && review.state === 'APPROVED' && review.commit_id === headSha && review.user_id === authorizedReviewer.user_id && review.user_login?.toLowerCase() === authorizedReviewer.login.toLowerCase()).length
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
  reviewRule?.required_approving_review_count === 1 &&
  checkRule?.strict === true && [...new Set(requiredCheckNames)].sort().join(',') === (input.arm === 'C' ? 'fixture-ci,stategate' : 'fixture-ci') &&
  noBypass &&
  noRepositoryRulesets &&
  protection?.body?.enforce_admins?.enabled === true &&
  protection?.body?.allow_force_pushes?.enabled === false &&
  protection?.body?.allow_deletions?.enabled === false
if (!nativeRulesVerified) nativeReasons.push('NATIVE_RULES_UNVERIFIED')
// Every frozen required check must be the terminal latest-attempt check.
for (const context of (input.arm === 'C' ? ['fixture-ci', 'stategate'] : ['fixture-ci'])) {
  const workflowName = context === 'fixture-ci' ? 'Fixture CI' : 'StateGate required check'
  const run = packet.fetched_object.workflow_runs.filter(r => r.name === workflowName && r.head_sha === headSha)
    .sort((a, b) => Number(a.run_number) - Number(b.run_number) || Number(a.run_attempt) - Number(b.run_attempt) || Number(a.id) - Number(b.id)).at(-1)
  const check = packet.fetched_object.checks.filter(c => c.name === context && c.head_sha === headSha && run && c.check_suite?.id === run.check_suite_id)
    .sort((a, b) => Number(a.id) - Number(b.id)).at(-1)
  if (!(run?.status === 'completed' && run.conclusion === 'success' && check?.status === 'completed' && check.conclusion === 'success')) nativeReasons.push(`REQUIRED_CHECK_NOT_SUCCESSFUL:${context}`)
}
// Conservative: GitHub unknown/conflicting/behind/blocked states cannot become eligible.
const pr = packet.fetched_object.pull_request
if (!(pr.mergeable === true && pr.mergeable_state === 'clean' && pr.state === 'open' && pr.draft === false)) nativeReasons.push('MERGEABILITY_NOT_AFFIRMATIVE')
const nativeEligible = nativeReasons.length === 0

return { nativeReasons, nativeEligible, headSha, latestFixtureRun, latestFixtureCheck, fixtureCiSuccess, currentHeadApproval, currentHeadApprovals, nativeRulesVerified }
}
