/**
 * Password-encrypted local export envelope.
 *
 * This protects a downloaded backup file at rest. It does not encrypt live chat,
 * change server-side access, or protect a passphrase that is weak or disclosed.
 */
const FORMAT = "ANON_ENCRYPTED_LOCAL_DATA_EXPORT";
const VERSION = 1;
const ITERATIONS = 600_000;
const AAD = "ANON_LOCAL_DATA_EXPORT:v1:PBKDF2-SHA256:AES-256-GCM";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedExport = {
  format: typeof FORMAT;
  version: typeof VERSION;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number };
  cipher: { name: "AES-GCM"; bits: 256 };
  salt: string;
  iv: string;
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptLocalExport(bundle: unknown, passphrase: string): Promise<EncryptedExport> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("This browser does not support encrypted export. Use a current browser over HTTPS.");
  }
  if (passphrase.length < 12) {
    throw new Error("Use a passphrase of at least 12 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = encoder.encode(JSON.stringify(bundle));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(AAD),
      tagLength: 128,
    },
    key,
    plaintext
  );

  return {
    format: FORMAT,
    version: VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
    cipher: { name: "AES-GCM", bits: 256 },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptLocalExport(
  raw: unknown,
  passphrase: string
): Promise<unknown> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("This browser does not support decryption. Use a current browser over HTTPS.");
  }
  if (!raw || typeof raw !== "object") throw new Error("This file is not an encrypted ANON export.");
  const envelope = raw as Partial<EncryptedExport>;
  if (
    envelope.format !== FORMAT ||
    envelope.version !== VERSION ||
    envelope.kdf?.name !== "PBKDF2" ||
    envelope.kdf?.hash !== "SHA-256" ||
    envelope.kdf?.iterations !== ITERATIONS ||
    envelope.cipher?.name !== "AES-GCM" ||
    envelope.cipher?.bits !== 256 ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Unsupported or damaged encrypted ANON export.");
  }

  try {
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("Malformed crypto parameters.");
    const key = await deriveKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: encoder.encode(AAD),
        tagLength: 128,
      },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("Could not decrypt this file. Check the passphrase and make sure the export is intact.");
  }
}
