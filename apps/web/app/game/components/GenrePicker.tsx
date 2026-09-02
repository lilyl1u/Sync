'use client';

import { GENRE_KITS, type GenreChoice } from '@/app/game/utils/genreKits';

type GenrePickerProps = {
  value: GenreChoice;
  onChange: (value: GenreChoice) => void;
  midiReady: number;
};

export function GenrePicker({ value, onChange, midiReady }: GenrePickerProps) {
  const selected = GENRE_KITS.find((kit) => kit.id === value);

  return (
    <div className="mb-5 w-full max-w-md mx-auto">
      <p className="text-[9px] mb-2 uppercase tracking-wider">Soundtrack</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange('random')}
          className={value === 'random' ? 'px-btn px-btn-start' : 'px-btn'}
          style={{ fontSize: 8, padding: '0.55rem 0.65rem' }}
        >
          Surprise
        </button>
        {GENRE_KITS.map((kit) => (
          <button
            key={kit.id}
            type="button"
            onClick={() => onChange(kit.id)}
            className={value === kit.id ? 'px-btn px-btn-start' : 'px-btn'}
            style={{ fontSize: 8, padding: '0.55rem 0.65rem' }}
          >
            {kit.label}
          </button>
        ))}
      </div>
      <p className="text-[8px] mt-2 opacity-80">
        {value === 'random'
          ? 'Picks a new style every run.'
          : selected
            ? selected.blurb
            : ''}
        {' '}LSTM extras: {midiReady}/3
      </p>
    </div>
  );
}
