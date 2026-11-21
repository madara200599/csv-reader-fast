[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/madara200599/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/madara200599/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

# csv-reader-fast

A faster drop-in for make.fun's csv-reader 1.0.0: `solve.js` answers exactly
as csv-reader 1.0.0 does for every `{text, header}` input — `{columns, rows,
errors}` with its full broken-CSV policy (BOM drop, LF/CRLF records, stray CR,
quoted fields with doubled quotes, quote junk, unterminated quotes, short/long
row padding and cutting) — from a single left-to-right pass that jumps between
delimiters with `indexOf` and lifts each field out with one `slice`, instead of
walking one character at a time.

`main.ts` is the program the harness runs: it reads every case from
`/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

On the practice set (6 cases, ~10.2 MB of CSV) it parses in ~0.17 s of CPU
against csv-reader 1.0.0's ~0.74 s, and runs end to end in ~0.9 s against the
house baseline's ~1.85 s — about 4× faster at parsing, 2× faster overall —
with answers byte-identical to the baseline on every case.

Entered via referral code r7k9dyj1
