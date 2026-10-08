"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Icon from "./Icon";
import { useAdminLocale } from "./AdminLocale";
import AdminLanguageSwitcher from "./AdminLanguageSwitcher";
import NotificationBell from "./NotificationBell";

// Shell de l'espace interne (charte : designadmin.md) — barre latérale sombre
// repliable, en-tête avec fil d'Ariane et bouton « Créer », palette de
// commandes (Ctrl/Cmd + K). Les libellés arrivent en FRANÇAIS et sont
// traduits ici via tr() (dictionnaire admin).

// Pages hors navigation rattachées à une section (fil d'Ariane, état actif).
const SECTION_ALIASES = [
  { prefix: "/admin/voyages", href: "/admin/programmes" },
  { prefix: "/admin/groupes", href: "/admin/inscriptions" },
];

// Action principale du bouton « Créer » selon la section courante.
const CREATE_ACTIONS = [
  { prefix: "/admin/programmes", href: "/admin/programmes/new", label: "Nouveau programme" },
  { prefix: "/admin/voyages", href: "/admin/programmes/new", label: "Nouveau programme" },
  { prefix: "/admin/visa-types", href: "/admin/visa-types/new", label: "Nouveau type de visa" },
  { prefix: "/admin/visa-services", href: "/admin/visa-services/new", label: "Nouvelle demande" },
  { prefix: "/admin/actualites", href: "/admin/actualites/new", label: "Nouvelle actualité" },
  { prefix: "/admin/billets", href: "/admin/billets/new", label: "Nouvelle vente de billet" },
];
const DEFAULT_CREATE = { href: "/admin/inscriptions/new", label: "Nouvelle inscription" };

// Barre latérale repliée : préférence par navigateur (localStorage), lue via
// useSyncExternalStore (dépliée côté serveur, aucune erreur d'hydratation).
const COLLAPSE_KEY = "gf_sb_collapsed";
const collapseListeners = new Set();
let collapsedInMemory = false; // repli si le stockage est indisponible
function subscribeCollapse(listener) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}
function readCollapse() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return collapsedInMemory;
  }
}
function writeCollapse(value) {
  collapsedInMemory = value;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* stockage indisponible : l'état ne survivra pas au rechargement */
  }
  collapseListeners.forEach((l) => l());
}

