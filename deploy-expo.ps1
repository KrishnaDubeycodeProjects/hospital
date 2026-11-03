Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Deploying Aarogya Flow to Expo EAS     " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\asha-app"

Write-Host "`n[1/2] Verifying TypeScript..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript errors found. Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/2] Triggering Expo EAS Cloud Build..." -ForegroundColor Yellow
npx -y eas-cli build --platform android --profile preview --non-interactive --no-wait

Write-Host "`nBuild submitted to Expo EAS cloud queue successfully!" -ForegroundColor Green

