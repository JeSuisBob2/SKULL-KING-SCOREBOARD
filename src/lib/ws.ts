// WebSocket client singleton for multiplayer rooms

type MessageHandler = (data: any) => void;

// Heartbeat : détecte les connexions "zombies" (téléphone sorti de veille,
// changement de réseau...) où le socket semble ouvert mais ne reçoit plus rien.
const PING_INTERVAL_MS = 20_000;  // un ping toutes les 20s
const STALE_TIMEOUT_MS = 55_000;  // silence > 55s → connexion considérée morte

// Retour au premier plan : un téléphone mis en veille perd sa connexion sans que le
// navigateur s'en aperçoive. Au-delà de ce silence, on ne fait plus confiance au socket ;
// en deçà, il doit quand même répondre au ping dans le délai imparti.
const RESUME_SILENCE_MS = 25_000;
const RESUME_PONG_TIMEOUT_MS = 4_000;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private _url: string = '';
  private intentionalClose = false;
  private lastMessageAt = Date.now();
  // Messages envoyés pendant une déconnexion : mis en file et rejoués à la reconnexion
  // (évite qu'une validation de pari/plis se perde silencieusement).
  private outbox: any[] = [];

  connect(url?: string) {
    if (url) this._url = url;
    if (!this._url) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    this.intentionalClose = false;
    const ws = new WebSocket(this._url);
    this.ws = ws;

    // Chaque handler ignore les évènements d'un ancien socket déjà remplacé : sur une
    // connexion morte, sa fermeture peut n'arriver que bien plus tard.
    ws.onopen = () => {
      if (this.ws !== ws) return;
      console.log('[WS] Connected');
      this.lastMessageAt = Date.now();
      this.startHeartbeat();
      this.emit('_connected', {});
      this.flushOutbox();
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastMessageAt = Date.now();
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'pong') return; // heartbeat uniquement
        this.emit(msg.type, msg);
      } catch {}
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      console.log('[WS] Disconnected');
      this.emit('_disconnected', {});
      if (!this.intentionalClose) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.stopHeartbeat();
    this.clearWatchdog();
    this.outbox = [];
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch {}
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else if (data?.type !== 'ping' && data?.type !== 'reconnect') {
      // Connexion indisponible : on garde le message pour le rejouer à la reconnexion
      if (this.outbox.length < 50) this.outbox.push(data);
      this.connect();
    }
  }

  /**
   * Retour au premier plan (déverrouillage, changement d'appli, réseau revenu) :
   * on s'assure que la connexion est réellement vivante, puis on resynchronise l'état.
   */
  resume() {
    if (!this._url) return;
    if (!this.connected) { this.connect(); return; } // la resynchro suivra l'ouverture

    if (Date.now() - this.lastMessageAt > RESUME_SILENCE_MS) {
      // Rien reçu depuis longtemps (veille) : le socket est très probablement mort.
      // Inutile d'attendre le heartbeat pour le découvrir : on repart sur un neuf.
      this.forceReconnect('Retour de veille');
      return;
    }

    // Socket a priori vivant : on demande l'état à jour et on vérifie qu'il répond.
    const askedAt = Date.now();
    try { this.ws!.send('{"type":"ping"}'); } catch {}
    this.emit('_resync', {});
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      if (this.lastMessageAt < askedAt) this.forceReconnect('Aucune réponse au retour');
    }, RESUME_PONG_TIMEOUT_MS);
  }

  /**
   * Abandonne le socket courant et en ouvre un neuf immédiatement. On n'attend pas sa
   * fermeture : sur une connexion morte, elle peut mettre très longtemps à arriver, et un
   * joueur qui n'envoie rien restait figé pendant tout ce temps.
   */
  private forceReconnect(reason: string) {
    console.log(`[WS] ${reason} — reconnexion immédiate`);
    this.clearWatchdog();
    const old = this.ws;
    this.ws = null; // ses handlers l'ignorent désormais
    try { old?.close(); } catch {}
    this.connect();
  }

  private flushOutbox() {
    const pending = this.outbox;
    this.outbox = [];
    for (const msg of pending) {
      try { this.ws?.send(JSON.stringify(msg)); } catch {}
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Silence prolongé → le socket est probablement mort : on en ouvre un neuf
      if (Date.now() - this.lastMessageAt > STALE_TIMEOUT_MS) {
        this.forceReconnect('Connexion silencieuse');
        return;
      }
      try { this.ws.send('{"type":"ping"}'); } catch {}
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private clearWatchdog() {
    if (this.watchdogTimer) { clearTimeout(this.watchdogTimer); this.watchdogTimer = null; }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  waitForConnection(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('Connexion timeout — vérifiez que le serveur est lancé'));
      }, 15000);
      // On ne rejette pas sur _disconnected : l'auto-reconnect peut réussir
      // avant le timeout et résoudre la promesse normalement.
      const unsub = this.on('_connected', () => {
        clearTimeout(timer);
        unsub();
        resolve();
      });
    });
  }

  private emit(type: string, data: any) {
    this.handlers.get(type)?.forEach(h => h(data));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WsClient();

// Retour au premier plan, réseau revenu, ou page restaurée depuis le cache du
// navigateur (bouton retour sur iOS) : on vérifie la connexion et on resynchronise —
// le client a pu rater des mises à jour pendant ce temps.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wsClient.resume();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => wsClient.resume());
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) wsClient.resume();
  });
}
