#!/usr/bin/env node
// Common read-only evidence collector. Install and run this exact file in every arm.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const repo = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const configReadToken = process.env.CONFIG_READ_TOKEN
const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '')
const eventPath = process.env.GITHUB_EVENT_PATH
const outPath = process.env.COMMON_EVIDENCE_PATH || 'common-evidence.json'
const scenarioId = process.env.BENCHMARK_SCENARIO_ID
const arm = process.env.BENCHMARK_ARM
if (!repo || !token || !configReadToken || !eventPath || !/^SG-MO1-C[1-6]-R0[1-4]$/.test(scenarioId || '') || !['A', 'B', 'C'].includes(arm)) {
  throw new Error('Require repository/token/config-read-token/event plus valid BENCHMARK_SCENARIO_ID and BENCHMARK_ARM')
}

const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value)
const baseHeaders = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' }
const sources = []

async function request(url, accept = baseHeaders.accept, allowed = [200], credential = token) {
  const response = await fetch(url, { headers: { ...baseHeaders, authorization: `Bearer ${credential}`, accept } })
  const body = await response.text()
  const record = { url, status: response.status, accept, etag: response.headers.get('etag'), body_sha256: sha256(body), body }
  sources.push(record)
  if (!allowed.includes(response.status)) throw new Error(`GET ${url} failed: HTTP ${response.status}`)
  return { ...record, json: accept === 'application/vnd.github.diff' ? null : (body ? JSON.parse(body) : null), link: response.headers.get('link') }
}

async function pages(url, itemPath = null, accept = baseHeaders.accept, credential = token) {
  const items = []
  let next = url
  for (let pageNumber = 1; next; pageNumber += 1) {
    if (pageNumber > 100) throw new Error(`Pagination exceeded 100 pages: ${url}`)
    const page = await request(next, accept, [200], credential)
    const rows = itemPath ? page.json?.[itemPath] : page.json
    if (!Array.isArray(rows)) throw new Error(`Expected array at ${itemPath || '$'}: ${next}`)
    items.push(...rows)
    const match = page.link?.match(/<([^>]+)>;\s*rel="next"/)
    next = match?.[1] || null
    if (next && new URL(next).origin !== new URL(api).origin) throw new Error('Refusing cross-origin pagination link')
  }
  return items
}

const eventBytes = await readFile(eventPath)
const event = JSON.parse(eventBytes.toString('utf8'))
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && event.inputs?.checkpoint !== 'post-disposition') {
  throw new Error('workflow_dispatch checkpoint must be post-disposition')
}
const eventPr = event.pull_request || event.workflow_run?.pull_requests?.[0] || null
const prNumber = Number(process.env.PR_NUMBER || eventPr?.number || 0)
if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error('Event does not identify a pull request; set PR_NUMBER')
const prUrl = `${api}/repos/${repo}/pulls/${prNumber}`
const startedAt = new Date().toISOString()

const prStart = await request(prUrl)
const reviewsStart = await pages(`${prUrl}/reviews?per_page=100`)
const repository = await request(`${api}/repos/${repo}`)
const diff = await request(prUrl, 'application/vnd.github.diff')
const commits = await pages(`${prUrl}/commits?per_page=100`)
const timeline = await pages(`${api}/repos/${repo}/issues/${prNumber}/timeline?per_page=100`, null, 'application/vnd.github+json')
const headSha = prStart.json.head?.sha
const checks = await pages(`${api}/repos/${repo}/commits/${headSha}/check-runs?filter=all&per_page=100`, 'check_runs')
const runs = await pages(`${api}/repos/${repo}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=100`, 'workflow_runs')
const artifacts = []
for (const run of runs) {
  const runArtifacts = await pages(`${api}/repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`, 'artifacts')
  artifacts.push(...runArtifacts.map(a => ({ ...a, workflow_run_id: run.id })))
}
const baseRef = prStart.json.base?.ref
const protection = await request(`${api}/repos/${repo}/branches/${encodeURIComponent(baseRef)}/protection`, baseHeaders.accept, [200, 404], configReadToken)
const rulesets = await pages(`${api}/repos/${repo}/rulesets?includes_parents=true&per_page=100`, null, baseHeaders.accept, configReadToken)
const reviewsEnd = await pages(`${prUrl}/reviews?per_page=100`)
const prEnd = await request(prUrl)

