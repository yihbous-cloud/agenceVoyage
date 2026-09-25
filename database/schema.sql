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
    origin_iata CHAR(3) NULL COMMENT 'Code IATA aéroport de départ à l''aller, ex: CMN (recherche de vols Duffel) ; sens inversé par défaut au retour si return_origin_iata/return_destination_iata non renseignés',
    destination_iata CHAR(3) NULL COMMENT 'Code IATA aéroport d''arrivée à l''aller, ex: JED',
    outbound_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale à l''aller, NULL = vol direct (migration 017)',
    return_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale au retour, NULL = vol direct (migration 017)',
    return_origin_iata CHAR(3) NULL COMMENT 'aéroport de départ au retour, NULL = même aéroport que l''arrivée à l''aller (sens inversé) (migration 018)',
    return_destination_iata CHAR(3) NULL COMMENT 'aéroport d''arrivée au retour, NULL = même aéroport que le départ à l''aller (sens inversé) (migration 018)',
    airline_id SMALLINT UNSIGNED NULL,
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

-- =====================================================================
-- 4. HÔTELS & CHAMBRES
-- =====================================================================

CREATE TABLE hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL COMMENT 'ex: La Mecque, Médine, Istanbul, Paris',
    landmark_name VARCHAR(100) NULL COMMENT 'point de repère de proximité (ex: Haram, Masjid Nabawi, Tour Eiffel)',
    country VARCHAR(100) NOT NULL DEFAULT 'Arabie Saoudite',
    star_rating TINYINT UNSIGNED NULL,
    landmark_distance_m INT UNSIGNED NULL COMMENT 'distance en mètres jusqu''à landmark_name',
    contact_info VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    passport_expiry_date DATE NULL,
    info_confirmed BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Fiche voyageur enregistrée/vérifiée depuis l''admin — verrouille le formulaire par défaut',
    phone_whatsapp VARCHAR(30) NOT NULL COMMENT 'numéro WhatsApp — canal principal de communication',
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_traveler_phone (phone_whatsapp),
    INDEX idx_traveler_passport (passport_number)
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
    allow_mixed_gender_room BOOLEAN NOT NULL DEFAULT FALSE,
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    INDEX idx_reg_group_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L'inscription est l'entité centrale : un voyageur inscrit à un voyage précis
CREATE TABLE registrations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    traveler_id BIGINT UNSIGNED NOT NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL COMMENT 'employé ayant saisi l’inscription',
    status ENUM('inscrit', 'confirme', 'paye_partiel', 'paye_complet', 'annule') NOT NULL DEFAULT 'inscrit',
    room_id BIGINT UNSIGNED NULL COMMENT 'chambre assignée (peut être NULL avant répartition)',
    preferred_hotel_id BIGINT UNSIGNED NULL COMMENT 'DEPRECIEE (migration 010) — remplacée par registration_hotel_preferences (une préférence par ville, migration 015), conservée pour l’historique mais plus alimentée',
    preferred_room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NULL COMMENT 'type de chambre souhaité par le voyageur',
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
    COALESCE(SUM(pay.amount), 0) AS total_paid,
    reg.total_due - COALESCE(SUM(pay.amount), 0) AS balance_due
FROM registrations reg
JOIN trips t            ON t.id = reg.trip_id
JOIN programs p          ON p.id = t.program_id
JOIN travelers tr        ON tr.id = reg.traveler_id
LEFT JOIN rooms r        ON r.id = reg.room_id
LEFT JOIN trip_hotels th ON th.id = r.trip_hotel_id
LEFT JOIN hotels h       ON h.id = th.hotel_id
LEFT JOIN payments pay   ON pay.registration_id = reg.id
GROUP BY reg.id;

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
