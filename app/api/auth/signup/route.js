import { NextResponse } from "next/server";
import { createSignupRequest } from "@/lib/staffUsers";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/whatsapp/team";

// Demande de compte par un membre de l'équipe (page /admin/demande-compte,
// sans session). Le compte est créé INACTIF au statut « en_attente » : il ne
// peut pas se connecter tant qu'un administrateur ne l'a pas validé depuis
// /admin/parametres/utilisateurs (qui choisit alors son rôle). Agence = sous-domaine (x-agency-id posé
// par proxy.js), jamais le corps de la requête.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function POST_handler(request) {
  const agencyId = Number(request.headers.get("x-agency-id"));
  if (!agencyId) {
    return NextResponse.json({ message: "Agence non résolue" }, { status: 400 });
  }

  const ip = clientIp(request);
  const limit = await rateLimit(`signup:${agencyId}:${ip}`, { limit: 10, windowSeconds: 60 * 60 });
  if (!limit.ok) return tooManyRequests(NextResponse, 60 * 60);

  const body = await request.json().catch(() => ({}));

  // Champ piège invisible (robots) : réponse identique à un succès, rien n'est créé.
  if (body.website) return NextResponse.json({ ok: true }, { status: 201 });

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");

  if (!fullName || !email || !password) {
    return NextResponse.json({ message: "Nom, email et mot de passe sont requis" }, { status: 400 });
  }
  if (fullName.length > 150 || email.length > 150 || phone.length > 30) {
    return NextResponse.json({ message: "Un des champs est trop long" }, { status: 400 });
  }
  if (!EMAIL_FORMAT.test(email)) {
    return NextResponse.json({ message: "Adresse email invalide" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ message: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
  }

  try {
    const id = await createSignupRequest({ fullName, email, phone, password });
    await logAudit({
      agencyId,
      action: "utilisateur.demande",
      objectType: "staff_users",
      objectId: id,
      after: { fullName, email },
      ip,
    });
    // La direction voit toutes les notifications ; les autres comptes ayant
    // utilisateurs.manage voient la pastille du menu « Utilisateurs ».
    await notify({ team: "direction", kind: "compte.demande", title: `Nouvelle demande de compte : ${fullName}`, body: email }, agencyId).catch(
      (err) => console.error("[signup] notification impossible :", err.message)
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Un compte ou une demande existe déjà pour cet email" }, { status: 409 });
    }
    throw err;
  }
}

export const POST = withNotFound(POST_handler);