function findActiveItem(items, pathname) {
  const alias = SECTION_ALIASES.find((a) => pathname.startsWith(a.prefix));
  const target = alias ? alias.href : pathname;
  let best = null;
  for (const item of items) {
    const match =
      item.href === "/admin" ? target === "/admin" : target === item.href || target.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

function initials(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminShell({ groups, user, agency, quickActions, children }) {
  const { tr, dir } = useAdminLocale();
  const pathname = usePathname();
  const router = useRouter();
  const contentRef = useRef(null);
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = findActiveItem(allItems, pathname);
  const createAction = CREATE_ACTIONS.find((a) => pathname.startsWith(a.prefix)) || DEFAULT_CREATE;
  const rtl = dir === "rtl";

  // Changement de page : ferme le tiroir mobile et la palette (remise à zéro
  // pendant le rendu, motif recommandé par React plutôt qu'un effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setPaletteOpen(false);
  }

  // … puis remonte en haut et joue le fondu d'entrée du contenu.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (el.parentElement) el.parentElement.scrollTop = 0;
    el.animate?.([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
      duration: 260,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const pageTitle = active ? tr(active.label) : tr("Espace interne");

  return (
    <div className="gf-app">
      <div className="gf-backdrop" data-open={mobileOpen} onClick={() => setMobileOpen(false)} />

      <aside className="gf-sidebar" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <div className="gf-sb-brand">
          <Link href="/admin" className="gf-logo" title={agency.name} translate="no">
            {initials(agency.name) || "GF"}
          </Link>
          <div className="gf-hide-collapsed" style={{ minWidth: 0, flex: 1 }}>
            <div className="gf-sb-title" translate="no">
              {agency.name}
            </div>
            <div className="gf-sb-sub">
              {agency.city ? (
                <>
                  <span translate="no">{agency.city}</span> · {tr("Espace interne")}
                </>
              ) : (
                tr("Espace interne")
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => writeCollapse(!collapsed)}
            title={collapsed ? tr("Déplier") : tr("Réduire")}
            className="gf-sb-iconbtn gf-collapse-btn"
          >
            <Icon name={collapsed !== rtl ? "left_panel_open" : "left_panel_close"} size={18} />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            title={tr("Fermer")}
            className="gf-sb-iconbtn gf-menu-btn"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ padding: "0 12px 10px" }}>
          <button type="button" onClick={() => setPaletteOpen(true)} className="gf-sb-search" title={tr("Rechercher, agir…")}>
            <Icon name="search" size={18} />
            <span className="gf-hide-collapsed" style={{ flex: 1, whiteSpace: "nowrap" }}>
              {tr("Rechercher, agir…")}
            </span>
            <span className="gf-kbd gf-hide-collapsed gf-hide-mobile" translate="no">
              Ctrl K
            </span>
          </button>
        </div>

        <nav className="gf-sb-nav">
          {groups.map((group) => (
            <div key={group.label} className="gf-sb-group">
              <div className="gf-sb-group-label gf-hide-collapsed">{tr(group.label)}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={tr(item.label)}
                  data-active={active?.href === item.href}
                  className="gf-sb-link"
                >
                  <Icon name={item.icon} size={20} />
                  <span className="gf-label gf-hide-collapsed">{tr(item.label)}</span>
                  {item.badge ? <span className="gf-sb-badge gf-hide-collapsed">{item.badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="gf-sb-footer">
          <div className="gf-sb-user">
            <div className="gf-avatar-sb" translate="no" title={user.fullName}>
              {initials(user.fullName)}
            </div>
            <div className="gf-hide-collapsed" style={{ flex: 1, minWidth: 0 }}>
              <div
                translate="no"
                style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {user.fullName}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--sb-muted)", textTransform: "capitalize" }}>{tr(user.role)}</div>
            </div>
            <AdminLanguageSwitcher variant="sidebar" className="gf-hide-collapsed" />
            <button type="button" onClick={handleLogout} title={tr("Déconnexion")} className="gf-sb-logout gf-hide-collapsed">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="gf-main">
        <header className="gf-header">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            title={tr("Menu")}
            className="gf-btn-square gf-menu-btn"
          >
            <Icon name="menu" size={19} />
          </button>
          <div className="gf-crumbs">
            <Link href="/admin" className="gf-hide-mobile">
              {tr("Espace interne")}
            </Link>
            <Icon name={rtl ? "chevron_left" : "chevron_right"} size={16} className="gf-hide-mobile" style={{ color: "var(--gf-faint)" }} />
            {active && active.href !== pathname ? (
              <Link href={active.href} className="gf-crumb-current">
                {pageTitle}
              </Link>
            ) : (
              <span className="gf-crumb-current">{pageTitle}</span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setPaletteOpen(true)} className="gf-btn-soft gf-hide-mobile">
            <Icon name="search" size={18} />
            {tr("Rechercher")}
            <span className="gf-kbd" style={{ borderColor: "color-mix(in oklch, var(--gf-accent) 25%, transparent)" }} translate="no">
              Ctrl K
            </span>
          </button>
          <NotificationBell />
          <Link href={createAction.href} className="gf-btn-dark" title={tr(createAction.label)}>
            <Icon name="add" size={18} />
            {tr("Créer")}
          </Link>
        </header>

        <div className="gf-scroll">
          <div ref={contentRef} className="gf-content">
            {children}
          </div>
        </div>
      </main>

      {paletteOpen && (
        <CommandPalette
          items={allItems}
          quickActions={quickActions}
          onClose={() => setPaletteOpen(false)}
          onRun={(href) => {
            setPaletteOpen(false);
            router.push(href);
          }}
        />
      )}
    </div>
  );
}

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function CommandPalette({ items, quickActions, onClose, onRun }) {
  const { tr } = useAdminLocale();
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const entries = useMemo(() => {
    const actions = quickActions.map((a) => ({ ...a, sourceLabel: a.label, group: "Actions", hint: tr(a.hint || "Action"), label: tr(a.label) }));
    const pages = items.map((i) => ({ ...i, sourceLabel: i.label, group: "Pages", hint: tr("Aller à"), label: tr(i.label) }));
    const all = [...actions, ...pages];
    const query = normalize(q.trim());
    if (!query) return all;
    // Recherche sur le libellé affiché ET sur le libellé français d'origine.
    return all.filter((e) => normalize(e.label).includes(query) || normalize(e.sourceLabel).includes(query));
  }, [items, quickActions, q, tr]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const run = useCallback((entry) => entry && onRun(entry.href), [onRun]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(entries[sel]);
    }
  };

  let lastGroup = null;

  return (
    <div className="gf-palette-overlay" onClick={onClose}>
      <div className="gf-palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="gf-palette-input">
          <Icon name="search" size={20} fill style={{ color: "var(--gf-accent)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder={tr("Rechercher une page ou une action…")}
          />
          <span className="gf-kbd" style={{ borderColor: "var(--gf-border-input)", color: "var(--gf-subtle)" }}>
            {tr("Échap")}
          </span>
        </div>
        <div className="gf-palette-list">
          {entries.map((entry, idx) => {
            const header =
              entry.group !== lastGroup ? (
                <div key={`h-${entry.group}`} className="gf-palette-group">
                  {tr(entry.group)}
                </div>
              ) : null;
            lastGroup = entry.group;
            return (
              <div key={`${entry.group}-${entry.href}-${entry.label}`}>
                {header}
                <button
                  type="button"
                  className="gf-palette-item"
                  data-selected={idx === sel}
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => run(entry)}
                >
                  <Icon name={entry.icon} size={19} />
                  <span style={{ flex: 1 }}>{entry.label}</span>
                  <span className="gf-palette-hint">{entry.hint}</span>
                </button>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13.5, color: "var(--gf-subtle)" }}>
              {tr("Aucun résultat")}
            </div>
          )}
        </div>
        <div className="gf-palette-foot">
          <span>↑↓ {tr("naviguer")}</span>
          <span>↵ {tr("ouvrir")}</span>
        </div>
      </div>
    </div>
  );
}
