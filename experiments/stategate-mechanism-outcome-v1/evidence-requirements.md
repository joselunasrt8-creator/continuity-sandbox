# Evidence requirements and collection dictionary

## Common evidence packet (all arms)

Retain immutable refs plus SHA-256 for: scenario/repetition; canonical repo owner/name/id; PR number/URL; event type/payload; head/base at event and decision; canonical diff bytes/hash; ruleset/branch-protection export and capture time; complete reviews (pseudonymize reviewer in analysis, preserve state/submitted time/commit/head/dismissal); required check names/conclusions/run IDs/URLs; workflow files/dependency SHAs; CI run start/end and billable minutes if exposed; PR opened/ready/eligible/merge/close times; each push/review/rerun/manual action; exact executed/merged head and merge commit if authorized; operator active handling intervals; corrections/rework; retrieval source/time/permission; collector revision/hash; raw artifact hashes; deviations/missingness.

Use UTC RFC 3339 with milliseconds where source supports it, monotonic durations from one clock; preserve source precision, don't manufacture milliseconds. Record clock/time-zone source. Hash byte-preserving raw data where available; otherwise record canonicalization algorithm/version and hash canonical UTF-8 JSON.

## Arm-specific evidence

- **A:** GitHub PR timeline, reviews, required-check/ruleset state, CI logs/artifacts, mergeability and merged object.
- **B:** A plus collector source hash, workflow run, JSON snapshot, fetched response hashes, artifact hash, collector active/runtime cost.
- **C:** A plus immutable Action SHA, redacted inputs, StateGate run/check, VALID/NULL/reasons, proof bytes/hash/id/validator identity, evaluated head/base/diff/review identities and acquisition status.

StateGate proof completeness never substitutes for common evidence completeness. Independent ground-truth ledger comes from scenario definition and common observations before arm output is inspected.

## Missingness codes

`NOT_COLLECTED`, `SOURCE_UNAVAILABLE`, `PERMISSION_DENIED`, `NOT_APPLICABLE`, `CLOCK_UNAVAILABLE`, `TRIAL_STOPPED`, `MASKING_IMPOSSIBLE`, `OTHER` plus explanation, field path, discovery time and actor. NOT_APPLICABLE needs reason. Missingness never becomes numeric zero.

## Proof fidelity rubric (0–1)

Score five equally weighted binary bindings against independent evidence: repository+PR; head/base; canonical diff; review policy/current-head evidence; decision+validator/proof identity. `proof_fidelity = verified bindings / applicable bindings`. If an arm has no native proof object, value is null with NOT_APPLICABLE; separately score common-packet fidelity. A contradicted/unverified binding is 0 when source evidence is complete.

## StateGate proof fields to preserve

For Arm C retain the release's `record_type` (`MERGE_GUARD_PROOF`), `proof_schema_version` (`1.1.0`), validator name/version/commit/release hash, `proof_id`, `proof_hash`, `canonical_hash`, result and NULL reason codes, repository/PR/head/base identity, `diff_hash`/`diff_source`, review-required policy, minimum approvals, approval count, review head/status/evidence hash and the original proof artifact. This is a readout of the pinned released interface, not a new schema. Verify validated/proof object identities against the independent PR API capture.
