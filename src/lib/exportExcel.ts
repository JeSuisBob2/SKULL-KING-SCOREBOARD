import ExcelJS from 'exceljs';
import type { RoomRow, RoomBidRow, RoomResultRow, ShameEntry } from './supabase';

interface ExportInput {
  room: RoomRow;
  results: RoomResultRow[];
  bids: RoomBidRow[];
  shameLog: ShameEntry[];
  /** Date affichée dans le fichier et dans son nom (date de fin pour l'historique). */
  date: Date;
}

/** Exporte une partie multijoueur en fichier Excel : classement + détail manche par manche. */
export async function exportGameToExcel({ room, results, bids, shameLog, date: when }: ExportInput) {
  const completedRounds = Array.from(
    new Set(results.filter(r => r.is_done).map(r => r.round_number))
  ).sort((a, b) => a - b);

  const shameFor = (pid: string) =>
    shameLog.filter(e => e.playerId === pid).reduce((s, e) => s + e.amount, 0);

  const totalFor = (pid: string) =>
    results.filter(r => r.player_id === pid && r.is_done).reduce((s, r) => s + r.score, 0) + shameFor(pid);

  const sortedPlayers = [...room.players].sort((a, b) => totalFor(b.id) - totalFor(a.id));
  const date = when.toLocaleDateString('fr-FR');
  const hasPenalties = shameLog.length > 0;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('SkullKing');

  // Style helpers
  const blackBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
  const allBorders: Partial<ExcelJS.Borders> = { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  const applyBorder = (row: ExcelJS.Row, colCount: number, bold = false, fill?: ExcelJS.Fill) => {
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.border = allBorders;
      cell.font = { bold };
      if (fill) cell.fill = fill;
    }
  };

  // ── Infos (Skull King et date fusionnées sur B:C) ─────────────────────
  const infoRow1 = ws.addRow(['Jeu', 'Skull King', '']);
  ws.mergeCells(`B1:C1`);
  applyBorder(infoRow1, 3);
  const infoRow2 = ws.addRow(['Date', date, '']);
  ws.mergeCells(`B2:C2`);
  applyBorder(infoRow2, 3);

  // ── En-tête classement ────────────────────────────────────────────────
  const summaryHeaders = ['Classement', 'Joueur', 'Score total', ...completedRounds.map(r => `M${r}`), ...(hasPenalties ? ['Pénalités'] : [])];
  const headerRow = ws.addRow(summaryHeaders);
  applyBorder(headerRow, summaryHeaders.length, true, headerFill);

  // ── Données joueurs ───────────────────────────────────────────────────
  sortedPlayers.forEach((p, i) => {
    const roundScores = completedRounds.map(r =>
      results.find(x => x.player_id === p.id && x.round_number === r && x.is_done)?.score ?? ''
    );
    const penalty = shameFor(p.id);
    const dataRow = ws.addRow([i + 1, p.name, totalFor(p.id), ...roundScores, ...(hasPenalties ? [penalty || ''] : [])]);
    applyBorder(dataRow, summaryHeaders.length);
  });

  // ── Ligne vide + en-tête détail ───────────────────────────────────────
  ws.addRow([]);
  const detailHeaders = ['Classement', 'Joueur', 'Manche', 'Pari', 'Plis réalisés', 'Harry', 'Bonus', 'Score manche', 'Cumul'];
  const detailHeaderRow = ws.addRow(detailHeaders);
  applyBorder(detailHeaderRow, detailHeaders.length, true, headerFill);

  // ── Détail par manche ─────────────────────────────────────────────────
  sortedPlayers.forEach((p, rank) => {
    let cumul = 0;
    completedRounds.forEach(r => {
      const res = results.find(x => x.player_id === p.id && x.round_number === r && x.is_done);
      const bid = bids.find(x => x.player_id === p.id && x.round_number === r);
      const score = res?.score ?? 0;
      cumul += score;
      const harry = bid?.harry_adjustment;
      const detailRow = ws.addRow([
        rank + 1,
        p.name,
        r,
        bid?.bid ?? '',
        res?.tricks ?? '',
        harry ? (harry > 0 ? `+${harry}` : harry) : '',
        res?.bonus || '',
        score,
        cumul,
      ]);
      applyBorder(detailRow, detailHeaders.length);
    });
    if (shameFor(p.id) !== 0) {
      const penRow = ws.addRow([rank + 1, p.name, 'Pénalités', '', '', '', '', shameFor(p.id), totalFor(p.id)]);
      applyBorder(penRow, detailHeaders.length);
    }
  });

  // ── Largeurs colonnes (après ajout des lignes) ─────────────────────────
  const maxCols = Math.max(summaryHeaders.length, detailHeaders.length);
  const colWidths = [14, 18, 13, 9, 11, 9, 9, 13, 9];
  for (let c = 1; c <= maxCols; c++) {
    ws.getColumn(c).width = colWidths[c - 1] ?? 10;
  }

  // ── Téléchargement ────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skullking_${room.code}_${date.replace(/\//g, '-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
