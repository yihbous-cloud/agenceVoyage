import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getGroupById, getGroupMembers, updateGroupTotalDue } from "@/lib/registrationGroups";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const [group, members] = await Promise.all([getGroupById(id), getGroupMembers(id)]);
  if (!group) {
    return NextResponse.json({ message: "Groupe introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ...group, members });
}

// Le montant dû est partagé par tout le groupe (voir CLAUDE.md
// §3quindecies) — même permission que la gestion des paiements, pas de
// distinction par champ nécessaire ici (endpoint dédié uniquement au volet
// financier, contrairement à PUT .../registrations/[id]).
export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "paiements.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const { totalDue } = await request.json();

  if (totalDue === undefined || Number.isNaN(Number(totalDue))) {
    return NextResponse.json({ message: "Montant dû invalide" }, { status: 400 });
  }

  const updated = await updateGroupTotalDue(id, Number(totalDue));
  return NextResponse.json(updated);
}
