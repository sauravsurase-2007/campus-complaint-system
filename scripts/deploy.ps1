# Usage (PowerShell):  .\scripts\deploy.ps1 -AdminEmail admin@example.com [-Region ap-south-1]
param(
  [Parameter(Mandatory = $true)][string]$AdminEmail,
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
$Stack = "campus-complaints"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Building backend"
sam build
if ($LASTEXITCODE -ne 0) { throw "sam build failed" }

Write-Host "==> Deploying stack '$Stack' to $Region"
sam deploy --stack-name $Stack --region $Region --capabilities CAPABILITY_IAM --resolve-s3 `
  --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides "AdminEmail=$AdminEmail"
if ($LASTEXITCODE -ne 0) { throw "sam deploy failed" }

function Get-Out($key) {
  aws cloudformation describe-stacks --stack-name $Stack --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" --output text
}

Write-Host "==> Writing frontend/js/config.js"
$config = @"
window.APP_CONFIG = {
  region: '$Region',
  userPoolId: '$(Get-Out 'UserPoolId')',
  clientId: '$(Get-Out 'UserPoolClientId')',
  apiUrl: '$(Get-Out 'ApiUrl')'
};
"@
Set-Content -Path "frontend/js/config.js" -Value $config -Encoding utf8

$Bucket = Get-Out 'WebsiteBucket'
Write-Host "==> Uploading frontend to s3://$Bucket"
aws s3 sync frontend "s3://$Bucket" --delete --region $Region --cache-control "no-cache"

Write-Host ""
Write-Host "Done! Open: $(Get-Out 'WebsiteUrl')"
Write-Host "Next: confirm the SNS subscription email sent to $AdminEmail, then run .\scripts\create-admin.ps1"
