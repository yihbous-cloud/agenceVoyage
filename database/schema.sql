-- =====================================================================
-- SCHÉMA DE BASE DE DONNÉES — GOLDEN FANTASTIC (Agence de Voyages)
-- MySQL 8.0+
-- =====================================================================
-- Convention : toutes les tables en snake_case, clés primaires `id`
-- (BIGINT UNSIGNED AUTO_INCREMENT), timestamps created_at/updated_at
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. UTILISATEURS INTERNES & RÔLES (Section administrative)
-- =====================================================================

CREATE TABLE roles (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT 'direction, ventes, comptabilite, suivi',
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (name, description) VALUES
    ('direction', 'Accès complet au système'),
    ('ventes', 'Gestion des inscrits et réservations'),
    ('comptabilite', 'Gestion financière et paiements'),
    ('suivi', 'Suivi opérationnel (hôtels, visas, listes)');

CREATE TABLE staff_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id TINYINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permissions dynamiques par rôle — voir migration 007_add_permissions.sql
-- pour le détail de la logique. Le rôle `direction` garde un accès complet
-- garanti au niveau code (lib/permissions.js) quel que soit le contenu de
-- ces tables — filet de sécurité anti-verrouillage.
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
    ('paiements.manage', 'Enregistrer / supprimer un paiement', 'Paiements & finances', 10),
    ('finances.view', 'Consulter les rapports financiers', 'Paiements & finances', 20),
    ('hebergement.manage', 'Affecter hôtels/chambres sur un voyage', 'Hébergement', 10),
    ('hotels.manage', 'Gérer le catalogue d''hôtels', 'Hébergement', 20),
    ('visa_types.manage', 'Gérer le catalogue des types de visa', 'Catalogues', 10),
    ('services.manage', 'Gérer le catalogue de services', 'Catalogues', 30),
    ('visa_services.manage', 'Gérer les demandes de visa autonomes (hors voyage)', 'Visa autonome', 10),
    ('compagnies.manage', 'Gérer les compagnies aériennes', 'Catalogues', 40),
    ('programmes.manage', 'Gérer les programmes et leurs FAQ', 'Programmes & voyages', 10),
    ('voyages.manage', 'Gérer les voyages (dates, prix, statut)', 'Programmes & voyages', 20),
    ('billets.manage', 'Rechercher / acheter des billets d''avion', 'Programmes & voyages', 30),
    ('actualites.manage', 'Gérer les actualités publiées', 'Contenu public', 10),
    ('slider.manage', 'Gérer le slider de l''accueil', 'Contenu public', 15),
    ('messages.manage', 'Gérer les messages de contact', 'Contenu public', 20),
    ('parametres.edit', 'Modifier les informations de l''agence', 'Administration', 10),
    ('medias.upload', 'Uploader des images (logo, couvertures)', 'Administration', 20),
    ('utilisateurs.manage', 'Gérer les comptes du personnel', 'Administration', 30),
    ('roles.manage', 'Gérer les rôles et permissions', 'Administration', 40);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r, (SELECT 'direction' AS role_name, code FROM permissions) p
WHERE r.name = p.role_name;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, x.code FROM roles r
JOIN (
    SELECT 'ventes' AS role_name, 'inscriptions.create' AS code UNION ALL
    SELECT 'ventes', 'inscriptions.edit' UNION ALL
    SELECT 'ventes', 'inscriptions.delete' UNION ALL
    SELECT 'ventes', 'inscriptions.edit_voyageur' UNION ALL
    SELECT 'ventes', 'billets.manage' UNION ALL
    SELECT 'ventes', 'messages.manage' UNION ALL
    SELECT 'ventes', 'visa_services.manage' UNION ALL

    SELECT 'comptabilite', 'inscriptions.edit' UNION ALL
    SELECT 'comptabilite', 'paiements.manage' UNION ALL
    SELECT 'comptabilite', 'finances.view' UNION ALL
    SELECT 'comptabilite', 'services.manage' UNION ALL
    SELECT 'comptabilite', 'visa_services.manage' UNION ALL

    SELECT 'suivi', 'inscriptions.edit' UNION ALL
    SELECT 'suivi', 'hebergement.manage' UNION ALL
    SELECT 'suivi', 'hotels.manage' UNION ALL
    SELECT 'suivi', 'visa_types.manage' UNION ALL
    SELECT 'suivi', 'visa_services.manage'
) x ON x.role_name = r.name;

-- =====================================================================
-- 2. COMPAGNIES AÉRIENNES (extensible — pas de valeurs codées en dur)
-- =====================================================================

CREATE TABLE airlines (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'ex: Royal Air Maroc, Saudia, Turkish Airlines',
    iata_code VARCHAR(3) NULL COMMENT 'ex: AT, SV, TK',
    -- Nom du template d'export utilisé pour générer la liste (référence logique, mappé côté application)
    export_template_key VARCHAR(50) NOT NULL COMMENT 'ex: ram_template, saudia_template, turkish_template, generic_template',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO airlines (name, iata_code, export_template_key) VALUES
    ('Royal Air Maroc', 'AT', 'ram_template'),
    ('Saudia', 'SV', 'saudia_template'),
    ('Turkish Airlines', 'TK', 'turkish_template');

-- =====================================================================
-- 3. PROGRAMMES & VOYAGES
-- =====================================================================

-- Un "programme" est le modèle marketing (ex: "Omra Ramadan Premium")
CREATE TABLE programs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE COMMENT 'pour URL SEO-friendly',
    program_type ENUM('omra', 'hajj', 'tourisme', 'autre') NOT NULL DEFAULT 'omra',
    -- Famille de catalogue pour la navigation publique (2 hubs distincts) :
    -- indépendante de program_type (granularité différente, voir
    -- database/migrations/001_add_program_family.sql pour la décision)
    family ENUM('omra_hajj', 'voyage_organise') NOT NULL DEFAULT 'omra_hajj',
    season ENUM('mawlid', 'rajab', 'chaabane', 'ramadan', 'chawal') NULL COMMENT 'pertinent uniquement si family = omra_hajj',
    theme VARCHAR(50) NULL COMMENT 'ex: plage, culture, aventure, famille, couple — pertinent uniquement si family = voyage_organise',
    short_description VARCHAR(500) NULL,
    full_description TEXT NULL COMMENT 'contenu riche, utilisé aussi pour schema.org / GEO',
    cover_image_url VARCHAR(500) NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_program_family (family)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un "voyage" est une instance datée d'un programme (départ précis)
CREATE TABLE trips (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    reference_code VARCHAR(30) NOT NULL UNIQUE COMMENT 'ex: GF-OMR-2027-03',
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    destination_country VARCHAR(100) NOT NULL DEFAULT 'Arabie Saoudite',
    destination_city VARCHAR(100) NULL COMMENT 'Ville de destination (liste Pays->Villes, lib/worldPlaces.js) — distincte du code aéroport précis (destination_iata) (migration 020)',
    origin_iata CHAR(3) NULL COMMENT 'Code IATA aéroport de départ à l''aller, ex: CMN (recherche de vols Duffel) ; sens inversé par défaut au retour si return_origin_iata/return_destination_iata non renseignés',
    destination_iata CHAR(3) NULL COMMENT 'Code IATA aéroport d''arrivée à l''aller, ex: JED',
    outbound_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale à l''aller, NULL = vol direct (migration 017)',
    return_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale au retour, NULL = vol direct (migration 017)',
    return_origin_iata CHAR(3) NULL COMMENT 'aéroport de départ au retour, NULL = même aéroport que l''arrivée à l''aller (sens inversé) (migration 018)',
    return_destination_iata CHAR(3) NULL COMMENT 'aéroport d''arrivée au retour, NULL = même aéroport que le départ à l''aller (sens inversé) (migration 018)',
    airline_id SMALLINT UNSIGNED NULL,
    pnr VARCHAR(10) NULL COMMENT 'PNR de la réservation groupe auprès de la compagnie (migration 030)',
    total_seats INT UNSIGNED NOT NULL DEFAULT 0,
    price_per_person DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'DEPRECIEE (migration 019) — remplacé par 4 prix par type de chambre (price_double/triple/quadruple/quintuple), le plus bas (quintuple) étant le prix affiché au public. Conservée pour l''historique, plus alimentée.',
    price_double DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre double/binôme (migration 019)',
    price_triple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre triple (migration 019)',
    price_quadruple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre quadruple (migration 019)',
    price_quintuple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre quintuple — le plus bas, prix affiché au public (migration 019)',
    flight_ticket_price DECIMAL(10,2) NULL COMMENT 'DEPRECIEE (migration 018) — prix désormais inclus dans price_per_person, conservée pour l''historique mais plus alimentée',
    currency CHAR(3) NOT NULL DEFAULT 'MAD',
    status ENUM('planifie', 'ouvert', 'complet', 'en_cours', 'termine', 'annule') NOT NULL DEFAULT 'planifie',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id),
    FOREIGN KEY (airline_id) REFERENCES airlines(id),
    INDEX idx_trip_dates (departure_date, return_date),
    INDEX idx_trip_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FAQ par programme (vide par défaut, alimentée depuis l'admin) — sert le
-- SEO/GEO (FAQPage JSON-LD, réponses directes citables par les IA)
CREATE TABLE program_faqs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    question VARCHAR(300) NOT NULL,
    answer TEXT NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    INDEX idx_program_faq_program (program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Offres de restauration par voyage (liste répétable, même pattern que
-- program_faqs ci-dessus) — affichées sur la fiche publique du programme
-- quand publiées (migration 020, voir CLAUDE.md)
CREATE TABLE trip_meal_offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 4. HÔTELS & CHAMBRES
-- =====================================================================

CREATE TABLE hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    name_arabic VARCHAR(150) NULL COMMENT 'nom en arabe, affiché à la place de name quand la langue est l''arabe (migration 034)',
    city VARCHAR(100) NOT NULL COMMENT 'ex: La Mecque, Médine, Istanbul, Paris',
    landmark_name VARCHAR(100) NULL COMMENT 'point de repère de proximité (ex: Haram, Masjid Nabawi, Tour Eiffel)',
    country VARCHAR(100) NOT NULL DEFAULT 'Arabie Saoudite',
    star_rating VARCHAR(10) NULL COMMENT 'ex: 3, 4, 4+, 5+ (texte libre depuis migration 023)',
    board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul' COMMENT 'Formule de restauration proposée par l''hôtel (migration 022)',
    landmark_distance_m INT UNSIGNED NULL COMMENT 'distance en mètres jusqu''à landmark_name',
    contact_info VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reserved_rooms_simple INT UNSIGNED NULL COMMENT 'Quota de chambres réservées pour l''agence par type, planification (migration 022) — distinct des chambres réelles de rooms ; NULL = ce type n''existe pas dans cet hôtel, 0 = existe mais aucune réservée (migration 023)',
    reserved_rooms_double INT UNSIGNED NULL,
    reserved_rooms_triple INT UNSIGNED NULL,
    reserved_rooms_quadruple INT UNSIGNED NULL,
    reserved_rooms_quintuple INT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hôtels par défaut d'un programme : fixés une fois à la création du
-- programme, auto-attachés (via trip_hotels) à chaque nouveau voyage créé
-- sous ce programme.
CREATE TABLE program_hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    UNIQUE KEY uq_program_hotel (program_id, hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Association hôtel <-> voyage (un voyage peut avoir plusieurs hôtels : Mecque + Médine)
CREATE TABLE trip_hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    UNIQUE KEY uq_trip_hotel_dates (trip_id, hotel_id, check_in_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rooms (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_hotel_id BIGINT UNSIGNED NOT NULL,
    room_number VARCHAR(20) NULL,
    room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NOT NULL,
    capacity TINYINT UNSIGNED NOT NULL COMMENT 'nombre de lits/places',
    FOREIGN KEY (trip_hotel_id) REFERENCES trip_hotels(id) ON DELETE CASCADE,
    INDEX idx_room_type (room_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tarifs par palier d'hébergement (tiers), voyages Omra/Hajj uniquement
-- (migration 021) — un tier associe un hôtel Mecque + un hôtel Médine précis
-- (FK libres, sans contrainte de ville) et une formule de restauration par
-- ville. Additif : un voyage sans tier configuré continue de fonctionner
-- avec price_double/triple/quadruple/quintuple sur trips. Voir CLAUDE.md.
CREATE TABLE trip_hotel_tiers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(100) NOT NULL COMMENT 'ex: Économique, Standard, VIP',
    makkah_hotel_id BIGINT UNSIGNED NOT NULL,
    makkah_board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul',
    madinah_hotel_id BIGINT UNSIGNED NOT NULL,
    madinah_board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (makkah_hotel_id) REFERENCES hotels(id),
    FOREIGN KEY (madinah_hotel_id) REFERENCES hotels(id),
    INDEX idx_tier_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Prix par personne + limite de places (NULL = illimité) par type de
-- chambre, pour un tier ci-dessus.
CREATE TABLE trip_hotel_tier_prices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tier_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL,
    room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NOT NULL,
    price_per_person DECIMAL(10,2) NOT NULL,
    seats_limit INT UNSIGNED NULL COMMENT 'NULL = illimité',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tier_id) REFERENCES trip_hotel_tiers(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tier_room_type (tier_id, room_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 5. VOYAGEURS & INSCRIPTIONS
-- =====================================================================

CREATE TABLE travelers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    full_name_arabic VARCHAR(150) NULL COMMENT 'nom en arabe, requis pour visa/liste compagnie',
    gender ENUM('homme', 'femme') NOT NULL,
    date_of_birth DATE NULL,
    national_id VARCHAR(30) NULL COMMENT 'CIN',
    passport_number VARCHAR(30) NULL,
    passport_issue_date DATE NULL COMMENT 'Date de délivrance du passeport (migration 029)',
    passport_expiry_date DATE NULL,
    info_confirmed BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Fiche voyageur enregistrée/vérifiée depuis l''admin — verrouille le formulaire par défaut',
    phone_whatsapp VARCHAR(30) NOT NULL COMMENT 'numéro WhatsApp — canal principal de communication',
    phone VARCHAR(30) NULL COMMENT 'N° téléphone général, distinct du WhatsApp (migration 026)',
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_traveler_phone (phone_whatsapp),
    INDEX idx_traveler_passport (passport_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Numéros de téléphone supplémentaires par voyageur (ex. contact d'urgence),
-- en plus de phone/phone_whatsapp — migration 026.
CREATE TABLE traveler_phone_numbers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    traveler_id BIGINT UNSIGNED NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un groupe lie plusieurs inscriptions du même voyage (binôme/couple, famille,
-- groupe d'amis) sans fusionner leurs dossiers individuels (documents,
-- passeport, visa restent par voyageur). allow_mixed_gender_room : coché
-- uniquement pour un couple/famille — seule exception à la non-mixité des
-- chambres, et seulement entre membres de CE groupe (voir migration 011).
-- total_due : montant dû partagé par TOUT le groupe (pas un montant par
-- membre) — le suivi financier (montant dû + versements) d'un binôme/
-- groupe se fait au niveau du groupe, voir migration 012 et CLAUDE.md.
CREATE TABLE registration_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(150) NOT NULL COMMENT 'ex. "Famille Alaoui", "M. et Mme Idrissi"',
    -- Responsable/point de contact du groupe (migration 027) — le premier
    -- membre inscrit le devient automatiquement (lib/registrationGroups.js
    -- ::ensureGroupResponsible), modifiable ensuite depuis la page du
    -- groupe. Référence en avant vers `registrations`, définie plus bas :
    -- valide car FOREIGN_KEY_CHECKS=0 pour tout ce fichier (voir plus haut).
    responsible_registration_id BIGINT UNSIGNED NULL COMMENT 'Voyageur responsable/point de contact du groupe (migration 027)',
    allow_mixed_gender_room BOOLEAN NOT NULL DEFAULT FALSE,
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    FOREIGN KEY (responsible_registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
    INDEX idx_reg_group_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L'inscription est l'entité centrale : un voyageur inscrit à un voyage précis
CREATE TABLE registrations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    traveler_id BIGINT UNSIGNED NOT NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL COMMENT 'employé ayant saisi l’inscription',
    status ENUM('inscrit', 'confirme', 'paye_partiel', 'paye_complet', 'annule') NOT NULL DEFAULT 'inscrit',
    room_id BIGINT UNSIGNED NULL COMMENT 'DEPRECIEE (migration 025) — remplacée par registration_room_assignments (une chambre par ville, un voyage multi-villes peut en avoir plusieurs), conservée pour l’historique mais plus alimentée',
    preferred_hotel_id BIGINT UNSIGNED NULL COMMENT 'DEPRECIEE (migration 010) — remplacée par registration_hotel_preferences (une préférence par ville, migration 015), conservée pour l’historique mais plus alimentée',
    preferred_room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NULL COMMENT 'type de chambre souhaité par le voyageur',
    selected_tier_id BIGINT UNSIGNED NULL COMMENT 'Tarif d''hébergement choisi (trip_hotel_tiers), NULL = prix plat du voyage (migration 021)',
    group_id BIGINT UNSIGNED NULL COMMENT 'groupe d’inscription (binôme/famille/groupe), voir registration_groups',
    visa_status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'montant total dû pour cette inscription',
    registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (preferred_hotel_id) REFERENCES hotels(id),
    FOREIGN KEY (selected_tier_id) REFERENCES trip_hotel_tiers(id),
    FOREIGN KEY (group_id) REFERENCES registration_groups(id),
    UNIQUE KEY uq_traveler_per_trip (trip_id, traveler_id),
    INDEX idx_reg_status (status),
    INDEX idx_reg_visa_status (visa_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Préférence hôtel par ville (migration 015) : un voyageur Omra passe par
-- plusieurs villes (Mecque + Médine), une seule préférence par inscription
-- ne suffisait pas. Une ligne par ville souhaitée, jamais deux hôtels pour
-- la même ville (uq_registration_city).
CREATE TABLE registration_hotel_preferences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    city VARCHAR(100) NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    UNIQUE KEY uq_registration_city (registration_id, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chambre réellement affectée, par ville (migration 025) : remplace
-- registrations.room_id (colonne scalaire unique, ne pouvait porter qu'une
-- seule chambre pour tout le voyage — bloquait l'affectation d'une
-- deuxième ville, voir CLAUDE.md). Même forme que
-- registration_hotel_preferences (une ligne par ville, jamais deux
-- chambres pour la même ville).
CREATE TABLE registration_room_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    city VARCHAR(100) NOT NULL,
    room_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    UNIQUE KEY uq_registration_city (registration_id, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 6. PAIEMENTS & SUIVI FINANCIER
-- =====================================================================

CREATE TABLE services (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ex: Billet avion, Hébergement, Visa, Transport local, Assurance',
    default_price DECIMAL(10,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ⚠️ Non utilisée depuis la migration 013 : le prix des services est
-- désormais inclus dans le prix global du programme (trips.price_per_person),
-- plus facturé séparément par inscription. Table conservée (vide) pour ne
-- pas casser une éventuelle réutilisation future, mais plus alimentée par
-- l'admin — voir CLAUDE.md.
CREATE TABLE registration_services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    service_id SMALLINT UNSIGNED NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un paiement cible SOIT une inscription individuelle (registration_id),
-- SOIT un groupe (group_id), SOIT une demande de visa autonome
-- (visa_service_id, migration 013) — jamais deux à la fois, jamais aucun
-- des trois (CHECK). Les inscriptions faisant partie d'un groupe n'ont
-- plus de paiement individuel : le suivi se fait via group_id (migration 012).
CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NULL,
    group_id BIGINT UNSIGNED NULL,
    visa_service_id BIGINT UNSIGNED NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'MAD',
    payment_method ENUM('especes', 'virement', 'cheque', 'carte', 'autre') NOT NULL DEFAULT 'especes',
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by_staff_id BIGINT UNSIGNED NULL,
    receipt_reference VARCHAR(50) NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (group_id) REFERENCES registration_groups(id),
    FOREIGN KEY (visa_service_id) REFERENCES visa_service_requests(id),
    FOREIGN KEY (recorded_by_staff_id) REFERENCES staff_users(id),
    INDEX idx_payment_date (payment_date),
    CONSTRAINT chk_payment_target CHECK (
        (registration_id IS NOT NULL AND group_id IS NULL AND visa_service_id IS NULL) OR
        (registration_id IS NULL AND group_id IS NOT NULL AND visa_service_id IS NULL) OR
        (registration_id IS NULL AND group_id IS NULL AND visa_service_id IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Paramètres de l'agence (ligne unique id=1) — en-tête des reçus de
-- paiement imprimables (format A5), voir migration 003.
CREATE TABLE agency_settings (
    id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
    name VARCHAR(150) NOT NULL DEFAULT 'Golden Fantastic',
    logo_url VARCHAR(255) NULL COMMENT 'chemin public (/uploads/agency/...)',
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    whatsapp VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    website VARCHAR(150) NULL,
    rc VARCHAR(50) NULL,
    tax_id VARCHAR(50) NULL,
    ice VARCHAR(50) NULL,
    footer_note VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_agency_settings_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 7. TYPES DE VISA, DOCUMENTS & DEMANDES
-- =====================================================================

-- Catalogue des types de visa : réutilisable globalement (program_id NULL)
-- ou spécifique à un programme précis (program_id renseigné)
CREATE TABLE visa_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL COMMENT 'ex: Visa Omra Arabie Saoudite, Visa touristique Turquie',
    country VARCHAR(100) NULL,
    program_id BIGINT UNSIGNED NULL COMMENT 'NULL = réutilisable pour tous les programmes ; sinon spécifique à ce programme',
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    description VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    INDEX idx_visa_type_program (program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Documents requis pour un type de visa (catalogue, indépendant du voyageur)
CREATE TABLE visa_type_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visa_type_id BIGINT UNSIGNED NOT NULL,
    document_name VARCHAR(150) NOT NULL COMMENT 'ex: Copie passeport, Photo identité, Certificat médical',
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (visa_type_id) REFERENCES visa_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE visa_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL UNIQUE,
    visa_type_id BIGINT UNSIGNED NULL COMMENT 'Type de visa demandé (détermine les documents requis et le prix)',
    submitted_date DATE NULL,
    consulate_or_authority VARCHAR(150) NULL COMMENT 'organisme concerné',
    status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    visa_number VARCHAR(50) NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (visa_type_id) REFERENCES visa_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suivi document par document, par voyageur (checklist "fourni / manquant")
-- ⚠️ visa_requests/visa_request_documents : non utilisées depuis la
-- migration 013 (visa désormais inclus dans le prix du programme, plus
-- géré par inscription) — tables conservées vides, remplacées par
-- visa_service_requests ci-dessous pour le service visa autonome.
CREATE TABLE visa_request_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visa_request_id BIGINT UNSIGNED NOT NULL,
    visa_type_document_id BIGINT UNSIGNED NOT NULL,
    status ENUM('manquant', 'fourni') NOT NULL DEFAULT 'manquant',
    provided_at DATETIME NULL,
    FOREIGN KEY (visa_request_id) REFERENCES visa_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (visa_type_document_id) REFERENCES visa_type_documents(id) ON DELETE CASCADE,
    UNIQUE KEY uq_request_document (visa_request_id, visa_type_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Service visa autonome (migration 013) : un client peut demander une
-- aide visa indépendamment de tout voyage réservé chez l'agence — suivi
-- financier propre (total_due, payments.visa_service_id).
CREATE TABLE visa_service_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    traveler_id BIGINT UNSIGNED NOT NULL,
    visa_type_id BIGINT UNSIGNED NOT NULL COMMENT 'détermine la destination, le prix et les documents requis',
    status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    submitted_date DATE NULL,
    consulate_or_authority VARCHAR(150) NULL,
    visa_number VARCHAR(50) NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    notes VARCHAR(255) NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    FOREIGN KEY (visa_type_id) REFERENCES visa_types(id),
    FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id),
    INDEX idx_visa_service_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE visa_service_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visa_service_request_id BIGINT UNSIGNED NOT NULL,
    visa_type_document_id BIGINT UNSIGNED NOT NULL,
    status ENUM('manquant', 'fourni') NOT NULL DEFAULT 'manquant',
    provided_at DATETIME NULL,
    FOREIGN KEY (visa_service_request_id) REFERENCES visa_service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (visa_type_document_id) REFERENCES visa_type_documents(id) ON DELETE CASCADE,
    UNIQUE KEY uq_service_document (visa_service_request_id, visa_type_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 8. COMMUNICATION WHATSAPP (Q&A prédéfinies + historique)
-- =====================================================================

-- Base de questions/réponses prédéfinies utilisée par le bot WhatsApp (via n8n)
CREATE TABLE whatsapp_qa_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trigger_keywords VARCHAR(255) NOT NULL COMMENT 'mots-clés séparés par virgule pour matcher la question',
    question_label VARCHAR(200) NOT NULL,
    answer_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rappels programmés (documents manquants, échéances de paiement, RDV)
CREATE TABLE whatsapp_reminders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    reminder_type ENUM('document_manquant', 'echeance_paiement', 'rdv', 'depart_imminent', 'autre') NOT NULL,
    scheduled_at DATETIME NOT NULL,
    sent_at DATETIME NULL,
    status ENUM('planifie', 'envoye', 'echoue') NOT NULL DEFAULT 'planifie',
    message_content TEXT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    INDEX idx_reminder_schedule (scheduled_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique brut des échanges WhatsApp (log)
CREATE TABLE whatsapp_messages_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    traveler_id BIGINT UNSIGNED NULL,
    direction ENUM('entrant', 'sortant') NOT NULL,
    message_text TEXT NOT NULL,
    matched_qa_id INT UNSIGNED NULL COMMENT 'NULL si escaladé vers un humain',
    escalated_to_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    FOREIGN KEY (matched_qa_id) REFERENCES whatsapp_qa_templates(id),
    FOREIGN KEY (escalated_to_staff_id) REFERENCES staff_users(id),
    INDEX idx_log_traveler (traveler_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 9. SITE PUBLIC (actualités & messages de contact)
-- =====================================================================

-- Annonces / nouveaux programmes publiés sur le site (CLAUDE.md 4a)
CREATE TABLE news_posts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    excerpt VARCHAR(500) NULL,
    content TEXT NULL,
    cover_image_url VARCHAR(500) NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at DATETIME NULL,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_news_published (is_published, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Diapositives du slider animé de l'accueil (/admin/slider). Une diapositive
-- liée à un programme (program_id) dérive son lien public dynamiquement
-- (jamais figé) ; button_link n'est utilisé que pour un lien libre.
CREATE TABLE slides (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(300) NULL,
    image_url VARCHAR(500) NULL,
    mobile_image_url VARCHAR(500) NULL COMMENT 'Image de fond pour l''affichage mobile — NULL = repli sur image_url (migration 024)',
    button_text VARCHAR(50) NOT NULL DEFAULT 'Découvrir',
    program_id BIGINT UNSIGNED NULL COMMENT 'lien dynamique vers un programme — prioritaire sur button_link',
    button_link VARCHAR(300) NULL COMMENT 'URL libre, utilisée seulement si program_id est NULL',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
    INDEX idx_slide_active_order (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages soumis via le formulaire de contact public
CREATE TABLE contact_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NULL,
    subject VARCHAR(200) NULL,
    message TEXT NOT NULL,
    status ENUM('nouveau', 'traite') NOT NULL DEFAULT 'nouveau',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contact_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 10. RÉSERVATIONS DE BILLETS D'AVION (intégration Duffel)
-- =====================================================================

-- Une réservation Duffel : soit individuelle (1 voyageur), soit groupée
-- (plusieurs voyageurs du même voyage sur la même offre/commande).
CREATE TABLE flight_bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    scope ENUM('individuel', 'groupe') NOT NULL,
    duffel_offer_id VARCHAR(64) NOT NULL,
    duffel_order_id VARCHAR(64) NULL COMMENT 'renseigné une fois la commande créée chez Duffel',
    booking_reference VARCHAR(50) NULL COMMENT 'PNR compagnie renvoyé par Duffel',
    total_amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status ENUM('en_attente', 'confirme', 'echec', 'annule') NOT NULL DEFAULT 'en_attente',
    duffel_mode ENUM('test', 'live') NOT NULL DEFAULT 'test' COMMENT 'préfixe de la clé API utilisée, pour ne jamais confondre un essai avec un achat réel',
    created_by_staff_id BIGINT UNSIGNED NULL,
    error_message VARCHAR(500) NULL,
    raw_offer JSON NULL,
    raw_order JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id),
    INDEX idx_flight_booking_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lien entre une réservation Duffel et chaque voyageur/inscription couvert
-- (une réservation groupée couvre plusieurs lignes ici).
CREATE TABLE flight_booking_passengers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    flight_booking_id BIGINT UNSIGNED NOT NULL,
    registration_id BIGINT UNSIGNED NOT NULL,
    duffel_passenger_id VARCHAR(64) NULL,
    ticket_number VARCHAR(50) NULL,
    FOREIGN KEY (flight_booking_id) REFERENCES flight_bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    UNIQUE KEY uq_booking_registration (flight_booking_id, registration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 11. VUES UTILES (pour les listes intelligentes)
-- =====================================================================

-- Vue : liste complète des voyageurs par voyage (base pour export)
-- Une ligne par (inscription, ville affectée) depuis la migration 025 (un
-- voyageur bi-ville, ex. Mecque + Médine, apparaît donc sur 2 lignes) —
-- les montants financiers sont pré-agrégés dans une sous-requête AVANT la
-- jointure sur registration_room_assignments pour éviter un double-comptage
-- par fan-out (deux relations 1-N — paiements et chambres — combinées sous
-- un même GROUP BY aurait multiplié total_paid par le nombre de villes).
CREATE OR REPLACE VIEW v_trip_traveler_list AS
SELECT
    t.id                    AS trip_id,
    t.reference_code,
    p.title                 AS program_title,
    tr.id                   AS traveler_id,
    tr.full_name,
    tr.full_name_arabic,
    tr.gender,
    tr.date_of_birth,
    tr.passport_number,
    tr.passport_expiry_date,
    tr.phone_whatsapp,
    h.name                  AS hotel_name,
    h.city                  AS hotel_city,
    r.room_number,
    r.room_type,
    reg.status              AS registration_status,
    reg.visa_status,
    reg.total_due,
    COALESCE(pay.total_paid, 0) AS total_paid,
    reg.total_due - COALESCE(pay.total_paid, 0) AS balance_due
FROM registrations reg
JOIN trips t            ON t.id = reg.trip_id
JOIN programs p          ON p.id = t.program_id
JOIN travelers tr        ON tr.id = reg.traveler_id
LEFT JOIN registration_room_assignments rra ON rra.registration_id = reg.id
LEFT JOIN rooms r        ON r.id = rra.room_id
LEFT JOIN trip_hotels th ON th.id = r.trip_hotel_id
LEFT JOIN hotels h       ON h.id = th.hotel_id
LEFT JOIN (
    SELECT registration_id, SUM(amount) AS total_paid
    FROM payments
    GROUP BY registration_id
) pay ON pay.registration_id = reg.id;

-- Vue : liste dédiée aux compagnies aériennes (champs génériques, à filtrer/formater par template applicatif selon airline_id)
CREATE OR REPLACE VIEW v_trip_airline_list AS
SELECT
    t.id                AS trip_id,
    t.reference_code,
    a.name              AS airline_name,
    a.export_template_key,
    tr.full_name,
    tr.full_name_arabic,
    tr.gender,
    tr.date_of_birth,
    tr.passport_number,
    tr.passport_expiry_date,
    t.departure_date,
    t.return_date
FROM registrations reg
JOIN trips t     ON t.id = reg.trip_id
JOIN travelers tr ON tr.id = reg.traveler_id
LEFT JOIN airlines a ON a.id = t.airline_id
WHERE reg.status IN ('confirme', 'paye_partiel', 'paye_complet');

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 9. MULTI-AGENCES (migration 016 — fondations, passe 1/2)
-- Voir CLAUDE.md §3sexvicies. Reproduit ici le contenu de
-- database/migrations/016_add_multi_agency.sql pour qu une installation
-- neuve depuis ce fichier aboutisse au meme etat final.
-- =====================================================================

-- Multi-agences (fondations, passe 1/2 — voir CLAUDE.md §3sexvicies) :
-- une même base/déploiement héberge plusieurs agences indépendantes, chacune
-- résolue par sous-domaine. Cette migration pose la table `agencies` et une
-- colonne `agency_id` sur toutes les tables métier ; le FILTRAGE des requêtes
-- par agence (lib/*.js) et le retrait de DEFAULT 1 sont la passe suivante.
--
-- ⚠️ `agency_id ... DEFAULT 1` est conservé volontairement : tant que les
-- INSERT existants (createProgram, createRegistration...) ne fournissent pas
-- eux-mêmes agency_id, retirer le DEFAULT casserait toute l'application
-- ("Field 'agency_id' doesn't have a default value"). À retirer quand
-- chaque INSERT sera retrofité.

CREATE TABLE agencies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    subdomain VARCHAR(63) NOT NULL UNIQUE COMMENT 'ex: goldenfantastic — résolu depuis le sous-domaine de la requête',
    logo_url VARCHAR(255) NULL COMMENT 'chemin public (/uploads/agency/...)',
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    whatsapp VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    website VARCHAR(150) NULL,
    rc VARCHAR(50) NULL,
    tax_id VARCHAR(50) NULL,
    ice VARCHAR(50) NULL,
    footer_note VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L'agence historique (Golden Fantastic) reprend le contenu de la ligne
-- unique de agency_settings (conservée, mais plus lue par le code).
INSERT INTO agencies (id, name, subdomain, logo_url, address, city, phone, whatsapp, email,
                      website, rc, tax_id, ice, footer_note)
SELECT 1, name, 'goldenfantastic', logo_url, address, city, phone, whatsapp, email,
       website, rc, tax_id, ice, footer_note
FROM agency_settings WHERE id = 1;

INSERT IGNORE INTO agencies (id, name, subdomain) VALUES (1, 'Golden Fantastic', 'goldenfantastic');

-- --- agency_id sur les tables métier -------------------------------------

ALTER TABLE programs ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_programs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE trips ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_trips_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE program_faqs ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_program_faqs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE hotels ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_hotels_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE program_hotels ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_program_hotels_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE trip_hotels ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_trip_hotels_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE rooms ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_rooms_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE travelers ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_travelers_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE registration_groups ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_registration_groups_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE registrations ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_registrations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE registration_hotel_preferences ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_registration_hotel_preferences_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE payments ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_payments_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE visa_types ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_visa_types_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE visa_type_documents ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_visa_type_documents_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE visa_service_requests ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_visa_service_requests_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE visa_service_documents ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_visa_service_documents_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE airlines ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_airlines_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE staff_users ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_staff_users_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE roles ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_roles_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE slides ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_slides_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE news_posts ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_news_posts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE contact_messages ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_contact_messages_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE whatsapp_qa_templates ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_whatsapp_qa_templates_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE whatsapp_reminders ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_whatsapp_reminders_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE whatsapp_messages_log ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_whatsapp_messages_log_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE flight_bookings ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_flight_bookings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE flight_booking_passengers ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_flight_booking_passengers_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
-- Migration 031 : le catalogue de services devient propre à chaque agence.
ALTER TABLE services ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_services_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);

-- Le DEFAULT 1 ci-dessus ne sert qu'aux lignes déjà semées plus haut
-- (rôles, compagnies...) : il est retiré aussitôt, comme en migration 033 —
-- un INSERT qui oublie l'agence doit échouer, pas tomber sur l'agence 1.
ALTER TABLE programs ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trips ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE program_faqs ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE program_hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trip_hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE rooms ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE travelers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registration_groups ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registrations ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registration_hotel_preferences ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_types ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_type_documents ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_service_requests ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_service_documents ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE airlines ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE staff_users ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE roles ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE slides ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE news_posts ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE contact_messages ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_qa_templates ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_reminders ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_messages_log ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE flight_bookings ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE flight_booking_passengers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE services ALTER COLUMN agency_id DROP DEFAULT;

-- --- Rôles : id élargi (4 rôles de base × N agences dépasserait tinyint) ---

ALTER TABLE staff_users DROP FOREIGN KEY staff_users_ibfk_1;
ALTER TABLE role_permissions DROP FOREIGN KEY role_permissions_ibfk_1;
ALTER TABLE roles MODIFY id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE staff_users MODIFY role_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE role_permissions MODIFY role_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_ibfk_1 FOREIGN KEY (role_id) REFERENCES roles(id);
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_ibfk_1
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- --- Unicité désormais PAR AGENCE (deux agences peuvent partager un même
-- nom de rôle, un même email de compte, un même slug de programme...) ---

ALTER TABLE roles DROP INDEX name, ADD UNIQUE KEY uq_role_agency_name (agency_id, name);
ALTER TABLE staff_users DROP INDEX email, ADD UNIQUE KEY uq_staff_agency_email (agency_id, email);
ALTER TABLE programs DROP INDEX slug, ADD UNIQUE KEY uq_program_agency_slug (agency_id, slug);
ALTER TABLE trips DROP INDEX reference_code, ADD UNIQUE KEY uq_trip_agency_reference (agency_id, reference_code);
ALTER TABLE airlines DROP INDEX name, ADD UNIQUE KEY uq_airline_agency_name (agency_id, name);
ALTER TABLE news_posts DROP INDEX slug, ADD UNIQUE KEY uq_news_agency_slug (agency_id, slug);

-- =====================================================================
-- 10. RÉSEAUX SOCIAUX DE L'AGENCE (migration 028)
-- Reproduit ici le contenu de database/migrations/028_add_agency_social_links.sql
-- pour qu'une installation neuve depuis ce fichier aboutisse au même état
-- final. Placée après la table `agencies` (FK requise, FOREIGN_KEY_CHECKS=1
-- de nouveau actif ici, voir plus haut).
-- =====================================================================

CREATE TABLE agency_social_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    platform VARCHAR(50) NOT NULL,
    url VARCHAR(255) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 11. CHARGES FINANCIÈRES DES PROGRAMMES (migration 035)
-- Coûts de l'agence par voyage (hôtels, billets, équipe, accessoires,
-- autres) + échéancier de paiement. Voir database/migrations/035_add_trip_expenses.sql.
-- =====================================================================

CREATE TABLE trip_expenses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trip_id BIGINT UNSIGNED NOT NULL,
    category ENUM('hotel', 'billets', 'equipe', 'accessoires', 'autre') NOT NULL,
    label VARCHAR(150) NOT NULL,
    supplier VARCHAR(150) NULL,
    hotel_id BIGINT UNSIGNED NULL,
    airline_id SMALLINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_trip_expenses_trip (trip_id),
    CONSTRAINT fk_trip_expenses_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_trip_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_expenses_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL,
    CONSTRAINT fk_trip_expenses_airline FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Échéancier : une ligne par date de paiement prévue. paid_date NULL = à payer.
CREATE TABLE trip_expense_installments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    expense_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_date DATE NULL,
    payment_method VARCHAR(30) NULL,
    reference VARCHAR(100) NULL,
    KEY idx_expense_installments_expense (expense_id),
    KEY idx_expense_installments_due (agency_id, due_date),
    CONSTRAINT fk_expense_installments_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_expense_installments_expense FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('charges.view', 'Consulter les charges financières des programmes', 'Paiements & finances', 30),
    ('charges.manage', 'Gérer les charges financières des programmes (coûts, échéances)', 'Paiements & finances', 40);

-- Direction (déjà garantie au niveau code) et comptabilité, dans chaque agence.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r
JOIN (SELECT 'charges.view' AS code UNION ALL SELECT 'charges.manage') p
WHERE r.name IN ('direction', 'comptabilite');

-- =====================================================================
-- MIGRATION 037 — WhatsApp Cloud API : fondations (Lot 0)
-- =====================================================================
-- Cahier des charges « WhatsApp, Agent IA Claude et Espace admin » (CLAUDE.md
-- §3centquadragies). Un numéro WhatsApp PAR AGENCE : le webhook Meta (commun
-- à toutes les agences) retrouve l'agence par le phone_number_id du message.
-- Secrets (jeton système, app secret) chiffrés AES-256-GCM par lib/secrets.js
-- — jamais en clair en base.
-- Les anciennes tables whatsapp_qa_templates / whatsapp_reminders /
-- whatsapp_messages_log (jamais utilisées) sont dépréciées, conservées vides.
-- =====================================================================

SET NAMES utf8mb4;

-- Compte WhatsApp Business (un numéro) d'une agence.
CREATE TABLE wa_accounts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(100) NOT NULL DEFAULT 'Numéro principal',
    waba_id VARCHAR(40) NULL,
    phone_number_id VARCHAR(40) NOT NULL,
    display_phone VARCHAR(30) NULL,
    access_token_enc TEXT NULL,
    app_secret_enc TEXT NULL,
    verify_token VARCHAR(100) NOT NULL,
    status ENUM('test', 'actif', 'inactif') NOT NULL DEFAULT 'test',
    quality_rating VARCHAR(20) NULL,
    messaging_tier VARCHAR(40) NULL,
    verified_name VARCHAR(150) NULL,
    last_webhook_at DATETIME NULL,
    last_check_at DATETIME NULL,
    last_check_result VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Unicité GLOBALE (toutes agences) : c'est la clé de routage du webhook.
    UNIQUE KEY uq_wa_accounts_phone_number (phone_number_id),
    UNIQUE KEY uq_wa_accounts_agency (agency_id),
    CONSTRAINT fk_wa_accounts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contact WhatsApp (prospect ou client), rattaché au voyageur du CRM s'il existe.
CREATE TABLE wa_contacts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    phone VARCHAR(20) NOT NULL,             -- wa_id Meta : indicatif + numéro, sans "+"
    profile_name VARCHAR(150) NULL,
    traveler_id BIGINT UNSIGNED NULL,
    language VARCHAR(20) NULL,              -- darija_latin, darija_arabe, ar, fr, en
    source VARCHAR(60) NULL,
    referral JSON NULL,                     -- clic sur une pub (click-to-WhatsApp)
    stage ENUM('prospect', 'qualifie', 'inscrit', 'en_voyage', 'ancien', 'perdu') NOT NULL DEFAULT 'prospect',
    advisor_staff_id BIGINT UNSIGNED NULL,
    qualification JSON NULL,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    last_inbound_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_contacts_phone (agency_id, phone),
    KEY idx_wa_contacts_traveler (traveler_id),
    CONSTRAINT fk_wa_contacts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_contacts_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_contacts_advisor FOREIGN KEY (advisor_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fil de discussion. Un seul propriétaire à la fois (IA ou humain) ; une
-- conversation "resolu" n'est jamais rouverte : le message suivant en crée une.
CREATE TABLE wa_conversations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    status ENUM('ia', 'copilote', 'humain', 'attente', 'resolu') NOT NULL DEFAULT 'ia',
    team VARCHAR(40) NULL,
    assigned_staff_id BIGINT UNSIGNED NULL,
    transfer_reason VARCHAR(60) NULL,
    priority ENUM('basse', 'normale', 'haute', 'urgente') NOT NULL DEFAULT 'normale',
    last_inbound_at DATETIME NULL,          -- fenêtre de service client de 24h
    fep_until DATETIME NULL,                -- fenêtre gratuite 72h (pub click-to-WhatsApp)
    sla_due_at DATETIME NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_conversations_contact (contact_id, status),
    KEY idx_wa_conversations_status (agency_id, status),
    KEY idx_wa_conversations_assigned (agency_id, assigned_staff_id),
    CONSTRAINT fk_wa_conversations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_conversations_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_conversations_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chaque message (entrant ou sortant). meta_message_id unique = dédoublonnage
-- des webhooks que Meta renvoie plusieurs fois. processing_status : le
-- webhook n'enregistre que "recu" ; le worker fait passer à "traite".
CREATE TABLE wa_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NOT NULL,
    meta_message_id VARCHAR(128) NULL,
    direction ENUM('entrant', 'sortant') NOT NULL,
    author ENUM('client', 'ia', 'humain', 'systeme') NOT NULL,
    author_staff_id BIGINT UNSIGNED NULL,
    type VARCHAR(30) NOT NULL,              -- text, audio, image, document, location, interactive, button, template...
    content TEXT NULL,
    payload JSON NULL,                      -- message Meta brut (entrant) ou corps envoyé (sortant)
    transcription TEXT NULL,
    reply_to_meta_id VARCHAR(128) NULL,
    status ENUM('recu', 'en_attente', 'envoye', 'livre', 'lu', 'echec') NOT NULL DEFAULT 'recu',
    error_code VARCHAR(20) NULL,
    error_message VARCHAR(255) NULL,
    billed_category VARCHAR(30) NULL,
    processing_status ENUM('recu', 'en_cours', 'traite', 'erreur', 'ignore') NOT NULL DEFAULT 'recu',
    processing_error VARCHAR(255) NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_messages_meta_id (meta_message_id),
    KEY idx_wa_messages_conversation (conversation_id, id),
    KEY idx_wa_messages_processing (processing_status, created_at),
    KEY idx_wa_messages_created (agency_id, created_at),
    CONSTRAINT fk_wa_messages_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_messages_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_messages_staff FOREIGN KEY (author_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fichiers reçus/envoyés, stockés HORS du dossier public (storage/wa-media/).
CREATE TABLE wa_media (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    meta_media_id VARCHAR(128) NULL,
    kind VARCHAR(20) NOT NULL,              -- audio, image, document, video, sticker
    storage_path VARCHAR(500) NULL,
    mime_type VARCHAR(100) NULL,
    size_bytes INT UNSIGNED NULL,
    file_name VARCHAR(255) NULL,
    sha256 CHAR(64) NULL,
    doc_type ENUM('passeport', 'cin', 'photo', 'recu', 'autre') NULL,
    validated_by_staff_id BIGINT UNSIGNED NULL,
    validated_at DATETIME NULL,
    purge_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_media_message (message_id),
    CONSTRAINT fk_wa_media_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_media_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_media_staff FOREIGN KEY (validated_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique du consentement marketing (accord / retrait), jamais modifié.
CREATE TABLE wa_consents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    action ENUM('accord', 'retrait') NOT NULL,
    source VARCHAR(60) NULL,
    text_shown TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_consents_contact (contact_id),
    CONSTRAINT fk_wa_consents_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_consents_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal d'audit des actions sensibles (réglages, secrets, prompts...).
-- Les secrets n'y figurent jamais (masqués avant écriture).
CREATE TABLE audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    object_type VARCHAR(60) NOT NULL,
    object_id VARCHAR(60) NULL,
    before_json JSON NULL,
    after_json JSON NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_log_agency (agency_id, created_at),
    CONSTRAINT fk_audit_log_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_audit_log_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conseiller attitré d'une inscription (transferts WhatsApp dirigés vers lui).
ALTER TABLE registrations ADD COLUMN advisor_staff_id BIGINT UNSIGNED NULL AFTER registered_by_staff_id,
  ADD CONSTRAINT fk_registrations_advisor FOREIGN KEY (advisor_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.settings', 'Configurer le compte WhatsApp (identifiants Meta, webhook)', 'WhatsApp & IA', 10),
    ('whatsapp.conversations.all', 'Voir toutes les conversations WhatsApp', 'WhatsApp & IA', 20);
-- Par défaut : direction uniquement (déjà garantie au niveau code).

-- =====================================================================
-- 12. VENTE DE BILLETS D'AVION HORS PROGRAMME (migration 036)
-- Voir database/migrations/036_add_ticket_sales.sql.
-- =====================================================================

CREATE TABLE ticket_sales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    traveler_id BIGINT UNSIGNED NOT NULL,
    airline_id SMALLINT UNSIGNED NULL,
    trip_type ENUM('aller_simple', 'aller_retour') NOT NULL DEFAULT 'aller_retour',
    origin_iata CHAR(3) NULL,
    destination_iata CHAR(3) NULL,
    departure_date DATE NULL,
    return_date DATE NULL,
    passengers_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    passenger_names VARCHAR(500) NULL,
    travel_class ENUM('economique', 'premium', 'affaires', 'premiere') NOT NULL DEFAULT 'economique',
    pnr VARCHAR(10) NULL,
    ticket_numbers VARCHAR(255) NULL,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('devis', 'reserve', 'emis', 'annule') NOT NULL DEFAULT 'reserve',
    notes TEXT NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ticket_sales_agency (agency_id, created_at),
    CONSTRAINT fk_ticket_sales_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ticket_sales_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    CONSTRAINT fk_ticket_sales_airline FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_sales_staff FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4ᵉ cible possible d'un paiement : exactement une des quatre, jamais deux.
ALTER TABLE payments
    ADD COLUMN ticket_sale_id BIGINT UNSIGNED NULL AFTER visa_service_id,
    ADD CONSTRAINT fk_payments_ticket_sale FOREIGN KEY (ticket_sale_id) REFERENCES ticket_sales(id);

ALTER TABLE payments DROP CHECK chk_payment_target;
ALTER TABLE payments ADD CONSTRAINT chk_payment_target CHECK (
    (registration_id IS NOT NULL) + (group_id IS NOT NULL) + (visa_service_id IS NOT NULL) + (ticket_sale_id IS NOT NULL) = 1
);

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('ticket_sales.manage', 'Gérer les ventes de billets d''avion (hors programme)', 'Billets d''avion', 10);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'ticket_sales.manage' FROM roles r
WHERE r.name IN ('direction', 'ventes', 'comptabilite');

-- =====================================================================
-- MIGRATION 038 — WhatsApp Lot 1 : agent IA Claude, inbox, transfert humain
-- =====================================================================
-- CLAUDE.md §3centunquadragies. Toutes les tables portent agency_id (sans
-- DEFAULT, migration 033). Les "équipes" du cahier des charges sont les
-- RÔLES existants (ventes, comptabilite, suivi = dossiers, direction =
-- responsable, + rôles personnalisés guide / accompagnateur / marketing).
-- =====================================================================

SET NAMES utf8mb4;

-- Réglages de l'agent IA, VERSIONNÉS : chaque enregistrement crée une
-- nouvelle version ; une seule active par agence ; retour arrière = réactiver
-- une version précédente (exigence 8.8 / recette "modification annulable").
CREATE TABLE ia_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    mode ENUM('ia', 'copilote', 'off') NOT NULL DEFAULT 'copilote',
    system_prompt MEDIUMTEXT NOT NULL,
    model_conversation VARCHAR(60) NOT NULL DEFAULT 'claude-sonnet-5-5',
    model_summary VARCHAR(60) NOT NULL DEFAULT 'claude-haiku-5-5',
    effort ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    max_tokens INT UNSIGNED NOT NULL DEFAULT 8000,
    history_size INT UNSIGNED NOT NULL DEFAULT 20,
    tools_enabled JSON NULL,
    transfer_keywords JSON NULL,
    messages JSON NULL,
    monthly_cost_cap_usd DECIMAL(10,2) NULL,
    prices JSON NULL,
    note VARCHAR(255) NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ia_settings_version (agency_id, version),
    CONSTRAINT fk_ia_settings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_settings_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Base de connaissances (hors prix et dates, qui viennent du CRM).
CREATE TABLE ia_knowledge (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'agence',
    question VARCHAR(500) NOT NULL,
    variants TEXT NULL,
    answer_fr TEXT NULL,
    answer_ar TEXT NULL,
    status ENUM('brouillon', 'publie') NOT NULL DEFAULT 'brouillon',
    author_staff_id BIGINT UNSIGNED NULL,
    verified_at DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ia_knowledge_status (agency_id, status),
    CONSTRAINT fk_ia_knowledge_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_knowledge_author FOREIGN KEY (author_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Questions sans réponse (transferts, corrections des conseillers) → fiches.
CREATE TABLE ia_unanswered (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    question TEXT NOT NULL,
    origin ENUM('transfert', 'correction', 'ia') NOT NULL DEFAULT 'transfert',
    correction TEXT NULL,
    handled BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_unanswered_open (agency_id, handled),
    CONSTRAINT fk_ia_unanswered_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_unanswered_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_ia_unanswered_knowledge FOREIGN KEY (knowledge_id) REFERENCES ia_knowledge(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal de chaque exécution de l'agent (CL-08). Jamais de passeport/CIN
-- en clair : masqués avant écriture (lib/ai/redact.js).
CREATE TABLE ia_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    context ENUM('conversation', 'resume', 'bac_a_sable', 'test') NOT NULL DEFAULT 'conversation',
    model VARCHAR(60) NOT NULL,
    settings_version INT UNSIGNED NULL,
    input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cache_read_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cache_write_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    tool_rounds INT UNSIGNED NOT NULL DEFAULT 0,
    tools JSON NULL,
    duration_ms INT UNSIGNED NULL,
    cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    outcome VARCHAR(30) NOT NULL DEFAULT 'reponse',
    stop_reason VARCHAR(30) NULL,
    response TEXT NULL,
    error VARCHAR(500) NULL,
    evaluation ENUM('bonne', 'a_corriger') NULL,
    evaluation_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_logs_agency (agency_id, created_at),
    KEY idx_ia_logs_conversation (conversation_id),
    CONSTRAINT fk_ia_logs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_logs_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Jeu de tests de l'agent (50 questions visées), rejouable après chaque
-- changement de prompt (NF-15).
CREATE TABLE ia_test_cases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    question TEXT NOT NULL,
    profile ENUM('prospect', 'inscrit') NOT NULL DEFAULT 'prospect',
    traveler_id BIGINT UNSIGNED NULL,
    expectation TEXT NULL,
    expect_transfer BOOLEAN NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ia_test_cases_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_test_cases_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ia_test_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    run_key VARCHAR(40) NOT NULL,
    case_id BIGINT UNSIGNED NOT NULL,
    settings_version INT UNSIGNED NULL,
    response TEXT NULL,
    transferred BOOLEAN NOT NULL DEFAULT FALSE,
    tools JSON NULL,
    cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_test_runs_run (agency_id, run_key),
    CONSTRAINT fk_ia_test_runs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_test_runs_case FOREIGN KEY (case_id) REFERENCES ia_test_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Horaires d'ouverture (plusieurs plages par jour possibles ; aucun = fermé)
-- et exceptions datées (fériés, horaires de Ramadan).
CREATE TABLE business_hours (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,      -- 0 = dimanche ... 6 = samedi
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    KEY idx_business_hours_agency (agency_id, weekday),
    CONSTRAINT fk_business_hours_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE business_hours_exceptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    label VARCHAR(100) NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT TRUE,
    open_time TIME NULL,
    close_time TIME NULL,
    CONSTRAINT fk_bh_exceptions_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Délais de prise en charge par motif de transfert (cahier §6.3).
CREATE TABLE sla_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(40) NOT NULL,
    label VARCHAR(100) NOT NULL,
    team VARCHAR(50) NOT NULL,
    minutes INT UNSIGNED NOT NULL,
    priority ENUM('basse', 'normale', 'haute', 'urgente') NOT NULL DEFAULT 'normale',
    around_the_clock BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uq_sla_rules_reason (agency_id, reason),
    CONSTRAINT fk_sla_rules_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Accompagnateur(s) de permanence par voyage (urgences en voyage, HU-11).
CREATE TABLE trip_escorts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trip_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_trip_escorts (trip_id, staff_id),
    CONSTRAINT fk_trip_escorts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_trip_escorts_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_escorts_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tâches internes créées par l'agent ou le système (reçu à valider, rappel
-- téléphonique, document à vérifier).
CREATE TABLE staff_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    type ENUM('validation_paiement', 'rappel', 'document', 'autre') NOT NULL,
    status ENUM('ouverte', 'faite', 'annulee') NOT NULL DEFAULT 'ouverte',
    team VARCHAR(50) NULL,
    assigned_staff_id BIGINT UNSIGNED NULL,
    conversation_id BIGINT UNSIGNED NULL,
    contact_id BIGINT UNSIGNED NULL,
    registration_id BIGINT UNSIGNED NULL,
    media_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    details JSON NULL,
    due_at DATETIME NULL,
    done_by_staff_id BIGINT UNSIGNED NULL,
    done_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_staff_tasks_open (agency_id, status),
    CONSTRAINT fk_staff_tasks_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_staff_tasks_assigned FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_done_by FOREIGN KEY (done_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_media FOREIGN KEY (media_id) REFERENCES wa_media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notifications internes (transfert, SLA dépassé, urgence) : pour un
-- conseiller précis (staff_id) ou pour toute une équipe (team = nom de rôle).
CREATE TABLE staff_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NULL,
    team VARCHAR(50) NULL,
    kind VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    task_id BIGINT UNSIGNED NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_staff_notifications_open (agency_id, read_at),
    CONSTRAINT fk_staff_notifications_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_staff_notifications_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_notifications_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_notifications_task FOREIGN KEY (task_id) REFERENCES staff_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Réponses rapides partagées (HU-07).
CREATE TABLE wa_quick_replies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    shortcut VARCHAR(40) NOT NULL,
    text_fr TEXT NULL,
    text_ar TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_wa_quick_replies (agency_id, shortcut),
    CONSTRAINT fk_wa_quick_replies_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Templates Meta : au Lot 1, simple copie synchronisée depuis Meta (envoi
-- depuis l'inbox quand la fenêtre de 24h est fermée, HU-08). Création,
-- soumission et correspondance des variables : Lot 2.
CREATE TABLE wa_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    meta_template_id VARCHAR(60) NULL,
    name VARCHAR(200) NOT NULL,
    language VARCHAR(20) NOT NULL,
    category VARCHAR(30) NULL,
    status VARCHAR(30) NULL,
    components JSON NULL,
    synced_at DATETIME NULL,
    UNIQUE KEY uq_wa_templates (agency_id, name, language),
    CONSTRAINT fk_wa_templates_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE wa_messages
  ADD COLUMN is_private_note BOOLEAN NOT NULL DEFAULT FALSE AFTER author_staff_id,
  ADD COLUMN draft_status ENUM('brouillon', 'envoye', 'rejete') NULL AFTER is_private_note,
  ADD COLUMN ia_log_id BIGINT UNSIGNED NULL AFTER draft_status,
  ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER ia_log_id,
  ADD CONSTRAINT fk_wa_messages_ia_log FOREIGN KEY (ia_log_id) REFERENCES ia_logs(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_wa_messages_template FOREIGN KEY (template_id) REFERENCES wa_templates(id) ON DELETE SET NULL;

ALTER TABLE wa_conversations
  ADD COLUMN ai_last_handled_message_id BIGINT UNSIGNED NULL AFTER sla_due_at,
  ADD COLUMN ai_lock_until DATETIME NULL AFTER ai_last_handled_message_id,
  ADD COLUMN ooh_notice_sent_at DATETIME NULL AFTER ai_lock_until,
  ADD COLUMN transferred_at DATETIME NULL AFTER ooh_notice_sent_at,
  ADD COLUMN sla_alert_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER transferred_at,
  ADD COLUMN first_human_reply_at DATETIME NULL AFTER sla_alert_level,
  ADD COLUMN summary TEXT NULL AFTER first_human_reply_at,
  ADD COLUMN welcomed BOOLEAN NOT NULL DEFAULT FALSE AFTER summary;

-- Permissions (catégorie "WhatsApp & IA", créée en 037).
INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.conversations.own', 'Traiter les conversations WhatsApp de son équipe et les siennes', 'WhatsApp & IA', 15),
    ('whatsapp.team', 'Gérer horaires, délais (SLA), accompagnateurs et réponses rapides', 'WhatsApp & IA', 30),
    ('whatsapp.tasks', 'Voir et traiter les tâches WhatsApp (reçus, rappels, documents)', 'WhatsApp & IA', 40),
    ('ia.knowledge', 'Gérer la base de connaissances de l''agent IA', 'WhatsApp & IA', 50),
    ('ia.sandbox', 'Utiliser le bac à sable et le jeu de tests de l''agent IA', 'WhatsApp & IA', 60),
    ('ia.settings', 'Modifier les réglages de l''agent IA (prompt, modèles, mode)', 'WhatsApp & IA', 70);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r
JOIN (SELECT 'whatsapp.conversations.own' AS code UNION ALL SELECT 'whatsapp.tasks') p
WHERE r.name IN ('ventes', 'comptabilite', 'suivi');

-- Données initiales par agence (modifiables dans l'admin).
-- SLA : valeurs par défaut du cahier des charges §6.3.
INSERT INTO sla_rules (agency_id, reason, label, team, minutes, priority, around_the_clock)
SELECT a.id, s.reason, s.label, s.team, s.minutes, s.priority, s.atc FROM agencies a
JOIN (
  SELECT 'urgence' reason, 'Urgence en voyage' label, 'accompagnateur' team, 5 minutes, 'urgente' priority, TRUE atc
  UNION ALL SELECT 'reclamation', 'Réclamation', 'direction', 15, 'haute', FALSE
  UNION ALL SELECT 'intention_achat', 'Intention d''achat', 'ventes', 15, 'haute', FALSE
  UNION ALL SELECT 'demande_humain', 'Demande explicite d''un conseiller', 'ventes', 15, 'normale', FALSE
  UNION ALL SELECT 'negociation', 'Négociation / groupe (5 personnes et +)', 'ventes', 30, 'normale', FALSE
  UNION ALL SELECT 'recu_paiement', 'Reçu de paiement', 'comptabilite', 120, 'normale', FALSE
  UNION ALL SELECT 'cas_particulier', 'Cas particulier (âge, santé, mineur)', 'suivi', 240, 'normale', FALSE
  UNION ALL SELECT 'question_religieuse', 'Question religieuse', 'guide', 1440, 'basse', FALSE
  UNION ALL SELECT 'echec_ia', 'L''agent IA n''a pas pu répondre', 'ventes', 15, 'normale', FALSE
  UNION ALL SELECT 'vocal_non_transcrit', 'Message vocal non transcrit', 'ventes', 15, 'normale', FALSE
) s;

-- Horaires par défaut (à confirmer par l'agence) : lun-ven 9h-18h, sam 9h-13h.
INSERT INTO business_hours (agency_id, weekday, open_time, close_time)
SELECT a.id, d.wd, d.o, d.c FROM agencies a
JOIN (
  SELECT 1 wd, '09:00:00' o, '18:00:00' c UNION ALL SELECT 2, '09:00:00', '18:00:00'
  UNION ALL SELECT 3, '09:00:00', '18:00:00' UNION ALL SELECT 4, '09:00:00', '18:00:00'
  UNION ALL SELECT 5, '09:00:00', '18:00:00' UNION ALL SELECT 6, '09:00:00', '13:00:00'
) d;

-- =====================================================================
-- MIGRATION 039 — WhatsApp Lot 2 : templates Meta, déclencheurs, liens
-- wa.me / QR codes, paiement en ligne
-- =====================================================================
-- CLAUDE.md §3centdeuxquadragies. Toutes les tables portent agency_id.
-- =====================================================================

SET NAMES utf8mb4;

-- Templates : édition locale (brouillon) puis soumission à Meta (TP-01),
-- catégorie demandée vs appliquée par Meta (TP-02/03), correspondance des
-- variables {{n}} ↔ champs CRM (TP-05). Un même NOM = une famille, une ligne
-- par langue (fr, ar...) comme chez Meta (TP-04).
ALTER TABLE wa_templates
  ADD COLUMN category_requested VARCHAR(30) NULL AFTER category,
  ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER status,
  ADD COLUMN variable_mapping JSON NULL AFTER components,
  ADD COLUMN description VARCHAR(255) NULL AFTER variable_mapping,
  ADD COLUMN origin ENUM('local', 'meta') NOT NULL DEFAULT 'meta' AFTER description,
  ADD COLUMN submitted_at DATETIME NULL AFTER synced_at,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at;

-- Déclencheurs (moteur unique, cahier §7.2).
CREATE TABLE wa_triggers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(60) NULL,                  -- identifiant stable des déclencheurs livrés
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    family ENUM('evenement', 'date_relative', 'inactivite', 'interne', 'manuel') NOT NULL,
    event_type VARCHAR(40) NULL,            -- famille "evenement" (et interne "prospect_qualifie")
    anchor ENUM('depart', 'retour', 'inscription') NULL,  -- famille "date_relative"
    offset_days INT NULL,                   -- J-15 = -15, J+2 = 2
    inactivity_hours INT UNSIGNED NULL,     -- famille "inactivite"
    audience ENUM('inscrits', 'prospects', 'equipe') NOT NULL DEFAULT 'inscrits',
    conditions JSON NULL,                   -- filtres (statut, visa, solde, famille de programme...)
    delay_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    template_name VARCHAR(200) NULL,        -- famille de templates (langue choisie par contact)
    free_text_when_open BOOLEAN NOT NULL DEFAULT TRUE,   -- DC-03 : texte libre gratuit si fenêtre 24h ouverte
    internal_action VARCHAR(40) NULL,       -- notifier_equipe, rapport_quotidien
    internal_team VARCHAR(50) NULL,
    allowed_start TIME NOT NULL DEFAULT '09:00:00',
    allowed_end TIME NOT NULL DEFAULT '21:00:00',
    skip_friday_prayer BOOLEAN NOT NULL DEFAULT TRUE,    -- pas d'envoi le vendredi 12h-14h (DC-06)
    urgent BOOLEAN NOT NULL DEFAULT FALSE,               -- ignore les plages d'envoi (changement de vol...)
    stop_conditions JSON NULL,              -- reponse_client, paiement_complet, document_recu, visa_accorde
    max_per_target INT UNSIGNED NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_triggers_code (agency_id, code),
    KEY idx_wa_triggers_active (agency_id, is_active, family),
    CONSTRAINT fk_wa_triggers_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exécutions (DC-08) : planifiées puis envoyées / annulées / ignorées.
-- dedupe_key empêche d'envoyer deux fois le même rappel à la même personne.
CREATE TABLE wa_trigger_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trigger_id BIGINT UNSIGNED NOT NULL,
    registration_id BIGINT UNSIGNED NULL,
    contact_id BIGINT UNSIGNED NULL,
    dedupe_key VARCHAR(190) NOT NULL,
    status ENUM('planifie', 'envoye', 'annule', 'ignore', 'echec') NOT NULL DEFAULT 'planifie',
    scheduled_at DATETIME NOT NULL,
    executed_at DATETIME NULL,
    channel ENUM('template', 'texte', 'interne') NULL,
    message_id BIGINT UNSIGNED NULL,
    result VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_trigger_runs_dedupe (agency_id, dedupe_key),
    KEY idx_wa_trigger_runs_due (status, scheduled_at),
    KEY idx_wa_trigger_runs_trigger (trigger_id, created_at),
    CONSTRAINT fk_wa_trigger_runs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_trigger_runs_trigger FOREIGN KEY (trigger_id) REFERENCES wa_triggers(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Liens wa.me avec code source et QR code (CP-07).
CREATE TABLE wa_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(150) NOT NULL,
    prefilled_message VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_links_code (agency_id, code),
    CONSTRAINT fk_wa_links_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_links_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Passerelles de paiement par agence (secrets chiffrés, lib/secrets.js).
CREATE TABLE payment_gateways (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    provider ENUM('stripe', 'paypal', 'cmi', 'virement') NOT NULL,
    mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
    public_config JSON NULL,
    secret_config_enc TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_gateways (agency_id, provider),
    CONSTRAINT fk_payment_gateways_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Liens de paiement envoyés aux clients. Le montant et la référence sont
-- fixés CÔTÉ SERVEUR à la création ; le paiement n'est enregistré dans le
-- CRM qu'à réception de la notification signée de la passerelle.
CREATE TABLE payment_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(20) NOT NULL,
    mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
    reference VARCHAR(40) NOT NULL,
    registration_id BIGINT UNSIGNED NULL,
    group_id BIGINT UNSIGNED NULL,
    conversation_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'MAD',
    description VARCHAR(255) NULL,
    external_id VARCHAR(120) NULL,
    checkout_url VARCHAR(1000) NULL,
    status ENUM('cree', 'paye', 'expire', 'annule', 'echec') NOT NULL DEFAULT 'cree',
    payment_id BIGINT UNSIGNED NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    last_event JSON NULL,
    UNIQUE KEY uq_payment_links_reference (reference),
    KEY idx_payment_links_external (provider, external_id),
    CONSTRAINT fk_payment_links_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_payment_links_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_group FOREIGN KEY (group_id) REFERENCES registration_groups(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.templates', 'Gérer les templates Meta (créer, soumettre, variables)', 'WhatsApp & IA', 80),
    ('whatsapp.triggers', 'Gérer les déclencheurs automatiques', 'WhatsApp & IA', 90),
    ('whatsapp.links', 'Créer des liens wa.me et QR codes', 'WhatsApp & IA', 100),
    ('paiements.liens', 'Créer et envoyer des liens de paiement en ligne', 'Paiements & finances', 50),
    ('paiements.passerelles', 'Configurer les passerelles de paiement en ligne', 'Paiements & finances', 60);

-- Liens de paiement : comptabilité et ventes (direction garantie au niveau code).
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'paiements.liens' FROM roles r WHERE r.name IN ('comptabilite', 'ventes');

-- =====================================================================
-- MIGRATION 040 — WhatsApp Lot 3 : campagnes, coûts, pilotage, audit IA,
-- rétention des données (CNDP), double authentification, tâches système
-- =====================================================================
-- CLAUDE.md §3centtroisquadragies. Tables métier avec agency_id (sauf
-- system_jobs, état technique global du serveur).
-- =====================================================================

SET NAMES utf8mb4;

-- Segments réutilisables (CP-01) : filtres JSON évalués à la demande.
CREATE TABLE wa_segments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    filters JSON NOT NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_segments_agency (agency_id),
    CONSTRAINT fk_wa_segments_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_segments_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Campagnes (CP-02→06). Circuit : brouillon → a_valider → validee →
-- en_cours → terminee (ou arretee / refusee). Les filtres sont recopiés à la
-- création pour que la campagne reste reproductible si le segment change.
CREATE TABLE wa_campaigns (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    segment_id BIGINT UNSIGNED NULL,
    filters JSON NOT NULL,
    template_name VARCHAR(200) NOT NULL,          -- variante A (famille de templates, langue par contact)
    template_b_name VARCHAR(200) NULL,            -- variante B (test A/B)
    free_text VARCHAR(500) NULL,                  -- variable « texte saisi au moment de l'envoi »
    ab_test_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 10 = 10 % des contacts reçoivent A ou B d'abord
    ab_wait_hours SMALLINT UNSIGNED NOT NULL DEFAULT 4,
    ab_metric ENUM('reponses', 'lus') NOT NULL DEFAULT 'reponses',
    ab_winner ENUM('A', 'B') NULL,
    scheduled_at DATETIME NULL,                   -- UTC ; NULL = dès la validation
    batch_size SMALLINT UNSIGNED NOT NULL DEFAULT 200,
    status ENUM('brouillon', 'a_valider', 'validee', 'en_cours', 'terminee', 'arretee', 'refusee') NOT NULL DEFAULT 'brouillon',
    estimated_recipients INT UNSIGNED NULL,
    estimated_cost DECIMAL(12,2) NULL,            -- MAD
    created_by_staff_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME NULL,
    approved_by_staff_id BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    review_note VARCHAR(500) NULL,
    started_at DATETIME NULL,
    test_sent_at DATETIME NULL,
    finished_at DATETIME NULL,
    stopped_by_staff_id BIGINT UNSIGNED NULL,
    stopped_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_campaigns_status (agency_id, status),
    CONSTRAINT fk_wa_campaigns_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_campaigns_segment FOREIGN KEY (segment_id) REFERENCES wa_segments(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_creator FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_approver FOREIGN KEY (approved_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_stopper FOREIGN KEY (stopped_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Destinataires figés au lancement (un contact = une ligne, jamais deux envois).
CREATE TABLE wa_campaign_recipients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    campaign_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    variant ENUM('A', 'B') NOT NULL DEFAULT 'A',
    phase ENUM('test', 'principal') NOT NULL DEFAULT 'principal',
    status ENUM('en_attente', 'envoye', 'echec', 'ignore', 'annule') NOT NULL DEFAULT 'en_attente',
    message_id BIGINT UNSIGNED NULL,
    result VARCHAR(255) NULL,
    sent_at DATETIME NULL,
    UNIQUE KEY uq_wa_campaign_recipient (campaign_id, contact_id),
    KEY idx_wa_campaign_recipients_status (campaign_id, status, phase),
    KEY idx_wa_campaign_recipients_agency (agency_id),
    CONSTRAINT fk_wa_campaign_recipients_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_campaign_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_campaign_recipients_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_campaign_recipients_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Coût Meta réel par message (renseigné quand Meta indique « billable » dans
-- le statut de livraison) et rattachement éventuel à une campagne.
ALTER TABLE wa_messages
  ADD COLUMN cost_mad DECIMAL(10,4) NULL AFTER billed_category,
  ADD COLUMN campaign_id BIGINT UNSIGNED NULL AFTER template_id,
  ADD KEY idx_wa_messages_campaign (campaign_id),
  ADD CONSTRAINT fk_wa_messages_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE SET NULL;

-- Réglages d'exploitation par agence : tarifs Meta, rapport quotidien,
-- alertes, conservation des données (NF-13), plafond de coût.
CREATE TABLE wa_ops_settings (
    agency_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    price_marketing_mad DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    price_utility_mad DECIMAL(8,4) NOT NULL DEFAULT 0.2000,
    price_authentication_mad DECIMAL(8,4) NOT NULL DEFAULT 0.2000,
    usd_to_mad DECIMAL(8,4) NOT NULL DEFAULT 10.0000,
    report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    report_hour TINYINT UNSIGNED NOT NULL DEFAULT 19,
    report_sections JSON NULL,                -- sections du rapport (paramétrable)
    report_emails VARCHAR(500) NULL,          -- destinataires e-mail (séparés par des virgules)
    alert_emails VARCHAR(500) NULL,           -- alertes techniques (panne webhook/file, sauvegarde)
    cost_alert_percent TINYINT UNSIGNED NOT NULL DEFAULT 80,
    retention_documents_days_after_trip SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    retention_media_days SMALLINT UNSIGNED NOT NULL DEFAULT 180,
    retention_conversations_months SMALLINT UNSIGNED NOT NULL DEFAULT 24,
    retention_ia_logs_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
    purge_enabled BOOLEAN NOT NULL DEFAULT FALSE,   -- activée par la direction après validation des durées
    last_report_at DATETIME NULL,
    last_purge_at DATETIME NULL,
    last_purge_result VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wa_ops_settings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit qualité hebdomadaire (NF-15, §8.16) : 20 conversations IA tirées
-- au hasard, notées sur une grille.
CREATE TABLE ia_audits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status ENUM('en_cours', 'termine') NOT NULL DEFAULT 'en_cours',
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    KEY idx_ia_audits_agency (agency_id, created_at),
    CONSTRAINT fk_ia_audits_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_audits_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ia_audit_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    audit_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    accuracy TINYINT UNSIGNED NULL,           -- 1 à 5
    tone TINYINT UNSIGNED NULL,               -- 1 à 5
    transfer_ok BOOLEAN NULL,                 -- transfert pertinent (ou absence de transfert justifiée)
    invented_info BOOLEAN NULL,               -- information inventée détectée (tolérance zéro)
    comment VARCHAR(1000) NULL,
    reviewed_by_staff_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    UNIQUE KEY uq_ia_audit_item (audit_id, conversation_id),
    KEY idx_ia_audit_items_agency (agency_id),
    CONSTRAINT fk_ia_audit_items_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_audit_items_audit FOREIGN KEY (audit_id) REFERENCES ia_audits(id) ON DELETE CASCADE,
    CONSTRAINT fk_ia_audit_items_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_ia_audit_items_staff FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Connexion : double authentification (TOTP) et verrouillage après 5 échecs (NF-07).
ALTER TABLE staff_users
  ADD COLUMN totp_secret_enc TEXT NULL AFTER password_hash,
  ADD COLUMN totp_enabled_at DATETIME NULL AFTER totp_secret_enc,
  ADD COLUMN failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER totp_enabled_at,
  ADD COLUMN locked_until DATETIME NULL AFTER failed_login_count,
  ADD COLUMN last_login_at DATETIME NULL AFTER locked_until;

-- État des tâches planifiées du serveur (sauvegarde, purge, contrôle de
-- santé). Global : pas d'agency_id (une seule base, un seul serveur).
CREATE TABLE system_jobs (
    name VARCHAR(60) NOT NULL PRIMARY KEY,
    last_run_at DATETIME NULL,
    last_status ENUM('ok', 'erreur', 'en_cours') NULL,
    last_message VARCHAR(500) NULL,
    details JSON NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.dashboard', 'Tableau de bord et statistiques WhatsApp', 'WhatsApp & IA', 110),
    ('whatsapp.costs', 'Voir les coûts Meta et Claude', 'WhatsApp & IA', 120),
    ('whatsapp.contacts', 'Contacts WhatsApp (liste, import, export)', 'WhatsApp & IA', 130),
    ('whatsapp.campaigns', 'Préparer des campagnes marketing', 'WhatsApp & IA', 140),
    ('whatsapp.campaigns.approve', 'Valider et lancer les campagnes', 'WhatsApp & IA', 150),
    ('whatsapp.data', 'Données personnelles : export, suppression, conservation', 'WhatsApp & IA', 160),
    ('audit.view', 'Journal d''audit, logs IA et audit qualité', 'WhatsApp & IA', 170);

-- Tableau de bord (périmètre limité à son équipe) et contacts : équipes en
-- contact avec les clients. Direction garantie au niveau code.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'whatsapp.dashboard' FROM roles r WHERE r.name IN ('ventes', 'comptabilite', 'suivi');
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'whatsapp.contacts' FROM roles r WHERE r.name IN ('ventes', 'suivi');

-- Demande de compte par l'équipe (migration 041) : compte créé inactif au
-- statut « en_attente », validé ou refusé par un administrateur
-- (utilisateurs.manage) depuis /admin/parametres/utilisateurs.
ALTER TABLE staff_users
  ADD COLUMN approval_status ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'valide' AFTER is_active,
  ADD COLUMN reviewed_by_staff_id BIGINT UNSIGNED NULL AFTER approval_status,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by_staff_id,
  ADD KEY idx_staff_users_approval (agency_id, approval_status),
  ADD CONSTRAINT fk_staff_users_reviewer FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;
