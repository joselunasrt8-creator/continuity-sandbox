# Continufy Sandbox

`continuity-sandbox` is the controlled internal empirical testbed for the Continufy ecosystem.

Its purpose is to test, measure, falsify, and reproduce claims about Continufy components before those claims are presented to independent external users.

The repository is not itself proof of external adoption, market value, or independent trust. It is a controlled environment for producing stronger internal evidence and for discovering where the evidence stops.

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
Reproducible evidence
```

The sandbox should be used to answer empirical questions such as:

- Does the component execute as specified?
- Does it produce deterministic outputs or proof artifacts?
- Does it detect or prevent states that the baseline workflow permits?
- What measurable overhead does it introduce?
- Does removal change workflow behavior?
- Can the result be reproduced across repeated runs?
- Can another repository in the Continufy ecosystem consume the component without copying its implementation?
- Is an apparent dependency genuine, or can the same guarantee be reproduced by a trivial local substitute?

## Current demonstrated surface

The repository currently serves as an external repository consumer of ContinuityOS Merge Guard behavior.

Existing work has demonstrated evidence classes including:

```text
A. Demonstration Proof
   Component runs and produces the expected VALID / NULL behavior and proof output.

B. Cross-Repo Dependency
   A repository separate from the source repository consumes the component as part of a GitHub workflow.
```

The sandbox has also produced an important negative result: the current consumable Merge Guard surface is stateless for continuity purposes, so an Independent Continuity Dependency Proof cannot legitimately be claimed from that surface alone.

That halt is evidence, not failure. The sandbox must preserve negative results when reality invalidates a stronger claim.

## What this repository can prove

Within a controlled same-owner environment, the sandbox can produce evidence about:

- installation and integration behavior
- deterministic execution
- VALID / NULL enforcement behavior
- proof generation
- failure classes
- reproducibility
- counterfactual behavior
- removal effects
- cross-repository consumption
- substitution resistance or substitutability
- operational overhead
- experiment repeatability

These results can be accumulated into an evidence package before external outreach.

## What this repository cannot prove

The sandbox does **not** establish:

- independent trust
- independent adoption
- willingness to retain the component
- external workflow dependency
- customer value
- willingness to pay
- market demand
- long-term production reliability outside this environment

Those require an independent trust boundary and real external use.

The intended progression is therefore:

```text
Architecture proof
        ↓
Sandbox experiment
        ↓
Repeated quantitative evidence
        ↓
Cross-repo ecosystem validation
        ↓
Independent external experiment
        ↓
External retention / dependency
```

## Experimental discipline

Every new sandbox experiment should define, before execution:

1. **Question** — the exact empirical question being tested.
2. **Object** — the component, release, commit, or workflow under test.
3. **Baseline** — behavior without the tested intervention.
4. **Intervention** — the exact Continufy component or governance mechanism introduced.
5. **Counterfactual** — what is removed, disabled, or substituted.
6. **Measurements** — observable outputs collected from both conditions.
7. **Decision rule** — what result supports, violates, or leaves the hypothesis indeterminate.
8. **Evidence identity** — commits, workflow runs, artifacts, hashes, and relevant configuration.
9. **Claim ceiling** — the strongest conclusion the experiment is actually allowed to support.

If the experiment cannot distinguish the component from a trivial substitute, it must not claim dependency.

If the required evidence cannot be produced, the correct result is a documented halt or indeterminate outcome.

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
evidence
```

The separation matters because the sandbox is intended to test the exported behavior, not manufacture the behavior locally.

## Repository policy

Changes should increase empirical value rather than architectural scope.

Prefer:

- small controlled experiments
- explicit baselines
- clean counterfactuals
- machine-readable results
- reproducible workflow runs
- preserved negative findings
- bounded claims

Avoid:

- duplicating source-repository implementation
- inventing new ContinuityOS architecture inside the sandbox
- creating experiments whose result is predetermined
- treating same-owner usage as independent adoption
- turning documentation into evidence without an executed experiment
- expanding the repository merely to create activity

## Current objective

Use the sandbox to exhaust the legitimate evidence available inside the Continufy ecosystem before requesting time, trust, or workflow changes from independent external users.

The target is not to prove that Continufy must succeed.

The target is to learn, with reproducible evidence, exactly what works, what fails, what improves a workflow, what is substitutable, and which remaining questions can only be answered by independent users.