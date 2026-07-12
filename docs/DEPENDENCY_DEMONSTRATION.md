# Dependency Demonstration

This document describes the observable dependency created by the consumer
repository's StateGate installation. It is limited to behavior visible in this
repository and its GitHub Actions workflow.

## What protection does StateGate provide?

StateGate provides a pull request check that is external to this repository's
own implementation code. The workflow invokes the published release
`joselunasrt8-creator/continuity-merge-guard@v1.0.0` and supplies pull request
context to it.

Observable protection boundary:

1. Pull request events trigger the consumer workflow.
2. The published Merge Guard release evaluates the pull request context it is
   given.
3. The workflow exposes the action outputs.
4. The workflow preserves any emitted proof file as a GitHub Actions artifact.
5. The workflow converts a non-success Merge Guard outcome into a failed check.

## What disappears if it is removed?

If `.github/workflows/merge-guard-consumer.yml` is removed, the repository loses
these observable surfaces:

- The `merge-guard-consumer / merge-guard-consumer` pull request check.
- The invocation of `joselunasrt8-creator/continuity-merge-guard@v1.0.0`.
- The printed Merge Guard outputs in workflow logs.
- The `MERGE_GUARD_PROOF` artifact upload path.
- The final workflow step that fails the check when Merge Guard does not
  succeed.

No repository file other than the workflow currently performs those behaviors.

## What GitHub behavior changes?

With the workflow enabled, GitHub Actions can create a pull request check for
configured pull request events. The check can pass or fail based on the workflow
job result.

If the workflow is removed from the branch under test, GitHub Actions no longer
has this repository-local workflow definition to run. The observable result is
that this repository no longer produces the `merge-guard-consumer` workflow check
from that workflow file on pull requests.

If repository branch protection has been configured to require that check, GitHub
may block merging until the required check is present and passing. That branch
protection setting is external to the files in this repository and must be
verified in GitHub repository settings.

## Which workflow guarantee is lost?

The lost workflow guarantee is:

```text
A non-success Merge Guard outcome is converted into a failed consumer check after
outputs and any emitted proof artifact are preserved.
```

That guarantee exists because the workflow uses three ordered behaviors:

1. Run Merge Guard with `continue-on-error: true`.
2. Always expose outputs and attempt artifact upload.
3. Fail at the end when `steps.merge-guard.outcome != 'success'`.

Removing the workflow removes that ordered behavior from this consumer
repository.

## Removal test: documented counterfactual only

Do not perform this test on the protected branch. Use it as a documented
counterfactual for maintainers who need to verify dependency behavior in a safe
branch or fork.

### Enabled

1. Open a pull request with `.github/workflows/merge-guard-consumer.yml` present.
2. Observe the `merge-guard-consumer / merge-guard-consumer` check.
3. Confirm the workflow invokes
   `joselunasrt8-creator/continuity-merge-guard@v1.0.0`.
4. Confirm the output and artifact steps run with `if: always()`.

### StateGate required

1. In GitHub repository settings, configure branch protection to require the
   `merge-guard-consumer / merge-guard-consumer` check.
2. Open or update a pull request.
3. Observe that GitHub treats the check as part of the mergeability state.

This setting is not stored in the repository files. It must be observed in the
GitHub settings UI or through GitHub's branch protection APIs.

### Remove workflow

1. In an isolated branch or fork, delete `.github/workflows/merge-guard-consumer.yml`.
2. Open or update a pull request from that branch.
3. Do not change branch protection during the test.

### Expected degradation

Observable degradation after removal:

- The repository no longer has a workflow file that invokes the published Merge
  Guard release.
- The repository no longer has a workflow step that uploads `MERGE_GUARD_PROOF`.
- The repository no longer has a workflow step that fails when the Merge Guard
  outcome is not `success`.
- If branch protection still requires the removed check, GitHub may report the
  required check as missing or pending until the requirement is updated or the
  workflow is restored.

This document records the counterfactual behavior. It does not remove the
workflow.
