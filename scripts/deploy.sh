#!/usr/bin/env bash
# Usage: ./scripts/deploy.sh admin@example.com [aws-region]
set -euo pipefail

ADMIN_EMAIL="${1:?Usage: ./scripts/deploy.sh admin@example.com [aws-region]}"
REGION="${2:-ap-south-1}"
STACK="campus-complaints"
cd "$(dirname "$0")/.."

echo "==> Building backend"
sam build

echo "==> Deploying stack '$STACK' to $REGION"
sam deploy --stack-name "$STACK" --region "$REGION" \
  --capabilities CAPABILITY_IAM --resolve-s3 \
  --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides "AdminEmail=$ADMIN_EMAIL"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

echo "==> Writing frontend/js/config.js"
cat > frontend/js/config.js <<CFG
window.APP_CONFIG = {
  region: '$REGION',
  userPoolId: '$(out UserPoolId)',
  clientId: '$(out UserPoolClientId)',
  apiUrl: '$(out ApiUrl)'
};
CFG

BUCKET="$(out WebsiteBucket)"
echo "==> Uploading frontend to s3://$BUCKET"
aws s3 sync frontend "s3://$BUCKET" --delete --region "$REGION" --cache-control "no-cache"

echo
echo "Done! Open: $(out WebsiteUrl)"
echo "Next: confirm the SNS subscription email sent to $ADMIN_EMAIL, then run ./scripts/create-admin.sh"
