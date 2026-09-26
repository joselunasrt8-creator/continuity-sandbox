#!/usr/bin/env node
// Arm B evidence-only comparator. It deliberately does not decide eligibility or gate merge.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const repo = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const eventPath = process.env.GITHUB_EVENT_PATH
const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '')
if (!repo || !token || !eventPath) throw new Error('Require GITHUB_REPOSITORY, read-only GITHUB_TOKEN, and GITHUB_EVENT_PATH')
const eventBytes = await readFile(eventPath)
const event = JSON.parse(eventBytes.toString('utf8'))
const prNumber = Number(process.env.PR_NUMBER || event.pull_request?.number || 0)
if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error('Event does not identify a pull request')

const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value)
const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' }
async function get(url, accept = headers.accept) {
  const response = await fetch(url, { headers: { ...headers, accept } })
  const body = await response.text()
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`)
  return { body, json: accept === 'application/vnd.github.diff' ? null : JSON.parse(body), etag: response.headers.get('etag'), link: response.headers.get('link'), url }
}
async function getReviews(url) {
  const rows = [], provenance = []
  let next = `${url}/reviews?per_page=100`
  while (next) {
    const page = await get(next)
    if (!Array.isArray(page.json)) throw new Error(`Review response was not an array: ${next}`)
    rows.push(...page.json.map(r => ({ reviewer_id: r.user?.id ?? null, state: r.state ?? null, submitted_at: r.submitted_at ?? null, commit_id: r.commit_id ?? null, id: r.id ?? null })))
    provenance.push({ url: page.url, body_sha256: sha256(page.body), etag: page.etag })
    const match = page.link?.match(/<([^>]+)>;\s*rel="next"/)
    next = match?.[1] || null
    if (next && new URL(next).origin !== new URL(api).origin) throw new Error('Refusing cross-origin review pagination link')
  }
  return { rows: rows.sort((a, b) => canonical(a).localeCompare(canonical(b))), provenance }
}

const prUrl = `${api}/repos/${repo}/pulls/${prNumber}`
const prStart = await get(prUrl)
const reviewsStart = await getReviews(prUrl)
const repository = await get(`${api}/repos/${repo}`)
const diff = await get(prUrl, 'application/vnd.github.diff')
const reviewsEnd = await getReviews(prUrl)
const prEnd = await get(prUrl)
const stableObject = prStart.json.head?.sha === prEnd.json.head?.sha && prStart.json.base?.sha === prEnd.json.base?.sha && prStart.json.updated_at === prEnd.json.updated_at
const stableReviews = canonical(reviewsStart.rows) === canonical(reviewsEnd.rows)
const canonicalDiff = diff.body.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
const snapshot = {
  snapshot_version: '1.1.0', observed_at: new Date().toISOString(),
  collection_status: stableObject && stableReviews ? 'CONSISTENT' : 'INCONSISTENT_NOT_EVIDENCE',
  trigger: {
    event_name: process.env.GITHUB_EVENT_NAME ?? null, event_action: event.action ?? null,
    event_payload_sha256: sha256(eventBytes), workflow_run_id: process.env.GITHUB_RUN_ID ?? null,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, workflow_sha: process.env.GITHUB_SHA ?? null,
    pr_number: event.pull_request?.number ?? prNumber, head_sha: event.pull_request?.head?.sha ?? null,
    base_sha: event.pull_request?.base?.sha ?? null, review_id: event.review?.id ?? null,
    review_commit_id: event.review?.commit_id ?? null
  },
  repository: { id: repository.json.id, full_name: repository.json.full_name, html_url: repository.json.html_url },
  pull_request: { number: prEnd.json.number, html_url: prEnd.json.html_url, state: prEnd.json.state, draft: prEnd.json.draft, created_at: prEnd.json.created_at, updated_at: prEnd.json.updated_at },
  fetched_object: { head_sha: prEnd.json.head?.sha ?? null, base_sha: prEnd.json.base?.sha ?? null, diff_sha256: sha256(canonicalDiff), diff_canonicalization: 'LF_NORMALIZE_TERMINAL_LF_PRESERVE_PATCH_TEXT_AND_ORDER' },
  reviews: reviewsEnd.rows,
  consistency: { stable_object: stableObject, stable_reviews: stableReviews, start_head_sha: prStart.json.head?.sha ?? null, end_head_sha: prEnd.json.head?.sha ?? null, start_base_sha: prStart.json.base?.sha ?? null, end_base_sha: prEnd.json.base?.sha ?? null, reviews_start_sha256: sha256(canonical(reviewsStart.rows)), reviews_end_sha256: sha256(canonical(reviewsEnd.rows)) },
  provenance: {
    source: 'GitHub REST API', api_version: '2022-11-28', pr_url: prUrl,
    pr_start_body_sha256: sha256(canonical(prStart.json)), pr_end_body_sha256: sha256(canonical(prEnd.json)),
    repository_url: repository.url, repository_body_sha256: sha256(canonical(repository.json)),
    diff_url: diff.url, diff_raw_body_sha256: sha256(diff.body), reviews: reviewsStart.provenance.concat(reviewsEnd.provenance)
  }
}
const bytes = `${JSON.stringify(snapshot, null, 2)}\n`
await writeFile(process.env.SNAPSHOT_PATH || 'pr-state-snapshot.json', bytes, { mode: 0o600 })
process.stdout.write(`${sha256(bytes)} ${snapshot.collection_status}\n`)
if (snapshot.collection_status !== 'CONSISTENT') process.exitCode = 2
