import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMetadata, MAX_DESCRIPTION_CHARS, MAX_IMAGE_BYTES, sniffImage, validateUpload } from "../src/upload/validate";
import { claimableTotal, claimOptions } from "../src/lens/claim";
import type { LaunchLive, LaunchStatic } from "../src/lens/read";

const pad = (sig: number[], len = 32) => Uint8Array.from([...sig, ...new Array(len - sig.length).fill(0)]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("sniffImage identifies png/jpeg/gif/webp by magic bytes", () => {
  assert.equal(sniffImage(PNG), "image/png");
  assert.equal(sniffImage(JPG), "image/jpeg");
  assert.equal(sniffImage(GIF), "image/gif");
  assert.equal(sniffImage(WEBP), "image/webp");
});

test("sniffImage rejects SVG, HTML, scripts, and short or empty input (don't trust names or declared types)", () => {
  const enc = new TextEncoder();
  assert.equal(sniffImage(enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(enc.encode("<!doctype html><html></html>")), null);
  assert.equal(sniffImage(enc.encode("MZ\u0090\u0000 not an image at all......")), null);
  assert.equal(sniffImage(new Uint8Array(0)), null);
  assert.equal(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e])), null); // truncated PNG header
  // RIFF but not WEBP (e.g. a WAV)
  assert.equal(sniffImage(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), null);
});

const ok = { bytes: PNG, name: "Signal", symbol: "SIG", description: "A token." };

test("validateUpload accepts a good upload", () => assert.deepEqual(validateUpload(ok), []));

test("validateUpload reports every problem, with limits stated", () => {
  assert.match(validateUpload({ ...ok, bytes: new Uint8Array(0) }).join(" "), /empty/);
  assert.match(validateUpload({ ...ok, bytes: new Uint8Array(MAX_IMAGE_BYTES + 1) }).join(" "), /limit is 512 KB/);
  assert.match(validateUpload({ ...ok, bytes: new TextEncoder().encode("<svg></svg><svg></svg>") }).join(" "), /PNG, JPEG, GIF or WebP/);
  assert.match(validateUpload({ ...ok, name: "" }).join(" "), /name must be 1-32/);
  assert.match(validateUpload({ ...ok, name: "x".repeat(33) }).join(" "), /name must be 1-32/);
  assert.match(validateUpload({ ...ok, symbol: "S".repeat(11) }).join(" "), /symbol must be 1-10/);
  assert.match(validateUpload({ ...ok, description: "d".repeat(MAX_DESCRIPTION_CHARS + 1) }).join(" "), /limited to 400/);
});

test("buildMetadata produces Metaplex fungible-token JSON with a typed image file", () => {
  const m = buildMetadata({ name: " Signal ", symbol: "SIG ", description: " hi ", imageUri: "https://devnet.irys.xyz/abc", mime: "image/png" });
  assert.deepEqual(m, {
    name: "Signal",
    symbol: "SIG",
    description: "hi",
    image: "https://devnet.irys.xyz/abc",
    properties: { files: [{ uri: "https://devnet.irys.xyz/abc", type: "image/png" }], category: "image" },
  });
  // the on-chain URI field holds at most 200 chars; the metadata URL itself is short
  assert.ok("https://devnet.irys.xyz/A1dHGwuT6Ug1LG8k5yok55yrKUm6UrEzcLvucMscz4Ma".length < 200);
});

/* ---------- claim roles ---------- */

const st = { creator: "CREATOR", feeClaimer: "PARTNER" } as LaunchStatic;
const live = { fees: { creatorSol: 0.5, partnerSol: 0.25, protocolSol: 0.1, totalTradingSol: 0.85 } } as LaunchLive;

test("claimOptions: only the creator wallet can claim the creator share, only the fee claimer the partner share", () => {
  const asCreator = claimOptions(st, live, "CREATOR");
  assert.deepEqual(asCreator.map((o) => [o.role, o.canClaim]), [["creator", true], ["partner", false]]);
  const asPartner = claimOptions(st, live, "PARTNER");
  assert.deepEqual(asPartner.map((o) => [o.role, o.canClaim]), [["creator", false], ["partner", true]]);
  const stranger = claimOptions(st, live, "SOMEONE");
  assert.ok(stranger.every((o) => !o.canClaim));
  assert.ok(claimOptions(st, live, null).every((o) => !o.canClaim));
});

test("claimOptions: when one wallet is both roles it can claim both, and the total adds up", () => {
  const both = { creator: "ME", feeClaimer: "ME" } as LaunchStatic;
  const opts = claimOptions(both, live, "ME");
  assert.ok(opts.every((o) => o.canClaim));
  assert.equal(claimableTotal(opts), 0.75);
  assert.equal(claimableTotal(claimOptions(st, live, "CREATOR")), 0.5);
});
