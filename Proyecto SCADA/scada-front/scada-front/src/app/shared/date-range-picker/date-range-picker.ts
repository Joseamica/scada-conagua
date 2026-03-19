// src/app/shared/date-range-picker/date-range-picker.ts

import {
  Component, Output, EventEmitter, ElementRef,
  HostListener, ViewChild, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DateRangeOutput {
  from:     string;
  to:       string;
  interval: string;
  preset:   string | null;
}

interface Preset { name: string; label: string; }

const PRESETS: Preset[] = [
  { name: 'today',     label: 'Hoy' },
  { name: 'yesterday', label: 'Ayer' },
  { name: 'last7',     label: 'Últimos 7 días' },
  { name: 'last14',    label: 'Últimos 14 días' },
  { name: 'last30',    label: 'Últimos 30 días' },
  { name: 'thisWeek',  label: 'Esta semana' },
  { name: 'lastWeek',  label: 'Semana pasada' },
  { name: 'thisMonth', label: 'Este mes' },
  { name: 'lastMonth', label: 'Mes pasado' },
  { name: 'thisYear',  label: 'Este año' },
  { name: 'lastYear',  label: 'Año pasado' },
];

const INTERVALS = [
  { value: '',    label: 'Auto' },
  { value: '1m',  label: '1 min' },
  { value: '5m',  label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h',  label: '1 hora' },
  { value: '6h',  label: '6 horas' },
  { value: '1d',  label: '1 día' },
];

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-range-picker.html',
  styleUrls: ['./date-range-picker.css']
})
export class DateRangePickerComponent {
  @Output() rangeApplied = new EventEmitter<DateRangeOutput>();
  @ViewChild('intervalSel') intervalSelRef!: ElementRef<HTMLSelectElement>;

  private el = inject(ElementRef);

  readonly presets   = PRESETS;
  readonly intervals = INTERVALS;
  readonly weekDays  = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  isOpen = false;
  popoverTop   = '0px';
  popoverRight = '0px';

  draftFrom:   Date | null = null;
  draftTo:     Date | null = null;
  hoverDate:   Date | null = null;
  selectingTo  = false;

  appliedFrom:    Date | null = null;
  appliedTo:      Date | null = null;
  appliedPreset:  string | null = 'last7';
  appliedInterval = '';

  // Calendars precomputed — only rebuilt on month navigation
  viewDate    = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  leftDays:  (Date | null)[] = [];
  rightDays: (Date | null)[] = [];

  constructor() {
    const { from, to } = this.getPresetRange('last7');
    this.appliedFrom = from;
    this.appliedTo   = to;
    this.draftFrom   = from;
    this.draftTo     = to;
    this.rebuildCalendars();
  }

  // ==============================
  // OPEN / CLOSE
  // ==============================
  @HostListener('document:click')
  onDocumentClick() {
    if (this.isOpen) this.isOpen = false;
  }

