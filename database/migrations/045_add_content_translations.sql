-- =====================================================================
-- MIGRATION 045 — Référencement, phase 1 vague 1B : contenu FR/AR par entité
-- =====================================================================
-- Cahier des charges « Référencement global » (CLAUDE.md §3centquinzequadragies) :
-- versions arabe ET française complètes des programmes, FAQ, actualités et
-- diapositives. Les colonnes existantes restent le contenu dans la LANGUE
-- PRINCIPALE de l'entité (content_locale) ; les tables *_translations
-- portent l'autre langue (l'anglais pourra s'y ajouter en phase 2). Le slug
-- reste unique et latin, commun à toutes les langues (décision du 12/10/2026).
-- Les FAQ suivent la langue principale de leur programme.
-- Remplissage initial de content_locale : scripts/backfill-content-locale.mjs.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE programs
  ADD COLUMN content_locale ENUM('ar', 'fr') NOT NULL DEFAULT 'ar'
    COMMENT 'Langue des champs de contenu de cette ligne ; l''autre langue est dans program_translations (migration 045)' AFTER slug;

ALTER TABLE news_posts
  ADD COLUMN content_locale ENUM('ar', 'fr') NOT NULL DEFAULT 'ar'
    COMMENT 'Langue des champs de contenu de cette ligne ; l''autre langue est dans news_translations (migration 045)' AFTER slug;

ALTER TABLE slides
  ADD COLUMN content_locale ENUM('ar', 'fr') NOT NULL DEFAULT 'ar'
    COMMENT 'Langue des textes de cette ligne ; l''autre langue est dans slide_translations (migration 045)' AFTER title;

CREATE TABLE program_translations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    program_id BIGINT UNSIGNED NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL,
    title VARCHAR(200) NULL,
    short_description VARCHAR(500) NULL,
    full_description TEXT NULL,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_program_translation (program_id, locale),
    CONSTRAINT fk_program_translations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_program_translations_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE program_faq_translations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    faq_id BIGINT UNSIGNED NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL,
    question VARCHAR(300) NULL,
    answer TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_faq_translation (faq_id, locale),
    CONSTRAINT fk_faq_translations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_faq_translations_faq FOREIGN KEY (faq_id) REFERENCES program_faqs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE news_translations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    news_id BIGINT UNSIGNED NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL,
    title VARCHAR(200) NULL,
    excerpt VARCHAR(500) NULL,
    content TEXT NULL,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_news_translation (news_id, locale),
    CONSTRAINT fk_news_translations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_news_translations_news FOREIGN KEY (news_id) REFERENCES news_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE slide_translations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    slide_id BIGINT UNSIGNED NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL,
    title VARCHAR(150) NULL,
    subtitle VARCHAR(300) NULL,
    button_text VARCHAR(50) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_slide_translation (slide_id, locale),
    CONSTRAINT fk_slide_translations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_slide_translations_slide FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
