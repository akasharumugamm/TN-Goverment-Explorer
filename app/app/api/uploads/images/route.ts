import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const maxDuration = 30;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)))
  ) {
    return "image/gif";
  }
  return null;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("tge_access_token")?.value;
  const domain = process.env.COGNITO_DOMAIN?.replace(/\/$/, "");
  if (!token || !domain) return false;

  const response = await fetch(domain + "/oauth2/userInfo", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!response.ok) return false;

  const claims = (await response.json()) as { sub?: string };
  return Boolean(claims.sub);
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: "Sign in to upload an image" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Authentication could not be verified" }, { status: 503 });
  }

  const bucket = process.env.S3_PUBLIC_IMAGES_BUCKET;
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

  if (!bucket || !region) {
    console.error("Image upload is not configured: S3_PUBLIC_IMAGES_BUCKET or AWS_REGION is missing");
    return NextResponse.json({ error: "Image uploads are not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file in the 'file' field" }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be larger than 0 bytes and no larger than 2 MB" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);

  if (!contentType || !ALLOWED_TYPES.has(contentType) || (file.type && file.type !== contentType)) {
    return NextResponse.json({ error: "Only valid JPEG, PNG, WEBP, or GIF images are allowed" }, { status: 415 });
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }[contentType];

  const key = "review-images/" + randomUUID() + "." + extension;
  const client = new S3Client({ region });

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  } catch (error) {
    console.error("S3 image upload failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not upload image" }, { status: 502 });
  } finally {
    client.destroy();
  }

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const imageUrl = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + encodedKey;

  return NextResponse.json({ imageUrl, key, contentType, size: bytes.byteLength }, { status: 201 });
}
