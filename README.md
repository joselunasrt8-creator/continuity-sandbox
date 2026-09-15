# Continufy Sandbox

`continuity-sandbox` is the controlled internal empirical testbed for the Continufy ecosystem.

Its purpose is to test, measure, falsify, and reproduce claims about Continufy components before those claims are presented to independent external users.

The repository is not itself proof of external adoption, market value, independent trust, or general production validity. It is a controlled environment for producing stronger internal evidence and for discovering where that evidence stops.

```text
Self-test ≠ independent validation
Same-owner use ≠ adoption
Cross-repo use ≠ external transfer
Deterministic output ≠ workflow improvement
Observed benefit ≠ customer value
Internal evidence ≠ market proof
```

## Governing question

> What can we legitimately demonstrate about a Continufy component before asking an independent user to depend on it?

## Role in the evidence pipeline

```text
Continufy component
        ↓
continuity-sandbox
        ↓
Controlled GitHub workflow
        ↓
Baseline observation
        ↓
Governed intervention
        ↓
Counterfactual / removal
        ↓
Measured outcome
        ↓
Reproducible internal evidence
        ↓
Independent external test
```

The sandbox should answer empirical questions such as:

- Does the component execute as specified?
- Does it produce deterministic outputs or proof artifacts?
- Does it detect or prevent states that the baseline workflow permits?
- What measurable overhead does it introduce?
- Does removal change workflow behavior?
- Can the result be reproduced across repeated runs?
- Can another repository consume the component without copying its implementation?
- Is an apparent dependency genuine, or can the same guarantee be reproduced by a trivial local substitute?
- Does the component outperform a strong simpler or platform-native baseline on the same task?
- Which results survive changes in repository, workload, configuration, and experiment operator?

## Current demonstrated surface

The repository currently serves as a separate repository consumer of ContinuityOS Merge Guard behavior inside the same owner/control boundary.

Existing work has demonstrated evidence classes including:

```text
A. Demonstration Proof
   Component runs and produces the expected VALID / NULL behavior and proof output.

B. Cross-Repo Consumption
   A repository separate from the source repository consumes the component as part of a GitHub workflow.
```

“Cross-repo consumption” is intentionally narrower than “independent dependency.” Repository separation does not create an independent trust boundary when source and consumer remain under the same owner/control environment.

The sandbox has also produced an important negative result: the current consumable Merge Guard surface is stateless for continuity purposes, so an Independent Continuity Dependency Proof cannot legitimately be claimed from that surface alone.

That halt is evidence, not failure. The sandbox must preserve negative results when reality invalidates a stronger claim.

## Evidence ladder

Sandbox results should be classified by the strongest evidence actually produced:

```text
E0 — Specification / documentation only
E1 — Component executes as specified
E2 — Deterministic/replayable behavior reproduced
E3 — Controlled baseline/intervention difference measured
E4 — Counterfactual or removal effect reproduced
E5 — Same-owner cross-repository transfer reproduced
E6 — Strong simpler/platform-native baseline outperformed
E7 — Independent operator or external repository reproduces result
E8 — External user retains or depends on the component
E9 — Economic value / willingness to pay observed
```

A result at one level does not inherit the claims of a higher level.

The sandbox primarily owns E1–E6. E7–E9 require evidence outside the current internal control boundary.

## What this repository can establish

Within a controlled same-owner environment, the sandbox can produce evidence about:

- installation and integration behavior;
- deterministic execution;
- VALID / NULL enforcement behavior;
- proof generation;
- failure classes;
- reproducibility;
- counterfactual behavior;
- removal effects;
- same-owner cross-repository consumption;
- substitution resistance or substitutability;
- operational overhead;
- experiment repeatability; and
- comparative performance against explicitly implemented baselines.

These results can be accumulated into an internal evidence package before external outreach.

## What this repository cannot establish alone

The sandbox does **not** establish:

- independent trust;
- independent adoption;
- willingness to retain the component;
- external workflow dependency;
- customer value;
- willingness to pay;
- market demand;
- representative production reliability;
- superiority across untested workflows; or
- general necessity of the Continufy architecture.

Those require an independent trust boundary, representative use, or market behavior.

The intended progression is therefore:

```text
Architecture / mechanism proof
        ↓
Sandbox experiment
        ↓
Repeated quantitative evidence
        ↓
Same-owner cross-repo validation
        ↓
Strong-baseline comparison
        ↓
Independent external experiment
        ↓
External retention / dependency
        ↓
Economic validation
```

## Experimental discipline

Every new sandbox experiment should define, before execution:

