# Consumer Audit

This audit classifies the Stage 2B consumer-validation surfaces that are visible
in this repository.

| Surface | Classification | Basis |
| --- | --- | --- |
| Installation | READY | The workflow invokes `joselunasrt8-creator/continuity-merge-guard@v1.0.0` from a consumer repository. |
| Documentation | READY | `README.md`, `docs/CONSUMER_VALIDATION.md`, and `docs/DEPENDENCY_DEMONSTRATION.md` describe the consumer installation and validation path. |
| VALID path | PARTIAL | A VALID scenario is documented, but the repository-local files do not contain a completed PR number, run URL, check conclusion, and artifact retention reference. |
| NULL path | PARTIAL | A NULL scenario and failure mechanism are documented, but repository-local files do not contain a completed failing PR number, run URL, check conclusion, and failure artifact reference. |
| Proof artifact | READY | The workflow uploads `MERGE_GUARD_PROOF` from `MERGE_GUARD_PROOF.json` when emitted. |
| Removal behavior | READY | The dependency demonstration documents the enabled → required → removed → degraded counterfactual without removing the workflow. |
| Remaining manual GitHub settings | PARTIAL | Branch protection requirements are not repository files; a maintainer must verify whether `merge-guard-consumer / merge-guard-consumer` is required in GitHub settings. |

## READY

`READY` means the repository contains the observable file-level mechanism or
documentation required for the surface.

## PARTIAL

`PARTIAL` means the repository contains the mechanism or documented procedure,
but completion depends on GitHub-hosted evidence or settings that are not stored
in the repository.

## BLOCKED

`BLOCKED` means the surface cannot currently be exercised from the observable
repository state. No Stage 2B surface is classified as `BLOCKED` in this audit.

## Reconciliation gaps

The remaining evidence gaps are external to repository files:

1. Record a passing VALID PR check and proof artifact reference.
2. Record a failing NULL PR check and failure evidence reference.
3. Verify whether branch protection requires
   `merge-guard-consumer / merge-guard-consumer`.

Until those GitHub-hosted observations are recorded, the consumer repository is a
technical proof surface with partial external evidence capture.
