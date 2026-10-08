import SignupForm from "./SignupForm";

// Demande de compte par un membre de l'équipe (migration 041) — accessible
// sans session (proxy.js). Le compte est créé en attente et validé ensuite
// par un administrateur (qui choisit alors son rôle) depuis
// /admin/parametres/utilisateurs.
export default function DemandeComptePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <SignupForm />
    </main>
  );
}
