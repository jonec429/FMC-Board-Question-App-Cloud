import React, { useState } from 'react';

export type SortDir = 'asc' | 'desc';

/** Extract a last name for sorting ("Lili Cohen" -> "cohen"). Multi-word last
 *  names ("Dela Cruz") sort by their final token — good enough for a roster. */
export function lastName(fullName?: string | null): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

/** Sort-column state for a table. Lives in the parent component so it survives
 *  re-renders (don't put this inside an inline-defined table component). */
export function useSortState(initial?: { key: string; dir: SortDir }) {
  const [sortKey, setSortKey] = useState<string>(initial?.key ?? '');
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? 'asc');

  const toggle = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sortKey, sortDir, toggle };
}

/**
 * Pure sort. `accessor(item, key)` returns the value to sort by for a column
 * (numbers sort numerically, everything else via locale-aware string compare).
 * Returns the original array unchanged when no sort key is set.
 */
export function sortItems<T>(
  items: T[],
  accessor: (item: T, key: string) => string | number,
  sortKey: string,
  sortDir: SortDir
): T[] {
  if (!sortKey) return items;
  const arr = [...items].sort((a, b) => {
    const av = accessor(a, sortKey);
    const bv = accessor(b, sortKey);
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
  });
  return sortDir === 'asc' ? arr : arr.reverse();
}

interface SortHeaderProps {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

/** Clickable table header cell with an ascending/descending indicator. */
export function SortHeader({ label, sortKey, activeKey, dir, onSort, className = '' }: SortHeaderProps) {
  const active = activeKey === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-widest font-black hover:text-slate-600 transition-colors"
      >
        {label}
        <span className={`text-[8px] ${active ? 'text-blue-500' : 'text-slate-300'}`}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}
