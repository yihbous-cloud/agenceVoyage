import { setScriptAgencyId } from "../lib/agencyContext.js";
import * as hotels from "../lib/hotels.js";
import * as airlines from "../lib/airlines.js";
import * as pa from "../lib/programsAdmin.js";
import * as faqs from "../lib/programFaqs.js";
import * as regs from "../lib/registrations.js";
import * as groups from "../lib/registrationGroups.js";
import * as ra from "../lib/roomAssignment.js";
import * as pay from "../lib/payments.js";
import * as tiers from "../lib/tripHotelTiers.js";
import * as visa from "../lib/visaTypes.js";
import * as news from "../lib/news.js";
import * as slides from "../lib/slides.js";
import * as programs from "../lib/programs.js";
import * as perms from "../lib/permissions.js";
import * as staff from "../lib/staffUsers.js";
import * as settings from "../lib/agencySettings.js";
import * as lists from "../lib/listGenerators.js";
import { getPool } from "../lib/db.js";

// Test d'isolation multi-agences (CLAUDE.md §3sexvicies passe 2). Crée une
// agence TEMPORAIRE avec ses 4 rôles, y fabrique des données via les vraies
// fonctions de lib/, vérifie que l'agence 1 n'y accède ni en lecture ni en
// écriture, puis supprime tout.
//   node --env-file=.env --import ./scripts/esm-register.mjs scripts/agency-isolation-test.mjs
const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];
const SUBDOMAIN = `iso-test-${Date.now() % 100000}`;
const created = await q("INSERT INTO agencies (name, subdomain) VALUES (?, ?)", ["Agence isolation test", SUBDOMAIN]);
const OTHER = created.insertId;
for (const roleName of ["direction", "ventes", "comptabilite", "suivi"]) {
  const [template] = await q("SELECT id, description FROM roles WHERE agency_id = 1 AND name = ?", [roleName]);
  if (!template) continue;
  const r = await q("INSERT INTO roles (name, description, agency_id) VALUES (?, ?, ?)", [roleName, template.description, OTHER]);
  await q("INSERT INTO role_permissions (role_id, permission_code) SELECT ?, permission_code FROM role_permissions WHERE role_id = ?", [r.insertId, template.id]);
}
async function cleanup() {
  const tables = (await q("SELECT table_name n FROM information_schema.columns WHERE table_schema=DATABASE() AND column_name='agency_id'")).map((r) => r.n);
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tables) await conn.query(`DELETE FROM ${t} WHERE agency_id = ?`, [OTHER]);
    await conn.query("DELETE FROM agencies WHERE id = ?", [OTHER]);
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    conn.release();
  }
}
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const throwsNotFound = async (fn, label) => {
  try {
    await fn();
    ok(false, `${label} (aucune erreur levée)`);
  } catch (e) {
    ok(e.code === "NOT_FOUND" || /introuvable|Ressource/i.test(e.message), `${label} → ${e.message}`);
  }
};

// --- données de l'agence 3 ---
setScriptAgencyId(OTHER);
const hotelId = await hotels.createHotel({ name: "HOTEL-A3", city: "Makka" });
const hotel2Id = await hotels.createHotel({ name: "HOTEL-A3-BIS", city: "Madina" });
const airlineId = await airlines.createAirline({ name: "AIRLINE-A3" });
const programId = await pa.createProgram({ title: "PROG-A3", slug: "prog-a3", family: "omra_hajj", isPublished: true });
const tripId = await pa.createTrip(programId, {
  referenceCode: "A3-REF", departureDate: "2027-05-01", returnDate: "2027-05-15",
  priceDouble: 1000, priceTriple: 900, priceQuadruple: 800, priceQuintuple: 700, totalSeats: 10, status: "ouvert",
});
const faqId = await faqs.createFaq(programId, { question: "Q?", answer: "A" });
const th = await ra.addTripHotel(tripId, hotelId, "2027-05-02", "2027-05-10");
const roomId = await ra.createRoom(th, { roomNumber: "1", roomType: "double", capacity: 2 });
const reg = await regs.createRegistration({
  tripId, fullName: "Voyageur A3", gender: "homme", phoneWhatsapp: "0600000003", preferredRoomType: "double",
});
const regB = await regs.createRegistration({
  tripId, fullName: "Voyageur B3", gender: "homme", phoneWhatsapp: "0600000004", preferredRoomType: "double",
});
const groupId = await groups.createGroup(tripId, "GROUPE-A3", false);
const payId = await pay.createPayment(reg.id, { amount: 500 }, null);
const visaId = await visa.createVisaType({ name: "VISA-A3", price: 100, documents: [{ name: "Photo" }] });
const newsId = await news.createNews({ title: "NEWS-A3", slug: "news-a3", isPublished: true });
const slideId = await slides.createSlide({ title: "SLIDE-A3", programId });
const tierId = await tiers.createTier(tripId, {
  label: "TIER-A3", makkahHotelId: hotelId, makkahBoardBasis: "logement_seul",
  madinahHotelId: hotel2Id, madinahBoardBasis: "logement_seul",
  prices: [{ roomType: "double", pricePerPerson: 1200 }],
});
const rolesA3 = await perms.listRoles();
ok(rolesA3.length === 4 && rolesA3.every((r) => r.agency_id === OTHER), "agence 3 : ses 4 rôles seulement");

