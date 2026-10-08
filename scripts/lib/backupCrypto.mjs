import crypto from "node:crypto";
import { Transform } from "node:stream";

// Chiffrement des sauvegardes (NF-14) : AES-256-GCM en flux.
// Format d'un fichier : "GFBK1" (5 octets) + IV (12) + données chiffrées + tag (16).
// Clé : BACKUP_ENCRYPTION_KEY (32 octets en base64). ⚠️ À conserver HORS du
// serveur (coffre de mots de passe) : sans elle, les sauvegardes sont illisibles.

const MAGIC = Buffer.from("GFBK1");

export function backupKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) throw new Error("BACKUP_ENCRYPTION_KEY manquante (openssl rand -base64 32).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY doit faire 32 octets (base64).");
  return key;
}

export function encryptStream(key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let started = false;
  return new Transform({
    transform(chunk, _enc, cb) {
      if (!started) {
        this.push(Buffer.concat([MAGIC, iv]));
        started = true;
      }
      cb(null, cipher.update(chunk));
    },
    flush(cb) {
      if (!started) this.push(Buffer.concat([MAGIC, iv]));
      this.push(cipher.final());
      this.push(cipher.getAuthTag());
      cb();
    },
  });
}

// Déchiffrement : le tag est en fin de fichier, on garde toujours les 16
// derniers octets en réserve. Une donnée altérée fait échouer final().
export function decryptStream(key) {
  let header = Buffer.alloc(0);
  let decipher = null;
  let tail = Buffer.alloc(0);
  return new Transform({
    transform(chunk, _enc, cb) {
      try {
        if (!decipher) {
          header = Buffer.concat([header, chunk]);
          if (header.length < MAGIC.length + 12) return cb();
          if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Fichier de sauvegarde non reconnu.");
          decipher = crypto.createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length, MAGIC.length + 12));
          chunk = header.subarray(MAGIC.length + 12);
        }
        const data = Buffer.concat([tail, chunk]);
        const keep = Math.min(16, data.length);
        tail = data.subarray(data.length - keep);
        cb(null, decipher.update(data.subarray(0, data.length - keep)));
      } catch (err) {
        cb(err);
      }
    },
    flush(cb) {
      try {
        if (!decipher) throw new Error("Fichier de sauvegarde vide ou tronqué.");
        decipher.setAuthTag(tail);
        cb(null, decipher.final());
      } catch {
        cb(new Error("Sauvegarde altérée ou mauvaise clé de chiffrement (vérification d'intégrité échouée)."));
      }
    },
  });
}
