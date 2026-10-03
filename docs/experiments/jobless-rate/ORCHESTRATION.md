# ORCHESTRATION.md — jobless-rate

Built 2026-09-23 to prove out `@usa-open-data-connectors/usa-sources` end to end.

- TDD: the adapter tests were written before the adapter, and the transform
  tests (`buildJoblessSeries`, `monthLabel`) before the chart.
- Live smoke test run explicitly: `RUN_SMOKE=1 npm run test:smoke -w @usa-open-data-connectors/usa-sources`.
- Two real findings came out of running the parser against the live API:
  the agency answers newest first rather than oldest first, and it marks an
  unpublished month with a dash instead of omitting the row. Both are now
  pinned by regression tests.

## Note on the source host

`www.bls.gov` answers 403 to scripted requests from this machine, so the
story links to the API host and to `data.bls.gov` and FRED, all of which
answer normally. A dead-link check that only reads the HTML site will report
false failures against bls.gov.
