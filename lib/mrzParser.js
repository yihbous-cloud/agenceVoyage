// Parseur MRZ (Machine Readable Zone, norme ICAO 9303, format passeport
// TD3 — 2 lignes de 44 caractères) pour le remplissage automatique depuis
// un lecteur de passeport USB (voir CLAUDE.md). Implémentation maison, zéro
// dépendance externe, cohérent avec le reste du projet.

const CHAR_VALUES = (() => {
  const map = {};
  for (let i = 0; i <= 9; i++) map[String(i)] = i;
  for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = i + 10;
  map["<"] = 0;
  return map;
})();

const WEIGHTS = [7, 3, 1];

function computeCheckDigit(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    const value = CHAR_VALUES[str[i]];
    if (value === undefined) return null;
    sum += value * WEIGHTS[i % 3];
  }
  return sum % 10;
}

// Le MRZ code l'année sur 2 chiffres sans siècle explicite (norme ICAO) —
// une naissance lointaine (>20 ans dans le "futur" par rapport à
// aujourd'hui) est donc supposée au XXe siècle, le reste au XXIe.
function parseMrzDate(yyMMdd) {
  if (!/^\d{6}$/.test(yyMMdd)) return null;
  const yy = Number(yyMMdd.slice(0, 2));
  const mm = yyMMdd.slice(2, 4);
  const dd = yyMMdd.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const currentYY = new Date().getFullYear() % 100;
  const century = yy > currentYY + 20 ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

function cleanNames(field) {
  return field.replace(/</g, " ").trim().replace(/\s+/g, " ");
}

// Retourne { fullName, passportNumber, gender, dateOfBirth,
// passportExpiryDate, nationality, valid, warnings } si les 2 dernières
// lignes non vides du texte scanné/collé ressemblent à un MRZ passeport
// (TD3), sinon null (format non reconnu — pas un rejet bruyant, le champ
// de scan reste silencieux tant que la saisie est incomplète).
export function parsePassportMrz(rawText) {
  const lines = (rawText || "")
    .split("\n")
    .map((l) => l.trim().toUpperCase())
    .filter(Boolean);

  if (lines.length < 2) return null;
  const [line1, line2] = lines.slice(-2);

  if (line1.length !== 44 || line2.length !== 44 || line1[0] !== "P") {
    return null;
  }

  const namesField = line1.slice(5).replace(/<+$/, "");
  const [surname = "", givenNames = ""] = namesField.split("<<");
  const fullName = cleanNames(`${givenNames} ${surname}`);

  const passportNumberRaw = line2.slice(0, 9);
  const passportNumber = passportNumberRaw.replace(/</g, "").trim();
  const passportCheckDigit = line2[9];
  const nationality = line2.slice(10, 13).replace(/</g, "");
  const birthDateRaw = line2.slice(13, 19);
  const birthCheckDigit = line2[19];
  const sex = line2[20];
  const expiryDateRaw = line2.slice(21, 27);
  const expiryCheckDigit = line2[27];

  if (!passportNumber || !fullName) return null;

  const warnings = [];
  if (computeCheckDigit(passportNumberRaw) !== Number(passportCheckDigit)) {
    warnings.push("numéro de passeport");
  }
  if (computeCheckDigit(birthDateRaw) !== Number(birthCheckDigit)) {
    warnings.push("date de naissance");
  }
  if (computeCheckDigit(expiryDateRaw) !== Number(expiryCheckDigit)) {
    warnings.push("date d'expiration");
  }

  return {
    fullName,
    passportNumber,
    gender: sex === "M" ? "homme" : sex === "F" ? "femme" : "",
    dateOfBirth: parseMrzDate(birthDateRaw),
    passportExpiryDate: parseMrzDate(expiryDateRaw),
    nationality,
    valid: warnings.length === 0,
    warnings,
  };
}
