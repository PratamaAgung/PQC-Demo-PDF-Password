#!/bin/bash
set -e

# ============================================
# PQC Demo - Deploy to ECS Express Mode + GPU Worker
# Jalankan dari root project directory
# Prerequisites: aws cli, docker
#
# Usage:
#   ./deploy.sh          # Deploy webapp only
#   ./deploy.sh --gpu    # Deploy webapp + GPU worker infra
# ============================================

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
ECR_REPO_NAME="pqc-demo"
GPU_ECR_REPO_NAME="pqc-demo-gpu-worker"
ECS_SERVICE_NAME="pqc-demo"
EXECUTION_ROLE_NAME="pqc-demo-ecs-execution-role"
INFRA_ROLE_NAME="pqc-demo-ecs-infrastructure-role"

DEPLOY_GPU=false
if [ "$1" = "--gpu" ]; then
  DEPLOY_GPU=true
fi

echo "🚀 PQC Demo - Deployment Script"
echo "================================"
if [ "$DEPLOY_GPU" = true ]; then
  echo "   Mode: Webapp + GPU Worker"
else
  echo "   Mode: Webapp only (use --gpu untuk include GPU worker)"
fi
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
GPU_ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_ECR_REPO_NAME}"

# ============================================
# Step 1: Create ECR Repositories
# ============================================
echo "📦 Step 1: ECR Repositories..."
aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION > /dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --image-scanning-configuration scanOnPush=true \
    --region $AWS_REGION > /dev/null
echo "   ✅ ECR webapp: $ECR_URI"

if [ "$DEPLOY_GPU" = true ]; then
  aws ecr describe-repositories --repository-names $GPU_ECR_REPO_NAME --region $AWS_REGION > /dev/null 2>&1 || \
    aws ecr create-repository \
      --repository-name $GPU_ECR_REPO_NAME \
      --image-scanning-configuration scanOnPush=true \
      --region $AWS_REGION > /dev/null
  echo "   ✅ ECR gpu-worker: $GPU_ECR_URI"
fi
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

  echo "   ⏳ Waiting for IAM role propagation..."
  sleep 10
  echo "   ✅ Created: $INFRA_ROLE_NAME"
else
  echo "   ✅ Exists: $INFRA_ROLE_NAME"
fi
echo ""

# ============================================
# Step 3: Build & Push Docker Images
# ============================================
echo "🐳 Step 3: Build & Push Docker Images..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")

# -- Webapp image --
echo "   Building webapp..."
FULL_IMAGE="${ECR_URI}:${IMAGE_TAG}"
docker build -t pqc-demo .
docker tag pqc-demo:latest ${ECR_URI}:latest
docker tag pqc-demo:latest ${FULL_IMAGE}
docker push ${ECR_URI}:latest
docker push ${FULL_IMAGE}
echo "   ✅ Webapp pushed: ${FULL_IMAGE}"

# -- GPU Worker image --
if [ "$DEPLOY_GPU" = true ]; then
  echo "   Building GPU worker..."
  GPU_FULL_IMAGE="${GPU_ECR_URI}:${IMAGE_TAG}"
  docker build -t pqc-demo-gpu-worker -f gpu-worker/Dockerfile gpu-worker/
  docker tag pqc-demo-gpu-worker:latest ${GPU_ECR_URI}:latest
  docker tag pqc-demo-gpu-worker:latest ${GPU_FULL_IMAGE}
  docker push ${GPU_ECR_URI}:latest
  docker push ${GPU_FULL_IMAGE}
  echo "   ✅ GPU worker pushed: ${GPU_FULL_IMAGE}"
fi
echo ""

# ============================================
# Step 4: Deploy ECS Express Service (Webapp)
# ============================================
echo "🌐 Step 4: Deploy Webapp (ECS Express)..."

EXECUTION_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXECUTION_ROLE_NAME}"
INFRA_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${INFRA_ROLE_NAME}"

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

# ============================================
# Step 5: Deploy GPU Worker Infrastructure (optional)
# ============================================
if [ "$DEPLOY_GPU" = true ]; then
  echo "🎮 Step 5: Deploy GPU Worker Infrastructure..."

  # Get default VPC and subnet
  VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
    --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)
  SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" \
    --query "Subnets[0].SubnetId" --output text --region $AWS_REGION)

  echo "   VPC: $VPC_ID"
  echo "   Subnet: $SUBNET_ID"

  aws cloudformation deploy \
    --template-file infra/gpu-worker-cfn.yml \
    --stack-name pqc-demo-gpu-worker \
    --parameter-overrides \
      GpuImageUri="${GPU_ECR_URI}:latest" \
      VpcId="${VPC_ID}" \
      SubnetId="${SUBNET_ID}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $AWS_REGION \
    --no-fail-on-empty-changeset

  echo "   ✅ GPU Worker stack deployed (ASG min=0, mati by default)"
  echo "   ℹ️  Nyalakan GPU dari UI webapp atau jalankan:"
  echo "      aws autoscaling set-desired-capacity --auto-scaling-group-name pqc-demo-gpu-asg --desired-capacity 1"
  echo ""
fi

# ============================================
# Done
# ============================================
echo "================================"
echo "🎉 Deployment selesai!"
echo ""
echo "Webapp URL: cek di ECS Console → Express Mode"
echo ""
if [ "$DEPLOY_GPU" = true ]; then
  echo "GPU Worker: mati by default (hemat biaya)"
  echo "  Nyalakan: aws autoscaling set-desired-capacity --auto-scaling-group-name pqc-demo-gpu-asg --desired-capacity 1"
  echo "  Matikan:  aws autoscaling set-desired-capacity --auto-scaling-group-name pqc-demo-gpu-asg --desired-capacity 0"
  echo ""
fi
echo "================================"
