import { createWorker } from "tesseract.js";

/**
 * Normalizes a plate string by removing non-alphanumeric characters and converting to uppercase.
 */
export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/**
 * Common Nigerian License Plate RegEx patterns:
 * 1. Standard: 3 letters (LGA) + 3 digits + 2 letters (e.g. ABC 123 XY, KSF 412 AA)
 * 2. Short/State: 2-3 letters + 2-4 digits + 1-2 letters (e.g. OS 123 AB, OAU 01 A)
 * 3. Commercial / along-bus: e.g. XA 123 ABC
 */
const PLATE_PATTERNS = [
  /\b([A-Z]{3})[- ]?([0-9]{3})[- ]?([A-Z]{2})\b/i,
  /\b([A-Z]{2,3})[- ]?([0-9]{2,4})[- ]?([A-Z]{1,2})\b/i,
  /\b([A-Z]{1,3})[- ]?([0-9]{1,4})\b/i,
];

export interface AnprResult {
  rawText: string;
  detectedPlate: string | null;
  confidence: number;
}

let workerInstance: any = null;

async function getWorker() {
  if (!workerInstance) {
    workerInstance = await createWorker("eng");
  }
  return workerInstance;
}

/**
 * Performs Automatic Number Plate Recognition on a base64 image or image buffer.
 */
export async function recognizePlateFromImage(
  imageBase64OrBuffer: string | Buffer,
): Promise<AnprResult> {
  try {
    let imageInput: Buffer | string = imageBase64OrBuffer;
    if (typeof imageBase64OrBuffer === "string" && imageBase64OrBuffer.startsWith("data:")) {
      const base64Data = imageBase64OrBuffer.split(",")[1];
      if (base64Data) {
        imageInput = Buffer.from(base64Data, "base64");
      }
    } else if (typeof imageBase64OrBuffer === "string" && !imageBase64OrBuffer.startsWith("http")) {
      // Raw base64 string
      imageInput = Buffer.from(imageBase64OrBuffer, "base64");
    }

    const worker = await getWorker();
    const ret = await worker.recognize(imageInput);

    const rawText = ret.data.text || "";
    const confidence = ret.data.confidence || 0;

    // Search for license plate patterns
    let detectedPlate: string | null = null;

    // First try strict patterns
    for (const pattern of PLATE_PATTERNS) {
      const match = rawText.match(pattern);
      if (match) {
        // Format as spaced plate string e.g. "ABC 123 XY"
        if (match[1] && match[2] && match[3]) {
          detectedPlate = `${match[1].toUpperCase()} ${match[2]} ${match[3].toUpperCase()}`;
        } else if (match[1] && match[2]) {
          detectedPlate = `${match[1].toUpperCase()} ${match[2]}`;
        } else {
          detectedPlate = match[0].toUpperCase();
        }
        break;
      }
    }

    // Fallback: clean lines and extract uppercase alphanumeric sequences of length 5-10
    if (!detectedPlate) {
      const lines = rawText
        .split("\n")
        .map((l: string) => normalizePlate(l))
        .filter((l: string) => l.length >= 4 && l.length <= 10 && /\d/.test(l) && /[A-Z]/.test(l));

      if (lines.length > 0) {
        detectedPlate = lines[0];
      }
    }

    return {
      rawText: rawText.trim(),
      detectedPlate,
      confidence,
    };
  } catch (error) {
    console.error("[ANPR Engine] Error recognizing plate:", error);
    return {
      rawText: "",
      detectedPlate: null,
      confidence: 0,
    };
  }
}
