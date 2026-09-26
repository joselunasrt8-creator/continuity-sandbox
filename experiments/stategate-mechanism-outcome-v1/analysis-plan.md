# Analysis plan

## Units and denominators

Primary unit: matched set (same scenario/repetition across A/B/C); arm-specific unit: PR episode. All 24 sets remain in report. For rates, denominator is complete independent ground truth for that metric; report numerator/denominator and missing count by arm/class. Never hide class effects. Paired differences are C minus A and C minus B. For binary rates report percentage-point difference.

Classes 1, 3 and 6 define 12 planned eligible episodes/arm; classes 2, 4 and 5 define 12 planned ineligible episodes/arm. If source evidence contradicts planned state, mark matched set protocol-deviant; do not relabel GT after seeing arms.

## Metrics and exact procedure

Times in seconds unless stated. Compare C separately with both A and B.

- **False allow:** observed eligible/transition-permitted with GT ineligible / complete ineligible episodes. An actual unauthorized merge is a false allow and immediate stop. A green check alone is not allow: observed eligibility means GitHub reports mergeable under controls or operator proceeds to the frozen transition point. Report mergeability and actual execution separately.
- **False block:** observed not eligible/unable to proceed with GT eligible / complete eligible episodes. Report GitHub gate state and actual eligible fixture execution separately.
- **Missed invalid state:** ineligible episode whose arm path fails to flag it before disposition / complete ineligible episodes. A path = native gates + common operator rule; B adds visible snapshot; C adds required StateGate check. Operator rule is identical and arm-masked.
- **Decision time:** from first availability of arm-required inputs to first recorded eligibility disposition. No disposition before stop = missing TRIAL_STOPPED. Median/range by arm/class.
- **Added gating delay:** elapsed seconds from all required native checks successful (or common evidence complete for ineligible case) to the arm disposition. This is the gate-added interval; A and B are measured under the same clock/procedure, and their actual duration is retained. C must have median added gating delay ≤45 seconds; also report paired C−A and C−B differences and full range.
- **Operator overhead:** active human seconds attributable to arm setup/check/interpret/retry/evidence retention per PR, contemporaneous intervals summed. Exclude passive wait and common collection. Include B collector setup/maintenance as cohort total separately; do not assume hypothetical amortization.
- **Rework:** count corrective pushes, review cycles, reruns, manual evidence repair after first disposition; preserve categories and total.
- **Evidence completeness:** applicable required common evidence fields present and source-verifiable / applicable common fields × 100. Fixed common packet in evidence-requirements. Report arm-specific fields separately; they never inflate common completeness. Missing/invalid source = incomplete.
- **Proof fidelity:** per evidence-requirements rubric; report arm-specific proof and common-packet fidelity separately.
- **Audit reconstruction time:** active seconds to submit complete blinded object/rule/eligibility/execution/sufficiency answers; report correctness with time. Only completed answers in median; censored timeouts/missing separately.
- **CI/runtime burden:** sum workflow job elapsed seconds and billable runner minutes/episode; report incremental StateGate and snapshot burden vs matched A. Missing billing is null; elapsed remains measurable.
- **Manual intervention:** number and active seconds of arm-specific non-automated actions (retry, override, permission adjustment, artifact repair), actor/reason. Unauthorized bypass stops trial.
- **Reproducibility:** twice replay archived inputs/evidence in clean environment after data collection. Record command/runtime hash, output hashes, decision equivalence. Pass requires both equal normalized decision and proof bytes/hash for deterministic native logic. Do not replay live network acquisition. Common packet reconstruction equivalence separate. Observed nondeterminism = fail; unavailable artifact = missing with reason.
- **Decision changes:** episodes where arm disposition differs from A, categorized agreement with independent GT; include adverse and neutral changes. It is not policy mutation.
- **Defensible economic proxy:** observed labor cost = active operator seconds × hourly fully loaded labor rate registered before execution and same across arms, plus actual billed CI charges where available. If no defensible rate/invoice, value null. Report observed gross and paired increments; no hypothetical avoided incident, willingness-to-pay, revenue, or extrapolation.

## Estimates and interpretation

Publish raw matched rows; paired difference vector; median/full range for continuous measures; exact counts/risk differences for binary; all missingness and deviations. Small N: do not imply statistical power or use asymptotic intervals as decisive. Any interval shown must state exact paired/randomization method and assumptions; decision gates stay as preregistered point estimates. Classes 2 and 4 are prespecified falsification probes. If an audit-time comparator median is zero, the 30% reduction criterion is not met against that comparator. Any StateGate false allow fails improvement regardless of mean. Snapshot B can win if it matches quality at lower burden or catches a state C misses.
