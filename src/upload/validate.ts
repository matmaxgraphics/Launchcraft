/**
 * Pure helpers for logo + metadata uploads: decide what bytes are an acceptable image, and build the
 * Metaplex token-metadata JSON that wallets and explorers read from the on-chain URI. No I/O here.
 */
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_DESCRIPTION_CHARS = 400;

export type ImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/**
 * Identify the image by its magic bytes, never by file name or the client-declared type.
 * SVG is deliberately not accepted: it can carry script, and wallets render these images.
 */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export interface UploadInput {
  bytes: Uint8Array;
  name: string;
  symbol: string;
  description: string;
}

/** Returns human-readable problems; empty means the upload is acceptable. */
export function validateUpload(i: UploadInput): string[] {
  const out: string[] = [];
  if (i.bytes.length === 0) out.push("The image file is empty.");
  else if (i.bytes.length > MAX_IMAGE_BYTES) out.push(`The image is ${(i.bytes.length / 1024).toFixed(0)} KB; the limit is ${MAX_IMAGE_BYTES / 1024} KB.`);
  else if (!sniffImage(i.bytes)) out.push("The logo must be a PNG, JPEG, GIF or WebP image.");
  const name = i.name.trim();
  const symbol = i.symbol.trim();
  if (!name || name.length > 32) out.push("The token name must be 1-32 characters.");
  if (!symbol || symbol.length > 10) out.push("The token symbol must be 1-10 characters.");
  if (i.description.length > MAX_DESCRIPTION_CHARS) out.push(`The description is limited to ${MAX_DESCRIPTION_CHARS} characters.`);
  return out;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  properties: { files: { uri: string; type: string }[]; category: "image" };
}

/** Metaplex fungible-token metadata: what wallets read from the URI stored on the mint. */
export function buildMetadata(i: { name: string; symbol: string; description: string; imageUri: string; mime: ImageMime }): TokenMetadata {
  return {
    name: i.name.trim(),
    symbol: i.symbol.trim(),
    description: i.description.trim(),
    image: i.imageUri,
    properties: { files: [{ uri: i.imageUri, type: i.mime }], category: "image" },
  };
}
