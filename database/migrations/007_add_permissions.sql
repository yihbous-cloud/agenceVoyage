-- =====================================================================
-- MIGRATION 007 — Permissions dynamiques par rôle
-- =====================================================================
-- Jusqu'ici, chaque route admin codait en dur la liste des rôles
-- autorisés (`requireRole(session, ["direction", "ventes"])`). Remplacé
-- par un système de permissions éditable depuis /admin/parametres/roles :
-- catalogue de permissions (`permissions`) + association rôle <-> permission
-- (`role_permissions`, la table `roles` existait déjà). Le contenu de
-- `role_permissions` ci-dessous reproduit EXACTEMENT le comportement qui
-- existait avant cette migration (aucun changement de droits en soi,
-- seulement en rend le contrôle éditable).
--
-- ⚠️ Le rôle `direction` garde un accès complet garanti au niveau code
-- (lib/permissions.js), indépendamment du contenu de cette table — filet
-- de sécurité pour ne jamais se retrouver bloqué hors du système en cas
-- de mauvaise manipulation des permissions.
--
-- Certaines restrictions plus fines que "accès à la route" (ex. le rôle
-- comptabilité ne peut modifier QUE le montant dû sur une inscription,
-- pas son statut) restent codées en dur dans les routes concernées : ce
-- sont des règles métier sur des champs précis, pas des permissions au
-- niveau d'une action/ressource — voir CLAUDE.md.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE permissions (
    code VARCHAR(60) PRIMARY KEY,
    label VARCHAR(150) NOT NULL,
    category VARCHAR(60) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permissions (
    role_id TINYINT UNSIGNED NOT NULL,
    permission_code VARCHAR(60) NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('inscriptions.create', 'Créer une inscription', 'Inscriptions & voyageurs', 10),
    ('inscriptions.edit', 'Modifier une inscription (statut, notes...)', 'Inscriptions & voyageurs', 20),
    ('inscriptions.delete', 'Supprimer une inscription', 'Inscriptions & voyageurs', 30),
    ('inscriptions.edit_voyageur', 'Corriger les informations du voyageur (nom, passeport...)', 'Inscriptions & voyageurs', 40),
    ('inscriptions.visa', 'Gérer le visa d''un inscrit', 'Inscriptions & voyageurs', 50),
    ('inscriptions.services', 'Gérer les services facturés d''un inscrit', 'Inscriptions & voyageurs', 60),
    ('paiements.manage', 'Enregistrer / supprimer un paiement', 'Paiements & finances', 10),
    ('finances.view', 'Consulter les rapports financiers', 'Paiements & finances', 20),
    ('hebergement.manage', 'Affecter hôtels/chambres sur un voyage', 'Hébergement', 10),
    ('hotels.manage', 'Gérer le catalogue d''hôtels', 'Hébergement', 20),
    ('visa_types.manage', 'Gérer le catalogue des types de visa', 'Catalogues', 10),
    ('visa_documents.manage', 'Gérer les documents de visa d''un inscrit', 'Catalogues', 20),
    ('services.manage', 'Gérer le catalogue de services', 'Catalogues', 30),
    ('compagnies.manage', 'Gérer les compagnies aériennes', 'Catalogues', 40),
    ('programmes.manage', 'Gérer les programmes et leurs FAQ', 'Programmes & voyages', 10),
    ('voyages.manage', 'Gérer les voyages (dates, prix, statut)', 'Programmes & voyages', 20),
    ('billets.manage', 'Rechercher / acheter des billets d''avion', 'Programmes & voyages', 30),
    ('actualites.manage', 'Gérer les actualités publiées', 'Contenu public', 10),
    ('messages.manage', 'Gérer les messages de contact', 'Contenu public', 20),
    ('parametres.edit', 'Modifier les informations de l''agence', 'Administration', 10),
    ('medias.upload', 'Uploader des images (logo, couvertures)', 'Administration', 20),
    ('utilisateurs.manage', 'Gérer les comptes du personnel', 'Administration', 30),
    ('roles.manage', 'Gérer les rôles et permissions', 'Administration', 40);

-- Reproduit le comportement exact d'avant migration.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r, (
    SELECT 'direction' AS role_name, code FROM permissions
) p WHERE r.name = p.role_name;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, x.code FROM roles r
JOIN (
    SELECT 'ventes' AS role_name, 'inscriptions.create' AS code UNION ALL
    SELECT 'ventes', 'inscriptions.edit' UNION ALL
    SELECT 'ventes', 'inscriptions.delete' UNION ALL
    SELECT 'ventes', 'inscriptions.edit_voyageur' UNION ALL
    SELECT 'ventes', 'inscriptions.services' UNION ALL
    SELECT 'ventes', 'billets.manage' UNION ALL
    SELECT 'ventes', 'messages.manage' UNION ALL

    SELECT 'comptabilite', 'inscriptions.edit' UNION ALL
    SELECT 'comptabilite', 'paiements.manage' UNION ALL
    SELECT 'comptabilite', 'finances.view' UNION ALL
    SELECT 'comptabilite', 'services.manage' UNION ALL

    SELECT 'suivi', 'inscriptions.edit' UNION ALL
    SELECT 'suivi', 'inscriptions.visa' UNION ALL
    SELECT 'suivi', 'visa_documents.manage' UNION ALL
    SELECT 'suivi', 'hebergement.manage' UNION ALL
    SELECT 'suivi', 'hotels.manage' UNION ALL
    SELECT 'suivi', 'visa_types.manage'
) x ON x.role_name = r.name;
