import os
import boto3
import uuid

# Initialize the S3 client using environment variables
s3_client = boto3.client(
    's3',
    endpoint_url=os.getenv("STORAGE_ENDPOINT"),
    aws_access_key_id=os.getenv("STORAGE_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("STORAGE_SECRET_KEY"),
    region_name=os.getenv("STORAGE_REGION", "us-east-1") # Region is required by boto3
)
BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME")

def upload_and_get_url(file_bytes: bytes, filename: str) -> str:
    # 1. Extract the extension (e.g., "mp3", "wav")
    ext = filename.split('.')[-1]
    
    # 2. Generate a unique key so identically named uploads don't overwrite each other
    unique_key = f"{uuid.uuid4()}.{ext}"
    
    # 3. Upload to the bucket
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=unique_key,
        Body=file_bytes,
        ContentType=f"audio/{ext}",
    )
    
    # 4. Construct and return the public-facing URL
    base_public_url = os.getenv("STORAGE_ENDPOINT").replace("/storage/v1/s3", "/storage/v1/object/public")
    return f"{base_public_url}/{BUCKET_NAME}/{unique_key}"