# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/renxweb3/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/renxweb3/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it answers exactly as the reference does on every case — same `{columns, rows, errors}`, same broken-row policy (stray CRs, unterminated quotes, quote junk, short and long rows) — while reading in bulk instead of one character at a time. Plain records and runs of plain fields are split natively; only quoted fields, quote junk and stray CRs take the careful path. On the kit's practice set (6 cases, 10.2M characters) it matches the reference on all 6 cases and runs about 3.6x faster warm / 2.7x faster cold than the house baseline on the build machine. No dependencies, no WebAssembly, no native code — just `solve.js` behind the house driver `main.ts`.

## Run it

```sh
MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=./out node main.ts
```

`main.ts` reads `$MAKEFUN_INPUT_DIR/cases.json` (default `/input`) and writes `$MAKEFUN_OUTPUT_DIR/answers.json` (default `/output`), answering every case with `run()` from `solve.js`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kacxzt8q&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
