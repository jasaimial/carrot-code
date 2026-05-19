# Infrastructure provisioning

Scripts and configuration for provisioning the carrot-code project's
production infrastructure on Azure. Industrial convention: anything
under `infra/` provisions or manages real cloud resources;
anything under `scripts/` is local developer tooling.

## Why `infra/` and not `scripts/`?

| Folder     | Purpose                                                                                                  | Examples                         |
| ---------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `infra/`   | Touches Azure / production resources. Reads from `az` CLI session, never embeds credentials. Idempotent. | `provision-swa.ps1`              |
| `scripts/` | Local-only developer tooling. Touches files in the repo, never cloud.                                    | `generate-placeholder-icons.mjs` |

The separation makes blast radius obvious: a typo in `scripts/` breaks
your local file system; a typo in `infra/` can spin up a billed Azure
resource. Convention earns its keep through that distinction.

## Operating principles

Every script under `infra/`:

1. **Idempotent.** Re-running with the same parameters produces the same
   end state, never duplicates or corrupts resources. Safe to run
   repeatedly during debugging.
2. **No hardcoded secrets, IDs, or PII.** Subscription IDs, tenant IDs,
   ARM resource paths, GitHub tokens, deployment tokens, and email
   addresses MUST NOT appear in any script source. Subscription context
   is verified by NAME (via `az account show --query name -o tsv`),
   never by ID. Tokens are read fresh from `gh auth token` at runtime
   and never persisted.
3. **Inputs as parameters.** Every value a maintainer might want to
   override is a CLI parameter with a sensible default. No `.env` files
   under source control.
4. **Verifies prerequisites before doing anything destructive.** Wrong
   subscription, missing CLI auth, missing scopes — fail loudly with a
   specific fix message before any resource is created or modified.
5. **Outputs only what's safe to print.** Default summary includes the
   public defaultHostname (the product URL) and the GitHub secret NAME
   (not value). Never prints subscription IDs, tenant IDs, ARM paths,
   or token values, even in error messages.

Per Constitution Principle XII (Public-Repo Hygiene) + spec 002's
[research.md Q9 sensitive-identifier discipline](../specs/002-shipping-infrastructure/research.md#q9-secrets-management--why-github-actions-secrets-not-azure-key-vault).

## Available scripts

### `provision-swa.ps1`

Provisions the Azure Static Web App that serves carrot-code's public
build, plus the GitHub Actions integration that auto-deploys on push.
Implements spec 002 tasks T102 + T103 + T104 in a single idempotent
run. The script:

1. Verifies the active `az` subscription matches the expected name
   (default: `Visual Studio Enterprise Subscription`).
2. Verifies `gh` CLI is authed with the `workflow` scope.
3. Ensures resource group `rg-carrot-code` exists in `westus2`
   (idempotent).
4. Creates the SWA Free-SKU resource if absent (skipped if present).
   Uses `--source <repo>` + `--token (gh auth token)` so Azure:
   - commits the deploy workflow file to the configured branch, and
   - creates a GitHub repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>`
     with the deployment token (value never enters this script).
5. Captures the public `defaultHostname` (the product URL).
6. Verifies the GitHub secret landed.
7. Prints the summary: hostname + secret name. Nothing else.

Run from repo root:

```powershell
# All defaults (most common)
./infra/provision-swa.ps1

# Override if defaults conflict (e.g., name globally taken, region rejected)
./infra/provision-swa.ps1 -AppName carrot-code-swa -Location centralus
```

Prerequisites:

- `az` CLI installed and `az login` completed against the maintainer's
  Visual Studio Enterprise Subscription.
- `gh` CLI installed and `gh auth login` completed with `repo` and
  `workflow` scopes (current default scopes from `gh auth login` cover
  this).

Failure modes the script handles with specific messages:

- Wrong active subscription → "switch with `az account set --subscription '<name>'`".
- `gh` missing `workflow` scope → "refresh with `gh auth refresh -h github.com -s workflow`".
- SKU not supported in chosen region → re-run with `-Location centralus`
  (Free SKU is NOT available in `westus3`; documented in spec 002
  research.md Q1).

## Future scripts (not yet authored)

- `update-production-branch.ps1` — switches the SWA's production branch
  from `001-vertical-slice` to `main` at slice-merge time. Lands as
  part of spec 002 task T121 follow-up.
- `bicep/` subdirectory if/when we want declarative IaC for
  reproducibility. Out of scope for v0; PowerShell scripts are
  sufficient at this scale.

## Hygiene reminders

- Add `infra/local/` to `.gitignore` if you ever need a local-only
  config file (e.g., for testing a Standard-SKU upgrade in a personal
  sandbox). Currently no such directory exists; defense in depth for
  whoever adds one.
- If a script ever needs to write a secret value or full ARM path to
  a file (it shouldn't), that file goes to `infra/local/` and is
  gitignored. The script should refuse to write to the working
  directory.
