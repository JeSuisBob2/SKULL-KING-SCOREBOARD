// WebSocket client singleton for multiplayer rooms

type MessageHandler = (data: any) => void;

// Heartbeat : détecte les connexions "zombies" (téléphone sorti de veille,
// changement de réseau...) où le socket semble ouvert mais ne reçoit plus rien.
const PING_INTERVAL_MS = 20_000;  // un ping toutes les 20s
const STALE_TIMEOUT_MS = 55_000;  // silence > 55s → connexion considérée morte

class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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

    this.intentionalClose = false;
    this.ws = new WebSocket(this._url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.lastMessageAt = Date.now();
      this.startHeartbeat();
      this.emit('_connected', {});
      this.flushOutbox();
    };

    this.ws.onmessage = (e) => {
      this.lastMessageAt = Date.now();
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'pong') return; // heartbeat uniquement
        this.emit(msg.type, msg);
      } catch {}
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.emit('_disconnected', {});
      if (!this.intentionalClose) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.outbox = [];
    this.ws?.close();
    this.ws = null;
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

      // Silence prolongé → le socket est probablement mort : on force la reconnexion
      if (Date.now() - this.lastMessageAt > STALE_TIMEOUT_MS) {
        console.log('[WS] Connexion silencieuse — reconnexion forcée');
        try { this.ws.close(); } catch {}
        return;
      }
      try { this.ws.send('{"type":"ping"}'); } catch {}
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
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

  /** Demande aux abonnés (store) de resynchroniser l'état depuis le serveur. */
  requestResync() {
    this.emit('_resync', {});
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WsClient();

// Retour au premier plan (déverrouillage du téléphone, changement d'onglet) :
// on reconnecte si besoin ET on demande une resynchronisation de l'état —
// le client a pu rater des broadcasts pendant la mise en veille.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (wsClient.connected) {
        wsClient.send({ type: 'ping' });
        wsClient.requestResync();
      } else {
        wsClient.connect();
      }
    }
  });
}
