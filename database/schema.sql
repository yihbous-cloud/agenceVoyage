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
    short_description VARCHAR(500) NULL,
    full_description TEXT NULL COMMENT 'contenu riche, utilisé aussi pour schema.org / GEO',
    cover_image_url VARCHAR(500) NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un "voyage" est une instance datée d'un programme (départ précis)
CREATE TABLE trips (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    reference_code VARCHAR(30) NOT NULL UNIQUE COMMENT 'ex: GF-OMR-2027-03',
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    destination_country VARCHAR(100) NOT NULL DEFAULT 'Arabie Saoudite',
    airline_id SMALLINT UNSIGNED NULL,
    total_seats INT UNSIGNED NOT NULL DEFAULT 0,
    price_per_person DECIMAL(10,2) NOT NULL DEFAULT 0.00,
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

-- =====================================================================
-- 4. HÔTELS & CHAMBRES
-- =====================================================================

CREATE TABLE hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL COMMENT 'ex: La Mecque, Médine',
    country VARCHAR(100) NOT NULL DEFAULT 'Arabie Saoudite',
    star_rating TINYINT UNSIGNED NULL,
    distance_to_haram_m INT UNSIGNED NULL COMMENT 'distance en mètres, pertinent pour Omra/Hajj',
    contact_info VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    room_type ENUM('simple', 'double', 'triple', 'quadruple') NOT NULL,
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
    phone_whatsapp VARCHAR(30) NOT NULL COMMENT 'numéro WhatsApp — canal principal de communication',
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_traveler_phone (phone_whatsapp),
    INDEX idx_traveler_passport (passport_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L'inscription est l'entité centrale : un voyageur inscrit à un voyage précis
CREATE TABLE registrations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    traveler_id BIGINT UNSIGNED NOT NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL COMMENT 'employé ayant saisi l’inscription',
    status ENUM('inscrit', 'confirme', 'paye_partiel', 'paye_complet', 'annule') NOT NULL DEFAULT 'inscrit',
    room_id BIGINT UNSIGNED NULL COMMENT 'chambre assignée (peut être NULL avant répartition)',
    visa_status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'montant total dû pour cette inscription',
    registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    UNIQUE KEY uq_traveler_per_trip (trip_id, traveler_id),
    INDEX idx_reg_status (status),
    INDEX idx_reg_visa_status (visa_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 6. PAIEMENTS & SUIVI FINANCIER
-- =====================================================================

CREATE TABLE services (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ex: Billet avion, Hébergement, Visa, Transport local, Assurance',
    default_price DECIMAL(10,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Détail des services facturés par inscription (permet le calcul du "restant dû")
CREATE TABLE registration_services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    service_id SMALLINT UNSIGNED NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'MAD',
    payment_method ENUM('especes', 'virement', 'cheque', 'carte', 'autre') NOT NULL DEFAULT 'especes',
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by_staff_id BIGINT UNSIGNED NULL,
    receipt_reference VARCHAR(50) NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (recorded_by_staff_id) REFERENCES staff_users(id),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 7. DEMANDES DE VISA
-- =====================================================================

CREATE TABLE visa_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL UNIQUE,
    submitted_date DATE NULL,
    consulate_or_authority VARCHAR(150) NULL COMMENT 'organisme concerné',
    status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    visa_number VARCHAR(50) NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    notes VARCHAR(255) NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
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
-- 9. VUES UTILES (pour les listes intelligentes)
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
