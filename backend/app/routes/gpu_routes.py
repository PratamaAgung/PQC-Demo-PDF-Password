"""
GPU Worker control routes.
Start/stop the GPU worker instance from the UI to save costs.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
GPU_ASG_NAME = os.environ.get("GPU_ASG_NAME", "pqc-demo-gpu-asg")
GPU_CLUSTER = os.environ.get("GPU_CLUSTER", "pqc-demo-gpu-cluster")
GPU_TASK_FAMILY = os.environ.get("GPU_TASK_FAMILY", "pqc-demo-gpu-worker")


def get_boto3_clients():
    """Lazy import boto3 and return clients. Returns None if unavailable."""
    try:
        import boto3
        return {
            "autoscaling": boto3.client("autoscaling", region_name=AWS_REGION),
            "ecs": boto3.client("ecs", region_name=AWS_REGION),
            "ec2": boto3.client("ec2", region_name=AWS_REGION),
        }
    except Exception:
        return None


@router.get("/status")
async def gpu_status():
    """Get current GPU worker status."""
    clients = get_boto3_clients()
    if not clients:
        return {"status": "not_configured", "message": "AWS SDK tidak tersedia"}

    try:
        response = clients["autoscaling"].describe_auto_scaling_groups(
            AutoScalingGroupNames=[GPU_ASG_NAME]
        )

        if not response["AutoScalingGroups"]:
            return {"status": "not_configured", "message": "GPU ASG not found"}

        asg = response["AutoScalingGroups"][0]
        desired = asg["DesiredCapacity"]
        instances = asg["Instances"]

        if desired == 0:
            return {
                "status": "stopped",
                "message": "GPU worker dimatikan (hemat biaya)",
                "desired_capacity": 0,
                "instances": 0,
            }

        running_instances = [i for i in instances if i["LifecycleState"] == "InService"]

        if running_instances:
            instance_id = running_instances[0]["InstanceId"]
            ec2_response = clients["ec2"].describe_instances(InstanceIds=[instance_id])
            public_ip = (
                ec2_response["Reservations"][0]["Instances"][0]
                .get("PublicIpAddress", "")
            )

            return {
                "status": "running",
                "message": "GPU worker aktif",
                "desired_capacity": desired,
                "instances": len(running_instances),
                "instance_id": instance_id,
                "worker_url": f"http://{public_ip}:8001" if public_ip else "",
                "instance_type": "g4dn.xlarge (NVIDIA T4 16GB)",
            }
        else:
            return {
                "status": "starting",
                "message": "GPU instance sedang dinyalakan...",
                "desired_capacity": desired,
                "instances": 0,
            }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Tidak bisa cek status: {str(e)}",
        }


@router.post("/start")
async def start_gpu_worker():
    """Start the GPU worker (set ASG desired=1)."""
    clients = get_boto3_clients()
    if not clients:
        raise HTTPException(status_code=503, detail="AWS SDK tidak tersedia")

    try:
        clients["autoscaling"].set_desired_capacity(
            AutoScalingGroupName=GPU_ASG_NAME,
            DesiredCapacity=1,
        )

        try:
            clients["ecs"].run_task(
                cluster=GPU_CLUSTER,
                taskDefinition=GPU_TASK_FAMILY,
                count=1,
            )
        except Exception:
            pass

        return {
            "status": "starting",
            "message": "GPU worker sedang dinyalakan. Tunggu ~2-3 menit.",
            "estimated_cost": "~$0.53/jam (g4dn.xlarge on-demand)",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyalakan GPU: {str(e)}")


@router.post("/stop")
async def stop_gpu_worker():
    """Stop the GPU worker (set ASG desired=0)."""
    clients = get_boto3_clients()
    if not clients:
        raise HTTPException(status_code=503, detail="AWS SDK tidak tersedia")

    try:
        try:
            tasks = clients["ecs"].list_tasks(cluster=GPU_CLUSTER)
            for task_arn in tasks.get("taskArns", []):
                clients["ecs"].stop_task(cluster=GPU_CLUSTER, task=task_arn)
        except Exception:
            pass

        clients["autoscaling"].set_desired_capacity(
            AutoScalingGroupName=GPU_ASG_NAME,
            DesiredCapacity=0,
        )

        return {
            "status": "stopping",
            "message": "GPU worker dimatikan. Tidak ada biaya lagi.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mematikan GPU: {str(e)}")
