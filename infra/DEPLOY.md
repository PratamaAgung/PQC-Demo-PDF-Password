# Deployment Guide - AWS App Runner

## Arsitektur

```
Internet (HTTPS otomatis)
    │
    ▼
┌────────────────────┐      ┌─────────────────────┐
│   AWS App Runner   │─────▶│  Container          │
│   (managed)        │      │  nginx:80 → uvicorn │
└────────────────────┘      └─────────────────────┘
```

Tidak perlu VPC, ALB, NAT Gateway, atau ECS Cluster.
App Runner meng-handle semuanya termasuk HTTPS, scaling, dan health check.

## Estimasi Biaya

| Resource | Spec | ~Biaya/bulan |
|----------|------|-------------|
| App Runner | 0.25 vCPU, 0.5GB RAM | ~$5-7 (active) |
| App Runner (idle) | auto-pause | ~$0 jika tidak ada traffic |
| ECR | < 500MB | ~$0.05 |
| **Total** | | **~$5-7/bulan** |

App Runner hanya charge saat ada traffic. Saat idle, biayanya hampir nol.

## Prerequisites

1. AWS CLI configured
2. Docker (untuk build lokal/pertama kali)
3. GitHub repository dengan secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

## Step-by-Step Deployment

### 1. Deploy Infrastructure (satu kali)

```bash
export AWS_REGION=ap-southeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Deploy CloudFormation
aws cloudformation deploy \
  --template-file infra/cloudformation.yml \
  --stack-name pqc-demo \
  --parameter-overrides \
    ImageUri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION
```

### 2. Build & Push image pertama kali

```bash
# Login ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build & push
docker build -t pqc-demo .
docker tag pqc-demo:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pqc-demo:latest
```

### 3. Akses Aplikasi

```bash
# Dapatkan URL (sudah HTTPS!)
aws cloudformation describe-stacks \
  --stack-name pqc-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`AppRunnerURL`].OutputValue' \
  --output text
```

URL berbentuk: `https://xxxxx.ap-southeast-1.awsapprunner.com`

### 4. CI/CD (otomatis)

Setiap push ke `main`:
1. GitHub Actions build Docker image
2. Push ke ECR
3. Trigger App Runner deployment
4. App Runner deploy new revision (zero downtime)

## Auto Deploy

CloudFormation sudah set `AutoDeploymentsEnabled: true`, artinya
setiap kali image baru di-push ke ECR, App Runner otomatis deploy.
GitHub Action juga trigger `start-deployment` sebagai backup.

## Cleanup

```bash
# Hapus stack (termasuk App Runner service)
aws cloudformation delete-stack --stack-name pqc-demo --region $AWS_REGION

# Hapus ECR images jika stack delete gagal
aws ecr batch-delete-image \
  --repository-name pqc-demo \
  --image-ids "$(aws ecr list-images --repository-name pqc-demo --query 'imageIds[*]' --output json)" \
  --region $AWS_REGION
```

## GitHub Secrets

| Secret | Deskripsi |
|--------|-----------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |

IAM user perlu policy:
- `AWSAppRunnerFullAccess`
- `AmazonEC2ContainerRegistryPowerUser`
