// Petites pages HTML autonomes des liens de paiement (hors site public :
// pas de layout, pas de traduction DOM) — bilingues français / arabe.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function htmlPage(title, bodyHtml, { status = 200 } = {}) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f5f1;color:#1f1f23;margin:0;padding:32px 16px}
.card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e3da;border-radius:16px;padding:28px}
h1{font-size:20px;margin:0 0 12px}p{line-height:1.6}.ar{direction:rtl;text-align:right;color:#55555c}.muted{color:#6e6e76;font-size:14px}
pre{white-space:pre-wrap;background:#f6f5f1;border-radius:10px;padding:12px;font-family:inherit}
button{background:#0f6b4b;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:16px;cursor:pointer}</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export function messagePage(title, fr, ar, extra = "") {
  return htmlPage(title, `<h1>${esc(title)}</h1><p>${esc(fr)}</p><p class="ar">${esc(ar)}</p>${extra}`);
}

// Formulaire auto-soumis vers la passerelle (CMI).
export function autoSubmitPage(action, params) {
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return htmlPage(
    "Redirection vers le paiement",
    `<h1>Redirection vers le paiement sécurisé…</h1><p class="ar">جارٍ التحويل إلى صفحة الأداء الآمن…</p>
<form id="f" method="post" action="${esc(action)}">${inputs}<noscript><button type="submit">Continuer</button></noscript></form>
<script>document.getElementById("f").submit();</script>`
  );
}

export { esc };
