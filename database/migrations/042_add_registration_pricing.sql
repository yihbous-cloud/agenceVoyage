-- Formules partielles (vol seul / hébergement seul), réductions et gratuités
-- par inscription, plafond de réduction par voyage (CLAUDE.md).

ALTER TABLE trips
  ADD COLUMN price_flight_only DECIMAL(10,2) NULL COMMENT 'Prix par personne du billet seul ; hébergement seul = prix complet - ce prix (migration 042)' AFTER price_quintuple,
  ADD COLUMN discount_cap DECIMAL(10,2) NULL COMMENT 'Plafond de réduction (MAD) par voyageur, visible par l''administrateur seulement ; NULL = réduction réservée à l''administrateur (migration 042)' AFTER price_flight_only;

ALTER TABLE registrations
  ADD COLUMN package_type ENUM('complet', 'vol_seul', 'hebergement_seul') NOT NULL DEFAULT 'complet' AFTER selected_tier_id,
  ADD COLUMN base_price DECIMAL(10,2) NULL COMMENT 'Prix de la formule avant réduction (migration 042)' AFTER package_type,
  ADD COLUMN discount_type ENUM('aucune', 'montant', 'pourcentage', 'gratuite') NOT NULL DEFAULT 'aucune' AFTER base_price,
  ADD COLUMN discount_value DECIMAL(10,2) NULL AFTER discount_type,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Réduction effective en MAD' AFTER discount_value,
  ADD COLUMN discount_reason VARCHAR(40) NULL AFTER discount_amount,
  ADD COLUMN discount_note VARCHAR(255) NULL AFTER discount_reason,
  ADD COLUMN discount_by_staff_id BIGINT UNSIGNED NULL AFTER discount_note,
  ADD COLUMN discount_at DATETIME NULL AFTER discount_by_staff_id,
  ADD CONSTRAINT fk_registrations_discount_by FOREIGN KEY (discount_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('remises.admin', 'Fixer le plafond de réduction, accorder des réductions au-delà et les gratuités', 'Paiements & finances', 50);
-- Direction : déjà garantie au niveau code (aucune ligne nécessaire).

-- Un voyageur « hébergement seul » (sans billet) n'apparaît plus sur la liste compagnie.
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
WHERE reg.status IN ('confirme', 'paye_partiel', 'paye_complet')
  AND reg.package_type != 'hebergement_seul';
