import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'scada_theme';

  /** User preference: 'light' | 'dark' | 'system' */
  readonly preference = signal<ThemePreference>(this.loadPreference());

  /** OS prefers dark */
  private readonly osPrefersDark = signal(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  /** Resolved actual theme: 'light' | 'dark' */
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') return this.osPrefersDark() ? 'dark' : 'light';
    return pref;
  });

  constructor() {
    // Listen to OS theme changes
    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => this.osPrefersDark.set(e.matches));
    }

    // Apply data-theme attribute whenever resolved changes
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolved());
    });
  }

  /** Cycle through light → dark → system */
  toggle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(this.preference());
    const next = order[(idx + 1) % order.length];
    this.setPreference(next);
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    localStorage.setItem(this.STORAGE_KEY, pref);
  }

  private loadPreference(): ThemePreference {
    if (typeof localStorage === 'undefined') return 'light';
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'light';
  }
}
