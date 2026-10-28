#!/usr/bin/env bash
# Usage: ./scripts/create-admin.sh admin@example.com 'StrongPassw0rd' "Admin Name" [aws-region]
set -euo pipefail

EMAIL="${1:?Usage: ./scripts/create-admin.sh email password name [region]}"
PASSWORD="${2:?password required}"
NAME="${3:?name required}"
REGION="${4:-ap-south-1}"
STACK="campus-complaints"

POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

aws cognito-idp admin-create-user --region "$REGION" --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true Name=name,Value="$NAME" \
  --message-action SUPPRESS >/dev/null
aws cognito-idp admin-set-user-password --region "$REGION" --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --password "$PASSWORD" --permanent
aws cognito-idp admin-add-user-to-group --region "$REGION" --user-pool-id "$POOL_ID" --username "$EMAIL" --group-name Admins

echo "Admin '$EMAIL' created. Sign in on the website."
