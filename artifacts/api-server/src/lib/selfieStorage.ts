/**
 * selfieStorage.ts — upload / download staff selfie images from GCS.
 * Pattern mirrors logoStorage.ts.
 */

import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parsePrivateObjectDir(): { bucketName: string; prefix: string } {
  const raw = process.env.PRIVATE_OBJECT_DIR ?? "";
  const cleaned = raw.startsWith("gs://") ? raw.slice(5) : raw.replace(/^\/+/, "");
  const slash = cleaned.indexOf("/");
  const bucketName = slash >= 0 ? cleaned.slice(0, slash) : cleaned;
  const prefix = slash >= 0 ? cleaned.slice(slash + 1) : "";
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR env var not set or invalid");
  return { bucketName, prefix };
}

/**
 * Upload a reference selfie Buffer to GCS.
 * Returns object path like /objects/selfies/ref-<staffId>.jpg
 */
export async function uploadReferenceSelfie(
  buf: Buffer,
  mimeType: string,
  staffId: string,
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const { bucketName, prefix } = parsePrivateObjectDir();
  const objectName = `${prefix}/selfies/ref-${staffId}.${ext}`.replace(/^\/+/, "");

  const bucket = gcs.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buf, {
    contentType: mimeType.includes("png") ? "image/png" : "image/jpeg",
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });

  return `/objects/selfies/ref-${staffId}.${ext}`;
}

/**
 * Upload a check-in selfie snapshot to GCS for audit trail.
 * Returns object path like /objects/selfies/checkin-<uuid>.jpg
 */
export async function uploadCheckinSelfie(
  buf: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const id = randomUUID();
  const { bucketName, prefix } = parsePrivateObjectDir();
  const objectName = `${prefix}/selfies/checkin-${id}.${ext}`.replace(/^\/+/, "");

  const bucket = gcs.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buf, {
    contentType: mimeType.includes("png") ? "image/png" : "image/jpeg",
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });

  return `/objects/selfies/checkin-${id}.${ext}`;
}

/**
 * Download a selfie from GCS as a Buffer given an object path.
 * Returns null if not found.
 */
export async function downloadSelfieBuffer(objectPath: string): Promise<Buffer | null> {
  try {
    const { bucketName, prefix } = parsePrivateObjectDir();
    const entityId = objectPath.startsWith("/objects/")
      ? objectPath.slice("/objects/".length)
      : objectPath.replace(/^\/+/, "");
    const objectName = `${prefix}/${entityId}`.replace(/^\/+/, "");

    const bucket = gcs.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) return null;

    const [buf] = await file.download();
    return buf;
  } catch {
    return null;
  }
}
