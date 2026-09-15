# Continufy Sandbox

`continuity-sandbox` is the controlled internal empirical testbed for the Continufy ecosystem.

Its purpose is to test, measure, falsify, compare, and reproduce claims about Continufy components before those claims are presented to independent external users.

The repository is not itself proof of external adoption, market value, architectural necessity, or independent trust. It is an internal evidence laboratory for determining what can actually be demonstrated and where the evidence stops.

## Governing question

> What can we legitimately demonstrate about a Continufy component before asking an independent user to depend on it?

## Evidence-lab model

```text
Candidate component / claim
        ↓
Prospective sandbox experiment
        ↓
Baseline + intervention + counterfactual
        ↓
Measured outcome
        ↓
Retain / revise / reject claim
        ↓
Reproducible internal evidence
```

The sandbox is not a mandatory stage in a fixed Continufy pipeline. Components should enter it only when there is a concrete empirical question that can be answered more cheaply or cleanly here than through external participation.

The sandbox should be used to answer questions such as:

- Does the component execute as specified?
- Does it produce deterministic outputs or proof artifacts?
- Does it detect or prevent states that the baseline workflow permits?
- What measurable overhead does it introduce?
- Does removal change workflow behavior?
- Can the result be reproduced across repeated runs?
- Can another repository consume the component without copying its implementation?
- Is an apparent dependency genuine, or can the same guarantee be reproduced by a trivial local substitute?
- Does the component outperform a strong simpler baseline?
- Does the tested relationship survive counterfactual removal or substitution?

## Current demonstrated surface

The repository currently serves as a separate-repository, same-owner consumer of ContinuityOS Merge Guard behavior.

Existing work has demonstrated evidence classes including:

```text
A. Demonstration Proof
   Component runs and produces the expected VALID / NULL behavior and proof output.

B. Cross-Repository Consumption
   A repository separate from the source repository consumes the component as part of a GitHub workflow.
```

`Cross-Repository Consumption` is intentionally narrower than `Cross-Repo Dependency`: consumption alone does not establish necessity, non-substitutability, or independent reliance.

The sandbox has also produced an important negative result: the current consumable Merge Guard surface is stateless for continuity purposes, so an Independent Continuity Dependency Proof cannot legitimately be claimed from that surface alone.

That halt is evidence, not failure. The sandbox must preserve negative results when reality invalidates a stronger claim.

## What this repository can establish

Within a controlled same-owner environment, the sandbox can produce bounded evidence about:

- installation and integration behavior;
- deterministic execution;
- VALID / NULL enforcement behavior;
- proof generation;
- failure classes;
- reproducibility;
- counterfactual behavior;
- removal effects;
- cross-repository consumption;
- substitution resistance or substitutability;
- operational overhead; and
- experiment repeatability.

These results can strengthen or weaken an internal claim before external outreach.

## What this repository cannot establish

The sandbox does **not** establish:

- independent trust;
- independent adoption;
- willingness to retain the component;
- external workflow dependency;
- customer value;
- willingness to pay;
- market demand;
- production necessity;
- universal architectural value; or
- long-term production reliability outside this environment.

Those require evidence appropriate to those claims, including an independent trust boundary where necessary.

A possible progression is:

```text
Architecture hypothesis
        ↓
Internal sandbox evidence
        ↓
Repeated / comparative evidence
        ↓
Independent external experiment
        ↓
External retention / dependency / value evidence
```

This is a possible evidence progression, not a required lifecycle for every component.

## Experimental discipline

Every new sandbox experiment should define, before execution:

1. **Question** — the exact empirical question being tested.
2. **Object** — the component, release, commit, or workflow under test.
3. **Baseline** — behavior without the tested intervention, preferably a strong simpler alternative where relevant.
4. **Intervention** — the exact Continufy component or mechanism introduced.
5. **Counterfactual** — what is removed, disabled, replaced, or substituted.
6. **Measurements** — observable outputs collected from both conditions.
7. **Decision rule** — what result supports, violates, simplifies, or leaves the hypothesis indeterminate.
8. **Evidence identity** — commits, workflow runs, artifacts, hashes, and relevant configuration.
9. **Claim ceiling** — the strongest conclusion the experiment is actually allowed to support.
10. **Stop rule** — the condition under which additional internal experimentation no longer adds legitimate evidence.

If the experiment cannot distinguish the component from a trivial or strong simpler substitute, it must not claim dependency or unique value.

If the required evidence cannot be produced, the correct result is a documented halt or indeterminate outcome.

## Relationship to Continufy components

The sandbox owns experiments and internal evidence. It does not own the semantics, authority, or implementation of the components it tests.

For ContinuityOS specifically, ContinuityOS remains the source of its legitimacy primitives and governed execution mechanisms. The sandbox is a consumer and experimental surface and must not silently duplicate ContinuityOS implementation logic to make an experiment succeed.

The same rule applies to other components:

```text
Component
    ↓ exported / consumable surface
continuity-sandbox
    ↓ controlled experiment
Evidence
```

A successful sandbox result does not make the tested component a mandatory Continufy dependency. A negative result may support revision, simplification, replacement, or removal.

```text
Same-owner evidence ≠ independent validation
Cross-repository consumption ≠ dependency
Internal reproducibility ≠ customer value
Component success ≠ architectural necessity
```

## Repository policy

Changes should increase empirical value rather than architectural scope.

Prefer:

- small controlled experiments;
- explicit baselines;
- clean counterfactuals;
- strong simpler comparators;
- machine-readable results;
- reproducible workflow runs;
- preserved negative findings;
- bounded claims; and
- explicit stop rules.

Avoid:

- duplicating source-repository implementation;
- inventing new component architecture inside the sandbox;
- creating experiments whose result is predetermined;
- treating same-owner usage as independent adoption;
- treating cross-repository use as dependency without removal/substitution evidence;
- turning documentation into evidence without an executed experiment;
- continuing internal experiments after the evidence ceiling has been reached; or
- expanding the repository merely to create activity.

## Current objective

Use the sandbox to exhaust the **useful and legitimate** evidence available inside the Continufy ecosystem before requesting time, trust, or workflow changes from independent external users.

The objective is not to prove that Continufy must succeed or to force every repository into one topology.

The objective is to learn, with reproducible evidence, exactly what works, what fails, what improves a workflow, what is substitutable, what should be simplified or removed, and which remaining questions can only be answered by independent users.
