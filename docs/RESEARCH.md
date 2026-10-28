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

## LiteLLM API (no CLI required)

The runner calls your LiteLLM gateway directly from Node. No SDK or coding-agent installation is needed. Set the gateway URL and a virtual key in your local process environment; keep the key out of chat, source files and command-line arguments. The model value is **your gateway's configured model alias**, not necessarily the upstream provider's model name.

```sh
export LITELLM_BASE_URL="https://your-gateway.example/v1"
export LITELLM_MODEL="your-research-model-alias"
read -rsp 'LiteLLM virtual key: ' LITELLM_API_KEY; echo
export LITELLM_API_KEY
pnpm research run --contest 2026-TX-S --provider litellm --search web --limit 1
```

The key-entry example uses Bash. On PowerShell, set the same environment variables through your preferred secret manager. The runner does not automatically load `.env` files. Use a dedicated virtual key with a gateway budget and model allowlist. The key is sent only in the Authorization header; the adapter rejects redirects and omits error bodies from logs. Remote URLs require HTTPS; loopback HTTP is supported for local gateways. Supply the gateway root or `/v1` base, not a full completion URL.

### Choose the API and research route

- **`--api responses` (default) with `--search web`:** calls `/v1/responses` with `web_search_preview`. Your gateway/model must support this tool and return a completed `web_search_call` in the output. A response with no completed search is rejected.
- **`--api chat --search web`:** calls `/v1/chat/completions` with `web_search_options: {}`. Use a compatible search-enabled route. Chat responses do not provide a universal proof of search execution, so verify source claims. Unsupported tools or parameters are errors, never silently retried with browsing disabled.
- **`--evidence-dir evidence --api chat`:** works with a normal text model. Provide dated source extracts per contest instead of asking it to browse. The output may cite only URLs in that packet. The adapter does not fetch those URLs or verify their contents.

LiteLLM compatibility is model/provider dependent: https://docs.litellm.ai/docs/completion/web_search . A plain completion endpoint alone does not provide internet research.

An evidence packet named `evidence/2026-TX-S.json` looks like:

```json
{
  "contestId": "2026-TX-S",
  "sources": [{
    "title": "Actual poll or election source",
    "url": "https://actual-source.example/report",
    "retrievedAt": "2026-10-28T12:00:00Z",
    "text": "Paste the actual source extract here, including publication date, poll field dates, sample and methodology where relevant."
  }]
}
```

The example is a template, not actual evidence. Gather lawful extracts from current sources. Source timestamps must precede the forecast cutoff and cannot be in the future. The packet is capped at 200KB, with 1–20 sources, and its hash is retained in the job record. The `evidence/` directory is excluded from Git. Only public election research should be submitted unless your gateway is approved for the data you supply.

```sh
pnpm research run --all --provider litellm --api chat --evidence-dir evidence --limit 10
pnpm research run --all --provider litellm --search web --limit 10
```

Start with one contest to verify your route, then increase `--limit`. Use a distinct `--out research-output/model-alias` for each model or revision so existing proposals do not cause unintended skips. Successful jobs record returned token usage, endpoint mode and research mode. Dollar cost and budget enforcement remain in LiteLLM. There are no automatic retries: a timeout or provider retry can still incur charges, and your gateway may have its own retries/fallbacks. `--timeout` bounds the request including response reading. Failed jobs remain resumable; valid proposals still require review before commitment.

This adapter is verified with local mock gateways, including the complete runner path. Your real gateway has not been contacted or billed during development.