const reviewProjection = rows => rows.map(r => ({ id: r.id, state: r.state, commit_id: r.commit_id, submitted_at: r.submitted_at, dismissed_at: r.dismissed_at ?? null, user_id: r.user?.id ?? null })).sort((a, b) => canonical(a).localeCompare(canonical(b)))
const stableObject = prStart.json.head?.sha === prEnd.json.head?.sha && prStart.json.base?.sha === prEnd.json.base?.sha && prStart.json.updated_at === prEnd.json.updated_at
const stableReviews = canonical(reviewProjection(reviewsStart)) === canonical(reviewProjection(reviewsEnd))
const canonicalDiff = diff.body.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
const trigger = {
  event_name: process.env.GITHUB_EVENT_NAME ?? null,
  event_action: event.action ?? null,
  checkpoint: event.inputs?.checkpoint ?? null,
  event_payload_sha256: sha256(eventBytes),
  workflow_run_id: process.env.GITHUB_RUN_ID ?? null,
  workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  workflow_sha: process.env.GITHUB_SHA ?? null,
  pr_number: eventPr?.number ?? prNumber,
  head_sha: eventPr?.head?.sha ?? event.workflow_run?.head_sha ?? null,
  base_sha: eventPr?.base?.sha ?? null,
  review_id: event.review?.id ?? null,
  review_commit_id: event.review?.commit_id ?? null,
  sender_id: event.sender?.id ?? null
}
const packet = {
  packet_version: '1.0.0', collection_started_at: startedAt, collection_ended_at: new Date().toISOString(),
  collection_status: stableObject && stableReviews ? 'CONSISTENT' : 'INCONSISTENT_RETRY_FORBIDDEN_AS_EVIDENCE',
  context: { scenario_id: scenarioId, repetition: Number(scenarioId.slice(-2)), arm },
  trigger,
  fetched_object: {
    repository: { id: repository.json.id, full_name: repository.json.full_name, html_url: repository.json.html_url },
    pull_request: { number: prEnd.json.number, html_url: prEnd.json.html_url, author_user_id: prEnd.json.user?.id ?? null, state: prEnd.json.state, draft: prEnd.json.draft, merged: prEnd.json.merged, mergeable: prEnd.json.mergeable, mergeable_state: prEnd.json.mergeable_state, created_at: prEnd.json.created_at, updated_at: prEnd.json.updated_at, merged_at: prEnd.json.merged_at, closed_at: prEnd.json.closed_at },
    head_sha: prEnd.json.head?.sha ?? null, base_sha: prEnd.json.base?.sha ?? null, base_ref: baseRef,
    diff_sha256: sha256(canonicalDiff), diff_canonicalization: 'LF_NORMALIZE_TERMINAL_LF_PRESERVE_PATCH_TEXT_AND_ORDER',
    commits, reviews: reviewProjection(reviewsEnd), checks, workflow_runs: runs, workflow_artifacts: artifacts,
    timeline, branch_protection: { status: protection.status, body: protection.json }, rulesets: { status: 200, body: rulesets }
  },
  consistency: {
    start_head_sha: prStart.json.head?.sha ?? null, end_head_sha: prEnd.json.head?.sha ?? null,
    start_base_sha: prStart.json.base?.sha ?? null, end_base_sha: prEnd.json.base?.sha ?? null,
    start_updated_at: prStart.json.updated_at, end_updated_at: prEnd.json.updated_at,
    reviews_start_sha256: sha256(canonical(reviewProjection(reviewsStart))), reviews_end_sha256: sha256(canonical(reviewProjection(reviewsEnd))),
    stable_object: stableObject, stable_reviews: stableReviews
  },
  provenance: { source: 'GitHub REST API', api_version: '2022-11-28', collector: 'common-collector.mjs@1.1.0', credential_classes: { common: 'GITHUB_TOKEN_READ_ONLY', configuration: 'BENCHMARK_ADMIN_READ_TOKEN_ADMINISTRATION_READ_ONLY' }, raw_event: { sha256: sha256(eventBytes), body: event }, responses: sources }
}
const output = `${JSON.stringify(packet, null, 2)}\n`
await writeFile(outPath, output, { mode: 0o600 })
process.stdout.write(`${sha256(output)} ${packet.collection_status}\n`)
if (packet.collection_status !== 'CONSISTENT') process.exitCode = 2
