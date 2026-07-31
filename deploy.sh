#!/bin/bash
set -e

# ============================================
# PQC Demo - Deploy to ECS Express Mode
# Jalankan dari root project directory
# Prerequisites: aws cli, docker
# ============================================

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
ECR_REPO_NAME="pqc-demo"
ECS_SERVICE_NAME="pqc-demo"
EXECUTION_ROLE_NAME="pqc-demo-ecs-execution-role"
INFRA_ROLE_NAME="pqc-demo-ecs-infrastructure-role"

echo "🚀 PQC Demo - Deployment Script"
echo "================================"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ AWS CLI tidak ter-configure. Jalankan 'aws configure' dulu."
  exit 1
fi
echo "✅ AWS Account: $ACCOUNT_ID"
echo "   Region: $AWS_REGION"
echo ""

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

# ============================================
# Step 1: Create ECR Repository (if not exists)
# ============================================
echo "📦 Step 1: ECR Repository..."
aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION > /dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --image-scanning-configuration scanOnPush=true \
    --region $AWS_REGION > /dev/null
echo "   ✅ ECR: $ECR_URI"
echo ""

# ============================================
# Step 2: Create IAM Roles (if not exists)
# ============================================
echo "🔑 Step 2: IAM Roles..."

# Task Execution Role
if ! aws iam get-role --role-name $EXECUTION_ROLE_NAME > /dev/null 2>&1; then
  aws iam create-role \
    --role-name $EXECUTION_ROLE_NAME \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' > /dev/null

  aws iam attach-role-policy \
    --role-name $EXECUTION_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  echo "   ✅ Created: $EXECUTION_ROLE_NAME"
else
  echo "   ✅ Exists: $EXECUTION_ROLE_NAME"
fi

# Infrastructure Role
if ! aws iam get-role --role-name $INFRA_ROLE_NAME > /dev/null 2>&1; then
  aws iam create-role \
    --role-name $INFRA_ROLE_NAME \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' > /dev/null

  aws iam attach-role-policy \
    --role-name $INFRA_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRolePolicyForServiceConnectTransportLayerSecurity

  # Wait for role propagation
  echo "   ⏳ Waiting for IAM role propagation..."
  sleep 10
  echo "   ✅ Created: $INFRA_ROLE_NAME"
else
  echo "   ✅ Exists: $INFRA_ROLE_NAME"
fi
echo ""

# ============================================
# Step 3: Build & Push Docker Image
# ============================================
echo "🐳 Step 3: Build & Push Docker Image..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
FULL_IMAGE="${ECR_URI}:${IMAGE_TAG}"

docker build -t pqc-demo .
docker tag pqc-demo:latest ${ECR_URI}:latest
docker tag pqc-demo:latest ${FULL_IMAGE}
docker push ${ECR_URI}:latest
docker push ${FULL_IMAGE}
echo "   ✅ Pushed: ${FULL_IMAGE}"
echo ""

# ============================================
# Step 4: Deploy ECS Express Service
# ============================================
echo "🌐 Step 4: Deploy ECS Express..."

EXECUTION_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXECUTION_ROLE_NAME}"
INFRA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${INFRA_ROLE_NAME}"

# Check if service already exists
SERVICE_ARN=$(aws ecs list-services --region $AWS_REGION \
  --query "serviceArns[?contains(@, '${ECS_SERVICE_NAME}')]|[0]" \
  --output text 2>/dev/null || echo "None")

if [ "$SERVICE_ARN" = "None" ] || [ -z "$SERVICE_ARN" ]; then
  echo "   Creating new ECS Express service..."
  aws ecs create-express-gateway-service \
    --primary-container "{\"image\": \"${FULL_IMAGE}\", \"containerPort\": 80}" \
    --health-check-path "/api/health" \
    --execution-role-arn $EXECUTION_ROLE_ARN \
    --infrastructure-role-arn $INFRA_ROLE_ARN \
    --region $AWS_REGION \
    --monitor-resources
  echo ""
  echo "   ✅ ECS Express service created!"
else
  echo "   Updating existing service: $SERVICE_ARN"
  aws ecs update-express-gateway-service \
    --service-arn $SERVICE_ARN \
    --primary-container "{\"image\": \"${FULL_IMAGE}\"}" \
    --region $AWS_REGION
  echo "   ✅ Service updated!"
fi

echo ""
echo "================================"
echo "🎉 Deployment selesai!"
echo ""
echo "Tunggu beberapa menit untuk provisioning, lalu cek URL di:"
echo "  aws ecs describe-services --cluster default --services $ECS_SERVICE_NAME --region $AWS_REGION"
echo ""
echo "Atau buka ECS Console → Express Mode untuk lihat URL."
echo "================================"
