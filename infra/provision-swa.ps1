<#
.SYNOPSIS
    Provision the carrot-code Azure Static Web App and wire up GitHub Actions.

.DESCRIPTION
    Idempotent provisioning script implementing spec 002-shipping-infrastructure
    tasks T102 + T103 + T104 in a single run. Creates the rg-carrot-code resource
    group (idempotent) and the SWA Free-SKU resource, then uses Azure's --source +
    --token integration to have the platform commit the deploy workflow file to
    the configured branch and store the deployment token as a GitHub repo secret.

    DESIGN: every parameter is an input with a sensible default. Subscription IDs,
    tenant IDs, ARM resource paths, GitHub tokens, and deployment tokens MUST NOT
    appear in this script or any commit it produces. The active az subscription is
    verified by NAME (not ID). The GitHub token is read fresh from the gh CLI
    session at runtime via `gh auth token` and never persisted to disk.

    Per Constitution Principle XII + spec 002 research.md Q9 sensitive-identifier
    discipline.

.PARAMETER SubscriptionName
    Expected name of the active Azure subscription. Verified before any resource
    operations. Default matches the maintainer's Visual Studio Enterprise
    Subscription. Switch context with: az account set --subscription '<name>'.

.PARAMETER ResourceGroup
    Resource group name. Created if absent (idempotent). Default: rg-carrot-code.

.PARAMETER Location
    Azure region. SWA Free is NOT available in westus3; fall back to centralus
    if westus2 returns "SKU not supported for region." Default: westus2.

.PARAMETER AppName
    SWA resource name. Globally unique. Default: carrot-code; fall back to
    carrot-code-swa if name collision occurs.

.PARAMETER Sku
    SWA pricing SKU. KEEP Free for v0; Standard is $9/mo and unnecessary.

.PARAMETER GitHubRepo
    GitHub repository in owner/name form. Default: jasaimial/carrot-code.

.PARAMETER ProductionBranch
    Branch the SWA treats as the production environment. Pushes here update the
    public URL. Default: 001-vertical-slice (current development branch). At
    slice merge time, a separate script (update-production-branch.ps1, not yet
    authored) flips this to main.

.PARAMETER AppLocation
    App source location relative to repo root. Default: / (Vite at root).

.PARAMETER OutputLocation
    Build output relative to AppLocation. Default: dist (Vite default).

.PARAMETER ApiLocation
    Functions API location. Empty = no API (we use SaveService + localStorage,
    no backend). Default: empty.

.EXAMPLE
    PS> ./infra/provision-swa.ps1
    All defaults. Most common invocation.

.EXAMPLE
    PS> ./infra/provision-swa.ps1 -AppName carrot-code-swa -Location centralus
    Fall back if the default name is globally taken or westus2 rejects Free SKU.
