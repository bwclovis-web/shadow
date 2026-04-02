import type { PerfumeCsvRecord } from "@/types/scraper"

/**
 * Stay under typical platform POST body limits (e.g. Vercel ~4.5MB) so import
 * does not fail with a browser-level "Failed to fetch".
 */
const DEFAULT_MAX_BODY_UTF8_BYTES = 2_300_000

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

function chunkRecordsBySerializedSize(
  records: PerfumeCsvRecord[],
  serializeBatch: (batch: PerfumeCsvRecord[]) => string,
  maxUtf8Bytes: number,
): PerfumeCsvRecord[][] {
  const chunks: PerfumeCsvRecord[][] = []
  let batch: PerfumeCsvRecord[] = []

  for (const r of records) {
    batch.push(r)
    if (utf8ByteLength(serializeBatch(batch)) <= maxUtf8Bytes) continue

    const last = batch.pop()!
    if (batch.length > 0) {
      chunks.push(batch)
      batch = [last]
      if (utf8ByteLength(serializeBatch(batch)) > maxUtf8Bytes) {
        chunks.push(batch)
        batch = []
      }
    } else {
      chunks.push([last])
      batch = []
    }
  }
  if (batch.length > 0) chunks.push(batch)
  return chunks
}

export function chunkPerfumeCsvRecordsForImport(
  records: PerfumeCsvRecord[],
  uploadImagesToR2: boolean,
  overwriteImageUrls: boolean,
  maxUtf8Bytes = DEFAULT_MAX_BODY_UTF8_BYTES,
): PerfumeCsvRecord[][] {
  return chunkRecordsBySerializedSize(
    records,
    (batch) =>
      JSON.stringify({
        records: batch,
        uploadImagesToR2,
        overwriteImageUrls,
      }),
    maxUtf8Bytes,
  )
}

export function chunkPerfumeCsvRecordsForRetryR2(
  records: PerfumeCsvRecord[],
  maxUtf8Bytes = DEFAULT_MAX_BODY_UTF8_BYTES,
): PerfumeCsvRecord[][] {
  return chunkRecordsBySerializedSize(
    records,
    (batch) => JSON.stringify({ records: batch }),
    maxUtf8Bytes,
  )
}
