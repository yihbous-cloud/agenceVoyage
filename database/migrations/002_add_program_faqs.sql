-- =====================================================================
-- MIGRATION 002 — FAQ par programme
-- =====================================================================
-- Additive et non destructive : nouvelle table uniquement, aucune colonne
-- existante modifiée. Contenu vide par défaut (pas de FAQ pré-remplie) —
-- alimenté ensuite depuis l'admin. Sert le SEO (FAQPage JSON-LD) et le GEO
-- (réponses directes citables) — voir PLAN-SEO-GEO-AIO.md §4.4/§5.
-- =====================================================================

SET NAMES utf8mb4;

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
