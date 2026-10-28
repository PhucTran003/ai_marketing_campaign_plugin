# CampaignPilot audit

Audit date: 2026-10-28. Review scope: secure paths, schemas, exposed Pi tools, errors, concurrency, prompt
injection, dependencies, and tests. Priority reflects this local single-user
extension, not a multi-tenant service. No credentials or campaign data are needed
for verification.

## Prioritized findings and remediation plan

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | `saveCampaign` followed a symlinked `campaigns/`; `loadCampaign` followed linked campaign folders/files. Generated IDs alone did not contain these accesses. | Fixed for stable paths: reject linked directories and open JSON with `O_NOFOLLOW`; regression tests verify rejection and outside-file preservation. See remaining race limitations below. |
| P1 | Saves published JSON before other exports, and revisions published before `revision.json`. I/O failure could leave a loadable but incomplete campaign. | Fixed: stage all artifacts and sync files before one directory rename; exclusive ID reservations prevent cooperating writers from overwriting destinations. Failure and concurrency tests pass. |
| P1 | npm reported high-severity Undici advisories, and Pi's bundled CLI embeds a copy invisible to a simple override. | Patched the dependency tree with Undici 8.12.2; changed `npm run dev` to Pi's shipped unbundled CLI and pinned Pi/`pi-ai` 1.4.0. npm audit now reports zero. Global/bundled Pi commands are not covered. |
| P2 | Constraints/assumptions counts, calendar references, and stored JSON reads were unbounded. | Fixed: 50 constraints, 100 assumptions, safe 60-character post references, 2 MiB payload/storage bounds, and bounded regular-file reads. |
| P2 | Loaded campaigns can contain instructions, while Pi also has powerful built-in tools. | Mitigated: labeled loaded content as untrusted and added planner/tool guidance. Prompt injection is not proven solved; Pi is not sandboxed by this extension. |
| P2 | Tests imported `pi-ai` through a transitive dependency; Node support was undocumented. | Fixed dependency declaration and documented runtime requirements. Node typings target the minimum major; Node 26 was tested. |
| P3 | README linked to a missing setup file; evidence was spread across historical notes. | Replaced README, added executable offline demo and `DEMO.md`, and updated implementation notes. No unsupported deployment/performance claims. |

## Dependency evidence

The initial `npm audit --json` reported two affected dependency nodes: Pi
(moderate through its dependency) and Undici (high). Advisories include
[TLS option handling](https://github.com/advisories/GHSA-2m5v-pch6-74hx) and
[excessive content encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c).
The audit reported affected Undici 8.x versions below 8.12.2. The targeted override
resolves the installed tree to 8.12.2 without downgrading Pi or changing providers.

Inspecting `dist/bundle/chunks/chunk-MM3LKT73.js` in Pi 1.4.0 revealed embedded
`node_modules/undici` code. An override cannot rewrite that published bundle.
`npm run dev` therefore launches the package's unbundled `dist/cli.js`, whose
dependencies resolve from the patched tree. This intentionally relies on the
layout shipped with pinned Pi 1.4.0; recheck the entry point and override when
updating Pi. The ordinary bundled/global `pi` executable is outside this remedy.

Final `npm audit --json` returned zero known advisories; `npm ls undici` confirmed
8.12.2. Advisory reachability and TLS behavior were not independently exploited or
tested; zero audit findings is not a claim of comprehensive security.

## Verification

- `npm test`: **106 passed across 10 files**.
- `npm run typecheck`: passed, including demo source; no casts added to hide errors.
- `npm run demo`: passed with fictional data in a fresh temporary directory.
- Clean temporary checkout of source plus lockfile: `npm ci --ignore-scripts
  --offline --no-audit --no-fund`, tests, and typecheck passed. The offline install
  used the local npm cache; cache availability is required for offline reproduction.
- Pi's actual loader registers `/campaign` and four tools in an automated test.
  Registered save/review/revise handlers were exercised offline during review/export implementation.
- `npm run dev -- --offline --version`: returned **1.4.0** through the unbundled
  entry point. No authenticated inference request was sent during this audit.
- A narrow secret-pattern scan of current source found no matching key/private-key
  patterns. This does not audit Git history or prove that arbitrary sensitive data
  is absent. No private Pi auth file was read for this audit.

New regressions cover root/folder/file symlinks, non-regular/oversized JSON,
export and metadata write failures, publication failure, concurrent saves, ID
collisions, collection/reference limits, circular inputs, and real Pi registration.

## Remaining improvements, in priority order

1. **P2: hostile local races and process termination.** Node's path-based API
   cannot make these ancestor checks an OS sandbox. A malicious same-user process
   can race directory replacement or alter campaign files directly. Run only in a
   trusted workspace with appropriate OS isolation if stronger boundaries are
   required. A crash can leave hidden staging/reservation directories; automatic
   stale-lock recovery is deliberately absent. Files are synced before rename,
   but parent directories are not fsynced, so power-loss durability is not claimed.
2. **P2: cancellation and timeout policy.** Tool handlers do not currently cancel
   in-progress local I/O or set filesystem operation deadlines. Bounded payloads
   reduce exposure, but slow/network filesystems may still hang. Test AbortSignal
   handling before adding timeouts or retries that could obscure save outcomes.
3. **P2: untrusted content.** Instructions and output labels reduce confusion but
   do not guarantee resistance to prompt injection. Pi's built-in tools retain
   their own permissions. Markdown is exported as content, not sanitized HTML;
   disable raw HTML in untrusted-content viewers. No third-party publishing tool
   is present, and approval remains conversational.
4. **P3: presentation/schema quality.** Several text fields can still contain
   whitespace-only text within their length limits. Review quality is heuristic,
   not a verifier of claims, voice, discounts, or KPI realism. Improving those
   rules requires deliberate product decisions and dedicated tests.
5. **P3: CI and runtime matrix.** Add CI and test Node 22/24 plus platform behavior
   before claiming cross-platform support. Current evidence is local macOS on
   Node 26; npm distribution, licensing, and hosted deployment are not implemented.

## Error handling and trust boundary

Validation and filesystem errors propagate to Pi's tool-error mechanism. Invalid
campaigns fail before staging. Handled I/O failures attempt to remove staging and
reservations; cleanup errors are visible rather than silently reported as success.
Tool outputs and logs may include campaign text and local paths, so use fictional
data in public recordings. Revisions are immutable through these APIs; owner-level
filesystem access can still edit their files.

These changes address the audit's high-priority defects without adding a web UI,
publishing, automatic approval, a custom model client, or unrelated refactors.
