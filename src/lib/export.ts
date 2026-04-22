import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Game, Round } from '../types';

function buildRows(game: Game, rounds: Round[]) {
  const rows: Record<string, unknown>[] = [];
  for (const round of rounds) {
    for (const player of game.players) {
      const bid = round.bids[player.id];
      const result = round.results[player.id];
      if (!result) continue;
      const adj = (bid?.betAdjustedByHarry ?? 0);
      const effectiveBid = (bid?.bid ?? 0) + adj;
      const sp = result.specialCards ?? {};
      rows.push({
        manche: round.roundNumber,
        joueur: player.name,
        pari: bid?.bid ?? 0,
        harryAdj: adj,
        pariEffectif: effectiveBid,
        plis: result.tricks,
        bonus: result.bonus,
        skullKing_pos: (sp as any).skullKing?.positive ?? 0,
        skullKing_neg: (sp as any).skullKing?.negative ?? 0,
        pirates_pos: (sp as any).pirates?.positive ?? 0,
        pirates_neg: (sp as any).pirates?.negative ?? 0,
        sirenes_pos: (sp as any).mermaids?.positive ?? 0,
        sirenes_neg: (sp as any).mermaids?.negative ?? 0,
        pieces_pos: (sp as any).coins?.positive ?? 0,
        pieces_neg: (sp as any).coins?.negative ?? 0,
        score: result.score,
      });
    }
  }
  return rows;
}

export function exportCSV(game: Game, rounds: Round[]): Blob {
  const rows = buildRows(game, rounds);
  const csv = Papa.unparse(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function exportXLSX(game: Game, rounds: Round[]): Blob {
  const rows = buildRows(game, rounds);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scores');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/octet-stream' });
}
