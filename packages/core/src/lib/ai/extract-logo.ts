import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { logger } from '../infra/logger.js';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

interface ExtractedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  kind: number;
  displayWidth: number;
  displayHeight: number;
  x: number;
  y: number;
  pageWidth: number;
  pageHeight: number;
}

function scoreImage(img: ExtractedImage): number {
  const pageArea = img.pageWidth * img.pageHeight;
  const imgArea = img.displayWidth * img.displayHeight;

  // Full-page image (scan) — skip
  if (imgArea > pageArea * 0.5) return -1;

  // Tiny images (icons, bullets) — skip
  if (img.width < 80 || img.height < 30) return -1;

  // Very large source images (photos) — skip
  if (img.width > 2000 && img.height > 2000) return -1;

  let score = 0;

  // Top of page (PDF coords: y=0 is bottom, high y = top)
  const yPercent = img.y / img.pageHeight;
  if (yPercent > 0.75) score += 3;
  else if (yPercent > 0.5) score += 1;

  // Reasonable display size
  if (img.displayWidth > 50 && img.displayWidth < 500) score += 2;

  // Aspect ratio (logos tend to be wider than tall)
  const ratio = img.width / img.height;
  if (ratio > 1 && ratio < 6) score += 2;

  // Moderate size bonus
  if (img.width > 150) score += 1;

  return score;
}

function getImageObj(pageObjs: unknown, name: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
  kind: number;
} | null> {
  return new Promise((resolve) => {
    try {
      (pageObjs as { get(name: string, cb: (data: unknown) => void): void }).get(
        name,
        (data) => resolve(data as { data: Uint8ClampedArray; width: number; height: number; kind: number } | null),
      );
    } catch {
      resolve(null);
    }
  });
}

export async function extractLogoFromPdf(input: {
  filePath: string;
  teamId: string;
}): Promise<string | null> {
  try {
    // Dynamic import for ESM compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const OPS = pdfjsLib.OPS;

    const data = new Uint8Array(fs.readFileSync(input.filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    // Only look at page 1
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();

    const imagePromises: Promise<ExtractedImage | null>[] = [];

    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === OPS.paintImageXObject) {
        // Find the preceding transform for position/size
        // Look past inner save/setGState/dependency ops that sit between transform and paint
        let transform: number[] | null = null;
        for (let k = j - 1; k >= Math.max(0, j - 10); k--) {
          if (ops.fnArray[k] === OPS.transform) {
            transform = ops.argsArray[k] as number[];
            break;
          }
        }

        const imgName = ops.argsArray[j][0] as string;

        const promise = getImageObj(page.objs, imgName).then((imgData) => {
          if (!imgData?.data) return null;

          return {
            data: imgData.data,
            width: imgData.width,
            height: imgData.height,
            kind: imgData.kind,
            displayWidth: transform ? Math.abs(transform[0] ?? imgData.width) : imgData.width,
            displayHeight: transform ? Math.abs(transform[3] ?? imgData.height) : imgData.height,
            x: transform?.[4] ?? 0,
            y: transform?.[5] ?? 0,
            pageWidth: viewport.width,
            pageHeight: viewport.height,
          } satisfies ExtractedImage;
        });

        imagePromises.push(promise);
      }
    }

    const images = (await Promise.all(imagePromises)).filter(
      (img): img is ExtractedImage => img !== null,
    );

    if (images.length === 0) {
      logger.info('No images found in PDF', { teamId: input.teamId });
      return null;
    }

    // Score and pick best candidate
    let bestImage: ExtractedImage | null = null;
    let bestScore = -1;

    for (const img of images) {
      const score = scoreImage(img);
      if (score > bestScore) {
        bestScore = score;
        bestImage = img;
      }
    }

    if (!bestImage || bestScore < 0) {
      logger.info('No suitable logo candidate found', {
        teamId: input.teamId,
        imageCount: images.length,
      });
      return null;
    }

    // Convert raw pixels to PNG
    const channels = bestImage.kind === 1 ? 1 : bestImage.kind === 2 ? 3 : 4;
    const pngBuffer = await sharp(
      Buffer.from(bestImage.data.buffer, bestImage.data.byteOffset, bestImage.data.byteLength),
      { raw: { width: bestImage.width, height: bestImage.height, channels } },
    )
      .png()
      .toBuffer();

    // Validate with sharp metadata
    const meta = await sharp(pngBuffer).metadata();
    if (!meta.width || !meta.height) return null;

    // Save to disk
    const logoDir = path.join(FILES_DIR, 'logos');
    await fs.promises.mkdir(logoDir, { recursive: true });

    const fileName = `${input.teamId}.png`;
    const filePath = path.join(logoDir, fileName);
    await fs.promises.writeFile(filePath, new Uint8Array(pngBuffer));

    logger.info('Logo extracted from PDF', {
      teamId: input.teamId,
      width: meta.width,
      height: meta.height,
      score: bestScore,
    });

    return `/files/logos/${fileName}`;
  } catch (err) {
    logger.error('Failed to extract logo from PDF', { error: err, teamId: input.teamId });
    return null;
  }
}
