// Définit le mot de passe admin : demande le mot de passe, calcule son hachage
// et l'enregistre dans le fichier .env à la racine du projet.
//
// Usage : bun scripts/hash-admin-password.ts
//
// Le mot de passe est saisi de façon interactive : il ne passe pas par la ligne de
// commande, donc il ne finit pas dans l'historique du shell. Seul son hachage est écrit.

import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';

// SK_ENV_FILE sert uniquement aux tests ; par défaut, le .env à la racine du projet.
const ENV_PATH = process.env.SK_ENV_FILE ?? new URL('../.env', import.meta.url).pathname;

const password = prompt('Mot de passe admin :');

if (!password) {
  console.error('Annulé : aucun mot de passe saisi.');
  process.exit(1);
}

if (password.length < 10) {
  console.error(`Trop court (${password.length} caractères) : utilisez au moins 10 caractères.`);
  process.exit(1);
}

// argon2id : algorithme recommandé aujourd'hui pour les mots de passe (lent et gourmand
// en mémoire, donc très coûteux à attaquer par force brute).
const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });

// Les hachages argon2 contiennent des $ ($argon2id$v=19$...), que le lecteur de .env
// interprète comme des variables — même entre apostrophes. On les échappe donc,
// sinon la valeur relue est tronquée et le mot de passe est toujours refusé.
const line = `SK_ADMIN_PASSWORD_HASH="${hash.replace(/\$/g, '\\$')}"`;

let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
let action: string;

if (/^SK_ADMIN_PASSWORD_HASH=.*$/m.test(content)) {
  content = content.replace(/^SK_ADMIN_PASSWORD_HASH=.*$/m, line);
  action = 'mis à jour';
} else {
  content = content.trimEnd() ? `${content.trimEnd()}\n${line}\n` : `${line}\n`;
  action = existsSync(ENV_PATH) ? 'ajouté' : 'créé';
}

writeFileSync(ENV_PATH, content);
// Lecture réservée au propriétaire du fichier
try { chmodSync(ENV_PATH, 0o600); } catch {}

console.log(`\n✅ Mot de passe admin ${action} dans ${ENV_PATH}`);
console.log('   (fichier ignoré par git : rien ne partira sur GitHub)');
console.log('\nRelancez le serveur pour l\'activer :\n');
console.log('   bun server.ts\n');
