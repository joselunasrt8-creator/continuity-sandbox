# continuityos-sandbox

This repository is the canonical external consumer repository for the published
Continuity Merge Guard GitHub Action.

It exists solely to verify that a fresh repository outside the Merge Guard source
repository can install and execute the released action exactly as documented.

## External consumer purpose

This repository is intentionally separate from Merge Guard development. It does
not modify Merge Guard, duplicate Merge Guard logic, or vendor files from the
Merge Guard repository.

The only required behavior is external consumption of the published release:

```text
joselunasrt8-creator/continuity-merge-guard@v1.0.0
```

## Release validation role

Pull request workflow runs validate that the published Merge Guard release can be
installed and executed from a normal external repository using only GitHub
provided pull request context.

Those workflow runs serve as reproducible external installation evidence for the
published action release. The workflow logs preserve the action outputs, and any
proof file emitted by the action is uploaded as the `MERGE_GUARD_PROOF` artifact.

## Minimal repository policy

This repository intentionally contains only minimal code and documentation needed
to operate as an external installation evidence surface. It is not a development
copy of Merge Guard and must not grow Merge Guard implementation logic.
