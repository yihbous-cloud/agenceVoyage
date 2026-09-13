import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact",
  description:
    "Contactez Golden Fantastic pour toute question sur nos programmes Omra, Hajj et séjours touristiques.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">Contact</h1>
      <p className="mt-3 text-zinc-600">
        Une question sur un programme ou votre inscription ? Écrivez-nous, ou
        contactez-nous directement sur WhatsApp.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-3 text-sm text-zinc-700">
          <p>
            <strong>WhatsApp :</strong> +212 6XX XXX XXX
          </p>
          <p>
            <strong>Email :</strong> contact@goldenfantastic.example
          </p>
          <p>
            <strong>Adresse :</strong> [Adresse de l&apos;agence à compléter]
          </p>
        </div>

        <ContactForm />
      </div>
    </main>
  );
}
