# Open Line Benchmark Workflow

Open Line has two performance-checking modes.

## Deployment checks

`npm run build` runs the normal `check:open-line-*` scripts through `prebuild`. These checks remain deployment-blocking and verify:

- deterministic output and golden signatures
- privacy-safe public projections
- narrative, branch, geometry, marker, renderer, and motion correctness
- no network, asynchronous narrative generation, or renderer-owned inference
- broad catastrophic ceilings that catch severe algorithmic regressions

These checks intentionally do not fail production builds on strict average or p95 microbenchmarks. Vercel and other shared build workers can have variable CPU scheduling, throttling, garbage collection timing, and noisy neighbors. A synthetic 1,000-event history that takes a few extra milliseconds on a shared builder is not a production correctness failure.

## Strict benchmark suite

Run strict Open Line timing gates with:

```bash
npm run benchmark:open-line
```

This command keeps the stricter warmup, average, p95, and maximum gates for:

- Pathprint geometry
- Open Line renderer
- Open Line markers
- Branch intelligence
- Motion planning
- Narrative generation

Use this command before performance-sensitive Open Line changes, during release-candidate audits, and in scheduled CI where the machine class is known. If it fails, profile the relevant subsystem before changing thresholds.

## Build ceilings

The build-safe checks retain broad maximum ceilings only:

- narrative generation: 250 ms maximum for a 1,000-event synthetic history
- branch intelligence: 250 ms maximum for a 2,000-event synthetic history
- motion planning: 250 ms maximum for a 1,000-event synthetic diff
- geometry: 300 ms maximum for a 1,000-event synthetic history
- renderer and marker server render checks: 500 ms maximum

These ceilings are intentionally wide. They catch unbounded loops, accidental full-render work in data layers, and severe complexity regressions without treating build-worker variance as a deploy blocker.
