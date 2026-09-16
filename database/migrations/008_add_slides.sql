-- =====================================================================
-- MIGRATION 008 — Slider (hero) de la page d'accueil
-- =====================================================================
-- Diapositives du slider animé de l'accueil, gérées depuis /admin/slider.
-- Une diapositive peut soit être liée à un programme existant (program_id
-- — le lien public /omra-hajj|/voyages-organises/[slug] est alors dérivé
-- dynamiquement de ce programme, jamais figé), soit pointer vers une URL
-- libre (button_link, utilisé uniquement quand program_id est NULL).
-- =====================================================================

SET NAMES utf8mb4;

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

-- Nouvelle permission (système de permissions dynamique, voir CLAUDE.md
-- §3undecies) — direction uniquement par défaut (contenu marketing de
-- l'accueil, même famille que actualites.manage/programmes.manage).
INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('slider.manage', 'Gérer le slider de l''accueil', 'Contenu public', 15);
