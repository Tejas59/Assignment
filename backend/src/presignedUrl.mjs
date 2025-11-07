import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bucket = process.env.UPLOAD_BUCKET;

export const handler = async (event) => {
  const body = JSON.parse(event.body);
  const { fileName, contentType } = body;

  const key = `uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadUrl, key }),
  };
};
