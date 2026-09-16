import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024;

// Sous-dossiers autorisés dans public/uploads/ — whitelist explicite pour
// éviter qu'un dossier arbitraire (traversal) soit passé par le client.
const ALLOWED_FOLDERS = ["programs", "agency"];

// Upload générique d'image (image de couverture d'un programme, logo de
// l'agence...) — enregistre le fichier sur le disque du serveur dans
// public/uploads/<folder>/, aucun service externe (S3, etc.) requis.
export async function POST(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "medias.upload"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folderInput = formData.get("folder");
  const folder = ALLOWED_FOLDERS.includes(folderInput) ? folderInput : "programs";

  if (!file || typeof file === "string") {
    return NextResponse.json({ message: "Aucun fichier reçu" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { message: "Format non supporté (JPG, PNG, WEBP ou GIF uniquement)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Image trop volumineuse (5 Mo maximum)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${crypto.randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${folder}/${filename}` }, { status: 201 });
}
