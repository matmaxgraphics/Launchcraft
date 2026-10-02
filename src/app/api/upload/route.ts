import { buildMetadata, MAX_IMAGE_BYTES, sniffImage, validateUpload } from "@/upload/validate";
import { UploadError, uploadBytes, uploaderStatus } from "@/upload/irys";

export const runtime = "nodejs";

/** Is logo upload available? (Lets the UI hide the picker instead of failing at deploy time.) */
export async function GET() {
  return Response.json({ configured: uploaderStatus().configured });
}

// Tiny in-memory limiter: the uploader wallet is real (devnet) money, so don't let one client drain it.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return bad("Too many uploads from this connection. Try again in a while.", 429);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_IMAGE_BYTES + 64 * 1024) return bad(`The upload is too large (limit ${MAX_IMAGE_BYTES / 1024} KB for the image).`, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Couldn't read the upload.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return bad("Choose an image to upload.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = String(form.get("name") ?? "");
  const symbol = String(form.get("symbol") ?? "");
  const description = String(form.get("description") ?? "");

  const problems = validateUpload({ bytes, name, symbol, description });
  if (problems.length) return bad(problems.join(" "));
  const mime = sniffImage(bytes)!; // validateUpload guarantees this is non-null

  try {
    const imageUri = await uploadBytes(Buffer.from(bytes), mime);
    const metadata = buildMetadata({ name, symbol, description, imageUri, mime });
    const metadataUri = await uploadBytes(Buffer.from(JSON.stringify(metadata)), "application/json");
    return Response.json({ imageUri, metadataUri });
  } catch (e) {
    if (e instanceof UploadError) return bad(e.message, e.status);
    return bad("The upload failed unexpectedly.", 500);
  }
}
