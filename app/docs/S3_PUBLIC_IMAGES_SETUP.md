# S3 public review images setup

This setup makes only objects under `review-images/*` publicly readable. It does **not** allow public uploads, overwrites, deletes, or bucket listing. Uploads go through the authenticated Next.js API using the EC2 instance role.

## 1. Create the bucket

Create a dedicated bucket for review images in the same AWS Region as the app. Keep Object Ownership set to **Bucket owner enforced** (ACLs disabled). Do not reuse a bucket that contains private files.

Set the app's server-side environment variables:

```dotenv
S3_PUBLIC_IMAGES_BUCKET=your-unique-bucket-name
AWS_REGION=ap-southeast-2
```

Do not put AWS access keys in these variables. The AWS SDK should obtain temporary credentials from the EC2 instance role.

## 2. EC2 instance role permissions

Attach this least-privilege IAM policy to the role used by the EC2 instance. Replace `YOUR_BUCKET_NAME` with the bucket name. This allows uploads only within the `review-images/` prefix.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UploadReviewImages",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/review-images/*"
    }
  ]
}
```

Do not grant `s3:PutObjectAcl`, `s3:DeleteObject`, or bucket-wide access unless a separately justified feature requires it.

## 3. Public read-only bucket policy

Before applying this policy, confirm this bucket is dedicated to images intended to be public. Replace `YOUR_BUCKET_NAME` with the exact bucket name.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadReviewImagesOnly",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/review-images/*"
    }
  ]
}
```

This policy makes image objects under `review-images/` readable by anyone who knows or obtains the URL. It does not grant public listing, uploading, overwriting, or deleting.

S3 Block Public Access settings can override this policy. For a dedicated public-image bucket, adjust only the settings necessary to permit this bucket policy, following your organization's AWS policy. Do not disable account-level protections broadly just to make the feature work. If organization-level controls prohibit public buckets, use CloudFront with an explicit public origin design or keep images private instead.

## 4. Upload API behaviour

The route `POST /api/uploads/images`:
- Requires a valid Cognito access-token cookie.
- Expects `multipart/form-data` with a `file` field.
- Limits files to 2 MiB.
- Accepts only JPEG, PNG, WEBP, and GIF, checking the file signature as well as the declared MIME type.
- Generates a random key under `review-images/`.
- Returns the public URL and S3 object key.
- Never accepts a caller-supplied S3 key or filename.

Example browser request:

```javascript
const data = new FormData();
data.append("file", fileInput.files[0]);

const response = await fetch("/api/uploads/images", {
  method: "POST",
  body: data,
});

const result = await response.json();
if (!response.ok) throw new Error(result.error || "Upload failed");
console.log(result.imageUrl, result.key);
```

Store `result.imageUrl` in the existing `review_posts.image_url` column when creating the review. Do not save base64 image data in PostgreSQL.

## 5. Before production

- Rotate any credentials that were exposed in terminal screenshots.
- Add rate limiting and upload quotas to reduce abuse and unexpected S3 charges.
- Consider malware scanning/moderation and a process for reporting/removing harmful content.
- Consider whether animated GIFs are necessary; they are currently allowed by the API.
- Verify bucket CORS only if the browser will access S3 directly. This implementation uploads through Next.js, so browser-to-S3 CORS is not required.
- Public objects may be cached or copied and cannot be made private again everywhere merely by changing the bucket policy.
