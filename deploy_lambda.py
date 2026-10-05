#!/usr/bin/env python3
"""
Automated AWS Lambda Deployment Script for AarogyaFlow (hospital-spring-boot)
Uses boto3 to:
  1. Validate AWS credentials and IAM permissions.
  2. Create or verify IAM execution role (hospital-spring-boot-lambda-role).
  3. Package the Maven project into an AWS Lambda deployment jar.
  4. Create or update AWS Lambda function (java21, 2048MB, 30s timeout).
  5. Configure all environment variables from .env into Lambda.
  6. Enable an AWS Lambda Function URL with public CORS access.
  7. Update frontend/.env.production with the new live API URL.
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

WORKSPACE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = WORKSPACE_DIR / "frontend"
ENV_FILE = WORKSPACE_DIR / ".env"

FUNCTION_NAME = "hospital-spring-boot-api"
ROLE_NAME = "hospital-spring-boot-lambda-role"
HANDLER = "com.qdischarge.clinicqueue.lambda.StreamLambdaHandler::handleRequest"
RUNTIME = "java21"
MEMORY_SIZE = 3008
TIMEOUT_SECONDS = 60

def parse_env_file(filepath: Path) -> dict:
    env_vars = {}
    if not filepath.exists():
        return env_vars
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()
    return env_vars

def get_or_create_execution_role(iam_client):
    print(f"🔑 Checking IAM role '{ROLE_NAME}'...")
    assume_role_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }
        ]
    }
    try:
        role = iam_client.get_role(RoleName=ROLE_NAME)
        role_arn = role["Role"]["Arn"]
        print(f"✅ IAM role found: {role_arn}")
        return role_arn
    except iam_client.exceptions.NoSuchEntityException:
        print(f"⚙️ Creating IAM role '{ROLE_NAME}'...")
        role = iam_client.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(assume_role_policy),
            Description="Execution role for hospital-spring-boot AWS Lambda backend"
        )
        role_arn = role["Role"]["Arn"]
        
        iam_client.attach_role_policy(
            RoleName=ROLE_NAME,
            PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        )
        print(f"✅ Created role: {role_arn} (waiting 10s for propagation)...")
        time.sleep(10)
        return role_arn

def build_package() -> Path:
    target_dir = WORKSPACE_DIR / "target"
    jars = [p for p in target_dir.glob("*.jar") if not p.name.endswith("-sources.jar")]
    if ("--skip-build" in sys.argv or os.environ.get("SKIP_BUILD") == "1") and jars:
        print(f"\n📦 Skipping Maven build (--skip-build). Using existing artifact: {jars[0].name}")
        return jars[0]

    print("\n📦 Packaging Spring Boot backend with Maven...")
    cmd = ["mvn.cmd" if os.name == "nt" else "mvn", "package", "-DskipTests"]
    result = subprocess.run(cmd, cwd=WORKSPACE_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ Maven build failed:")
        print(result.stdout[-1500:])
        print(result.stderr[-1500:])
        sys.exit(1)
    
    jars = [p for p in target_dir.glob("*.jar") if not p.name.endswith("-sources.jar")]
    if not jars:
        print("❌ No jar file found in target directory!")
        sys.exit(1)
    
    # Prefer original jar or shaded jar
    jar_path = jars[0]
    print(f"✅ Build successful! Artifact: {jar_path.name} ({jar_path.stat().st_size / (1024*1024):.2f} MB)")
    return jar_path

def deploy_to_lambda(session, role_arn: str, jar_path: Path, env_vars: dict, s3_bucket: str = "buckets132"):
    s3_client = session.client("s3")
    lambda_client = session.client("lambda")
    
    s3_key = f"lambda/{jar_path.name}"
    print(f"\n☁️ Uploading {jar_path.name} ({jar_path.stat().st_size / (1024*1024):.2f} MB) to s3://{s3_bucket}/{s3_key}...")
    for attempt in range(1, 4):
        try:
            s3_client.upload_file(str(jar_path), s3_bucket, s3_key)
            print("✅ Upload to S3 complete!")
            break
        except Exception as e:
            if attempt == 3:
                raise
            print(f"⚠️ S3 upload attempt {attempt} failed ({e}), retrying in 3s...")
            time.sleep(3)

    # Clean env vars: values must be strings and max 4KB total if possible, filter non-empty and non-reserved AWS keys
    lambda_env = {k: str(v) for k, v in env_vars.items() if v and not k.startswith("AWS_")}
    lambda_env["SPRING_PROFILES_ACTIVE"] = "prod"
    lambda_env["PORT"] = "8088"
    lambda_env["STORAGE_UPLOAD_DIR"] = "/tmp/storage/documents"

    function_exists = False
    try:
        lambda_client.get_function(FunctionName=FUNCTION_NAME)
        function_exists = True
    except lambda_client.exceptions.ResourceNotFoundException:
        function_exists = False

    if function_exists:
        print(f"🔄 Updating existing Lambda function code for '{FUNCTION_NAME}' from S3...")
        lambda_client.update_function_code(
            FunctionName=FUNCTION_NAME,
            S3Bucket=s3_bucket,
            S3Key=s3_key
        )
        print("⏳ Waiting for code update to settle...")
        waiter = lambda_client.get_waiter("function_updated")
        waiter.wait(FunctionName=FUNCTION_NAME)

        print(f"🔄 Updating configuration for '{FUNCTION_NAME}'...")
        lambda_client.update_function_configuration(
            FunctionName=FUNCTION_NAME,
            Handler=HANDLER,
            Role=role_arn,
            Runtime=RUNTIME,
            Timeout=TIMEOUT_SECONDS,
            MemorySize=MEMORY_SIZE,
            Environment={"Variables": lambda_env}
        )
        print("⏳ Waiting for configuration update to settle...")
        waiter.wait(FunctionName=FUNCTION_NAME)
    else:
        print(f"🚀 Creating new Lambda function '{FUNCTION_NAME}' from s3://{s3_bucket}/{s3_key}...")
        for attempt in range(5):
            try:
                lambda_client.create_function(
                    FunctionName=FUNCTION_NAME,
                    Runtime=RUNTIME,
                    Role=role_arn,
                    Handler=HANDLER,
                    Code={"S3Bucket": s3_bucket, "S3Key": s3_key},
                    Description="AarogyaFlow Hospital Spring Boot Backend (Java 21)",
                    Timeout=TIMEOUT_SECONDS,
                    MemorySize=MEMORY_SIZE,
                    Publish=True,
                    Environment={"Variables": lambda_env}
                )
                break
            except ClientError as e:
                if "The role defined for the function cannot be assumed by Lambda" in str(e):
                    print("⏳ Waiting for IAM role propagation (5s)...")
                    time.sleep(5)
                else:
                    raise

    print("⏳ Waiting for Lambda function to be active...")
    waiter = lambda_client.get_waiter("function_active_v2")
    waiter.wait(FunctionName=FUNCTION_NAME)
    # Configure provisioned concurrency to reduce cold start latency
    try:
        lambda_client.put_provisioned_concurrency_config(
            FunctionName=FUNCTION_NAME,
            Qualifier="$LATEST",
            ProvisionedConcurrentExecutions=5
        )
        print(f"✅ Set provisioned concurrency to 5 for {FUNCTION_NAME}")
    except Exception as e:
        print(f"⚠️ Could not set provisioned concurrency: {e}")

    # Configure Function URL
    print("\n🌐 Configuring public AWS Lambda Function URL...")
    try:
        url_cfg = lambda_client.get_function_url_config(FunctionName=FUNCTION_NAME)
        func_url = url_cfg["FunctionUrl"]
        print(f"✅ Existing Function URL: {func_url}")
    except lambda_client.exceptions.ResourceNotFoundException:
        url_cfg = lambda_client.create_function_url_config(
            FunctionName=FUNCTION_NAME,
            AuthType="NONE",
            Cors={
                "AllowOrigins": ["*"],
                "AllowMethods": ["*"],
                "AllowHeaders": ["*"],
                "MaxAge": 86400
            }
        )
        func_url = url_cfg["FunctionUrl"]
        print(f"✅ Created Function URL: {func_url}")

    # Add public invoke permission for Function URL
    try:
        lambda_client.add_permission(
            FunctionName=FUNCTION_NAME,
            StatementId="FunctionURLAllowPublicAccess",
            Action="lambda:InvokeFunctionUrl",
            Principal="*",
            FunctionUrlAuthType="NONE"
        )
    except ClientError:
        pass # Already exists

    return func_url

def update_frontend(func_url: str):
    print(f"\n🎨 Linking frontend to live Lambda URL: {func_url}")
    frontend_env = FRONTEND_DIR / ".env.production"
    clean_url = func_url.rstrip("/")
    with open(frontend_env, "w", encoding="utf-8") as f:
        f.write(f"# Auto-generated for AWS Lambda deployment\n")
        f.write(f"VITE_API_URL={clean_url}\n")
    print(f"✅ Updated {frontend_env.relative_to(WORKSPACE_DIR)}")

def main():
    print("=" * 65)
    print("🏥 AarogyaFlow AWS Lambda Backend Deployer")
    print("=" * 65)

    # 1. Parse .env
    env_vars = parse_env_file(ENV_FILE)
    print(f"📄 Loaded {len(env_vars)} configuration variables from .env")

    access_key = os.environ.get("AWS_ACCESS_KEY_ID") or env_vars.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or env_vars.get("AWS_SECRET_ACCESS_KEY")
    session_token = os.environ.get("AWS_SESSION_TOKEN") or env_vars.get("AWS_SESSION_TOKEN")
    region = os.environ.get("AWS_REGION") or env_vars.get("AWS_REGION", "us-east-1")

    if not access_key or not secret_key:
        print("❌ Error: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.")
        print("Usage: python deploy_lambda.py")
        sys.exit(1)

    print(f"📍 Target Region: {region}")
    session_kwargs = {
        "aws_access_key_id": access_key,
        "aws_secret_access_key": secret_key,
        "region_name": region
    }
    if session_token:
        session_kwargs["aws_session_token"] = session_token

    session = boto3.Session(**session_kwargs)

    # 2. Validate credentials
    sts = session.client("sts")
    try:
        identity = sts.get_caller_identity()
        print(f"👤 Authenticated as: {identity['Arn']} (Account: {identity['Account']})")
    except ClientError as e:
        print(f"❌ Failed AWS STS authentication: {e}")
        sys.exit(1)

    # 3. Setup IAM Role
    iam = session.client("iam")
    role_arn = get_or_create_execution_role(iam)

    # 4. Build Jar
    jar_path = build_package()

    # 5. Deploy Lambda
    func_url = deploy_to_lambda(session, role_arn, jar_path, env_vars)

    # 6. Update Frontend
    update_frontend(func_url)

    print("\n" + "=" * 65)
    print("🎉 DEPLOYMENT COMPLETE!")
    print(f"🚀 Live Backend Function URL: {func_url}")
    print(f"🏥 Health Endpoint: {func_url}actuator/health")
    print(f"🧪 Test Credentials: {func_url}api/test/credentials")
    print("=" * 65)

if __name__ == "__main__":
    main()
