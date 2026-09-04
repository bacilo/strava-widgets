# Deferred Items — Phase 25

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## From 25-01 (Task 3)

**Pre-existing NUL byte in `gear-aggregate-logic.ts`'s `unknownKey` literal.**

`gear-aggregate-logic.ts`'s `unknownKey = ' unknown'` internal map key (intended as a leading
space, per its own comment "internal-only key, never exposed; sorts before any real label")
actually contains a literal NUL byte (`\x00`) instead of a space character. Confirmed present
in the commit immediately preceding this plan's Task 1 (`git show <pre-task-1-commit>:src/analytics/gear-aggregate-logic.ts`
via python3 byte-level read) — not introduced by any task in this plan.

Functionally harmless: a NUL byte (char code 0) sorts before any printable character in string
comparison, same as a space (char code 32) would, so `unknownKey`'s "sorts before any real
label" invariant still holds and all tests pass. The only externally-visible effect is that
`file`/`git diff` classify `gear-aggregate-logic.ts` as binary (`application/octet-stream`),
which produces a `Bin X -> Y bytes` diff stat instead of a normal line diff for any commit that
touches this file — cosmetic only, does not affect `git blame`, `git log -p` correctness, or
runtime behavior.

Not fixed here — out of scope for FIX-02/D-12/D-13 (Task 3 only widens the Unknown-bucket
predicate; it does not touch the `unknownKey` literal). Worth a one-line fix in a future
low-risk cleanup plan: replace the NUL byte with an actual space character.
