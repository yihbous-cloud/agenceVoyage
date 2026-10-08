import crypto from "node:crypto";

// Chiffrement des secrets stockés en base (jeton système Meta, app secret,
// et plus tard clés Claude / transcription / passerelles de paiement) —
// AES-256-GCM, clé maître dans la variable d'environnement
// SECRETS_ENCRYPTION_KEY (32 octets, en base64 ou en hexadécimal ;
// générer avec : openssl rand -base64 32). La clé n'est jamais en base :
// une copie de la base seule ne permet pas de relire les secrets.
// Format stocké : "v1:<iv>:<tag>:<texte chiffré>" (base64).
// ⚠️ Changer la clé rend illisibles les secrets déjà enregistrés : il
// faudra les ressaisir depuis l'admin (/admin/whatsapp/parametres).

const PREFIX = "v1";

function getKey() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SECRETS_ENCRYPTION_KEY manquante : impossible de chiffrer/déchiffrer les secrets.");
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY doit faire 32 octets (base64 ou hexadécimal).");
  }
  return key;
}

export function isEncryptionConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain) {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored) {
  if (!stored) return null;
  const [prefix, iv, tag, data] = String(stored).split(":");
  if (prefix !== PREFIX || !iv || !tag || !data) throw new Error("Secret chiffré illisible");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// Affichage dans l'admin : jamais le secret, seulement ses 4 derniers caractères.
export function maskSecret(plain) {
  if (!plain) return null;
  const s = String(plain);
  return s.length <= 4 ? "••••" : `••••••••${s.slice(-4)}`;
}
