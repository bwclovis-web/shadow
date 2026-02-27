import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required R2 env var: ${key}. Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL are set in .env`,
    )
  }
  return value
}

const accountId = () => getRequiredEnv('R2_ACCOUNT_ID')
const accessKeyId = () => getRequiredEnv('R2_ACCESS_KEY_ID')
const secretAccessKey = () => getRequiredEnv('R2_SECRET_ACCESS_KEY')
const bucketName = () => getRequiredEnv('R2_BUCKET_NAME')
const publicUrl = () => getRequiredEnv('R2_PUBLIC_URL')

let client: S3Client | null = null

const getR2Client = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId(),
        secretAccessKey: secretAccessKey(),
      },
    })
  }
  return client
}

/**
 * Uploads a buffer to R2. Key should not include leading slash.
 * @param key - Object key (e.g. houses/123.jpg or perfumes/456.webp)
 * @param buffer - Raw file bytes
 * @param contentType - Optional MIME type (e.g. image/jpeg, image/webp)
 */
export const uploadToR2 = async (
  key: string,
  buffer: Buffer,
  contentType?: string,
): Promise<void> => {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    Body: buffer,
    ...(contentType && { ContentType: contentType }),
  })
  await getR2Client().send(command)
}

/**
 * Returns the public URL for an object stored in R2.
 * R2_PUBLIC_URL should not have a trailing slash; key should not have a leading slash.
 * @param key - Object key (e.g. houses/123.jpg or perfumes/456.webp)
 * @returns Full public URL
 */
export const getR2PublicUrl = (key: string): string => {
  const base = publicUrl().replace(/\/$/, '')
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key
  return `${base}/${normalizedKey}`
}
