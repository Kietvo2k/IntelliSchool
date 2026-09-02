# AI study no-context evidence — 2026-09-02

## Root cause

The local hashing retriever used a default minimum cosine score of `0.05`.
For the query about Internet/ARPANET, unrelated school chunks scored above that
threshold, forcing the response into grounded mode and causing a false “not enough
data” answer.

## Change

The default minimum retrieval score is now `0.30`, selected from measured examples:
the unrelated math/chemistry chunks scored `0.173`/`0.211`, while the matching
calculus chunk scored `0.528`. Explicit `minScore` callers remain supported.

## Live evidence

The real UI request “Hãy giải thích nguồn gốc của Internet và ARPANET cho học sinh
lớp 12.” returned a general-knowledge answer with no school citation and no refusal.
The same UI request had no provider diagnostics banner or tool-trace block.
