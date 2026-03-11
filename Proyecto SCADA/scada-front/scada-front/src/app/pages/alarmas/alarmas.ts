import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBellAlert,
  heroCog6Tooth,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import {
  heroBellAlertSolid,
  heroCheckCircleSolid,
  heroClockSolid,
} from '@ng-icons/heroicons/solid';
import { AlarmService, ActiveAlarm } from '../../core/services/alarm.service';

@Component({
  selector: 'app-alarmas',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './alarmas.html',
  styleUrl: './alarmas.css',
  providers: [
    provideIcons({
      heroBellAlert,
      heroBellAlertSolid,
      heroCog6Tooth,
      heroClockSolid,
      heroCheckCircleSolid,
      heroArrowPath,
    }),
  ],
})
export class Alarmas implements OnInit, OnDestroy {
  alarms = signal<ActiveAlarm[]>([]);
  loading = signal(false);
  severityFilter = signal<string>('all');
  ackingId = signal<number | null>(null);
  ackComment = signal('');
  showAckModal = signal(false);

  filtered = computed(() => {
    const sev = this.severityFilter();
    const list = this.alarms();
    if (sev === 'all') return list;
    return list.filter((a) => a.severity === sev);
  });

  countBySeverity = computed(() => {
    const list = this.alarms();
    return {
      critico: list.filter((a) => a.severity === 'critico').length,
      alerta: list.filter((a) => a.severity === 'alerta').length,
      aviso: list.filter((a) => a.severity === 'aviso').length,
    };
  });

  private pollInterval: any = null;

  constructor(
    private alarmService: AlarmService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.fetchAlarms();
    this.pollInterval = setInterval(() => this.fetchAlarms(), 10000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  fetchAlarms() {
    this.loading.set(true);
    this.alarmService.getActiveAlarms().subscribe({
      next: (data) => {
        this.alarms.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setFilter(sev: string) {
    this.severityFilter.set(sev);
  }

  openAck(alarm: ActiveAlarm) {
    this.ackingId.set(alarm.id);
    this.ackComment.set('');
    this.showAckModal.set(true);
  }

  cancelAck() {
    this.showAckModal.set(false);
    this.ackingId.set(null);
  }

  confirmAck() {
    const id = this.ackingId();
    if (!id) return;
    this.alarmService.acknowledgeAlarm(id, this.ackComment()).subscribe({
      next: () => {
        this.showAckModal.set(false);
        this.ackingId.set(null);
        this.fetchAlarms();
      },
      error: () => {
        this.showAckModal.set(false);
        this.ackingId.set(null);
      },
    });
  }

  onAckCommentChange(event: Event) {
    this.ackComment.set((event.target as HTMLTextAreaElement).value);
  }

  severityLabel(sev: string): string {
    const map: Record<string, string> = { critico: 'Critico', alerta: 'Alerta', aviso: 'Aviso' };
    return map[sev] || sev;
  }

  stateLabel(state: string): string {
    const map: Record<string, string> = {
      ACTIVE_UNACK: 'Sin reconocer',
      ACTIVE_ACK: 'Reconocida',
      INACTIVE: 'Inactiva',
    };
    return map[state] || state;
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  }

  goConfig() {
    this.router.navigate(['/alarmas/configuracion']);
  }

  goHistory() {
    this.router.navigate(['/alarmas/historial']);
  }
}
