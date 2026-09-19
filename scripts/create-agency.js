#!/usr/bin/env node
/**
 * Crée une nouvelle agence (multi-agences, CLAUDE.md §3sexvicies) et lui
 * seed les rôles de base + leur matrice de permissions, copiés de l'agence 1.
 * Usage : node scripts/create-agency.js "Nom de l'agence" sous-domaine
 * Création manuelle volontaire pour l'instant (pas d'interface super-admin).
 * Ensuite : node scripts/create-staff-user.js "Nom" email mdp direction <agencyId>
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const [name, subdomain] = process.argv.slice(2);

  if (!name || !subdomain || !/^[a-z0-9-]{1,63}$/.test(subdomain)) {
    console.error('Usage: node scripts/create-agency.js "Nom de l\'agence" sous-domaine');
    console.error("Sous-domaine : minuscules, chiffres et tirets uniquement (1 à 63 caractères).");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "golden_fantastic",
  });

  try {
    await connection.beginTransaction();

    const [agencyResult] = await connection.execute(
      `INSERT INTO agencies (name, subdomain) VALUES (?, ?)`,
      [name, subdomain]
    );
    const agencyId = agencyResult.insertId;

    // Rôles de base = ceux de l'agence 1 (direction/ventes/comptabilite/suivi,
    // hors rôles personnalisés créés par cette agence), avec leurs permissions.
    const baseRoles = ["direction", "ventes", "comptabilite", "suivi"];
    for (const roleName of baseRoles) {
      const [[template]] = await connection.execute(
        `SELECT id, description FROM roles WHERE agency_id = 1 AND name = ?`,
        [roleName]
      );
      if (!template) continue;

      const [roleResult] = await connection.execute(
        `INSERT INTO roles (name, description, agency_id) VALUES (?, ?, ?)`,
        [roleName, template.description, agencyId]
      );
      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_code)
         SELECT ?, permission_code FROM role_permissions WHERE role_id = ?`,
        [roleResult.insertId, template.id]
      );
    }

    await connection.commit();
    console.log(`Agence créée : id ${agencyId}, sous-domaine "${subdomain}".`);
    console.log(
      `Étape suivante : node scripts/create-staff-user.js "Nom" email mdp direction ${agencyId}`
    );
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
