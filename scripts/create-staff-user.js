#!/usr/bin/env node
/**
 * Crée ou met à jour un utilisateur interne (staff_users).
 * Usage : node scripts/create-staff-user.js "Nom complet" email@exemple.com motdepasse role
 * Rôles valides : direction, ventes, comptabilite, suivi
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function main() {
  const [fullName, email, password, role] = process.argv.slice(2);

  if (!fullName || !email || !password || !role) {
    console.error(
      "Usage: node scripts/create-staff-user.js \"Nom complet\" email@exemple.com motdepasse role"
    );
    console.error("Rôles valides : direction, ventes, comptabilite, suivi");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "golden_fantastic",
  });

  const [roleRows] = await connection.execute(
    "SELECT id FROM roles WHERE name = ?",
    [role]
  );

  if (roleRows.length === 0) {
    console.error(`Rôle inconnu : ${role}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await connection.execute(
    `INSERT INTO staff_users (full_name, email, password_hash, role_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), role_id = VALUES(role_id)`,
    [fullName, email, passwordHash, roleRows[0].id]
  );

  console.log(`Utilisateur créé/mis à jour : ${email} (${role})`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
