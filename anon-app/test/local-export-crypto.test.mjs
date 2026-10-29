import test from "node:test";
import assert from "node:assert/strict";
import { encryptLocalExport, decryptLocalExport } from "../lib/localExportCrypto.ts";

const sample = {
  format: "ANON_LOCAL_DATA_EXPORT",
  version: 1,
  exportedAt: "2026-10-29T00:00:00.000Z",
  messageHistory: [{ id: "test-message", content: "private local test text" }],
};

test("encrypted local export round-trips without exposing plaintext in the envelope", async () => {
  const passphrase = "correct horse battery staple 2026";
  const envelope = await encryptLocalExport(sample, passphrase);
  const serialized = JSON.stringify(envelope);

  assert.equal(envelope.format, "ANON_ENCRYPTED_LOCAL_DATA_EXPORT");
  assert.equal(envelope.kdf.iterations, 600_000);
  assert.equal(envelope.cipher.name, "AES-GCM");
  assert.equal(serialized.includes("private local test text"), false);

  const restored = await decryptLocalExport(envelope, passphrase);
  assert.deepEqual(restored, sample);
});

test("wrong passphrase is rejected", async () => {
  const envelope = await encryptLocalExport(sample, "correct horse battery staple 2026");
  await assert.rejects(
    () => decryptLocalExport(envelope, "this is definitely the wrong passphrase"),
    /Could not decrypt this file/
  );
});

test("tampered ciphertext is rejected", async () => {
  const envelope = await encryptLocalExport(sample, "correct horse battery staple 2026");
  const ciphertext = envelope.ciphertext.split("");
  const middle = Math.floor(ciphertext.length / 2);
  ciphertext[middle] = ciphertext[middle] === "A" ? "B" : "A";
  const tampered = { ...envelope, ciphertext: ciphertext.join("") };

  await assert.rejects(
    () => decryptLocalExport(tampered, "correct horse battery staple 2026"),
    /Could not decrypt this file/
  );
});

test("passphrases shorter than 12 characters are rejected", async () => {
  await assert.rejects(
    () => encryptLocalExport(sample, "short"),
    /at least 12 characters/
  );
});
