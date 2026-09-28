/**
 * ANPR Service — Automatic Number Plate Recognition
 *
 * Uses Plate Recognizer cloud API (https://platerecognizer.com/) as the
 * primary recognizer, with an inline regex-based fallback for when the API
 * key is not configured or the API is unreachable.
 *
 * Environment variable:
 *   PLATE_RECOGNIZER_TOKEN — API token from https://app.platerecognizer.com/
 *   (free tier: 2,500 lookups / month, enough for prototype evaluation)
 */

export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export interface AnprResult {
  rawText: string;
  detectedPlate: string | null;
  confidence: number;
}

// ─── Plate Recognizer (primary) ──────────────────────────────────────────────

const PLATE_RECOGNIZER_URL =
  "https://api.platerecognizer.com/v1/plate-reader/";

async function recognizeWithPlateRecognizer(
  imageBuffer: Buffer,
): Promise<AnprResult | null> {
  const token = process.env.PLATE_RECOGNIZER_TOKEN;
  if (!token) return null; // skip — no API key configured

  try {
    // Plate Recognizer accepts multipart/form-data with the image as "upload"
    const boundary = `----FormBoundary${Date.now()}`;
    const fileName = "plate.jpg";

    const header = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="upload"; filename="${fileName}"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`,
    );
    const regionField = Buffer.from(
      `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="regions"\r\n\r\n` +
        `ng`,
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat([header, imageBuffer, regionField, footer]);

    const res = await fetch(PLATE_RECOGNIZER_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      console.warn(
        `[ANPR] Plate Recognizer returned HTTP ${res.status}: ${await res.text()}`,
      );
      return null;
    }

    const data = (await res.json()) as {
      results?: Array<{
        plate: string;
        score: number;
        dscore: number;
        vehicle?: { type?: string };
      }>;
    };

    const best = data.results?.[0];
    if (!best) {
      return { rawText: JSON.stringify(data), detectedPlate: null, confidence: 0 };
    }

    // Format the plate nicely for Nigerian plates (e.g. "KSF 412 AA")
    const raw = best.plate.toUpperCase();
    const formatted = formatNigerianPlate(raw);

    return {
      rawText: JSON.stringify(data),
      detectedPlate: formatted,
      confidence: Math.round(best.score * 100),
    };
  } catch (error) {
    console.warn("[ANPR] Plate Recognizer error:", error);
    return null;
  }
}

// ─── Regex fallback (lightweight, no external deps) ──────────────────────────

/**
 * Common Nigerian License Plate RegEx patterns:
 * 1. Standard: 3 letters (LGA) + 3 digits + 2 letters (e.g. KSF 412 AA)
 * 2. Short/State: 2-3 letters + 2-4 digits + 1-2 letters (e.g. OS 123 AB)
 * 3. Commercial: e.g. XA 123 ABC
 */
const PLATE_PATTERNS = [
  /\b([A-Z]{3})[- ]?([0-9]{3})[- ]?([A-Z]{2})\b/i,
  /\b([A-Z]{2,3})[- ]?([0-9]{2,4})[- ]?([A-Z]{1,2})\b/i,
  /\b([A-Z]{1,3})[- ]?([0-9]{1,4})\b/i,
];

function extractPlateFromText(text: string): string | null {
  for (const pattern of PLATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[2] && match[3]) {
        return `${match[1].toUpperCase()} ${match[2]} ${match[3].toUpperCase()}`;
      }
      if (match[1] && match[2]) {
        return `${match[1].toUpperCase()} ${match[2]}`;
      }
      return match[0].toUpperCase();
    }
  }

  // Fallback: extract uppercase alphanumeric sequences of 4-10 chars
  const lines = text
    .split("\n")
    .map((l) => normalizePlate(l))
    .filter((l) => l.length >= 4 && l.length <= 10 && /\d/.test(l) && /[A-Z]/.test(l));

  return lines[0] ?? null;
}

/**
 * Formats a raw plate string into a nicely spaced Nigerian plate format.
 * e.g. "KSF412AA" → "KSF 412 AA"
 */
function formatNigerianPlate(raw: string): string {
  const clean = normalizePlate(raw);

  // Try standard format: AAA 000 AA
  const std = clean.match(/^([A-Z]{3})(\d{3})([A-Z]{2})$/);
  if (std) return `${std[1]} ${std[2]} ${std[3]}`;

  // Try short format: AA(A) 00(00) A(A)
  const short = clean.match(/^([A-Z]{2,3})(\d{2,4})([A-Z]{1,2})$/);
  if (short) return `${short[1]} ${short[2]} ${short[3]}`;

  return raw.toUpperCase();
}

// ─── Tesseract.js fallback (for when Plate Recognizer is not configured) ─────

let tesseractWorker: any = null;

async function getTesseractWorker() {
  if (!tesseractWorker) {
    try {
      const { createWorker } = await import("tesseract.js");
      tesseractWorker = await createWorker("eng");
    } catch (error) {
      console.error("[ANPR] Failed to initialize Tesseract worker:", error);
      return null;
    }
  }
  return tesseractWorker;
}

async function recognizeWithTesseract(
  imageBuffer: Buffer,
): Promise<AnprResult> {
  const worker = await getTesseractWorker();
  if (!worker) {
    return { rawText: "", detectedPlate: null, confidence: 0 };
  }

  try {
    const ret = await worker.recognize(imageBuffer);
    const rawText = ret.data.text || "";
    const confidence = ret.data.confidence || 0;
    const detectedPlate = extractPlateFromText(rawText);

    return {
      rawText: rawText.trim(),
      detectedPlate,
      confidence,
    };
  } catch (error) {
    console.error("[ANPR] Tesseract recognition error:", error);
    return { rawText: "", detectedPlate: null, confidence: 0 };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Performs Automatic Number Plate Recognition on a base64 image or buffer.
 *
 * Strategy:
 * 1. If PLATE_RECOGNIZER_TOKEN is set → use Plate Recognizer cloud API
 * 2. Otherwise → fall back to Tesseract.js OCR (legacy)
 */
export async function recognizePlateFromImage(
  imageBase64OrBuffer: string | Buffer,
): Promise<AnprResult> {
  // Normalize input to Buffer
  let imageBuffer: Buffer;
  if (Buffer.isBuffer(imageBase64OrBuffer)) {
    imageBuffer = imageBase64OrBuffer;
  } else if (imageBase64OrBuffer.startsWith("data:")) {
    const base64Data = imageBase64OrBuffer.split(",")[1];
    imageBuffer = Buffer.from(base64Data ?? "", "base64");
  } else {
    imageBuffer = Buffer.from(imageBase64OrBuffer, "base64");
  }

  // 1. Try Plate Recognizer (primary — best for Nigerian plates)
  const prResult = await recognizeWithPlateRecognizer(imageBuffer);
  if (prResult) {
    console.log(
      `[ANPR] Plate Recognizer → ${prResult.detectedPlate ?? "no plate"} (${prResult.confidence}% confidence)`,
    );
    return prResult;
  }

  // 2. Fallback to Tesseract.js
  console.log("[ANPR] Falling back to Tesseract.js (no PLATE_RECOGNIZER_TOKEN or API error)");
  return recognizeWithTesseract(imageBuffer);
}
