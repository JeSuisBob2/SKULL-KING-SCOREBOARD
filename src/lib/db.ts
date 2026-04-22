import Dexie, { Table } from 'dexie';
import { Game, Round } from '../types';

class SkullDb extends Dexie {
  games!: Table<Game, string>;
  rounds!: Table<Round, string>;

  constructor() {
    super('skull-king-db');
    this.version(1).stores({
      games: 'id, status, updatedAt',
      rounds: 'id, gameId, roundNumber',
    });
  }
}

export const db = new SkullDb();
