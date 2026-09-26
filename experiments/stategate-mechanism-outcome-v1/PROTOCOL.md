# StateGate mechanism-to-outcome benchmark v1.0.0

**Terminal for issue #43:** `PROTOCOL_FROZEN` after validation, hash, commit, and clean reread. This package authorizes no scenario execution. Parent scope: continuity-sandbox #40; upstream: Continufy- #19.

## Question and claim ceiling

Prospectively compare StateGate's exact-object validation/proof loop with (A) competent GitHub-native controls and (B) those controls plus a minimal evidence snapshot in one bounded, same-owner GitHub PR workflow. Outcomes may be improvement, null, harm, cost, blocked, or indeterminate. The benchmark cannot establish independent adoption/dependency, market demand, external economic validation, universal transferability, or that Continufy as a whole works.

This is not code correctness/security certification. Preserve:

```text
Instruction ≠ Authority
Evidence ≠ Decision
Decision ≠ Permission
Validation ≠ Execution
VALID ≠ Merge Authority
Proof ≠ Outcome
Outcome ≠ Automatic Governance Mutation
```

GitHub owner/operator permissions and repository rules remain authority and execution boundary. StateGate can only emit a required check and proof; it cannot grant merge authority, merge, manufacture evidence, or decide code correctness/security.

## Design and matching

Six semantic classes × four repetitions = 24 matched sets. Each set contains one isolated PR episode per arm, up to 72 episodes. Match source tree/base commit, mutation, actor/reviewer roles, native controls, CI, event schedule, and collection windows. Use three disposable repositories (one per arm) or a documented resettable equivalent; never use production code/repositories. Randomize arm order within each set and scenario order from a recorded seed before the first episode. `SCENARIOS.json` freezes IDs, ground truth, event sequence, permitted deviations, and a deterministic scenario/arm order derived from its recorded pre-outcome seed. A repetition is a separate disposable PR. All 72 episodes remain unrun under #43. If a mutation/event cannot be reproduced, stop the matched set as a deviation; do not replace it after observing results.

### Arm A — competent native baseline

All arms use the exact fixture CI in `fixture-ci.yml` and GitHub rulesets/branch protection on the protected default branch: PR required; one approving review; dismiss stale approval on new pushes; require approval of the most recent push; required `fixture-ci` check; strict up-to-date branch requirement; prohibit direct pushes; no administrator bypass during trial. Pin workflow/dependency references to full commit SHAs. Capture effective rule export/API response before cohort. PR author and approving reviewer must be distinct GitHub users; use only an already-authorized reviewer, with no external recruitment under #43. If no such account exists, or the GitHub account/plan cannot enforce PR, approval, stale/current-push review, and required-check behavior, future execution is `BLOCKED`; do not weaken the baseline. Enforce rules for administrators and configure no bypass actors. A human/operator separately authorizes any merge.

### Arm B — minimal snapshot comparator

Arm A plus included `snapshot-collector.mjs`, run by `snapshot-collector.yml` as a non-required diagnostic job on the same PR/review event. It uses Node built-in `fetch` and read-only `GITHUB_TOKEN` to write one JSON artifact containing PR/repository identities, head/base, canonical diff SHA-256 using LF normalization plus one terminal LF (patch text/order preserved), reviews and review commit IDs/states/times, observation time, API provenance, workflow event/run/head, and source hashes. It does not issue an eligibility decision, fail a required check, or merge. It is intentionally dependency-free and small; it does not implement StateGate policy, freshness rules, exact-object validation, or proof semantics. Same operator procedure applies across arms. Collector failure is missing evidence and does not change native gates.

### Arm C — StateGate required check

Arm A plus the workflow in `stategate-required-check.yml`, using `joselunasrt8-creator/stategate@dd6a607533b0c5c31eb99840e39d0a443998541a` (v1.1.1 full immutable commit; never floating `v1`). Enable `require-review-approval: 'true'`, `minimum-approvals: '1'`; provide repository, PR number, event head/base and actor; allow the pinned Action to acquire current PR/diff/reviews. Before each C episode, set the read-only repository variable `EXPECTED_DIFF_HASH` to the SHA-256 produced by the snapshot collector for the intended object; capture the value/configuration as evidence. Update it only when the intended object changes by the scenario (class 3 reapproval uses the newly intended head); class 4 retains O1 while current PR is O2. Missing/malformed variable blocks setup. Require the exact `stategate` check in branch rules. Grant only `contents: read`, `pull-requests: read`, `actions: write` needed for documented proof upload. No contents/PR/checks write or merge capability. No StateGate code/schema/behavior/release changes.

The pinned release internally references `actions/upload-artifact@v4` from its composite Action. This transitive upload dependency is not modified; capture its resolved action identity from the future run record/log. If that identity or required artifact retention cannot be verified, stop before trials. The audited release interface normalizes reviews and binds current review head; compares acquired head/base against event inputs; binds canonical diff, review policy/evidence, decision and validator identity into proof; and fails closed when required evidence is missing, malformed, unavailable or inconsistent. `action.yml` uploads `MERGE_GUARD_PROOF.json`. Proof is validation evidence, not outcome/authority. Full commit `dd6a607533b0c5c31eb99840e39d0a443998541a` is the peeled v1.1.1 release tag target; the GitHub Release record itself is not marked immutable, so only the full commit SHA is used as the pin. The output artifact workflow references are pinned separately.

## Scenario semantics

