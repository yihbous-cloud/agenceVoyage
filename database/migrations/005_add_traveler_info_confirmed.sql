-- =====================================================================
-- MIGRATION 005 — Persiste le verrouillage des infos voyageur
-- =====================================================================
-- Le formulaire "Informations du voyageur" (EditTravelerForm.jsx) se
-- verrouille (lecture seule) après enregistrement — mais cet état n'était
-- gardé qu'en mémoire côté client : recharger la page ou y revenir plus
-- tard réaffichait le formulaire en édition, contredisant "une fois
-- vérifié, reste verrouillé". Persisté en base pour survivre à la
-- navigation.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE travelers
    ADD COLUMN info_confirmed BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Fiche voyageur enregistrée/vérifiée depuis l''admin — verrouille le formulaire par défaut'
        AFTER passport_expiry_date;
