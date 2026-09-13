const DUFFEL_API_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

function getApiKey() {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) {
    throw new Error("DUFFEL_API_KEY n'est pas configurée dans .env");
  }
  return key;
}

// Le mode (test/live) se déduit uniquement du préfixe de la clé fournie —
// jamais d'un interrupteur séparé, pour ne jamais confondre un essai avec
// un achat réel par erreur de configuration.
export function getDuffelMode() {
  const key = process.env.DUFFEL_API_KEY || "";
  if (key.startsWith("duffel_live_")) return "live";
  if (key.startsWith("duffel_test_")) return "test";
  return "inconnu";
}

async function duffelRequest(path, { method = "GET", body, query } = {}) {
  const url = new URL(`${DUFFEL_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify({ data: body }) : undefined,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      json?.errors?.map((e) => e.message).join(" ; ") || `Erreur Duffel (${res.status})`;
    const error = new Error(message);
    error.duffelErrors = json?.errors;
    error.status = res.status;
    throw error;
  }

  return json.data;
}

// --- Recherche de vols ---

export async function searchOffers({
  originIata,
  destinationIata,
  departureDate,
  returnDate,
  passengerCount,
  cabinClass = "economy",
}) {
  const slices = [
    { origin: originIata, destination: destinationIata, departure_date: departureDate },
  ];
  if (returnDate) {
    slices.push({
      origin: destinationIata,
      destination: originIata,
      departure_date: returnDate,
    });
  }

  const offerRequest = await duffelRequest("/air/offer_requests", {
    method: "POST",
    query: { return_offers: true },
    body: {
      slices,
      passengers: Array.from({ length: passengerCount }, () => ({ type: "adult" })),
      cabin_class: cabinClass,
    },
  });

  return offerRequest.offers || [];
}

export async function getOffer(offerId) {
  return duffelRequest(`/air/offers/${offerId}`, {
    query: { return_available_services: false },
  });
}

// --- Création de commande (achat) ---

export async function createOrder({ offerId, totalAmount, currency, passengers }) {
  return duffelRequest("/air/orders", {
    method: "POST",
    body: {
      type: "instant",
      selected_offers: [offerId],
      payments: [
        {
          type: "balance",
          currency,
          amount: totalAmount,
        },
      ],
      passengers,
    },
  });
}

export async function getOrder(orderId) {
  return duffelRequest(`/air/orders/${orderId}`);
}
