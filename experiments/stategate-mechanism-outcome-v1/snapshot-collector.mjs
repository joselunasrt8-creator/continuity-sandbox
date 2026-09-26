#!/usr/bin/env node
// Arm B evidence-only snapshot. It deliberately does not decide eligibility or gate merge.
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const repo = process.env.GITHUB_REPOSITORY
const prNumber = process.env.PR_NUMBER || process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER
const token = process.env.GITHUB_TOKEN
const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '')
if (!repo || !/^\d+$/.test(String(prNumber || '')) || !token) {
  throw new Error('Require GITHUB_REPOSITORY, PR_NUMBER, and read-only GITHUB_TOKEN')
}
const sha256 = (s) => `sha256:${createHash('sha256').update(s).digest('hex')}`
const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` :
  v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v)
const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' }
async function get(url, accept = headers.accept) {
  const r = await fetch(url, { headers: { ...headers, accept } })
  const body = await r.text()
  if (!r.ok) throw new Error(`GET ${url} failed: HTTP ${r.status}`)
  return { body, etag: r.headers.get('etag'), link: r.headers.get('link'), url }
}
const prUrl = `${api}/repos/${repo}/pulls/${prNumber}`
const prRaw = await get(prUrl)
const pr = JSON.parse(prRaw.body)
const repositoryRaw = await get(`${api}/repos/${repo}`)
const repository = JSON.parse(repositoryRaw.body)
const diffRaw = await get(prUrl, 'application/vnd.github.diff')
let reviews = [], reviewSources = [], next = `${api}/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`
while (next) {
  const page = await get(next)
  const rows = JSON.parse(page.body)
  if (!Array.isArray(rows)) throw new Error(`Review response was not an array: ${page.url}`)
  reviews.push(...rows.map(r => ({ reviewer: r.user?.login ?? null, state: r.state ?? null, submitted_at: r.submitted_at ?? null, commit_id: r.commit_id ?? null, id: r.id ?? null })))
  reviewSources.push({ url: page.url, body_sha256: sha256(page.body), etag: page.etag })
  const m = page.link?.match(/<([^>]+)>;\s*rel="next"/)
  next = m?.[1] || null
  if (next && new URL(next).origin !== new URL(api).origin) throw new Error('Refusing cross-origin review pagination link')
}
const canonicalDiff = diffRaw.body.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
const observedAt = new Date().toISOString()
const snapshot = {
  snapshot_version: '1.0.0', observed_at: observedAt,
  repository: { id: repository.id, full_name: repository.full_name, html_url: repository.html_url },
  pull_request: { number: pr.number, html_url: pr.html_url, state: pr.state, draft: pr.draft, created_at: pr.created_at, updated_at: pr.updated_at },
  object: { head_sha: pr.head?.sha ?? null, base_sha: pr.base?.sha ?? null, diff_sha256: sha256(canonicalDiff), diff_canonicalization: 'LF_NORMALIZE_TERMINAL_LF_PRESERVE_PATCH_TEXT_AND_ORDER' },
  reviews: reviews.sort((a,b) => canonical(a).localeCompare(canonical(b))),
  provenance: {
    source: 'GitHub REST API', api_version: '2022-11-28', pr_url: prRaw.url, pr_body_sha256: sha256(canonical(pr)), pr_etag: prRaw.etag,
    repository_url: repositoryRaw.url, repository_body_sha256: sha256(canonical(repository)), repository_etag: repositoryRaw.etag,
    diff_url: diffRaw.url, diff_body_sha256: sha256(diffRaw.body), reviews: reviewSources,
    workflow_event: process.env.GITHUB_EVENT_NAME ?? null, workflow_sha: process.env.GITHUB_SHA ?? null,
    workflow_run_id: process.env.GITHUB_RUN_ID ?? null, workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null
  }
}
const bytes = `${JSON.stringify(snapshot, null, 2)}\n`
await writeFile(process.env.SNAPSHOT_PATH || 'pr-state-snapshot.json', bytes, { mode: 0o600 })
process.stdout.write(`${sha256(bytes)}\n`)
