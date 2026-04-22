import { useState, useEffect, useRef } from 'react';
import { Player } from '../types';
import { useStore } from '../store/useStore';

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  currentGamePlayers: Player[];
}

export default function PlayerNameCombobox({ value, onChange, placeholder, currentGamePlayers }: Props) {
  const { games } = useStore();
  const [focused, setFocused] = useState(false);
  const [input, setInput] = useState(value);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setInput(value); }, [value]);

  const usedNames = currentGamePlayers.map(p => p.name.trim().toLowerCase());

  const historicalNames = Array.from(
    new Set(games.flatMap(g => g.players.map(p => p.name)))
  ).filter(name => {
    const lower = name.trim().toLowerCase();
    return lower && !usedNames.includes(lower) || lower === value.trim().toLowerCase();
  });

  const filtered = historicalNames.filter(n =>
    n.toLowerCase().includes(input.toLowerCase()) && n.toLowerCase() !== input.toLowerCase()
  );

  const showDropdown = focused && filtered.length > 0;

  return (
    <div className="relative">
      <input
        className="input w-full"
        value={input}
        placeholder={placeholder}
        aria-label="Nom du joueur"
        onChange={e => {
          setInput(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          closeTimer.current = setTimeout(() => setFocused(false), 150);
        }}
      />
      {showDropdown && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl bg-surface border border-white/10 shadow-xl overflow-hidden">
          {filtered.map(name => (
            <li
              key={name}
              className="px-4 py-2 cursor-pointer hover:bg-accent/20 text-sm"
              onMouseDown={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current);
                setInput(name);
                onChange(name);
                setFocused(false);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