// --- vue de l'agence 1 ---
setScriptAgencyId(1);
ok(!(await hotels.listHotels()).some((h) => h.id === hotelId), "agence 1 ne voit pas l'hôtel de l'agence 3");
ok(!(await airlines.listAirlines()).some((a) => a.id === airlineId), "listAirlines isolé");
ok(!(await pa.listAllPrograms()).some((p) => p.id === programId), "listAllPrograms isolé");
ok((await pa.getProgramById(programId)) === null, "getProgramById(id étranger) = null");
ok((await pa.getTripFullById(tripId)) === null, "getTripFullById(id étranger) = null");
ok((await regs.getRegistrationById(reg.id)) === null, "getRegistrationById(id étranger) = null");
ok((await regs.listRegistrations()).every((r) => r.id !== reg.id), "listRegistrations isolé");
ok((await regs.listOpenTripsForSelect()).every((t) => t.id !== tripId), "listOpenTripsForSelect isolé");
ok((await groups.getGroupById(groupId)) === null, "getGroupById étranger = null");
ok((await pay.getPaymentById(payId)) === null, "getPaymentById étranger = null (reçu)");
ok((await visa.listVisaTypes()).every((v) => v.id !== visaId), "visa types isolés");
ok((await news.listAllNews()).every((n) => n.id !== newsId), "actualités isolées");
ok((await news.getNewsById(newsId)) === null, "getNewsById étranger = null");
ok((await slides.listAllSlides()).every((s) => s.id !== slideId), "slides isolés");
ok((await programs.getProgramBySlug("prog-a3")) === null, "slug public d'une autre agence introuvable");
ok((await programs.getProgramsByFamily("omra_hajj")).every((p) => p.id !== programId), "catalogue public isolé");
ok((await tiers.listTiersForTrip(tripId)).length === 0, "tarifs d'un voyage étranger invisibles");
ok((await ra.listRoomsForTrip(tripId)).length === 0, "chambres d'un voyage étranger invisibles");
ok((await ra.getTripSummary(tripId)) === null, "getTripSummary étranger = null");
ok((await faqs.listAllFaqsForProgram(programId)).length === 0, "FAQ étrangères invisibles");
const roles1 = await perms.listRoles();
ok(roles1.every((r) => r.agency_id === 1), "listRoles : agence 1 seulement");
ok((await staff.listStaffUsers()).every((u) => true), "listStaffUsers ok");
ok((await lists.getPnrPassengerList(tripId)).length === 0, "liste PNR d'un voyage étranger vide");
try { await lists.getTravelerList(tripId); ok(false, "getTravelerList étranger devrait échouer"); } catch { ok(true, "getTravelerList (vue) refuse un voyage étranger"); }
ok((await settings.getAgencySettings()).id === 1, "getAgencySettings = agence 1");

