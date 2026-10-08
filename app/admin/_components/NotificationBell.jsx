"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

// Cloche de notifications (urgences, transferts, SLA, tâches, rapports...)
// et notifications du navigateur (Notification API) — cahier §8, lot 3.
// Interrogation toutes les 30 s, en pause quand l'onglet est masqué.
const POLL_MS = 30_000;
const SEEN_KEY = "gf-notif-last-id";

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  // Lu à l'ouverture du menu (jamais rendu côté serveur, menu fermé au départ).
  const [permission, setPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "default"));
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await fetch("/api/admin/whatsapp/notifications?unread=1").catch(() => null);
    if (!res?.ok) return;
    const list = await res.json();
    setItems(list);
    // Notification du navigateur pour les nouveautés (pas au premier chargement).
    const seen = readSeen();
    const fresh = list.filter((n) => n.id > seen);
    if (fresh.length) {
      try {
        localStorage.setItem(SEEN_KEY, String(Math.max(...list.map((n) => n.id))));
      } catch {}
      if (!firstLoad.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const n of fresh.slice(0, 3)) {
          const notif = new Notification(n.title, { body: n.body ? String(n.body).slice(0, 140) : undefined, tag: `gf-${n.id}` });
          notif.onclick = () => {
            window.focus();
            window.location.href = n.conversation_id ? `/admin/whatsapp/conversations/${n.conversation_id}` : "/admin/whatsapp/taches";
          };
        }
      }
    }
    firstLoad.current = false;
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function markAllRead() {
    await fetch("/api/admin/whatsapp/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: items.map((n) => n.id) }) });
    setItems([]);
  }

  return (
    <div className="relative">
      <button type="button" className="gf-btn-square" title="Notifications" onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        <Icon name={items.length ? "notifications_active" : "notifications"} size={19} />
        {items.length > 0 && (
          <span className="gf-sb-badge" style={{ position: "absolute", top: -4, insetInlineEnd: -4, minWidth: 18 }}>
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="gf-card absolute end-0 z-50 mt-2 w-80 overflow-hidden" style={{ boxShadow: "var(--gf-shadow-pop)" }}>
          <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">
            Notifications
            {items.length > 0 && (
              <button type="button" className="text-xs text-zinc-500" onClick={markAllRead}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Aucune notification non lue.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.conversation_id ? `/admin/whatsapp/conversations/${n.conversation_id}` : "/admin/whatsapp/taches"}
                  className="block border-b px-4 py-2.5 text-sm hover:bg-zinc-50"
                  onClick={() => setOpen(false)}
                >
                  <span className="block" dir="auto">
                    {n.title}
                  </span>
                  <span className="text-xs text-zinc-500">{new Date(`${String(n.created_at).replace(" ", "T")}Z`).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                </Link>
              ))
            )}
          </div>
          {typeof Notification !== "undefined" && permission !== "granted" && (
            <button
              type="button"
              className="w-full border-t px-4 py-2 text-start text-xs"
              style={{ color: "var(--gf-accent-ink)" }}
              onClick={async () => setPermission(await Notification.requestPermission())}
            >
              {permission === "denied" ? "Notifications du navigateur bloquées (à autoriser dans les réglages du navigateur)" : "Activer les notifications du navigateur"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
