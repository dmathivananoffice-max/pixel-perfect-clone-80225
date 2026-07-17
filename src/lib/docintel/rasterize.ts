// ─────────────────────────────────────────────────────────────
// Browser-side rasterizer.
// Converts a File (PDF or image) into an array of base64 PNGs,
// one per page. Runs entirely in the browser using pdfjs-dist so
// the raw file never leaves the origin unencoded.
//
// Kept client-side because Cloudflare Workers cannot render PDFs
// without native deps.
// ─────────────────────────────────────────────────────────────
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface RasterizedPage {
  pageNumber: number;
  /** data URL, e.g. `data:image/png;base64,....` */
  dataUrl: string;
  /** rendered pixel dimensions — used by the UI to translate model bboxes back into image coords */
  widthPx: number;
  heightPx: number;
}

/** Cap PDF page render width — big enough for legible OCR, small enough to keep tokens down. */
const PDF_RENDER_MAX_WIDTH = 1600;
/** Never send more than this many pages per document to the model. */
const MAX_PAGES_PER_DOC = 20;

async function imageFileToPage(file: File): Promise<RasterizedPage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
  // Get dimensions for bbox translation.
  const { widthPx, heightPx } = await new Promise<{ widthPx: number; heightPx: number }>(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = dataUrl;
    },
  );
  return { pageNumber: 1, dataUrl, widthPx, heightPx };
}

async function pdfToPages(file: File): Promise<RasterizedPage[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = Math.min(doc.numPages, MAX_PAGES_PER_DOC);
  const out: RasterizedPage[] = [];
  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const viewport1x = page.getViewport({ scale: 1 });
    const scale = Math.min(2, PDF_RENDER_MAX_WIDTH / viewport1x.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    out.push({ pageNumber: p, dataUrl, widthPx: canvas.width, heightPx: canvas.height });
    // release
    page.cleanup();
  }
  await doc.destroy();
  return out;
}

/** Rasterize a file into one image per page. Throws for unsupported types. */
export async function rasterizeFile(file: File): Promise<RasterizedPage[]> {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return pdfToPages(file);
  }
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|tiff?|heic)$/i.test(file.name)) {
    return [await imageFileToPage(file)];
  }
  throw new Error(`Unsupported file type for rasterization: ${mime || file.name}`);
}

/** Convert an ArrayBuffer of already-known bytes (e.g. downloaded from storage) into a File. */
export function bufferToFile(buf: ArrayBuffer, fileName: string, mimeType: string | null): File {
  return new File([buf], fileName, { type: mimeType ?? 'application/octet-stream' });
}
