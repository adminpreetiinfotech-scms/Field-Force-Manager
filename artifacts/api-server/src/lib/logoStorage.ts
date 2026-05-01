/**
 * Logo storage helpers — uploads company logo Buffers directly to GCS
 * and returns object paths served via /api/storage/objects/*.
 *
 * PRIVATE_OBJECT_DIR has the form:
 *   gs://<bucketId>/objects   (or /<bucketId>/objects)
 */

import { Storage } from "@google-cloud/storage";

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
 * Upload a logo buffer to GCS.
 * Returns the object path stored in DB: e.g. /objects/logos/<companyId>.jpg
 * To serve: GET /api/storage/objects/logos/<companyId>.jpg
 */
export async function uploadLogoBuffer(
  buf: Buffer,
  mimeType: string,
  companyId: string,
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const { bucketName, prefix } = parsePrivateObjectDir();
  const objectName = `${prefix}/logos/${companyId}.${ext}`.replace(/^\/+/, "");

  const bucket = gcs.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buf, {
    contentType: mimeType.includes("png") ? "image/png" : "image/jpeg",
    resumable: false,
    metadata: { cacheControl: "public, max-age=86400" },
  });

  return `/objects/logos/${companyId}.${ext}`;
}

/**
 * Download a logo from GCS as a Buffer (used for PDF generation).
 * objectPath is what is stored in DB, e.g. /objects/logos/<companyId>.jpg
 * Returns null if the object doesn't exist.
 */
export async function downloadLogoBuffer(objectPath: string): Promise<Buffer | null> {
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

/**
 * Stream a logo from GCS to an Express response.
 * Returns false if the object doesn't exist.
 */
import type { Response as ExpressResponse } from "express";

export async function streamLogoToResponse(
  objectPath: string,
  res: ExpressResponse,
): Promise<boolean> {
  try {
    const { bucketName, prefix } = parsePrivateObjectDir();
    const entityId = objectPath.startsWith("/objects/")
      ? objectPath.slice("/objects/".length)
      : objectPath.replace(/^\/+/, "");
    const objectName = `${prefix}/${entityId}`.replace(/^\/+/, "");

    const bucket = gcs.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) return false;

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    await new Promise<void>((resolve, reject) => {
      file.createReadStream()
        .on("error", reject)
        .on("end", resolve)
        .pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}
