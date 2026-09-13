import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVoyage, setSelectedVoyage] = useState(null);
  const [form, setForm] = useState({
    nomClient: "",
    email: "",
    telephone: "",
    nombrePersonnes: 1,
  });
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/voyages`)
      .then((res) => res.json())
      .then((data) => {
        setVoyages(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Impossible de charger les voyages. Le serveur est-il démarré ?");
        setLoading(false);
      });
  }, []);

  const openReservation = (voyage) => {
    setSelectedVoyage(voyage);
    setConfirmation(null);
    setForm({ nomClient: "", email: "", telephone: "", nombrePersonnes: 1 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voyageId: selectedVoyage.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la réservation");
      }
      setConfirmation(`Réservation confirmée pour ${selectedVoyage.destination} !`);
      setVoyages((prev) =>
        prev.map((v) =>
          v.id === selectedVoyage.id
            ? { ...v, placesDisponibles: v.placesDisponibles - form.nombrePersonnes }
            : v
        )
      );
    } catch (err) {
      setConfirmation(err.message);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Agence Voyage</h1>
        <p>Découvrez nos destinations et réservez votre prochain séjour</p>
      </header>

      {loading && <p className="status">Chargement des voyages…</p>}
      {error && <p className="status error">{error}</p>}

      <main className="voyages-grid">
        {voyages.map((voyage) => (
          <article className="voyage-card" key={voyage.id}>
            {voyage.image && (
              <img src={voyage.image} alt={voyage.destination} />
            )}
            <div className="voyage-card-body">
              <h2>{voyage.destination}, {voyage.pays}</h2>
              <p>{voyage.description}</p>
              <p className="voyage-meta">
                {voyage.duree} jours · {voyage.prix} MAD · {voyage.placesDisponibles} places restantes
              </p>
              <button
                disabled={voyage.placesDisponibles === 0}
                onClick={() => openReservation(voyage)}
              >
                {voyage.placesDisponibles === 0 ? "Complet" : "Réserver"}
              </button>
            </div>
          </article>
        ))}
      </main>

      {selectedVoyage && (
        <div className="modal-overlay" onClick={() => setSelectedVoyage(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Réserver : {selectedVoyage.destination}</h2>
            <form onSubmit={handleSubmit}>
              <label>
                Nom complet
                <input
                  required
                  value={form.nomClient}
                  onChange={(e) => setForm({ ...form, nomClient: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Téléphone
                <input
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                />
              </label>
              <label>
                Nombre de personnes
                <input
                  type="number"
                  min="1"
                  max={selectedVoyage.placesDisponibles}
                  value={form.nombrePersonnes}
                  onChange={(e) =>
                    setForm({ ...form, nombrePersonnes: Number(e.target.value) })
                  }
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setSelectedVoyage(null)}>
                  Annuler
                </button>
                <button type="submit">Confirmer</button>
              </div>
            </form>
            {confirmation && <p className="confirmation">{confirmation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
