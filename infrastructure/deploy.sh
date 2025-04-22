#!/bin/bash
set -e

# Check if running in the correct directory
if [ ! -f "cdk.json" ]; then
    echo "Error: Please run this script from the infrastructure directory"
    exit 1
fi

# Install infrastructure dependencies
echo "Installing infrastructure dependencies..."
npm install

# Install Lambda dependencies
echo "Installing Lambda dependencies..."
cd lambda
npm install --production
cd ..

# Deploy infrastructure
echo "Deploying infrastructure..."
cdk deploy --require-approval never --force

# Get the outputs
echo "Getting deployment outputs..."
aws cloudformation describe-stacks --stack-name InfrastructureStack --query 'Stacks[0].Outputs' | jq 'map({(.OutputKey): .OutputValue}) | add' > outputs.json

# Update the web application configuration
echo "Updating web application configuration..."
API_ENDPOINT=$(jq -r '.ApiEndpoint' outputs.json)
USER_POOL_ID=$(jq -r '.UserPoolId' outputs.json)
USER_POOL_CLIENT_ID=$(jq -r '.UserPoolClientId' outputs.json)
CLOUDFRONT_DOMAIN=$(jq -r '.CloudFrontDomain' outputs.json)
S3_BUCKET_NAME="infrastructurestack-websitebucket75c24d94-1p6rpbncbmqn" # Hardcoded based on previous ls
S3_REGION="us-east-2" # Deduced from API GW endpoint
S3_ORIGIN_DOMAIN="${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com"

# Look up Distribution ID using the S3 origin domain name
echo "Looking for CF distribution with origin ${S3_ORIGIN_DOMAIN}..."
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items!=null && contains(Origins.Items[*].DomainName, '${S3_ORIGIN_DOMAIN}')].Id | [0]" --output text)

if [ -z "${CLOUDFRONT_DISTRIBUTION_ID}" ] || [ "${CLOUDFRONT_DISTRIBUTION_ID}" == "None" ]; then
  echo "Error: Could not find CloudFront Distribution ID for S3 origin ${S3_ORIGIN_DOMAIN}"
  exit 1 # Exit if ID not found
fi
echo "Found CloudFront Distribution ID: ${CLOUDFRONT_DISTRIBUTION_ID}"

# Sync frontend files to S3 bucket
echo "Syncing frontend files to S3 bucket s3://${S3_BUCKET_NAME}..."
aws s3 sync ../web-server/public s3://${S3_BUCKET_NAME}/ --delete

# Create a configuration file for the web application
mkdir -p ../web-server/public # Ensure directory exists
cat > ../web-server/public/config.js << EOL
window.config = {
  userPoolId: '${USER_POOL_ID}',
  clientId: '${USER_POOL_CLIENT_ID}',
  apiEndpoint: '${API_ENDPOINT}',
  websiteUrl: 'https://${CLOUDFRONT_DOMAIN}'
};
EOL

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"

echo "Deployment complete!"
echo "Website URL: https://${CLOUDFRONT_DOMAIN}"
echo "API Endpoint: ${API_ENDPOINT}" 