`SCENARIOS.json` is authoritative for immutable scenario IDs, setup, event/mutation sequence, eligibility, evidence, observation, stop conditions and allowed deviations. Ground truth comes only from the frozen fixture and independently observed GitHub object/review state before viewing arm-specific results. Eligibility means the defined transition meets the frozen native review/identity/evidence preconditions at the decision point. Ineligible transitions are not merged; record gate result and stop. Eligible fixture PRs may be merged only by an authorized operator after evidence capture. Automated components never merge.

For event-sensitive scenarios preserve event payload and exact API-observed state. A head changed after event creation makes the event object stale. Follow only each scenario’s explicit event sequence and captured payload; do not substitute `workflow_dispatch`; verify identity before scoring. No outcome relies on nondeterministic timing. If GitHub cannot reliably create the defined race in a disposable repo, block rather than fabricate StateGate input.

## Common collector

Same definitions and common collection across arms. At start/end, record wall-clock UTC and monotonic times. Read PR, commits, reviews, branch rules, checks, workflow runs/artifacts, merge state/timestamps with the same paginated GitHub REST API procedure/API version. Preserve raw response bytes or canonical JSON, endpoints, retrieval time, ETag/metadata if available, collector revision, token scopes, and SHA-256. Never use an arm's output as sole ground truth.

Capture pushes, reviews/dismissals, workflow runs/reruns, check changes, operator actions, corrections/rework, merge/cancel/close and reason. Trial evidence index points to artifacts. Missing evidence is missing; never backfill from memory. Equal observation window: first PR event to eligible merge or terminal ineligible/blocked state, capped at 30 active operator minutes and 24 wall-clock hours. Passive wait excluded from active time.

Outcome schema: `OUTCOME_OBJECT.schema.json`. One record per PR episode. Use JSON `null` when unavailable/not applicable and add `missingness` entry with reason. No unavailable measurement may be encoded as zero. Count zero only if full event history was observed and no event occurred.

## Blinded reconstruction (procedure only)

Do not conduct now. After all future episodes finish, a coordinator who does not score packets builds standardized packets from common and arm evidence. Replace trial/PR IDs with random IDs, shuffle from preregistered seed, and remove arm labels/check names/product labels when this does not remove substantive evidence. Seal the key until all auditor submissions are locked.

An auditor uninvolved in operation receives packets without web/API access and determines: exact repo/PR/head/base/diff/review evaluated; applicable rules/evidence state; eligibility; execution and exact executed object; whether packet suffices for reproducible audit. Record field correctness/unknown against independent ground truth, monotonic start/end, total active seconds, confidence. Timeout 30 active minutes is censored/missing, never imputed as 1,800 seconds. If masking fails, record arm guess/confidence and report the limitation; retain score.

## Stops and deviations

Stop before any episode if native rules are not competent, immutable StateGate SHA cannot be resolved, common collector permission insufficient, ground truth ambiguous, or arm workflow differs beyond its assigned intervention. Stop in flight on unexpected merge, unauthorized bypass, unrelated repository mutation, secret leak, identity loss, or sequence mismatch. Preserve evidence, mark set deviation/blocked, do not silently repair/retry. Technical interruption before scenario mutation may be retried once identically; retain both attempts and time. Any protocol/collector/scenario/rule/pin/metric/threshold edit requires a new version and prospective registration before new outcomes.

## Analysis and decision

Analyze all 24 matched sets intention-to-treat. Report raw set/episode data, denominators, missingness, deviations, paired differences, class strata, medians and ranges. Compare C separately to A and B. No post hoc exclusions, subgroup selection, null imputation or threshold changes. Exact metrics and precedence appear in `analysis-plan.md` and `TERMINAL_CLASSIFIER.json`.

The strongest allowed claim is a bounded same-owner mechanism-to-outcome statement for this StateGate release, workflow, fixtures and observed episodes, with small-N/finite-class and masking/measurement limits. Before any future execution, verify live rules on three disposable repos, exact StateGate pin, no bypass, check names, API/artifact permissions and collector connectivity. This protocol freeze does not establish those configurations exist and does not authorize execution.

## Prior-art reuse audit

Reuse the sandbox's experiment discipline and evidence vocabulary from `EXPERIMENT_MERGE_GUARD_DEPENDENCY_TEST.md`, `DEPENDENCY_PROOF_MERGE_GUARD.md`, and `NULL_ENFORCEMENT_PROOF.md`. These are ContinuityOS Merge Guard records and are not outcomes, fixtures, or claims for this StateGate study. The StateGate release's existing fixtures `fixtures/review-valid-current-head.json`, `fixtures/review-stale-head-null.json`, `fixtures/review-required-missing-null.json`, and `fixtures/hash-determinism.json` informed the semantic classes; they remain StateGate-owned conformance fixtures and are not experimental observations. No prior protocol or outcome schema exactly fits this three-arm design, so this package adds only the scenario, outcome, collector and classifier objects necessary here.

## Contract reuse and package map

This bounded local procedure preserves applicable distinctions from Continufy `docs/sop-governance/v1.0/contract.md` and freeze/execute/observe discipline from `docs/reference-execution/v1.0/canonical-instrument-specification.md` and `coordination-contract.md`. Those contracts remain owned by Continufy and are references, not duplicated or redefined here; Reference Execution v1.0 cohort rules are not imported as authority for this single sandbox benchmark. The package files referenced above are the exact baseline/intervention workflow sketches, scenario manifest, outcome schema, collection dictionary, analysis plan, classifier, comparator source and validator. `experiment-manifest.json` records frozen identities and exact native controls; `evidence-requirements.md` is the common evidence dictionary; `freeze-manifest.json` binds hashes to the payload commit and intentionally excludes itself from its own hash set.
