# Sections 3–4 implementation notes

Implemented the guide's MVP scaffold only. Pi owns model access and conversation;
the extension validates and exports campaigns locally. There is no separate model
client, web UI, publishing integration, revision workflow, scoring, or CSV export.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | ESM package with the guide's `dev`, `test`, and `typecheck` scripts; dependencies resolved by npm rather than copied version pins. Pi is installed locally as a development dependency. |
| `package-lock.json` | Records the dependency versions for reproducible installation with `npm ci`. |
| `tsconfig.json` | Strict ES2022 / NodeNext checking of source, future tests, and the Pi extension. No JavaScript is emitted. |
| `.gitignore` | Preserves existing rules and adds generated `campaigns/` and macOS `.DS_Store` exclusions; dependencies and environment files were already ignored. |
| `src/schema.ts` | Zod schemas and inferred `Brief` / `Campaign` types, with field bounds and unique selected channels. |
| `src/checks.ts` | `validateCampaign` parses untrusted input and rejects duplicate post IDs, invalid channel choices, bad calendar references/days, and incorrect budget totals. |
| `src/render.ts` | `renderMarkdown` exports the brief, strategy, content, calendar, budget, proposed KPIs, and human review notes. |
| `src/storage.ts` | `saveCampaign` validates before writing and creates UUID directories containing exclusive JSON and Markdown files. Includes the guide's section 4.7 `campaignRoot` and ID-validated `loadCampaign` helper; no V1 load tool is registered. |
| `.pi/extensions/campaignpilot.ts` | Registers `/campaign` to gather a brief through Pi and `campaign_save` to validate and persist the proposed campaign. Runtime validation remains centralized in Zod behind the guide's permissive `Type.Any` tool parameter. |
| `examples/brief.json` | The guide's Bean & Brew sample brief. |
| `tests/.gitkeep` | Preserves the section 3 test directory without implementing section 5 tests. |
| `README.md` | Local installation, typecheck, and Pi usage instructions with explicit scope and verification limits. |
| `IMPLEMENTATION_NOTES.md` | This file: implementation explanations, API comparison, and verification record. |

The ignored `campaigns/` directory exists locally and is also created on demand by
`saveCampaign`. V2's `review.ts` and `csv.ts` are deliberately absent.

## Installed Pi API compared with the guide

Verified against `@earendil-works/pi-coding-agent` **1.4.0**, specifically
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`:

- `ExtensionAPI`, `registerCommand`, and `registerTool` support the guide's usage.
- `ToolDefinition.execute` still takes five arguments: tool-call ID, inferred
  parameters, optional abort signal, optional update callback, and context. The
  current context type is `ExtensionToolContext`, which supplies `cwd`.
- `sendUserMessage` accepts a string and returns `void`; its optional settings
  include `deliverAs` and `expandPromptTemplates`. The guide's single-string call
  requires no change.
- Pi's declarations import `TSchema` and `Static` from the newer `typebox` package.
  The guide imports `Type` from `@sinclair/typebox` (installed version **0.34.52**).
  The supplied object/any schema satisfies the installed Pi types, so the guide's
  import is retained. This is compile-time verification, not a claim of a complete
  provider/tool-call integration test.

No adapter changes, declaration shims, or casts were needed. The section 4 source
code and compiler configuration are preserved as supplied by the guide.

## Verification

- `npm run typecheck`: **passed**, no TypeScript errors.
- `git diff --check`: **passed**.
- Section 5 tests were not created or run. `npm test` is reserved for that suite.
- A real authenticated Pi conversation and generated campaign save still require
  manual verification using `npm run dev`, `/login`, `/model`, and `/campaign`.

Storage retains the guide's local MVP limitations: it does not protect against
symlinked campaign directories or make the two output writes atomic. Those
production-hardening changes are outside sections 3–4.
