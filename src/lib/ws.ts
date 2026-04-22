// WebSocket client singleton for multiplayer rooms

type MessageHandler = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _url: string = '';
  private intentionalClose = false;

  connect(url?: string) {
    if (url) this._url = url;
    if (!this._url) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.intentionalClose = false;
    this.ws = new WebSocket(this._url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.emit('_connected', {});
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
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
    this.ws?.close();
    this.ws = null;
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
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

// Reconnect when the user comes back to the page (mobile background/lock screen)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      wsClient.connect();
    }
  });
}
