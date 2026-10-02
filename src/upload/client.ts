/** Browser-side calls to /api/upload. The route does the storing; this only moves a File over HTTP. */

export interface UploadedMetadata {
  imageUri: string;
  metadataUri: string;
}

/** Is logo upload set up on this server? Defaults to false if the check itself fails. */
export async function uploadAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/api/upload", { cache: "no-store" });
    return r.ok && Boolean((await r.json()).configured);
  } catch {
    return false;
  }
}

export async function uploadLaunchMetadata(a: { file: File; name: string; symbol: string; description: string }): Promise<UploadedMetadata> {
  const form = new FormData();
  form.set("image", a.file);
  form.set("name", a.name);
  form.set("symbol", a.symbol);
  form.set("description", a.description);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach the upload service. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as Partial<UploadedMetadata> & { error?: string };
  if (!res.ok || !body.metadataUri || !body.imageUri) throw new Error(body.error ?? "The upload failed.");
  return { imageUri: body.imageUri, metadataUri: body.metadataUri };
}
