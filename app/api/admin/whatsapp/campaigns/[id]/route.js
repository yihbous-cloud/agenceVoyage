import { NextResponse } from "next/server";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { campaignReport } from "@/lib/whatsapp/campaigns";
import { toCsv } from "@/lib/whatsapp/contacts";

export const dynamic = "force-dynamic";

// Rapport de campagne (CP-06) ; ?format=csv : contacts ayant répondu, à
// transmettre aux conseillers.
export const GET = whatsappRoute(["whatsapp.campaigns", "whatsapp.campaigns.approve"], async (request, { params }) => {
  const { id } = await params;
  const report = await campaignReport(Number(id));
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = toCsv(
      [
        { label: "Nom", key: "profile_name" },
        { label: "Téléphone", value: (r) => `+${r.phone}` },
        { label: "Étape", key: "stage" },
        { label: "Variante", key: "variant" },
        { label: "Envoyé le", key: "sent_at" },
        { label: "Réponse le", key: "replied_at" },
      ],
      report.responders
    );
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="campagne-${id}-reponses.csv"` },
    });
  }
  return NextResponse.json(report);
});
