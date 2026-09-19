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
