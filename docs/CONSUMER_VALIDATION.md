# Consumer Validation Guide

This repository is an external consumer of the published Continuity Merge Guard
GitHub Action release:

```text
joselunasrt8-creator/continuity-merge-guard@v1.0.0
```

The validation target is the consumer repository behavior, not the action source
repository. This guide records how a maintainer can observe whether the consumer
installation is operational on pull requests.

## Installation

The repository installs StateGate through the GitHub Actions workflow at
`.github/workflows/merge-guard-consumer.yml`.

Observable installation facts:

- The workflow runs on `pull_request` events for `opened`, `synchronize`, and
  `reopened` activity.
- The workflow grants `contents: read` permissions only.
- The workflow invokes the published release
  `joselunasrt8-creator/continuity-merge-guard@v1.0.0`.
- The workflow passes GitHub pull request context into the action, including the
  repository, PR number, head SHA, base SHA, actor, PR author, head ref, PR body,
  and PR labels.
- The workflow uploads `MERGE_GUARD_PROOF.json` as the
  `MERGE_GUARD_PROOF` artifact when the file exists.
- The workflow fails the job when the Merge Guard step outcome is not `success`.

## Expected checks

A pull request should expose one consumer check:

```text
merge-guard-consumer / merge-guard-consumer
```

The check is expected to perform these observable steps:

1. Run the published Continuity Merge Guard release.
2. Print the Merge Guard step outputs.
3. Upload the proof artifact when `MERGE_GUARD_PROOF.json` exists.
4. Fail the job if the Merge Guard step did not succeed.

## VALID example

Use this scenario to produce consumer evidence for a PR expected to pass:

```text
Scenario name: VALID consumer documentation-only PR
Candidate PR: a pull request that changes only consumer documentation and keeps
              the Merge Guard workflow installed.
Expected check result: merge-guard-consumer / merge-guard-consumer succeeds.
Required proof: MERGE_GUARD_PROOF artifact is attached to the workflow run when
                the action emits MERGE_GUARD_PROOF.json.
```

Evidence record to preserve after running the scenario:

```text
PR number:
PR URL:
Workflow run URL:
Check conclusion:
Artifact name: MERGE_GUARD_PROOF
Artifact URL or retention reference:
Observed Merge Guard outputs:
```

Do not treat this scenario as complete until the check conclusion and proof
artifact record are copied from the GitHub workflow run.

## NULL example

Use this scenario to produce consumer evidence for a PR expected to fail:

```text
Scenario name: NULL consumer PR
Candidate PR: a pull request intentionally constructed so the published Merge
              Guard release returns a non-success step outcome.
Expected check result: merge-guard-consumer / merge-guard-consumer fails.
Required proof: workflow logs showing the Merge Guard step outcome and any
                MERGE_GUARD_PROOF artifact emitted before failure.
```

Why this scenario fails in the consumer repository:

- The workflow runs the Merge Guard step with `continue-on-error: true` so later
  proof and output steps still execute.
- The final step checks `steps.merge-guard.outcome`.
- If that outcome is not `success`, the final step exits with status `1`.
- Therefore a non-success Merge Guard outcome becomes an observable failed
  consumer check.

Evidence record to preserve after running the scenario:

```text
PR number:
PR URL:
Workflow run URL:
Check conclusion:
Failing step:
Logged Merge Guard outcome:
Artifact name: MERGE_GUARD_PROOF, if present
Artifact URL or retention reference, if present:
```

Do not invent failure evidence. If the workflow run has not been executed, leave
these fields blank and classify the NULL path as `PARTIAL` in the consumer audit.

## Proof artifact

The workflow attempts to upload this artifact on every pull request run:

```text
MERGE_GUARD_PROOF
```

The uploaded path is:

```text
MERGE_GUARD_PROOF.json
```

The upload step uses `if-no-files-found: ignore`, so absence of the file does not
itself fail the workflow. The proof artifact is therefore present only when the
published action emits `MERGE_GUARD_PROOF.json` during that run.

## Troubleshooting

Use only observable workflow behavior when diagnosing the consumer installation:

| Symptom | Observable check | Repository-local cause to inspect |
| --- | --- | --- |
| No check appears on a PR | Confirm the PR event is `opened`, `synchronize`, or `reopened`. | Verify `.github/workflows/merge-guard-consumer.yml` still exists on the branch. |
| Check fails after Merge Guard runs | Read the final step log for `Continuity Merge Guard failed with outcome:`. | The Merge Guard step outcome was not `success`. |
| No proof artifact appears | Inspect the upload step summary. | The action did not leave `MERGE_GUARD_PROOF.json` at the workflow workspace path, or GitHub artifact retention expired. |
| Outputs are unclear | Inspect the `Expose Merge Guard outputs` step. | The workflow prints `steps.merge-guard.outputs` as JSON for the run. |
| Installation drift is suspected | Inspect the `uses:` line. | The consumer must continue to reference the published release, not a vendored copy. |
