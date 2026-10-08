-- Multi-agences, passe 2 : agency_settings (ligne unique) cesse d'être lue
-- par le code, au profit de la table `agencies` (une ligne par agence).
-- La passe 1 n'avait copié agency_settings qu'UNE fois, à la création de
-- `agencies` : tout ce qui a été modifié depuis dans /admin/parametres
-- (logo, téléphone...) n'existe que dans agency_settings. On le recopie une
-- dernière fois pour l'agence historique (id 1) ; agency_settings reste en
-- base, dépréciée (jamais plus lue ni écrite).
UPDATE agencies a
JOIN agency_settings s ON s.id = 1
SET a.name = s.name, a.logo_url = s.logo_url, a.address = s.address, a.city = s.city,
    a.phone = s.phone, a.whatsapp = s.whatsapp, a.email = s.email, a.website = s.website,
    a.rc = s.rc, a.tax_id = s.tax_id, a.ice = s.ice, a.footer_note = s.footer_note
WHERE a.id = 1;
