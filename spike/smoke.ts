/**
 * Post-deploy smoke test against any running Launchcraft URL (local or Vercel).
 *   npm run smoke -- https://your-app.vercel.app            read-only, spends nothing
 *   npm run smoke -- https://your-app.vercel.app --upload   also POSTs a 1x1 PNG (~0.0001 devnet SOL from the uploader)
 * Exit code 1 if anything required fails.
 */
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:3100").replace(/\/$/, "");
const doUpload = args.includes("--upload");

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const note = (m: string) => console.log(`  • ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`  ✗ ${m}`);
};

async function get(path: string) {
  const t0 = Date.now();
  const r = await fetch(base + path, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  return { r, ms: Date.now() - t0 };
}

async function main() {
  console.log(`Smoke test: ${base}\n`);

  console.log("Pages");
  for (const [path, expectType, mustContain] of [
    ["/", "text/html", "Launchcraft"],
    ["/create", "text/html", "Name your token"],
    ["/launches", "text/html", "My launches"],
    ["/launch/GoGRKMAfVKjThCFkgJq4e5BFuuDynTaspTiYN3axCHce", "text/html", "Reading the pool"],
  ] as const) {
    try {
      const { r, ms } = await get(path);
      const body = await r.text();
      const type = r.headers.get("content-type") ?? "";
      r.status === 200 && type.includes(expectType) && body.includes(mustContain) ? ok(`${path} (${ms} ms)`) : bad(`${path}: HTTP ${r.status}, ${type}, ${body.includes(mustContain) ? "" : `missing "${mustContain}"`}`);
    } catch (e) {
      bad(`${path}: ${(e as Error).message}`);
    }
  }

  console.log("\nAssets");
  for (const [path, type] of [["/opengraph-image", "image/png"], ["/icon.svg", "image/svg+xml"]] as const) {
    try {
      const { r } = await get(path);
      r.status === 200 && (r.headers.get("content-type") ?? "").includes(type) ? ok(path) : bad(`${path}: HTTP ${r.status} ${r.headers.get("content-type")}`);
    } catch (e) {
      bad(`${path}: ${(e as Error).message}`);
    }
  }

  console.log("\nSocial card");
  try {
    const html = await (await get("/")).r.text();
    const og = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
    if (!og) bad("no og:image tag");
    else if (!/^https?:\/\//.test(og)) bad(`og:image is not absolute: ${og}`);
    else if (base.startsWith("https://") && og.startsWith("http://localhost")) bad(`og:image points at localhost (${og}); set NEXT_PUBLIC_SITE_URL`);
    else ok(`og:image ${og}`);
  } catch (e) {
    bad(`og check: ${(e as Error).message}`);
  }

  console.log("\nFeature flags");
  try {
    const up = (await (await get("/api/upload")).r.json()) as { configured?: boolean };
    up.configured ? ok("logo upload configured") : note("logo upload NOT configured (set IRYS_UPLOADER_KEY and redeploy to enable)");
  } catch (e) {
    bad(`/api/upload: ${(e as Error).message}`);
  }
  try {
    const ai = (await (await get("/api/copilot")).r.json()) as { configured?: boolean };
    ai.configured ? ok("AI Copilot key present") : note("AI Copilot key NOT set (the rule-based Copilot still works)");
  } catch (e) {
    bad(`/api/copilot: ${(e as Error).message}`);
  }

  console.log("\nAPI guards");
  try {
    const r = await fetch(base + "/api/copilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "   " }), signal: AbortSignal.timeout(30_000) });
    r.status === 400 ? ok("copilot rejects an empty question (400)") : bad(`copilot empty question -> HTTP ${r.status}`);
  } catch (e) {
    bad(`copilot guard: ${(e as Error).message}`);
  }
  try {
    const form = new FormData();
    form.set("name", "x");
    form.set("symbol", "x");
    const r = await fetch(base + "/api/upload", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    r.status === 400 ? ok("upload rejects a request with no image (400)") : bad(`upload without image -> HTTP ${r.status}`);
  } catch (e) {
    bad(`upload guard: ${(e as Error).message}`);
  }

  if (doUpload) {
    console.log("\nLive upload (spends ~0.0001 devnet SOL)");
    try {
      const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
      const form = new FormData();
      form.set("image", new File([png], "smoke.png", { type: "image/png" }));
      form.set("name", "Smoke Test");
      form.set("symbol", "SMK");
      form.set("description", "post-deploy smoke test");
      const r = await fetch(base + "/api/upload", { method: "POST", body: form, signal: AbortSignal.timeout(90_000) });
      const j = (await r.json()) as { metadataUri?: string; imageUri?: string; error?: string };
      if (r.status === 200 && j.metadataUri) {
        const meta = await (await fetch(j.metadataUri)).json();
        const img = await fetch(meta.image);
        meta.name === "Smoke Test" && img.status === 200 ? ok(`stored and read back: ${j.metadataUri}`) : bad("uploaded, but the stored data didn't read back correctly");
      } else bad(`upload failed: HTTP ${r.status} ${j.error ?? ""}`);
    } catch (e) {
      bad(`upload: ${(e as Error).message}`);
    }
  }

  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll required checks passed.");
}

main()
  .catch((e) => {
    console.error("smoke crashed:", e?.message ?? e);
    failed++;
  })
  .finally(() => process.exit(failed ? 1 : 0));
