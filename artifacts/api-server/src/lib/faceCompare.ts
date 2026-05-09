/**
 * faceCompare.ts — lightweight face similarity using jimp pixel histograms.
 *
 * Algorithm:
 *  1. Load both images via jimp
 *  2. Resize to 64x64 and convert to grayscale
 *  3. Crop center 48x48 (face area — ignores hairline & chin variability)
 *  4. Build normalised luminance histograms (256 buckets)
 *  5. Compute Bhattacharyya coefficient → score 0-100
 *
 * This is a deterrent-grade check (not ML face recognition).
 * Same person in similar lighting → score ~65-100.
 * Different people        → score ~0-55.
 * Threshold: 60 → flag as mismatch warning.
 */

import Jimp from "Jimp";

const THUMB = 64;
const CROP_OFFSET = 8;
const CROP_SIZE = THUMB - 2 * CROP_OFFSET; // 48
const BINS = 256;
const MATCH_THRESHOLD = 55; // score >= 55 → match (can be tuned)

function buildHistogram(img: Jimp): Float64Array {
  const hist = new Float64Array(BINS);
  const { width, height } = img.bitmap;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = img.getPixelColor(x, y);
      // jimp pixel: 0xRRGGBBAA — extract red channel of grayscale (R=G=B)
      const lum = (px >>> 24) & 0xff;
      hist[lum]++;
    }
  }
  const total = width * height;
  for (let i = 0; i < BINS; i++) hist[i] /= total;
  return hist;
}

function bhattacharyya(h1: Float64Array, h2: Float64Array): number {
  let bc = 0;
  for (let i = 0; i < BINS; i++) {
    bc += Math.sqrt(h1[i] * h2[i]);
  }
  // bc is in [0, 1]; convert to percentage similarity
  return Math.round(bc * 100);
}

async function prepareImage(buf: Buffer): Promise<Jimp> {
  const img = await Jimp.read(buf);
  img
    .resize(THUMB, THUMB)
    .greyscale()
    .crop(CROP_OFFSET, CROP_OFFSET, CROP_SIZE, CROP_SIZE);
  return img;
}

export type FaceCompareResult = {
  score: number;       // 0-100
  status: "match" | "mismatch" | "error";
  matched: boolean;
};

/**
 * Compare two image buffers and return a similarity score.
 */
export async function compareFaces(
  refBuf: Buffer,
  checkBuf: Buffer,
): Promise<FaceCompareResult> {
  try {
    const [ref, chk] = await Promise.all([
      prepareImage(refBuf),
      prepareImage(checkBuf),
    ]);
    const h1 = buildHistogram(ref);
    const h2 = buildHistogram(chk);
    const score = bhattacharyya(h1, h2);
    const matched = score >= MATCH_THRESHOLD;
    return { score, status: matched ? "match" : "mismatch", matched };
  } catch {
    return { score: 0, status: "error", matched: false };
  }
}
