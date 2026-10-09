// Mise à jour automatique de l'appli sur les téléphones restés ouverts.
//
// Le serveur annonce la version actuellement en ligne (message 'version'). Si elle
// diffère de celle de ce code, on attend un moment sans risque — jamais en pleine
// saisie — puis on installe la nouvelle version et on recharge la page.

import { create } from 'zustand';
import { wsClient } from './ws';

/** Identifiant du build de ce code (injecté par Vite). */
export const APP_BUILD: string = __APP_BUILD__;

// Garde anti-boucle : au plus UNE tentative automatique par version toutes les 10 min.
// Si le rechargement ne suffit pas (service worker bloqué...), on n'insiste pas :
// le bandeau reste affiché et le joueur peut mettre à jour à la main.
const ATTEMPT_KEY = 'skullking-update-attempt';
const ATTEMPT_COOLDOWN_MS = 10 * 60 * 1000;

export const useAppUpdate = create<{ available: boolean }>(() => ({ available: false }));

let serverBuild: string | null = null;

function autoAttemptAllowed(build: string): boolean {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return true;
    const last = JSON.parse(raw);
    return !(last.build === build && Date.now() - last.at < ATTEMPT_COOLDOWN_MS);
  } catch {
    return true;
  }
}

function markAttempt(build: string) {
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ build, at: Date.now() })); } catch {}
}

/**
 * Installe la nouvelle version : demande au service worker de se mettre à jour, attend
 * qu'il prenne le relais, puis recharge la page. `manual` = clic sur le bandeau.
 */
export async function applyUpdate(manual = false) {
  if (!serverBuild) return;
  if (!manual && !autoAttemptAllowed(serverBuild)) return;
  markAttempt(serverBuild);

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      const swReady = new Promise<void>(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
        setTimeout(resolve, 15_000);
      });
      await reg.update();
      // Nouvelle version trouvée : on attend son installation, sinon la page
      // rechargée resservirait l'ancienne depuis le cache.
      if (reg.installing || reg.waiting) await swReady;
    }
  } catch {}

  window.location.reload();
}

/** Hors d'une partie, ou appli en arrière-plan : aucune saisie à perdre. */
function isSafeMoment(): boolean {
  if (document.visibilityState === 'hidden') return true;
  return !window.location.pathname.includes('/room/');
}

/** Appelé à chaque changement de page : les changements de phase sont le bon moment. */
export function onRouteChange() {
  if (useAppUpdate.getState().available) applyUpdate();
}

if (!import.meta.env.DEV) {
  wsClient.on('version', (msg) => {
    if (!msg.build || msg.build === APP_BUILD) return;
    serverBuild = msg.build;
    useAppUpdate.setState({ available: true });
    if (isSafeMoment()) applyUpdate();
  });

  // Le joueur quitte l'appli ou éteint l'écran : le moment idéal, il ne voit rien.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && useAppUpdate.getState().available) applyUpdate();
  });
}
