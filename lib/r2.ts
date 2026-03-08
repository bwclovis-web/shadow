import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const getRequiredEnv = (key: string): string => {
  const raw = process.env[key]
  const value = typeof raw === 'string' ? raw.trim() : ''
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

/** Build a readable message from SDK/network errors that may not be standard Error. */
function getR2ErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    const parts: string[] = []
    if (typeof o.message === 'string') parts.push(o.message)
    if (typeof o.name === 'string') parts.push(`name: ${o.name}`)
    if (typeof o.Code === 'string') parts.push(`Code: ${o.Code}`)
    const meta = o.$metadata as { httpStatusCode?: number } | undefined
    if (meta?.httpStatusCode) parts.push(`HTTP ${meta.httpStatusCode}`)
    if (parts.length) return parts.join('; ')
    try {
      const str = JSON.stringify(
        { name: o.name, Code: o.Code, message: o.message, $metadata: o.$metadata },
        null,
        0,
      )
      if (str && str !== '{}') return str
    } catch {
      // ignore
    }
  }
  const fallback = String(err)
  return fallback === '[object Object]' || !fallback ? 'Unknown error (check R2 credentials and account)' : fallback
}

/**
 * Verify the R2 bucket exists and is accessible with the current credentials.
 * Call this before a batch of uploads to fail fast with a clear error.
 * @returns { ok: true } or { ok: false, error: "detailed message with bucket name and account" }
 */
export async function checkR2BucketExists(): Promise<{ ok: true } | { ok: false; error: string }> {
  const bucket = bucketName()
  const acct = accountId()
  try {
    await getR2Client().send(new HeadBucketCommand({ Bucket: bucket }))
    return { ok: true }
  } catch (err) {
    const msg = getR2ErrorMessage(err)
    const isBucketNotFound =
      /bucket does not exist|NoSuchBucket|404|Not Found/i.test(msg) ||
      (typeof err === 'object' && err !== null && (err as { Code?: string }).Code === 'NoSuchBucket')
    if (isBucketNotFound) {
      return {
        ok: false,
        error: `R2 bucket not found or not accessible. Server is using R2_BUCKET_NAME="${bucket}" and R2_ACCOUNT_ID="${acct}". In Cloudflare: (1) Open the R2 dashboard and confirm you're in the same account as ${acct}. (2) Confirm the bucket name matches exactly (no extra spaces — current length ${bucket.length} chars). (3) Ensure your R2 API token was created in this account and has "Object Read & Write". Restart the dev server after changing .env.`,
      }
    }
    return {
      ok: false,
      error: `R2 bucket check failed. Server is using R2_BUCKET_NAME="${bucket}" and R2_ACCOUNT_ID="${acct}". Error: ${msg}. Check credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY), account ID, and that the bucket exists in that account.`,
    }
  }
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
  const bucket = bucketName()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ...(contentType && { ContentType: contentType }),
  })
  try {
    await getR2Client().send(command)
  } catch (err) {
    const msg = getR2ErrorMessage(err)
    const isNoSuchBucket =
      /bucket does not exist|NoSuchBucket/i.test(msg) ||
      (typeof err === 'object' && err !== null && (err as { Code?: string }).Code === 'NoSuchBucket')
    if (isNoSuchBucket) {
      throw new Error(
        `The specified bucket does not exist. (R2_BUCKET_NAME="${bucket}", account ${accountId()}. Check that this bucket exists in the Cloudflare R2 dashboard for this account and that .env is loaded — e.g. restart the dev server after changing .env.)`,
      )
    }
    throw err
  }
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