1. **Question** — the exact empirical question being tested.
2. **Object** — the component, release, commit, or workflow under test.
3. **Baseline** — behavior without the tested intervention.
4. **Strong comparator** — the simplest credible existing mechanism that could provide the same outcome, when applicable.
5. **Intervention** — the exact Continufy component or governance mechanism introduced.
6. **Counterfactual** — what is removed, disabled, or substituted.
7. **Measurements** — observable outputs collected from each condition.
8. **Decision rule** — what result supports, violates, or leaves the hypothesis indeterminate.
9. **Evidence identity** — commits, workflow runs, artifacts, hashes, and relevant configuration.
10. **Independence class** — same process, separate run, separate repository, separate operator, or external owner.
11. **Claim ceiling** — the strongest conclusion the experiment is actually allowed to support.

If the experiment cannot distinguish the component from a trivial substitute or strong native baseline, it must not claim unique dependency or superiority.

If the required evidence cannot be produced, the correct result is a documented halt or indeterminate outcome.

## Comparative value boundary

A component should not be judged only against “nothing.” Many Continufy mechanisms operate in environments that already contain branch protection, required checks, CI, CODEOWNERS, policy engines, audit logs, access controls, and workflow automation.

Where a credible existing mechanism can address the same target problem, sandbox experiments should compare against it.

Useful measures include:

- unauthorized or invalid states prevented;
- false blocks;
- detection/decision accuracy;
- added latency;
- setup and maintenance effort;
- operator interventions;
- evidence/proof completeness;
- replayability;
- failure recovery;
- policy/configuration complexity; and
- behavior after the Continufy component is removed.

A more elaborate mechanism that does not produce a consequential improvement over a simpler baseline should be simplified, narrowed, or rejected for that use case.

## Independence boundary

Independence is a property of the evidence-producing relationship, not merely repository identity.

```text
Different file       ≠ independent
Different branch     ≠ independent
Different repository ≠ necessarily independent
Different owner/operator with autonomous incentives and control
                     = stronger independence evidence
```

The sandbox should record who controls the source component, consumer repository, experiment design, execution environment, and interpretation. This makes same-owner evidence useful without presenting it as external validation.

## Relationship to ContinuityOS

ContinuityOS remains the source of legitimacy primitives and governed execution mechanisms.

This repository is a consumer and experimental surface. It must not silently duplicate ContinuityOS implementation logic in order to make an experiment succeed.

```text
ContinuityOS
    ↓
published / consumable primitive
    ↓
continuity-sandbox
    ↓
controlled experiment
    ↓
bounded internal evidence
```

The separation matters because the sandbox is intended to test exported behavior, not manufacture the behavior locally.

## Relationship to StateGate and other components

The sandbox may test StateGate, MindShift, SYNAPSE, Methodology Engineering outputs, or other Continufy components when a bounded executable question exists.

Using the sandbox does not validate the source repository as a whole. Each experiment applies only to the exact component version, configuration, workload, and claim that were prospectively tested.

Cross-component experiments should avoid circular validation. If component A defines the success criterion for component B while B is also used to justify A, the experiment must introduce an independent measurement or comparator before claiming mutual support.

## Reproducibility and transfer

The sandbox distinguishes:

```text
Repeatability
Same setup + same operator + repeated run

Reproducibility
Same frozen protocol + independently reconstructed run

Transfer
Different repository/workload + same claim

Independent validation
Different controlling actor + independently meaningful outcome
```

Repeated internal success is useful evidence of mechanism stability. It is not a substitute for transfer or independence.

## Repository policy

Changes should increase empirical value rather than architectural scope.

Prefer:

- small controlled experiments;
- explicit baselines;
- strong comparators;
- clean counterfactuals;
- machine-readable results;
- reproducible workflow runs;
- preserved negative findings;
- explicit independence classification; and
- bounded claims.

Avoid:

- duplicating source-repository implementation;
- inventing new ContinuityOS architecture inside the sandbox;
- creating experiments whose result is predetermined;
- treating same-owner usage as independent adoption;
- treating cross-repository usage as external validation;
- turning documentation into evidence without an executed experiment;
- using only weak “component versus nothing” comparisons when a strong baseline exists;
- circularly validating Continufy components with one another; and
- expanding the repository merely to create activity.

## Current objective

Use the sandbox to exhaust the legitimate evidence available inside the Continufy ecosystem before requesting time, trust, or workflow changes from independent external users.

The target is not to prove that Continufy must succeed.

The target is to learn, with reproducible evidence, exactly what works, what fails, what improves a workflow relative to credible alternatives, what is substitutable, and which remaining questions can only be answered by independent users.

The strongest internal result should make the next external experiment smaller and more informative—not make the external experiment unnecessary.
