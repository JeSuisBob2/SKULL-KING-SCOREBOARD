/**
 * 🏴‍☠️ CAPITAINE BID — Widget flottant
 * Composant bas-droite avec chat pirate.
 *
 * NOTE: Ce composant n'est pas encore utilisé dans l'app.
 * Pour l'activer, ajouter <BotWidget /> dans Layout.tsx.
 */

import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import {
  generateInitialAdvice,
  generateMidRoundAdvice,
  generateTextReply,
  generateDebriefMessage,
  type BotMessage,
  type BotContext,
} from '../lib/fakeBot';

// ── Constantes ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'capitaine-bid-history';
const MAX_HISTORY = 30;

// ── Helpers ───────────────────────────────────────────────────────────────

function loadHistory(): BotMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(msgs: BotMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
}

function buildContext(
  room: any,
  results: any[],
  bids: any[],
  shameLog: any[],
  myPlayerId: string,
  round: number,
): BotContext {
  const shameFor = (pid: string) =>
    shameLog.filter((e: any) => e.playerId === pid).reduce((s: number, e: any) => s + e.amount, 0);

  const totalFor = (pid: string) =>
    results.filter((r: any) => r.player_id === pid && r.is_done)
      .reduce((s: number, r: any) => s + r.score, 0) + shameFor(pid);

  const myScore = totalFor(myPlayerId);
  const scores = room.players.map((p: any) => totalFor(p.id));
  const leaderScore = Math.max(...scores);

  const myCurrentRoundResults = results.filter(
    r => r.player_id === myPlayerId && r.round_number === round && r.is_done
  );
  const tricksWon = myCurrentRoundResults.reduce((s, r) => s + (r.tricks ?? 0), 0);

  const myBidRow = bids.find(b => b.player_id === myPlayerId && b.round_number === round);
  const tricksNeeded = myBidRow?.bid ?? null;

  const lastRoundResult = results.find(
    r => r.player_id === myPlayerId && r.round_number === round - 1 && r.is_done
  );

  const myName = room.players.find((p: any) => p.id === myPlayerId)?.name ?? 'Matelot';

  return {
    round,
    totalRounds: room.total_rounds,
    totalPlayers: room.players.length,
    myScore,
    leaderScore,
    lastScore: lastRoundResult?.score ?? null,
    myBid: myBidRow?.bid ?? null,
    tricksWon,
    tricksNeeded,
    playerName: myName,
    roundsLeft: room.total_rounds - round,
  };
}

// ── Composant ─────────────────────────────────────────────────────────────