  toggleOpen(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      this.popoverTop   = `${rect.bottom + 8}px`;
      // Align right edge with trigger; clamp so popover never goes off-screen left
      const popoverW    = Math.min(700, window.innerWidth - 16);
      const rightEdge   = window.innerWidth - rect.right;
      const leftEdge    = rect.right - popoverW;
      this.popoverRight = leftEdge < 8
        ? `${Math.max(8, window.innerWidth - rect.left - popoverW)}px`
        : `${Math.max(8, rightEdge)}px`;

      this.draftFrom   = this.appliedFrom ? new Date(this.appliedFrom) : null;
      this.draftTo     = this.appliedTo   ? new Date(this.appliedTo)   : null;
      this.hoverDate   = null;
      this.selectingTo = false;
      if (this.draftFrom) {
        this.viewDate = new Date(this.draftFrom.getFullYear(), this.draftFrom.getMonth() - 1, 1);
        this.rebuildCalendars();
      }
    }
  }

  /** Detiene propagación de clicks dentro del popover para que no lo cierre */
  stopProp(event: MouseEvent) { event.stopPropagation(); }

  // ==============================
  // CALENDAR NAVIGATION
  // ==============================
  get leftMonthDate():  Date { return this.viewDate; }
  get rightMonthDate(): Date {
    return new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
  }

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.rebuildCalendars();
  }
  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.rebuildCalendars();
  }

  /** Precomputa ambos meses — solo se llama en navegación, no en cada hover */
  private rebuildCalendars() {
    this.leftDays  = this.buildMonth(this.leftMonthDate.getFullYear(),  this.leftMonthDate.getMonth());
    this.rightDays = this.buildMonth(this.rightMonthDate.getFullYear(), this.rightMonthDate.getMonth());
  }

  private buildMonth(year: number, month: number): (Date | null)[] {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++)      days.push(null);
    for (let d = 1; d <= daysInMonth; d++)  days.push(new Date(year, month, d));
    while (days.length % 7 !== 0)           days.push(null);
    return days;
  }

  /** trackBy para *ngFor — evita destruir/recrear botones en cada cycle */
  trackDay(index: number, day: Date | null): string {
    return day ? `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` : `e${index}`;
  }

  // ==============================
  // DAY INTERACTION
  // ==============================
  onDayClick(date: Date) {
    if (!this.selectingTo || !this.draftFrom) {
      // Primer click → marca inicio
      this.draftFrom   = new Date(date);
      this.draftTo     = null;
      this.selectingTo = true;
    } else {
      // Segundo click → marca fin (auto-swap si invertido)
      let from = this.draftFrom;
      let to   = new Date(date);
      if (to < from) [from, to] = [to, from];
      this.draftFrom   = from;
      this.draftTo     = to;
      this.selectingTo = false;
      this.hoverDate   = null;
    }
  }

  onDayHover(date: Date) {
    if (this.selectingTo) this.hoverDate = new Date(date);
  }

  onCalMouseLeave() {
    this.hoverDate = null;
  }

  getDayClass(date: Date): string {
    if (!date) return 'drp-day drp-day--empty';

    const effectiveTo = this.selectingTo && this.hoverDate ? this.hoverDate : this.draftTo;

    let rangeStart = this.draftFrom;
    let rangeEnd   = effectiveTo;
    if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
      [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }

    const isStart = !!rangeStart && this.isSameDay(date, rangeStart);
    const isEnd   = !!rangeEnd   && this.isSameDay(date, rangeEnd);
    const inRange = !!(rangeStart && rangeEnd &&
      date > rangeStart && date < rangeEnd &&
      !this.isSameDay(date, rangeStart) && !this.isSameDay(date, rangeEnd));
    const isToday = this.isSameDay(date, new Date());

    const c = ['drp-day'];
    if (isStart)                  c.push('drp-day--start');
    if (isEnd)                    c.push('drp-day--end');
    if (inRange)                  c.push('drp-day--in-range');
    if (isToday && !isStart && !isEnd) c.push('drp-day--today');
    return c.join(' ');
  }

  isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  // ==============================
  // PRESETS — solo actualizan draft, NO cierran
  // ==============================
  onPresetClick(name: string) {
    const { from, to } = this.getPresetRange(name);
    this.draftFrom   = from;
    this.draftTo     = to;
    this.selectingTo = false;
    this.hoverDate   = null;
  }

  get selectedPreset(): string | null {
    if (!this.draftFrom) return null;
    const to = this.draftTo ?? this.draftFrom;
    for (const p of PRESETS) {
      const r = this.getPresetRange(p.name);
      if (this.isSameDay(r.from, this.draftFrom) && this.isSameDay(r.to, to)) return p.name;
    }
    return null;
  }

  // ==============================
  // APPLY / CANCEL
  // ==============================
  apply() {
    if (!this.draftFrom) return;
    const to = this.draftTo ?? this.draftFrom;
    this.appliedFrom    = new Date(this.draftFrom.getFullYear(), this.draftFrom.getMonth(), this.draftFrom.getDate(), 0, 0, 0, 0);
    this.appliedTo      = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    this.appliedPreset  = this.selectedPreset;
    this.appliedInterval = this.intervalSelRef?.nativeElement?.value ?? '';
    this.isOpen = false;
    this.emit();
  }

  cancel() {
    this.draftFrom   = this.appliedFrom ? new Date(this.appliedFrom) : null;
    this.draftTo     = this.appliedTo   ? new Date(this.appliedTo)   : null;
    this.selectingTo = false;
    this.hoverDate   = null;
    this.isOpen      = false;
  }

  private emit() {
    if (!this.appliedFrom || !this.appliedTo) return;
    // toISOString() incluye milisegundos (.000Z) — los eliminamos para el backend
    const toRFC3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    this.rangeApplied.emit({
      from:     toRFC3339(this.appliedFrom),
      to:       toRFC3339(this.appliedTo),
      interval: this.appliedInterval,
      preset:   this.appliedPreset
    });
  }

  // ==============================
  // PRESET RANGES
  // ==============================
  getPresetRange(name: string): { from: Date; to: Date } {
    const now = new Date();
    const s = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const e = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    switch (name) {
      case 'today':     return { from: s(now), to: e(now) };
      case 'yesterday': { const d = new Date(now); d.setDate(d.getDate()-1); return { from: s(d), to: e(d) }; }
      case 'last7':     { const d = new Date(now); d.setDate(d.getDate()-6); return { from: s(d), to: e(now) }; }
      case 'last14':    { const d = new Date(now); d.setDate(d.getDate()-13); return { from: s(d), to: e(now) }; }
      case 'last30':    { const d = new Date(now); d.setDate(d.getDate()-29); return { from: s(d), to: e(now) }; }
      case 'thisWeek':  { const m = new Date(now); m.setDate(m.getDate()-(m.getDay()||7)+1); return { from: s(m), to: e(now) }; }
      case 'lastWeek':  { const lm = new Date(now); lm.setDate(lm.getDate()-(lm.getDay()||7)-6); const ls = new Date(lm); ls.setDate(lm.getDate()+6); return { from: s(lm), to: e(ls) }; }
      case 'thisMonth': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: e(new Date(now.getFullYear(), now.getMonth()+1, 0)) };
      case 'lastMonth': return { from: new Date(now.getFullYear(), now.getMonth()-1, 1), to: e(new Date(now.getFullYear(), now.getMonth(), 0)) };
      case 'thisYear':  return { from: new Date(now.getFullYear(), 0, 1), to: e(new Date(now.getFullYear(), 11, 31)) };
      case 'lastYear':  return { from: new Date(now.getFullYear()-1, 0, 1), to: e(new Date(now.getFullYear()-1, 11, 31)) };
      default:          return { from: s(now), to: e(now) };
    }
  }

  // ==============================
  // DISPLAY HELPERS
  // ==============================
  /** Sync from parent: update the applied range without emitting */
  syncFromQuickRange(presetName: string): void;
  syncFromQuickRange(from: Date, to: Date): void;
  syncFromQuickRange(fromOrPreset: string | Date, to?: Date) {
    let from: Date, toDate: Date;
    let preset: string | null = null;
    if (typeof fromOrPreset === 'string') {
      const range = this.getPresetRange(fromOrPreset);
      from = range.from;
      toDate = range.to;
      preset = fromOrPreset;
    } else {
      from = fromOrPreset;
      toDate = to!;
    }
    this.appliedFrom    = from;
    this.appliedTo      = toDate;
    this.appliedPreset  = preset;
    this.appliedInterval = '';
    this.draftFrom      = new Date(from);
    this.draftTo        = new Date(toDate);
    this.selectingTo    = false;
    this.hoverDate      = null;
  }

  get triggerLabel(): string {
    if (!this.appliedFrom || !this.appliedTo) return 'Seleccionar rango';
    if (this.isSameDay(this.appliedFrom, this.appliedTo)) return this.fmt(this.appliedFrom);
    return `${this.fmt(this.appliedFrom)} – ${this.fmt(this.appliedTo)}`;
  }

  fmt(d: Date): string {
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getMonthLabel(d: Date): string {
    return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  fmtInput(d: Date | null): string {
    if (!d) return '– – / – – / – – – –';
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm} / ${dd} / ${yyyy}`;
  }

  get effectiveTo(): Date | null {
    return this.selectingTo && this.hoverDate ? this.hoverDate : this.draftTo;
  }
}
