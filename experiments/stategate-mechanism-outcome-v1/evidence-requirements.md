# Evidence requirements and collection dictionary

## Common evidence packet (all arms)

Install and run `common-collector.yml` plus `common-collector.mjs` unchanged in A, B and C. Retain every emitted packet, including inconsistent packets, and index them by scenario/arm/event/run. The collector preserves raw event and REST response bytes inside its JSON artifact plus hashes, endpoints, pagination, ETags and API version. Trigger-payload head/base remain separate from later fetched head/base.

Retain immutable refs plus SHA-256 for: scenario/repetition; canonical repo owner/name/id; PR number/URL; event type/payload; head/base at event and decision; canonical diff bytes/hash; ruleset/branch-protection export and capture time; complete reviews; required check names/conclusions/run IDs/URLs; workflow files/dependency SHAs; CI run start/end and billable minutes if exposed; PR opened/ready/eligible/merge/close times; each push/review/rerun/manual action; exact executed/merged head and merge commit if authorized; operator active handling intervals; corrections/rework; retrieval source/time/permission; collector revision/hash; raw artifact hashes; deviations/missingness.

Use UTC RFC 3339 ending in `Z`, with fractional seconds only where source supports them, and monotonic durations from one clock; preserve source precision and do not manufacture milliseconds. Record clock/time-zone source. Hash byte-preserving raw data where available; otherwise record canonicalization algorithm/version and hash canonical UTF-8 JSON.

## Frozen completeness denominator

`evidence-fields.json` is normative. It enumerates E01–E32 as atomic fields, exact standardized-packet paths, validity rules, applicability and class denominators. All 32 are applicable in every class, so the denominator is always 32 per episode. At the frozen cutoff, a coordinator builds a standardized mechanism packet using only eligible durable sources: A uses GitHub-native PR/review/check/workflow/rule objects and logs; B adds its snapshot; C adds its StateGate check/proof. The common collector is the independent answer key and may verify a field, but its output is forbidden as packet content. This preserves the evidence-packaging comparison instead of giving every arm the collector's package.

Each field contributes exactly 0 or 1. Empty arrays count only when an eligible source proves zero items. `evidence_completeness_percent = 100 × sum(E01..E32) / 32`; retain numerator, failed field IDs and source mapping even though the outcome object records the percentage. The denominator and definitions are identical across arms; arm-specific artifacts can supply a common field but never add denominator fields.

## Arm-specific evidence

- **A:** GitHub PR timeline, reviews, required-check/ruleset state, CI logs/artifacts, mergeability and merged object.
- **B:** A plus snapshot comparator source hash, workflow run, JSON snapshot, fetched response hashes, artifact hash, collector active/runtime cost.
- **C:** A plus immutable Action SHA, redacted inputs, StateGate run/check, VALID/NULL/reasons, proof bytes/hash/id/validator identity, evaluated head/base/diff/review identities and acquisition status.

StateGate proof completeness never substitutes for common evidence completeness. Independent ground-truth ledger comes from scenario definition and common observations before arm output is inspected.

## Missingness codes

`NOT_COLLECTED`, `SOURCE_UNAVAILABLE`, `PERMISSION_DENIED`, `NOT_APPLICABLE`, `CLOCK_UNAVAILABLE`, `TRIAL_STOPPED`, `MASKING_IMPOSSIBLE`, `OTHER` plus explanation, exact field path, discovery time and actor. `OUTCOME_OBJECT.schema.json.x-null-requires-missingness` freezes every nullable measurement path; `validate-protocol.mjs` rejects a null at any listed path unless `missingness` contains an entry with that exact `field_path`. NOT_APPLICABLE needs a reason. Missingness never becomes numeric zero.

## Proof fidelity rubric (0–1)

Score five equally weighted binary bindings against independent evidence: repository+PR; head/base; canonical diff; review policy/current-head evidence; decision+validator/proof identity. `proof_fidelity = verified bindings / applicable bindings`. If an arm has no native proof object, value is null with NOT_APPLICABLE and matching missingness; separately score common-packet fidelity. A contradicted/unverified binding is 0 when source evidence is complete.

## StateGate proof fields to preserve

For Arm C retain the release's `record_type` (`MERGE_GUARD_PROOF`), `proof_schema_version` (`1.1.0`), validator name/version/commit/release hash, `proof_id`, `proof_hash`, `canonical_hash`, result and NULL reason codes, repository/PR/head/base identity, `diff_hash`/`diff_source`, review-required policy, minimum approvals, approval count, review head/status/evidence hash and the original proof artifact. This is a readout of the pinned released interface, not a new schema. Verify validated/proof object identities against the independent PR API capture.