export default function BotWidget() {
  const { room, results, bids, shameLog, myPlayerId } = useRoomStore();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // N'affiche le bot que si on est dans une room active
  const currentRound = room?.current_round ?? 1;
  const isInRoom = !!room;
  if (!isInRoom) return null;

  // Scroll auto
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Compteur non-lus
  useEffect(() => {
    if (!open) {
      const lastSeen = Number(localStorage.getItem('bot-last-seen') ?? '0');
      const newMsgs = messages.filter(m => m.role === 'assistant' && m.timestamp > lastSeen);
      setUnread(newMsgs.length);
    } else {
      setUnread(0);
      localStorage.setItem('bot-last-seen', String(Date.now()));
    }
  }, [open, messages]);

  // Sauvegarde
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const ctx = buildContext(room, results, bids, shameLog, myPlayerId, currentRound);

  const addMessage = (msg: Omit<BotMessage, 'timestamp'>) => {
    const full: BotMessage = { ...msg, timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full;
  };

  const handleBotReply = async (reply: string) => {
    setTyping(null);
    addMessage({ role: 'assistant', content: reply });
    setIsLoading(false);
  };

  const onTypingCallback = (text: string) => setTyping(text);

  // ── Boutons rapides ────────────────────────────────────────────────────

  const handleQuickBid = async () => {
    if (isLoading) return;
    addMessage({ role: 'user', content: 'Conseille-moi un pari pour cette manche.' });
    setIsLoading(true);
    const reply = await generateInitialAdvice(ctx, false, onTypingCallback);
    handleBotReply(reply);
  };

  const handleQuickStatus = async () => {
    if (isLoading) return;
    const msg = `J'ai gagné ${ctx.tricksWon} plis, j'en ai besoin de ${ctx.tricksNeeded ?? '?'}. Que faire ?`;
    addMessage({ role: 'user', content: msg });
    setIsLoading(true);
    const reply = await generateMidRoundAdvice(ctx, msg, onTypingCallback);
    handleBotReply(reply);
  };

  const handleQuickDebrief = async () => {
    if (isLoading) return;
    const lastResult = results.find(
      r => r.player_id === myPlayerId && r.round_number === currentRound - 1 && r.is_done
    );
    if (!lastResult) {
      addMessage({ role: 'assistant', content: '🏴‍☠️ Pas encore de résultats à débriefer pour ce moment !' });
      return;
    }
    const lastBid = bids.find(b => b.player_id === myPlayerId && b.round_number === currentRound - 1);
    addMessage({ role: 'user', content: 'Fais-moi le bilan de la dernière manche.' });
    setIsLoading(true);
    const reply = await generateDebriefMessage(
      lastBid?.bid ?? 0,
      lastResult.tricks,
      lastResult.score,
      onTypingCallback
    );
    handleBotReply(reply);
  };

  // ── Envoi texte ────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    addMessage({ role: 'user', content: text });
    setIsLoading(true);

    const lowerText = text.toLowerCase();
    let reply: string;

    if (lowerText.includes('pari') || lowerText.includes('parier') || lowerText.includes('combien')) {
      reply = await generateInitialAdvice(ctx, false, onTypingCallback);
    } else if (
      lowerText.includes('pli') ||
      lowerText.includes('gagn') ||
      lowerText.includes('perdu') ||
      lowerText.includes('faire')
    ) {
      reply = await generateMidRoundAdvice(ctx, text, onTypingCallback);
    } else {
      reply = await generateTextReply(ctx, text, onTypingCallback);
    }

    handleBotReply(reply);
  };

  // ── Photo ──────────────────────────────────────────────────────────────

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading) return;
    e.target.value = '';

    const previewUrl = URL.createObjectURL(file);
    addMessage({ role: 'user', content: previewUrl, isPhoto: true });
    setIsLoading(true);

    const reply = await generateInitialAdvice(ctx, true, onTypingCallback);
    handleBotReply(reply);
    URL.revokeObjectURL(previewUrl);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Bouton flottant */}
      <button
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-[#1c2541] border-2 border-yellow-400/60 shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        onClick={() => setOpen(v => !v)}
        title="Capitaine Bid"
      >
        🏴‍☠️
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-h-[70vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0b132b]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1c2541] border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏴‍☠️</span>
              <div>
                <div className="font-semibold text-sm text-white">Capitaine Bid</div>
                <div className="text-xs text-white/40">Manche {currentRound}/{room.total_rounds}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearHistory}
                className="text-white/30 hover:text-white/60 text-xs transition-colors"
                title="Effacer l'historique"
              >
                🗑️
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Contexte actuel */}
          <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex gap-3 text-xs text-white/50">
            <span>Score : <span className="text-white/80">{ctx.myScore}</span></span>
            <span>Leader : <span className="text-white/80">{ctx.leaderScore}</span></span>
            {ctx.myBid !== null && (
              <span>Pari : <span className="text-white/80">{ctx.myBid}</span></span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center text-white/30 text-xs mt-6 space-y-1">
                <div className="text-3xl">🏴‍☠️</div>
                <div>Ahoy ! Je suis le Capitaine Bid.</div>
                <div>Demande-moi conseil ou envoie une photo de ta main !</div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-yellow-500/20 text-white rounded-tr-sm'
                      : 'bg-white/10 text-white/90 rounded-tl-sm'
                  }`}
                >
                  {msg.isPhoto ? (
                    <img src={msg.content} alt="Ma main" className="rounded-lg max-h-32 object-contain" />
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content.split('**').map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} className="text-yellow-300">{part}</strong>
                          : part
                      )}
                    </div>
                  )}
                  <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/30 text-right' : 'text-white/20'}`}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Indicateur de frappe */}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/60 max-w-[85%]">
                  <div className="flex items-center gap-1">
                    <span>{typing}</span>
                    <span className="animate-pulse">●</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Boutons rapides */}
          <div className="px-3 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto">
            <button
              onClick={handleQuickBid}
              disabled={isLoading}
              className="whitespace-nowrap text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors"
            >
              🎯 Pari
            </button>
            <button
              onClick={handleQuickStatus}
              disabled={isLoading}
              className="whitespace-nowrap text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors"
            >
              📊 Statut
            </button>
            <button
              onClick={handleQuickDebrief}
              disabled={isLoading}
              className="whitespace-nowrap text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors"
            >
              📋 Bilan
            </button>
          </div>

          {/* Zone de saisie */}
          <div className="px-3 pb-3 pt-1 flex items-center gap-2 border-t border-white/5">
            {/* Bouton photo */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isLoading}
              className="text-lg disabled:opacity-40 hover:scale-110 transition-transform"
              title="Envoyer une photo"
            >
              📷
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />

            {/* Input texte */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Pose ta question..."
              disabled={isLoading}
              className="flex-1 bg-white/10 rounded-full px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-yellow-400/40 disabled:opacity-40"
            />

            {/* Bouton envoyer */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-yellow-400 disabled:opacity-30 hover:scale-110 transition-transform text-lg"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
