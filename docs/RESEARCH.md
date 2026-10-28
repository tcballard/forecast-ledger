# Research runner

Start with `pnpm research briefs --all` to inspect all 868 briefs without model calls. Each prompt includes exact option keys, contest notes, the forecast cutoff, evidence requirements and an abstention path. Current web research must be available in the provider; a model's unsupported recollection is not an evidence source.

## Codex

Install and authenticate the Codex CLI separately using the official instructions: https://learn.chatgpt.com/docs/non-interactive-mode . Check `codex exec --help` on your installed version. The bundled adapter invokes `codex exec --sandbox read-only -` with the prompt on stdin, and expects its final message on stdout. It does not read or copy your credential files. You can add `--model NAME` to the runner to choose your installed provider model explicitly.

```sh
pnpm research run --all --provider codex --limit 10
pnpm research run --state TX --provider codex --limit 50
pnpm research run --all --provider codex --limit 868
```

Choose a limit appropriate to your allowance; 868 research calls can be slow and expensive. The local app itself makes no paid calls. Provider access, web capability and quality are not guaranteed by the application. The orchestration was tested with a deterministic stub; a paid national model run was not performed during the build.

## Other providers

```sh
pnpm research run --office House --provider command --executable /absolute/path/to/adapter --args '["--mode","research"]' --limit 10
```

Your executable receives one UTF-8 prompt on stdin. It must exit 0 and print exactly one JSON object (an optional Markdown JSON fence is accepted). Send progress to stderr. You can wrap Claude, another authenticated CLI or a server-side API using this contract. Keep keys in your own environment; never put them into a prompt or repository. The runner does not invoke a shell and never constructs commands from model outputs. Use a provider timeout up to 3600 seconds with `--timeout`; default 300.

## Proposal schema

```json
{
  "contestId": "2026-AK-M-ballot-measure-2",
  "probabilities": {"Yes": 0.55, "No": 0.45},
  "method": "Your provider/model and method",
  "rationale": "Explain evidence, uncertainty, adoption threshold and modelling assumptions.",
  "evidence": [{"title": "Actual source title", "url": "https://actual-source.example/", "note": "Publication/access date and supporting fact"}]
}
```

These numbers and URL are illustrative, not a real forecast. Every listed option must appear exactly once; no extra or missing candidates. Values must be finite and sum to 1. A provider unable to research should return `{"abstain":true,"reason":"..."}`; this produces a failed/abstained job, not a 50% forecast.

## Resume and review

Output defaults to `research-output/`, excluded from Git. `briefs/` contains prompts; `proposals/` contains validated forecasts; `jobs/` contains timestamps, provider configuration, prompt hash and status. Existing valid proposals for the same contest are skipped. Invalid outputs, timeouts and abstentions remain visible in job logs and are retried on another run. To request a later research revision, use a fresh `--out research-output/revision-2` directory. A failed job does not wipe a committed forecast.

Model outputs cannot commit themselves. Load a JSON file into the relevant contest in the UI, inspect the evidence, check the review box and commit. Alternatively, `pnpm research import FILE.json` is an explicit instruction to commit that one reviewed file to local SQLite. `validate` only checks shape and arithmetic. The runner cannot validate that a cited page supports its claim.

## Useful commands

```sh
pnpm research validate path/to/proposal.json
pnpm research import path/to/reviewed-proposal.json
pnpm research coverage
pnpm research export > ledger-export.json
```

For clean JSON stdout without package-manager banners use `node --experimental-strip-types scripts/research.ts export > ledger-export.json`.

The cutoff is enforced at run start and every commitment, regardless of model-provided dates. The workflow does not schedule updates, place trades or post forecasts publicly. Evaluation requires explicit final certified outcomes, including delayed runoffs/RCV counts, recorded through the UI after cutoff.