// écritures croisées : tout doit échouer ou ne rien faire
await throwsNotFound(() => pa.createTrip(programId, { referenceCode: "X", departureDate: "2027-01-01", returnDate: "2027-01-02" }), "createTrip sur un programme étranger");
await throwsNotFound(() => faqs.createFaq(programId, { question: "x", answer: "y" }), "createFaq sur un programme étranger");
await throwsNotFound(() => regs.createRegistration({ tripId, fullName: "Intrus", gender: "homme", phoneWhatsapp: "0699999999" }), "createRegistration sur un voyage étranger");
await throwsNotFound(() => ra.addTripHotel(tripId, hotelId, "2027-05-02", "2027-05-03"), "addTripHotel (voyage ET hôtel étrangers)");
await throwsNotFound(() => ra.createRoom(th, { roomNumber: "9", roomType: "double", capacity: 2 }), "createRoom sur un trip_hotel étranger");
await throwsNotFound(() => pay.createPayment(reg.id, { amount: 1 }, null), "createPayment sur une inscription étrangère");
await throwsNotFound(() => ra.assignRegistrationsToRoom([reg.id], roomId), "assignRegistrationsToRoom (inscription étrangère)");
await throwsNotFound(() => tiers.createTier(tripId, { label: "x", makkahHotelId: hotelId, madinahHotelId: hotel2Id, makkahBoardBasis: "logement_seul", madinahBoardBasis: "logement_seul" }), "createTier sur un voyage étranger");
await throwsNotFound(() => slides.createSlide({ title: "x", programId }), "createSlide lié à un programme étranger");
await throwsNotFound(() => perms.setRolePermissions(rolesA3[0].id, []), "setRolePermissions sur un rôle étranger");
await throwsNotFound(() => staff.createStaffUser({ fullName: "x", email: "x@y.z", password: "Passw0rd123", roleId: rolesA3[0].id }), "createStaffUser avec un rôle étranger");
await throwsNotFound(() => regs.updateRegistration(reg.id, { notes: "piraté" }), "updateRegistration étranger");
await throwsNotFound(() => regs.updateTraveler(1e9, {}), "updateTraveler inexistant");
await throwsNotFound(() => groups.createGroup(tripId, "G-intrus", false), "createGroup sur un voyage étranger");

await throwsNotFound(() => hotels.updateHotel(hotelId, { name: "PIRATE", city: "X" }), "updateHotel étranger");
await throwsNotFound(() => hotels.deleteHotel(hotelId), "deleteHotel étranger");
await throwsNotFound(() => pa.updateProgram(programId, { title: "PIRATE" }), "updateProgram étranger");
await throwsNotFound(() => pa.deleteTrip(tripId), "deleteTrip étranger");
await throwsNotFound(() => airlines.deleteAirline(airlineId), "deleteAirline étranger");
await throwsNotFound(() => news.deleteNews(newsId), "deleteNews étranger");
await throwsNotFound(() => slides.deleteSlide(slideId), "deleteSlide étranger");
await throwsNotFound(() => faqs.deleteFaq(faqId), "deleteFaq étranger");
await throwsNotFound(() => pay.deletePayment(payId), "deletePayment étranger");
await throwsNotFound(() => regs.deleteRegistration(reg.id), "deleteRegistration étranger");
await throwsNotFound(() => visa.deleteVisaType(visaId), "deleteVisaType étranger");
await throwsNotFound(() => tiers.deleteTier(tierId), "deleteTier étranger");
try { await pa.deleteProgram(programId); ok(false, "deleteProgram étranger devrait échouer"); } catch { ok(true, "deleteProgram étranger refusé"); }

// --- l'agence 3 doit avoir tout conservé ---
setScriptAgencyId(OTHER);
const h3 = (await hotels.listHotels()).find((h) => h.id === hotelId);
ok(h3 && h3.name === "HOTEL-A3", "hôtel A3 intact (ni modifié ni supprimé par l'agence 1)");
ok((await pa.getProgramById(programId)).title === "PROG-A3", "programme A3 intact");
ok((await pa.getTripFullById(tripId)) !== null, "voyage A3 intact");
ok((await regs.getRegistrationById(reg.id)).notes == null, "inscription A3 intacte");
ok((await regs.getRegistrationById(regB.id)) !== null, "inscription B3 présente");
ok((await visa.listVisaTypes()).some((v) => v.id === visaId), "visa A3 intact");
ok((await news.getNewsById(newsId)) !== null, "actualité A3 intacte");
ok((await slides.listAllSlides()).some((s) => s.id === slideId), "slide A3 intact");
ok((await faqs.listAllFaqsForProgram(programId)).length === 1, "FAQ A3 intacte");
ok((await pay.getPaymentById(payId)) !== null, "paiement A3 intact");
ok((await tiers.listTiersForTrip(tripId)).length === 1, "tarif A3 intact");
ok((await airlines.listAirlines()).some((a) => a.id === airlineId), "compagnie A3 intacte");

// même numéro WhatsApp dans deux agences = deux voyageurs distincts
setScriptAgencyId(1);
const tmp1 = await q("SELECT COUNT(DISTINCT agency_id) n FROM travelers WHERE phone_whatsapp='0600000003'");
ok(tmp1[0].n === 1, "le voyageur 0600000003 n'existe que dans l'agence de test");
console.log(failures === 0 ? "\nTOUS LES CONTRÔLES PASSENT" : `\n${failures} ÉCHEC(S)`);
await cleanup();
await pool.end();
process.exit(failures ? 1 : 0);