#>
[CmdletBinding()]
param(
    [string]$SubscriptionName  = 'Visual Studio Enterprise Subscription',
    [string]$ResourceGroup     = 'rg-carrot-code',
    [string]$Location          = 'westus2',
    [string]$AppName           = 'carrot-code',
    [ValidateSet('Free', 'Standard')][string]$Sku = 'Free',
    [string]$GitHubRepo        = 'jasaimial/carrot-code',
    [string]$ProductionBranch  = '001-vertical-slice',
    [string]$AppLocation       = '/',
    [string]$OutputLocation    = 'dist',
    [string]$ApiLocation       = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- helpers ---------------------------------------------------------------

function Write-Step ($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok   ($msg) { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn ($msg) { Write-Host "    !! $msg" -ForegroundColor Yellow }

# --- 1. verify prerequisites ----------------------------------------------
Write-Step 'Checking prerequisites'

# az CLI present and logged in
try { $null = az account show 2>$null } catch {
    throw 'Azure CLI not logged in. Run: az login'
}

# Active subscription name matches expected (verify by name, NOT id, to avoid
# pulling a subscription id into PowerShell scope where a future echo / Out-File
# could accidentally persist it)
$activeSub = (az account show --query 'name' -o tsv)
if ($activeSub -ne $SubscriptionName) {
    throw "Active subscription is '$activeSub'; expected '$SubscriptionName'. Switch with: az account set --subscription '$SubscriptionName'"
}
Write-Ok "Active subscription: $activeSub"

# gh CLI present and authed
try { $null = gh auth status 2>&1 } catch {
    throw 'GitHub CLI not authenticated. Run: gh auth login'
}

# gh token has workflow scope (required for az to push the deploy workflow file
# into the repo via the GitHub API on our behalf)
$authStatus = (gh auth status 2>&1 | Out-String)
if ($authStatus -notmatch 'workflow') {
    throw 'GitHub CLI token lacks "workflow" scope. Refresh with: gh auth refresh -h github.com -s workflow'
}
Write-Ok 'GitHub CLI authed with workflow scope'

# --- 2. ensure resource group exists (idempotent) -------------------------
Write-Step "Ensuring resource group '$ResourceGroup' exists in '$Location'"
$null = az group create --name $ResourceGroup --location $Location --query 'name' -o tsv
Write-Ok 'Resource group ready'

# --- 3. create SWA (skip if exists) ---------------------------------------
Write-Step "Checking for existing SWA '$AppName'"
$existing = $null
try {
    $existing = az staticwebapp show --name $AppName --resource-group $ResourceGroup --query 'name' -o tsv 2>$null
} catch {
    # Expected when SWA does not yet exist; az returns non-zero. Swallow and continue.
    $existing = $null
}

if ($existing) {
    Write-Warn "SWA '$AppName' already exists; skipping creation. To recreate, delete first: az staticwebapp delete --name $AppName --resource-group $ResourceGroup --yes"
} else {
    Write-Step "Creating SWA '$AppName' (Sku=$Sku, branch=$ProductionBranch)"
    Write-Host "    This may take 30-60 seconds..." -ForegroundColor Gray

    # Fetch gh token fresh at runtime; never persist. The token is passed to az
    # as a process argument (visible to /proc on the local machine for the
    # duration of the call only); az hands it to GitHub's API to push the
    # workflow file and write the AZURE_STATIC_WEB_APPS_API_TOKEN_* secret.
    # The deployment token Azure mints is round-tripped directly into GitHub
    # Secrets by az; it never enters this script's variable scope.
    $ghToken = (gh auth token)

    $createArgs = @(
        'staticwebapp', 'create',
        '--name', $AppName,
        '--resource-group', $ResourceGroup,
        '--location', $Location,
        '--sku', $Sku,
        '--source', "https://github.com/$GitHubRepo",
        '--branch', $ProductionBranch,
        '--token', $ghToken,
        '--app-location', $AppLocation,
        '--output-location', $OutputLocation
    )
    if ($ApiLocation -ne '') {
        $createArgs += @('--api-location', $ApiLocation)
    }
    $createArgs += @('--query', 'name', '-o', 'tsv')

    $null = az @createArgs
    Write-Ok 'SWA created'
}

# --- 4. capture defaultHostname (T104 part 1) -----------------------------
Write-Step 'Capturing public defaultHostname'
$hostName = (az staticwebapp show --name $AppName --resource-group $ResourceGroup --query 'defaultHostname' -o tsv)
if (-not $hostName) {
    throw 'defaultHostname is empty; check resource state in the Azure portal'
}
Write-Ok "defaultHostname: https://$hostName"

# --- 5. verify GH secret landed (T104 part 2) -----------------------------
Write-Step 'Verifying GitHub deployment-token secret'
$secretMatch = $null
try {
    $secretMatch = (gh secret list --repo $GitHubRepo 2>$null | Select-String -Pattern 'AZURE_STATIC_WEB_APPS_API_TOKEN' | Select-Object -First 1)
} catch {
    $secretMatch = $null
}

if (-not $secretMatch) {
    Write-Warn "Expected secret AZURE_STATIC_WEB_APPS_API_TOKEN_* not yet visible. Azure sometimes writes it ~30 seconds after SWA create returns. Re-check with: gh secret list --repo $GitHubRepo"
} else {
    $secretName = ($secretMatch.ToString() -split '\s+')[0]
    Write-Ok "GitHub secret: $secretName (value not exposed)"
}

# --- 6. summary ------------------------------------------------------------
Write-Host ''
Write-Host '=== Provisioning complete ===' -ForegroundColor Magenta
Write-Host ''
Write-Host "  Public URL:        https://$hostName"
Write-Host "  Resource group:    $ResourceGroup"
Write-Host "  Production branch: $ProductionBranch"
Write-Host ''
Write-Host 'The SWA-deploy workflow file should now exist on the production branch.' -ForegroundColor Gray
Write-Host "Verify with: git fetch origin && git ls-tree origin/$ProductionBranch '.github/workflows/' " -ForegroundColor Gray
Write-Host ''
Write-Host 'Next (spec 002 task T105): fetch the workflow file, review the five fields' -ForegroundColor Gray
Write-Host 'per task T106 (node-version, app_location, api_location, output_location,' -ForegroundColor Gray
Write-Host 'skip_app_build), commit edits if any, push.' -ForegroundColor Gray
