-- Multi-agences, passe 2 : agency_id n'a plus de valeur par défaut.
-- Chaque INSERT fournit désormais explicitement l'agence courante
-- (lib/agencyContext.js, resolveAgencyId) ; le DEFAULT 1 de la passe 1 ne
-- servait qu'à ne pas casser les INSERT non encore retrofités, et masquait
-- un oubli en rattachant silencieusement la ligne à l'agence 1. Sans défaut,
-- un INSERT qui oublie l'agence échoue bruyamment au lieu de fuiter.
ALTER TABLE agency_social_links ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE airlines ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE contact_messages ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE flight_booking_passengers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE flight_bookings ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE news_posts ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE program_faqs ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE program_hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE programs ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registration_groups ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registration_hotel_preferences ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registration_room_assignments ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE registrations ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE roles ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE rooms ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE services ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE slides ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE staff_users ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE traveler_phone_numbers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE travelers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trip_hotel_tier_prices ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trip_hotel_tiers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trip_hotels ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trip_meal_offers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE trips ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_service_documents ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_service_requests ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_type_documents ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE visa_types ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_messages_log ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_qa_templates ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE whatsapp_reminders ALTER COLUMN agency_id DROP DEFAULT;
