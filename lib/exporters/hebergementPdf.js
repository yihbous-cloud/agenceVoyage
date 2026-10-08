import PDFDocument from "pdfkit";

const GOLD = "#B08D2B";
const MUTED = "#444444";

// Colonnes de chaque sous-tableau (un sous-tableau par hôtel, voir
// buildHebergementPdfBuffer) — pas de colonne Hôtel/Packs/Groupe : l'hôtel
// est déjà annoncé dans le sous-titre au-dessus du tableau, le pack et le
// groupe ne sont plus affichés du tout (demande explicite). "checkbox" et
// "observations" ne lisent aucune donnée : dessinées à part dans drawLine
// (case à cocher vide / cellule vide) — colonnes à cocher/remplir à la main
// sur le PDF imprimé.
const COLUMNS = [
  { key: "checkbox", header: "", ratio: 0.08 },
  { key: "room_number", header: "N° Chambre", ratio: 0.14 },
  { key: "traveler_name", header: "Voyageur", ratio: 0.27 },
  { key: "traveler_phone", header: "Tél", ratio: 0.19 },
  { key: "observations", header: "Observations", ratio: 0.32 },
];
const ROOM_NUMBER_INDEX = COLUMNS.findIndex((c) => c.key === "room_number");

function formatDateFr(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

// Contrairement à cell() des autres exporteurs (qui affiche "—" pour une
// valeur manquante), une chambre vide ou un téléphone non renseigné reste
// une chaîne VIDE ici — ce tableau sert de document de travail imprimable,
// une cellule vide invite à la compléter à la main plutôt qu'à afficher un
// tiret qui laisserait croire que l'information a été vérifiée et manque.
function cell(value) {
  return value == null ? "" : String(value);
}

// Regroupe les lignes déjà triées par chambre (voir getHebergementRoomOccupants,
// lib/listGenerators.js) en blocs contigus — un bloc = une chambre + tous ses
// occupants (1 ligne minimum, une chambre vide n'a qu'un occupant fictif à
// null). Base de la fusion de la cellule N° Chambre (demande explicite) :
// chaque bloc n'affiche son numéro de chambre qu'une fois, centré
// verticalement sur la hauteur totale du bloc.
function groupRoomBlocks(rows) {
  const blocks = [];
  let current = null;
  for (const row of rows) {
    if (!current || current.room_number !== row.room_number) {
      current = { room_number: row.room_number, occupants: [] };
      blocks.push(current);
    }
    current.occupants.push(row);
  }
  return blocks;
}

// Liste d'hébergement — PDF portrait, une page par ville (Makka puis Madina,
// puis toute autre ville — ordre déjà appliqué par la requête SQL, voir
// getHebergementRoomOccupants, lib/listGenerators.js). Sur chaque page, le
// tableau est éclaté en plusieurs sous-tableaux, un par HÔTEL. Chaque page
// répète l'en-tête (infos du programme + nom de la ville en grand) et le
// pied de page (nom de l'agence, lien vers la fiche programme publique,
// pagination). Exporteur dédié plutôt qu'une extension de buildPdfBuffer
// (lib/exporters/pdf.js) : mise en page trop spécifique pour rester
// générique aux 3 autres listes, qui restent inchangées.
//
// rowsByCity: [{ city, hotelGroups: [{ hotel_name, rows: [{
//   room_number, traveler_name, traveler_phone }, ...] }, ...] }, ...]
export function buildHebergementPdfBuffer({ trip, originLabel, destinationLabel, programUrl, agencyName, rowsByCity }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = COLUMNS.map((c) => c.ratio * contentWidth);
    const roomColX = doc.page.margins.left + colWidths.slice(0, ROOM_NUMBER_INDEX).reduce((a, b) => a + b, 0);
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 30;

    // ⚠️ Piège pdfkit rencontré : les cellules dessinées avec un x explicite
    // (drawLine, drawTableHeader) laissent `doc.x` sur la dernière colonne
    // écrite (souvent tout à droite) une fois la boucle terminée. Un
    // `.text()` SANS x explicite juste après (ex. le sous-titre du prochain
    // hôtel) hérite alors de ce `doc.x` résiduel au lieu de repartir de la
    // marge gauche, produisant un titre visiblement décalé/mal aligné.
    // Toutes les lignes "pleine largeur" ci-dessous (en-tête de page,
    // sous-titre hôtel, message "aucune chambre") passent donc désormais un
    // x explicite (`doc.page.margins.left`), jamais l'ambiant.

    function drawPageHeader(cityName) {
      const left = doc.page.margins.left;
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#000").text(trip.program_title, left, doc.y, {
        width: contentWidth,
      });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(MUTED)
        .text(
          `${trip.reference_code} · Départ ${formatDateFr(trip.departure_date)} → Retour ${formatDateFr(
            trip.return_date
          )}`,
          left,
          doc.y,
          { width: contentWidth }
        );
      doc.text(`Aéroport de départ : ${originLabel}`, left, doc.y, { width: contentWidth });
      doc.text(`Aéroport d'arrivée : ${destinationLabel}`, left, doc.y, { width: contentWidth });
      doc.fillColor("#000");
      doc.moveDown(0.5);
      doc
        .moveTo(left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .lineWidth(1.5)
        .strokeColor(GOLD)
        .stroke()
        .strokeColor("#000")
        .lineWidth(1);
      doc.moveDown(0.7);

      doc.font("Helvetica-Bold").fontSize(24).fillColor(GOLD).text(cityName, left, doc.y);
      doc.fillColor("#000");
      doc.moveDown(0.8);
    }

    function drawHotelSubHeading(hotelName) {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#000")
        .text(hotelName, doc.page.margins.left, doc.y, { width: contentWidth });
      doc.moveDown(0.3);
    }

    function drawTableHeader() {
      const y = doc.y;
      let x = doc.page.margins.left;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
      COLUMNS.forEach((c, i) => {
        doc.text(c.header, x, y, { width: colWidths[i] - 4 });
        x += colWidths[i];
      });
      doc.y = y + 14;
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor(GOLD)
        .stroke()
        .strokeColor("#000");
      doc.moveDown(0.4);
    }

    const CHECKBOX_SIZE = 8;

    // Hauteur d'une ligne occupant (sans la colonne N° Chambre, dessinée à
    // part une fois par bloc) — utilisée à la fois pour mesurer un bloc
    // avant de décider d'une coupure de page et pour dessiner chaque ligne.
    function lineHeight(row) {
      let h = 11;
      COLUMNS.forEach((c, i) => {
        if (c.key === "checkbox" || c.key === "room_number") return;
        const value = cell(row[c.key]) || " ";
        h = Math.max(h, doc.heightOfString(value, { width: colWidths[i] - 6 }));
      });
      return h + 6;
    }

    // Dessine une ligne occupant (checkbox, voyageur, tél, observations) —
    // PAS la colonne N° Chambre, gérée séparément par drawRoomBlock pour la
    // fusion visuelle. `globalIndex` pilote uniquement l'alternance zébrée
    // (continue sur tout le tableau de l'hôtel, pas remise à zéro par bloc).
    function drawLine(row, height, globalIndex) {
      const y = doc.y;
      if (globalIndex % 2 === 1) {
        doc.rect(doc.page.margins.left, y - 2, contentWidth, height - 2).fill("#F7F3E8");
        doc.fillColor("#000");
      }

      let x = doc.page.margins.left;
      COLUMNS.forEach((c, i) => {
        if (c.key === "checkbox") {
          // Case à cocher vide — une par ligne (demande explicite), y
          // compris à l'intérieur d'une chambre à plusieurs occupants.
          doc
            .rect(x + (colWidths[i] - CHECKBOX_SIZE) / 2, y + 1, CHECKBOX_SIZE, CHECKBOX_SIZE)
            .strokeColor(MUTED)
            .stroke()
            .strokeColor("#000");
        } else if (c.key !== "room_number") {
          const value = cell(row[c.key]);
          if (value) doc.text(value, x + 3, y, { width: colWidths[i] - 6 });
        }
        x += colWidths[i];
      });
      doc.y = y + height;
    }

    // Dessine un bloc chambre complet : une ligne par occupant (case à
    // cocher/voyageur/tél/observations), puis le N° Chambre une seule fois,
    // centré verticalement sur la hauteur totale du bloc — la "fusion de
    // cellule" demandée, sans dépendre d'une vraie grille (le tableau n'a de
    // toute façon aucun trait de séparation entre lignes, seul le fond
    // zébré distingue les lignes).
    function drawRoomBlock(block, startIndex) {
      const heights = block.occupants.map(lineHeight);
      const blockTop = doc.y;

      block.occupants.forEach((row, i) => {
        drawLine(row, heights[i], startIndex + i);
      });

      const blockHeight = heights.reduce((a, b) => a + b, 0);
      const roomNumber = cell(block.room_number);
      if (roomNumber) {
        const textHeight = doc.heightOfString(roomNumber, { width: colWidths[ROOM_NUMBER_INDEX] - 6 });
        const centeredY = blockTop + Math.max(0, (blockHeight - textHeight) / 2);
        doc.font("Helvetica").fontSize(9).fillColor("#000");
        doc.text(roomNumber, roomColX + 3, centeredY, { width: colWidths[ROOM_NUMBER_INDEX] - 6 });
      }

      // ⚠️ Piège pdfkit : un `.text()` avec un y explicite déplace `doc.y` à
      // LA POSITION DE CE TEXTE, pas à la position la plus basse déjà
      // atteinte — comme le numéro de chambre est dessiné centré (donc plus
      // haut que le bas réel du bloc dès que celui-ci a plusieurs occupants),
      // `doc.y` se retrouvait remonté au milieu du bloc après ce dessin. Le
      // contenu suivant (ligne du bloc suivant, ou titre du prochain hôtel)
      // repartait alors de cette position trop haute et se superposait aux
      // dernières lignes déjà dessinées — constaté en conditions réelles
      // (capture d'écran : "ANJOUM" chevauchant B4/IHBOUS YASSINE, "401"
      // chevauchant C3/Wafae). Recalé explicitement sur le vrai bas du bloc.
      doc.y = blockTop + blockHeight;
    }

    // Espace minimal (sous-titre + en-tête de tableau + au moins une ligne)
    // à vérifier avant de commencer un nouveau sous-tableau, pour ne jamais
    // laisser un titre d'hôtel orphelin tout en bas d'une page.
    const MIN_BLOCK_HEIGHT = 70;

    rowsByCity.forEach((cityGroup, cityIndex) => {
      if (cityIndex > 0) doc.addPage();
      drawPageHeader(cityGroup.city);

      if (cityGroup.hotelGroups.length === 0) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor(MUTED)
          .text("Aucune chambre.", doc.page.margins.left, doc.y, { width: contentWidth });
        doc.fillColor("#000");
        return;
      }

      cityGroup.hotelGroups.forEach((hotelGroup, hotelIndex) => {
        if (hotelIndex > 0) doc.moveDown(0.8);

        if (doc.y > bottomLimit - MIN_BLOCK_HEIGHT) {
          doc.addPage();
          drawPageHeader(cityGroup.city);
        }

        drawHotelSubHeading(hotelGroup.hotel_name);
        drawTableHeader();

        const roomBlocks = groupRoomBlocks(hotelGroup.rows);
        let lineIndex = 0;
        roomBlocks.forEach((block) => {
          const blockHeight = block.occupants.reduce((sum, row) => sum + lineHeight(row), 0);
          if (doc.y + blockHeight > bottomLimit) {
            doc.addPage();
            drawPageHeader(cityGroup.city);
            drawHotelSubHeading(hotelGroup.hotel_name);
            drawTableHeader();
            lineIndex = 0;
          }
          drawRoomBlock(block, lineIndex);
          lineIndex += block.occupants.length;
        });
      });
    });

    // Pied de page — posé après coup sur chaque page déjà générée
    // (bufferPages: true), pour connaître le nombre total de pages avant de
    // dessiner la pagination "Page X / N".
    // ⚠️ Piège pdfkit : un `.text()` dont le y tombe SOUS la limite de marge
    // basse (page.maxY() = height - margins.bottom) déclenche la pagination
    // automatique AVANT de dessiner — même avec x/y explicites — ajoutant une
    // page vierge parasite pour chaque appel de pied de page. Neutralisé en
    // mettant temporairement `margins.bottom` à 0 pendant le dessin du pied
    // de page (repoussant artificiellement cette limite), restauré aussitôt
    // après pour ne pas fausser la mise en page du contenu réel.
    const range = doc.bufferedPageRange();
    const realBottomMargin = doc.page.margins.bottom;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - realBottomMargin + 10;
      doc.font("Helvetica").fontSize(8);

      doc.fillColor(MUTED).text(agencyName, doc.page.margins.left, footerY, {
        width: contentWidth / 3,
        align: "left",
      });

      doc.fillColor(GOLD).text(programUrl, doc.page.margins.left, footerY, {
        width: contentWidth,
        align: "center",
        link: programUrl,
        underline: true,
      });

      doc.fillColor(MUTED).text(`Page ${i - range.start + 1} / ${range.count}`, doc.page.margins.left, footerY, {
        width: contentWidth,
        align: "right",
      });

      doc.fillColor("#000");
      doc.page.margins.bottom = realBottomMargin;
    }

    doc.end();
  });
}
