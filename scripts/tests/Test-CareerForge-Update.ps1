[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$UpdateScript = Join-Path $ProjectRoot "scripts\Update-ResumeForge.ps1"
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $UpdateScript,
    [ref]$tokens,
    [ref]$errors
)
if ($errors.Count -ne 0) {
    throw "CareerForge updater contains PowerShell syntax errors."
}
$content = Get-Content -LiteralPath $UpdateScript -Raw -Encoding UTF8
if (-not $content.Contains('else { "Q717-A/CareerForge" }')) {
    throw "Updater default must stay on the CareerForge repository."
}
if ($content.Contains('else { "magicapple123/ResumeForge" }')) {
    throw "Updater would revert the fork to upstream."
}
Write-Host "CareerForge updater source and syntax checks passed."
