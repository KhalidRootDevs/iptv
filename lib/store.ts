"use client";

import { useSyncExternalStore } from "react";
import type { Channel } from "./types";

// Lightweight localStorage-backed store for favorites and watch history.
// Uses useSyncExternalStore so every mounted component stays in sync, including
// across browser tabs (via the native "storage" event).

const FAV_KEY = "kbin:favorites";
const RECENT_KEY = "kbin:recents";
const RECENT_LIMIT = 24;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function read(key: string): Channel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Channel[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: Channel[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
  emit();
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAV_KEY || e.key === RECENT_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

// --- Favorites ---

export function toggleFavorite(channel: Channel) {
  const list = read(FAV_KEY);
  const exists = list.some((c) => c.id === channel.id);
  write(
    FAV_KEY,
    exists ? list.filter((c) => c.id !== channel.id) : [channel, ...list],
  );
}

export function isFavorite(id: string): boolean {
  return read(FAV_KEY).some((c) => c.id === id);
}

const EMPTY: Channel[] = [];
// Cache snapshots so useSyncExternalStore doesn't loop on new array identities.
let favCache: Channel[] = EMPTY;
let favRaw = "";
function favSnapshot(): Channel[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(FAV_KEY) ?? "";
  if (raw !== favRaw) {
    favRaw = raw;
    favCache = raw ? (JSON.parse(raw) as Channel[]) : EMPTY;
  }
  return favCache;
}

let recentCache: Channel[] = EMPTY;
let recentRaw = "";
function recentSnapshot(): Channel[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(RECENT_KEY) ?? "";
  if (raw !== recentRaw) {
    recentRaw = raw;
    recentCache = raw ? (JSON.parse(raw) as Channel[]) : EMPTY;
  }
  return recentCache;
}

export function useFavorites(): Channel[] {
  return useSyncExternalStore(subscribe, favSnapshot, () => EMPTY);
}

export function useRecents(): Channel[] {
  return useSyncExternalStore(subscribe, recentSnapshot, () => EMPTY);
}

// --- Recently watched ---

export function pushRecent(channel: Channel) {
  const list = read(RECENT_KEY).filter((c) => c.id !== channel.id);
  write(RECENT_KEY, [channel, ...list].slice(0, RECENT_LIMIT));
}

export function clearRecents() {
  write(RECENT_KEY, []);
}
