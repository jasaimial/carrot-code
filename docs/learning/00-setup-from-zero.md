# 00 — Setup from Zero (Windows + VS Code + Copilot)

Replicable steps to bootstrap a new project that uses Spec Kit. Tested on Windows 11 with PowerShell 7, VS Code, and GitHub Copilot Chat. Took ~10 minutes end-to-end.

> **If you already have `uv` and `git` installed**, skip to step 3.

---

## 0. What you'll have at the end

- A git repo on `main` with two clean commits.
- `.specify/` (templates, scripts, memory) and `.github/prompts/speckit.*.prompt.md` (slash commands) wired up for Copilot Chat.
- Ready to run `/speckit.constitution` as the very next step.

## 1. Verify prerequisites

```powershell
Get-Command git, uv, gh, node, npm -ErrorAction SilentlyContinue |
  Select-Object Name, Version, Source | Format-Table -AutoSize
```

You need at minimum: `git`. Strongly recommended: `gh` (GitHub CLI) for later. `node` + `npm` if your project uses them. `uv` is what we'll install next if missing.

## 2. Install `uv` (Astral)

`uv` is a fast Python tool runner written in Rust. **You do not need Python installed** — `uv` brings its own.

```powershell
winget install --id=astral-sh.uv -e --accept-source-agreements --accept-package-agreements
```

Verify in a **new** terminal (PATH refresh):

```powershell
uv --version
```

## 3. Initialize the git repo *first*

> ⚠️ **Order matters.** Spec Kit's `git` extension creates a feature branch per spec. If the repo doesn't exist when you run `specify init`, it'll create one for you — but you lose control over the initial commit. Do it yourself.

```powershell
cd <your-project-folder>
git init -b main
```

Add a sensible `.gitignore` before staging anything (Node/Vite/editor noise — see this repo's [.gitignore](../../.gitignore) for a starter).

```powershell
git add .
git commit -m "chore: initial commit"
```

## 4. Install the Specify CLI

Pin to a specific release for reproducibility. Find the latest tag at https://github.com/github/spec-kit/releases (or `git tag --sort=-v:refname | Select -First 5` in a local clone).

```powershell
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.8.10
```

`uv` will warn that `~\.local\bin` isn't on PATH. Fix it:

```powershell
uv tool update-shell                                       # persists for new shells
$env:PATH = "C:\Users\$env:USERNAME\.local\bin;$env:PATH"  # for THIS shell, right now
specify --version
```

> **Cosmetic bug:** `specify --help` may crash on banner rendering when its output is captured. Doesn't affect real usage. `specify init --help` works fine.

## 5. Scaffold Spec Kit into the existing repo

```powershell
specify init --here --integration copilot --script ps --force --ignore-agent-tools
```

Flag-by-flag:

| Flag | Why |
|---|---|
| `--here` | Scaffold into current directory instead of creating a new one |
| `--integration copilot` | Wire up VS Code Copilot slash commands (replaces the deprecated `--ai` flag) |
| `--script ps` | Use PowerShell scripts instead of bash |
| `--force` | Skip the "directory not empty" prompt (we already have `.gitignore` etc.) |
| `--ignore-agent-tools` | Skip the check for an agent CLI binary — we use Copilot via VS Code chat, not a CLI |

> **Version note:** as of v0.8.10 the flag is `--integration`. Older docs and examples show `--ai`, which still works but emits a deprecation warning and will be removed in v0.10.

## 6. Verify what landed

```powershell
git status --short
```

You should see, untracked:
- `.specify/` — templates, PowerShell scripts, `memory/constitution.md` (placeholder), the `git` extension
- `.github/prompts/speckit.*.prompt.md` — the slash commands themselves
- `.github/agents/` — agent definitions
- `.github/copilot-instructions.md` — repo-wide context Copilot reads on every chat

And modified:
- `.vscode/settings.json` — registers the prompt files and auto-approves running scripts under `.specify/scripts/` in the integrated terminal

## 7. Commit the scaffold

```powershell
git add .
git commit -m "chore: scaffold spec-kit v0.8.10 (Copilot + PowerShell)"
git log --oneline
```

You now have two commits and a clean baseline.

## 8. (Optional) Push to GitHub

You don't have to do this yet — many teams wait until after the constitution + first spec are in place so the initial push is more meaningful. When you're ready:

```powershell
gh repo create <org-or-user>/<repo> --private --source . --remote origin --push
```

Switch `--private` to `--public` if appropriate. Add a topic and description with `--description "..." --homepage "..."`.

## 9. Next: write the constitution

Open a **new** chat in VS Code Copilot, type `/`, and pick `speckit.constitution`. The constitution is your project's governing principles — it's read by every subsequent spec/plan/task command. Don't skip it.

See [01-spec-kit-workflow.md](./01-spec-kit-workflow.md) for what comes after.

---

## Troubleshooting cheatsheet

| Symptom | Fix |
|---|---|
| `specify: command not found` after install | `$env:PATH = "C:\Users\$env:USERNAME\.local\bin;$env:PATH"` and run `uv tool update-shell` |
| `specify --help` crashes | Cosmetic. Use `specify <subcommand> --help` instead, or just look at GitHub docs |
| Slash commands don't appear in Copilot Chat | Reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window") |
| `--ai` deprecation warning | Use `--integration <agent>` instead — same effect |
| Spec-kit asked to create a git repo | You skipped step 3. Cancel, init the repo yourself, re-run `specify init --here --force` |
