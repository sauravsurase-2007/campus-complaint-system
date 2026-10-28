# Usage: .\scripts\create-admin.ps1 -Email admin@example.com -Password 'StrongPassw0rd' -Name "Admin Name" [-Region ap-south-1]
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
$PoolId = aws cloudformation describe-stacks --stack-name campus-complaints --region $Region `
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text

aws cognito-idp admin-create-user --region $Region --user-pool-id $PoolId --username $Email `
  --user-attributes "Name=email,Value=$Email" "Name=email_verified,Value=true" "Name=name,Value=$Name" `
  --message-action SUPPRESS | Out-Null
aws cognito-idp admin-set-user-password --region $Region --user-pool-id $PoolId --username $Email `
  --password $Password --permanent
aws cognito-idp admin-add-user-to-group --region $Region --user-pool-id $PoolId --username $Email --group-name Admins

Write-Host "Admin '$Email' created. Sign in on the website."
