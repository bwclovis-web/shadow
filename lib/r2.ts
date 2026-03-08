import {
  HeadBucketCommand,
  ListBucketsCommand,
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
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    const parts: string[] = []
    if (typeof o.message === 'string' && o.message) parts.push(o.message)
    if (typeof o.name === 'string') parts.push(`name: ${o.name}`)
    if (typeof o.Code === 'string') parts.push(`Code: ${o.Code}`)
    const meta = o.$metadata as { httpStatusCode?: number } | undefined
    if (meta?.httpStatusCode) parts.push(`HTTP ${meta.httpStatusCode}`)
    // SDK often puts the real reason in .cause (e.g. network errors)
    if (o.cause instanceof Error && o.cause.message) parts.push(`cause: ${o.cause.message}`)
    else if (typeof o.cause === 'string') parts.push(`cause: ${o.cause}`)
    if (parts.length) return parts.join('; ')
    try {
      const str = JSON.stringify(
        { name: o.name, Code: o.Code, message: o.message, $metadata: o.$metadata, cause: o.cause },
        null,
        0,
      )
      if (str && str !== '{}') return str
    } catch {
      // ignore
    }
  }
  if (err instanceof Error && err.message) return err.message
  const fallback = String(err)
  return fallback === '[object Object]' || !fallback ? 'Unknown error (check R2 credentials and account)' : fallback
}

/**
 * List bucket names visible with the current R2 credentials (requires token with Admin Read or account-level access).
 * Used to show the user which buckets exist when HeadBucket returns NotFound.
 */
export async function listR2BucketNames(): Promise<
  { ok: true; names: string[] } | { ok: false; error: string }
> {
  try {
    const result = await getR2Client().send(new ListBucketsCommand({}))
    const names = (result.Buckets ?? []).map(b => b.Name ?? '').filter(Boolean)
    return { ok: true, names }
  } catch (err) {
    return { ok: false, error: getR2ErrorMessage(err) }
  }
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
    const errObj = typeof err === 'object' && err !== null ? (err as { name?: string; Code?: string }) : null
    const isBucketNotFound =
      /bucket does not exist|NoSuchBucket|404|Not Found|NotFound/i.test(msg) ||
      errObj?.Code === 'NoSuchBucket' ||
      errObj?.name === 'NotFound'
    if (isBucketNotFound) {
      let extra = ''
      const listResult = await listR2BucketNames()
      if (listResult.ok && listResult.names.length > 0) {
        const inList = listResult.names.includes(bucket)
        extra = ` Buckets visible with your credentials: [${listResult.names.join(', ')}]. Your R2_BUCKET_NAME "${bucket}" is ${inList ? 'in this list but HeadBucket still failed (check token permissions).' : 'NOT in this list — use one of these names or create a bucket with that exact name.'}`
      } else {
        extra = ` (Could not list buckets: ${listResult.ok ? '' : listResult.error}. Your token may need "Admin Read" to list buckets, or the account/credentials may be wrong.)`
      }
      return {
        ok: false,
        error: `R2 bucket not found or not accessible. Server is using R2_BUCKET_NAME="${bucket}" and R2_ACCOUNT_ID="${acct}".${extra} If scripts/migrate-images-to-r2 works but this fails, Next.js may be using different env: .env.local overrides .env — ensure R2_* are not redefined (or wrong) in .env.local. In Cloudflare: (1) Confirm you're in the account with ID ${acct}. (2) Bucket name must match exactly. (3) R2 API token must be from this account with "Object Read & Write" (or Admin). Restart the dev server after changing .env.`,
      }
    }
    const hint =
      msg === 'Unknown' || msg === 'Unknown error (check R2 credentials and account)'
        ? ' Check the server terminal/logs for full error (e.g. network, TLS, or auth).'
        : ''
    return {
      ok: false,
      error: `R2 bucket check failed. Server is using R2_BUCKET_NAME="${bucket}" and R2_ACCOUNT_ID="${acct}". Error: ${msg}.${hint} Check credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY), account ID, and that the bucket exists in that account.`,
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
