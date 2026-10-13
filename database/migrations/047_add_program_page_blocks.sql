-- =====================================================================
-- 047 — Référencement global, phase 2 vague 2A (CLAUDE.md §3centdixseptquadragies)
-- Fiche voyage en 10 blocs (cahier §6.4) : contenu saisi au niveau du
-- PROGRAMME (programmes permanents, décision D3), données propres au
-- DÉPART sur trips, photos/vidéo et avis clients.
-- =====================================================================

-- --- Contenu de la fiche (langue principale : programs.content_locale) ----
ALTER TABLE programs
    ADD COLUMN supervision TEXT NULL COMMENT 'encadrement : guide religieux, accompagnateur' AFTER full_description,
    ADD COLUMN itinerary_days JSON NULL COMMENT 'programme jour par jour : [{title, description}]' AFTER supervision,
    ADD COLUMN included_items TEXT NULL COMMENT 'inclus, un élément par ligne' AFTER itinerary_days,
    ADD COLUMN excluded_items TEXT NULL COMMENT 'non inclus, un élément par ligne' AFTER included_items,
    ADD COLUMN formalities TEXT NULL COMMENT 'documents, délais, conditions (Markdown)' AFTER excluded_items,
    ADD COLUMN formalities_verified_at DATE NULL COMMENT 'formalités vérifiées le' AFTER formalities,
    ADD COLUMN formalities_source_url VARCHAR(500) NULL COMMENT 'source officielle des formalités' AFTER formalities_verified_at,
    ADD COLUMN booking_conditions TEXT NULL COMMENT 'acompte, échéancier, annulation, modification (Markdown)' AFTER formalities_source_url;

-- Même contenu dans l'autre langue (lib/contentTranslations.js).
ALTER TABLE program_translations
    ADD COLUMN supervision TEXT NULL AFTER full_description,
    ADD COLUMN itinerary_days JSON NULL AFTER supervision,
    ADD COLUMN included_items TEXT NULL AFTER itinerary_days,
    ADD COLUMN excluded_items TEXT NULL AFTER included_items,
    ADD COLUMN formalities TEXT NULL AFTER excluded_items,
    ADD COLUMN booking_conditions TEXT NULL AFTER formalities;

-- --- Propre au départ ------------------------------------------------------
ALTER TABLE trips
    ADD COLUMN baggage_allowance VARCHAR(150) NULL COMMENT 'franchise bagages, ex. 2 x 23 kg + 7 kg cabine' AFTER return_layover_iata;

-- --- Photo réelle de l'hôtel (fiche + balisage Hotel) ----------------------
ALTER TABLE hotels
    ADD COLUMN photo_url VARCHAR(500) NULL COMMENT 'photo réelle de l hôtel' AFTER landmark_distance_m;

-- --- Preuves : photos et vidéo du programme -------------------------------
CREATE TABLE program_media (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    program_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('photo', 'video') NOT NULL DEFAULT 'photo',
    url VARCHAR(500) NOT NULL COMMENT 'chemin d upload (photo) ou lien YouTube (vidéo)',
    caption_fr VARCHAR(255) NULL COMMENT 'légende, sert aussi de texte alternatif',
    caption_ar VARCHAR(255) NULL,
    video_upload_date DATE NULL COMMENT 'date de mise en ligne de la vidéo (VideoObject)',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_program_media_program (agency_id, program_id, sort_order),
    CONSTRAINT fk_program_media_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_program_media_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Preuves : avis clients réellement reçus, saisis par l'équipe ---------
-- Publiable seulement avec le consentement de l'auteur (consent_given).
CREATE TABLE program_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    program_id BIGINT UNSIGNED NOT NULL,
    trip_id BIGINT UNSIGNED NULL COMMENT 'départ concerné (facultatif)',
    author_name VARCHAR(120) NOT NULL,
    author_city VARCHAR(100) NULL,
    rating TINYINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL DEFAULT 'ar' COMMENT 'langue du texte de l avis',
    review_date DATE NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'accord de l auteur pour la publication',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_program_reviews_program (agency_id, program_id, is_published),
    CONSTRAINT chk_program_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_program_reviews_consent CHECK (is_published = FALSE OR consent_given = TRUE),
    CONSTRAINT fk_program_reviews_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_program_reviews_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    CONSTRAINT fk_program_reviews_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
    CONSTRAINT fk_program_reviews_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
