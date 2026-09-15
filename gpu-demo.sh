#!/bin/bash
set -e

# ============================================================================
# PQC Demo - On-demand GPU runner control
#
# Two-image model: this runs the dedicated GPU image (pqc-demo-gpu, built from
# Dockerfile.gpu with cudaq) — NOT the slim webapp image. Scale-to-zero
# g4dn.xlarge, idle cost = $0. Bring it up only for a live demo.
#
# Usage:
#   ./gpu-demo.sh build     # build + push the GPU image (Dockerfile.gpu) to ECR
#   ./gpu-demo.sh deploy    # create/update the GPU CloudFormation stack (stays at 0)
#   ./gpu-demo.sh start     # launch the GPU instance + task (~2-3 min, ~$0.53/hr)
#   ./gpu-demo.sh status    # show instance / service state + public URL
#   ./gpu-demo.sh stop      # scale everything back to 0 (stop paying)
#
# Typical first run:  ./gpu-demo.sh build && ./gpu-demo.sh deploy && ./gpu-demo.sh start
#
# Prereqs: aws cli configured; docker (for `build`).
# ============================================================================

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
STACK_NAME="pqc-demo-gpu"
ASG_NAME="pqc-demo-gpu-asg"
CLUSTER="pqc-demo-gpu-cluster"
SERVICE="pqc-demo-gpu"
GPU_ECR_REPO_NAME="pqc-demo-gpu"   # dedicated repo for the GPU image (with cudaq)

ACTION="${1:-status}"

account_id() {
  aws sts get-caller-identity --query Account --output text 2>/dev/null
}

case "$ACTION" in
  build)
    ACCOUNT_ID=$(account_id)
    [ -z "$ACCOUNT_ID" ] && { echo "❌ AWS CLI belum ter-configure."; exit 1; }
    GPU_ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_ECR_REPO_NAME}"

    echo "📦 Ensuring GPU ECR repo '${GPU_ECR_REPO_NAME}'..."
    aws ecr describe-repositories --repository-names "$GPU_ECR_REPO_NAME" --region "$AWS_REGION" > /dev/null 2>&1 || \
      aws ecr create-repository \
        --repository-name "$GPU_ECR_REPO_NAME" \
        --image-scanning-configuration scanOnPush=true \
        --region "$AWS_REGION" > /dev/null

    echo "🐳 Building GPU image (Dockerfile.gpu, includes cudaq)..."
    aws ecr get-login-password --region "$AWS_REGION" | \
      docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    docker build --platform linux/amd64 -f Dockerfile.gpu -t pqc-demo-gpu .
    docker tag pqc-demo-gpu:latest "${GPU_ECR_URI}:latest"
    docker push "${GPU_ECR_URI}:latest"
    echo "✅ GPU image pushed: ${GPU_ECR_URI}:latest"
    ;;

  deploy)
    ACCOUNT_ID=$(account_id)
    [ -z "$ACCOUNT_ID" ] && { echo "❌ AWS CLI belum ter-configure."; exit 1; }
    GPU_ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${GPU_ECR_REPO_NAME}:latest"

    # Sanity: make sure the GPU image exists before wiring the stack to it.
    if ! aws ecr describe-images --repository-name "$GPU_ECR_REPO_NAME" \
          --image-ids imageTag=latest --region "$AWS_REGION" > /dev/null 2>&1; then
      echo "⚠️  GPU image belum ada di ECR. Jalankan './gpu-demo.sh build' dulu."
      exit 1
    fi

    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
      --query "Vpcs[0].VpcId" --output text --region "$AWS_REGION")
    SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" \
      --query "Subnets[0].SubnetId" --output text --region "$AWS_REGION")

    echo "🚀 Deploying GPU stack '${STACK_NAME}' (starts at desired=0, no cost)..."
    echo "   Image:  ${GPU_ECR_URI}"
    echo "   VPC:    ${VPC_ID}"
    echo "   Subnet: ${SUBNET_ID}"

    aws cloudformation deploy \
      --template-file infra/gpu-cfn.yml \
      --stack-name "$STACK_NAME" \
      --parameter-overrides \
        ImageUri="$GPU_ECR_URI" \
        VpcId="$VPC_ID" \
        SubnetId="$SUBNET_ID" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$AWS_REGION" \
      --no-fail-on-empty-changeset

    echo "✅ GPU stack ready. Start a demo with: ./gpu-demo.sh start"
    ;;

  start)
    echo "🟢 Bringing up GPU runner (~2-3 min, ~\$0.53/hr on-demand)..."
    aws autoscaling set-desired-capacity \
      --auto-scaling-group-name "$ASG_NAME" \
      --desired-capacity 1 \
      --region "$AWS_REGION"
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$SERVICE" \
      --desired-count 1 \
      --region "$AWS_REGION" > /dev/null
    echo "   ⏳ Instance booting + image pulling. Check: ./gpu-demo.sh status"
    ;;

  stop)
    echo "🔴 Scaling GPU runner back to zero (stop paying)..."
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$SERVICE" \
      --desired-count 0 \
      --region "$AWS_REGION" > /dev/null || true
    aws autoscaling set-desired-capacity \
      --auto-scaling-group-name "$ASG_NAME" \
      --desired-capacity 0 \
      --region "$AWS_REGION"
    echo "✅ Idle. No further GPU cost."
    ;;

  status)
    echo "📊 GPU runner status (region ${AWS_REGION})"
    DESIRED=$(aws autoscaling describe-auto-scaling-groups \
      --auto-scaling-group-names "$ASG_NAME" \
      --query "AutoScalingGroups[0].DesiredCapacity" \
      --output text --region "$AWS_REGION" 2>/dev/null || echo "n/a")
    echo "   ASG desired capacity: ${DESIRED}"

    INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
      --auto-scaling-group-names "$ASG_NAME" \
      --query "AutoScalingGroups[0].Instances[?LifecycleState=='InService'].InstanceId | [0]" \
      --output text --region "$AWS_REGION" 2>/dev/null || echo "None")

    if [ "$INSTANCE_ID" != "None" ] && [ -n "$INSTANCE_ID" ]; then
      PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
        --query "Reservations[0].Instances[0].PublicIpAddress" \
        --output text --region "$AWS_REGION")
      echo "   Instance: ${INSTANCE_ID}"
      echo "   🌐 Demo URL: http://${PUBLIC_IP}/"
      echo "   (GPU backend check: http://${PUBLIC_IP}/api/grover/backend)"
    else
      echo "   No running GPU instance (idle or still booting)."
    fi
    ;;

  *)
    echo "Usage: ./gpu-demo.sh {build|deploy|start|status|stop}"
    exit 1
    ;;
esac
