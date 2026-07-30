# Deployment Guide - ECS Express Mode

## Arsitektur

```
Internet (HTTPS otomatis via AWS-provided URL)
    │
    ▼
┌──────────────────────────────────────────────────┐
│   ECS Express Mode (managed by AWS)              │
│   ┌─────────┐    ┌──────────┐    ┌───────────┐  │
│   │   ALB   │───▶│  Fargate │───▶│ Container │  │
│   │ (shared)│    │  (task)  │    │ nginx:80  │  │
│   └─────────┘    └──────────┘    └───────────┘  │
│   + Auto Scaling + HTTPS + Health Check          │
└──────────────────────────────────────────────────┘
```

ECS Express Mode otomatis provision:
- ECS Cluster + Fargate tasks
- ALB (shared, dibagi sampai 25 services)
- Auto scaling
- HTTPS dengan AWS-provided URL
- Networking & security groups

Kita hanya perlu sediakan: container image, execution role, infrastructure role.

## Estimasi Biaya

| Resource | Spec | ~Biaya/bulan |
|----------|------|-------------|
| Fargate | 0.25 vCPU, 0.5GB RAM, 1 task | ~$8 |
| ALB (shared) | dibagi max 25 services | ~$1-5 |
| ECR | < 500MB | ~$0.05 |
| CloudWatch Logs | minimal | ~$1 |
| **Total** | | **~$10-14/bulan** |

ALB di-share oleh ECS Express Mode, jadi biayanya jauh lebih murah
dibanding dedicated ALB (~$22/bulan).

## Prerequisites

1. AWS CLI v2 (terbaru, support ECS Express)
2. Docker
3. GitHub repo dengan secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

## Step-by-Step Deployment

### 1. Deploy IAM Roles & ECR (satu kali)

```bash
export AWS_REGION=ap-southeast-1

aws cloudformation deploy \
  --template-file infra/cloudformation.yml \
  --stack-name pqc-demo-infra \
  --parameter-overrides \
    ImageUri="placeholder" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION
```

### 2. Build & Push image pertama kali

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build & push
docker build -t pqc-demo .
docker tag pqc-demo:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest
```

### 3. Create ECS Express Service (satu kali)

```bash
EXECUTION_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/pqc-demo-ecs-execution-role"
INFRA_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/pqc-demo-ecs-infrastructure-role"
IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest"

aws ecs create-express-gateway-service \
  --primary-container "image=${IMAGE_URI},port=80,healthCheckPath=/api/health" \
  --execution-role-arn $EXECUTION_ROLE \
  --infrastructure-role-arn $INFRA_ROLE \
  --monitor-resources
```

Tunggu beberapa menit. ECS Express akan provision semua infrastructure otomatis.

### 4. Akses Aplikasi

Setelah provisioning selesai, URL tersedia di output CLI atau di ECS Console.
Format: `https://xxxxx.ap-southeast-1.amazonaws.com`

### 5. CI/CD (otomatis setelah setup)

Setiap push ke `main`:
1. GitHub Actions build Docker image
2. Push ke ECR
3. Update ECS Express service dengan image baru
4. Rolling deployment otomatis

## Update Aplikasi (manual)

```bash
aws ecs update-express-gateway-service \
  --service-arn arn:aws:ecs:${AWS_REGION}:${AWS_ACCOUNT_ID}:service/CLUSTER/pqc-demo \
  --primary-container '{"image": "NEW_IMAGE_URI"}'
```

## Cleanup

```bash
# List dan delete ECS Express service
aws ecs delete-service --cluster CLUSTER_NAME --service pqc-demo --force

# Hapus CloudFormation stack
aws cloudformation delete-stack --stack-name pqc-demo-infra --region $AWS_REGION
```

## GitHub Secrets

| Secret | Deskripsi |
|--------|-----------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |

IAM user perlu policy:
- `AmazonECS_FullAccess`
- `AmazonEC2ContainerRegistryPowerUser`
- `CloudWatchLogsFullAccess`
- `IAMReadOnlyAccess` (untuk get role ARNs)
