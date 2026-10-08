"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { makeTranslator } from "@/lib/i18n/translate";
import { isRtl } from "@/lib/i18n/locales";

const AdminLocaleContext = createContext({
  locale: "ar",
  dir: "rtl",
  tr: makeTranslator("ar", "admin"),
  brandName: "Golden Fantastic",
});

const TRANSLATED_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "SVG", "PATH"]);

// Les ~80 écrans de l'espace interne contiennent des textes français en dur
// (JSX, libellés, messages d'erreur renvoyés par le serveur...). Plutôt que
// de modifier chaque composant, ce traducteur remplace APRÈS affichage le
// texte exact des nœuds du DOM (et les attributs d'affichage) par sa
// traduction, d'après le dictionnaire admin (lib/i18n/translations). Tout
// texte absent du dictionnaire reste en français — jamais de texte vide.
//
// Un MutationObserver traduit aussi tout contenu ajouté ensuite (navigation,
// modales, messages d'erreur...) dans la même micro-tâche que le rendu, donc
// avant le premier affichage à l'écran. Un texte saisi par l'utilisateur
// (champs de formulaire) n'est jamais touché : seuls les nœuds de texte et
// les attributs placeholder/title/aria-label/alt sont traduits, et tout
// élément portant translate="no" est ignoré.
function startDomTranslation(tr) {
  const translatedTexts = new WeakMap(); // nœud → dernière valeur écrite par nous
  const translatedAttrs = new WeakMap(); // élément → { attribut → dernière valeur }
  const missing = (window.__i18nMissing = window.__i18nMissing || new Set());

  const isSkipped = (element) =>
    !element || SKIP_TAGS.has(element.tagName?.toUpperCase()) || element.closest?.('[translate="no"]');

  const translateString = (raw) => {
    const core = raw.trim();
    if (!core || !/\p{L}/u.test(core)) return raw;
    const translated = tr(core);
    if (translated === core) {
      // Texte latin non traduit : mémorisé pour l'audit (window.__i18nMissing).
      if (/[A-Za-zÀ-ÿ]{2,}/.test(core)) missing.add(core);
      return raw;
    }
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    return lead + translated + trail;
  };

  const translateTextNode = (node) => {
    if (isSkipped(node.parentElement)) return;
    const current = node.nodeValue;
    if (translatedTexts.get(node) === current) return;
    const next = translateString(current);
    if (next !== current) {
      node.nodeValue = next;
      translatedTexts.set(node, next);
    }
  };

  const translateElementAttrs = (element) => {
    if (isSkipped(element)) return;
    let memo = translatedAttrs.get(element);
    for (const attr of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute?.(attr);
      if (!value) continue;
      if (memo && memo[attr] === value) continue;
      const next = translateString(value);
      if (next !== value) {
        element.setAttribute(attr, next);
        if (!memo) {
          memo = {};
          translatedAttrs.set(element, memo);
        }
        memo[attr] = next;
      }
    }
    // Boutons <input type="submit|button"> : le texte est dans value.
    if (element.tagName === "INPUT" && ["submit", "button"].includes(element.type)) {
      const value = element.getAttribute("value");
      if (value) {
        const next = translateString(value);
        if (next !== value) element.setAttribute("value", next);
      }
    }
  };

  const translateSubtree = (root) => {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateElementAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateElementAttrs(node);
      node = walker.nextNode();
    }
  };

  translateSubtree(document.body);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((added) => translateSubtree(added));
      } else if (record.type === "characterData") {
        translateTextNode(record.target);
      } else if (record.type === "attributes") {
        translateElementAttrs(record.target);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES, "value"],
  });

  // alert() natif (messages d'erreur après une action) : traduit à l'envoi.
  const originalAlert = window.alert;
  window.alert = (message) => originalAlert.call(window, tr(String(message ?? "")));

  return () => {
    observer.disconnect();
    window.alert = originalAlert;
  };
}

// Provider de l'espace interne : la langue vient du cookie (lu côté serveur
// par le layout admin, qui est dynamique de toute façon — session), jamais
// d'un préfixe d'URL. Le HTML serveur est en français ; pour l'arabe/anglais
// le traducteur ci-dessus remplace les textes dès la première peinture
// (<html data-i18n-pending> masque la page jusque-là, voir le layout).
export function AdminLocaleProvider({ locale, brandName, children }) {
  const value = useMemo(
    () => ({
      locale,
      dir: isRtl(locale) ? "rtl" : "ltr",
      tr: makeTranslator(locale, "admin", { brandName }),
      brandName: brandName || "Golden Fantastic",
    }),
    [locale, brandName]
  );

  useEffect(() => {
    if (locale === "fr") {
      document.documentElement.removeAttribute("data-i18n-pending");
      return undefined;
    }
    // La traduction du DOM ne doit démarrer qu'une fois React HYDRATÉ (y
    // compris les frontières <Suspense> hydratées plus tard, ex. useSearchParams) :
    // modifier un nœud texte avant son hydratation provoque une erreur de
    // « hydration mismatch ». requestIdleCallback ne s'exécute que lorsque la
    // file de travail de React est vide ; la page reste masquée (data-i18n-pending)
    // jusque-là, avec un délai maximal de sécurité.
    let stop;
    let timer;
    let attempts = 0;
    const begin = () => {
      stop = startDomTranslation(value.tr);
      document.documentElement.removeAttribute("data-i18n-pending");
    };
    // React pose une propriété interne (__reactFiber$…) sur chaque élément
    // qu'il a hydraté : tant qu'un élément du corps en est dépourvu, une
    // frontière Suspense attend encore son hydratation. Sondage borné (3 s) :
    // au-delà, on traduit quand même plutôt que de laisser la page masquée.
    const hydrated = () => {
      const all = document.body.querySelectorAll("*");
      for (const el of all) {
        const tag = el.tagName;
        if (tag.includes("-") || el.closest("svg, script, style, noscript, nextjs-portal")) continue;
        if (el.closest("[data-nextjs-toast], [data-nextjs-dialog-overlay]")) continue;
        if (!Object.keys(el).some((k) => k.startsWith("__reactFiber$"))) return false;
      }
      return true;
    };
    const poll = () => {
      attempts += 1;
      if (hydrated() || attempts >= 60) begin();
      else timer = window.setTimeout(poll, 50);
    };
    timer = window.setTimeout(poll, 0);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [locale, value]);

  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale() {
  return useContext(AdminLocaleContext);
}
