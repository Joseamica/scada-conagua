import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AlarmGroup {
  id: number;
  name: string;
  description: string | null;
  parent_group_id: number | null;
  municipality: string | null;
  estado_id: number;
  is_enabled: boolean;
  alarm_count: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Alarm {
  id: number;
  group_id: number;
  group_name: string;
  name: string;
  description: string | null;
  severity: 'aviso' | 'alerta' | 'critico';
  is_enabled: boolean;
  dev_eui: string;
  measurement: string;
  comparison_operator: '<' | '>' | '=' | '<>';
  threshold_value: number;
  hysteresis_activation_sec: number;
  hysteresis_deactivation_sec: number;
  action_type: 'none' | 'email' | 'telegram';
  notify_on_state_change: boolean;
  notification_template: string | null;
  resend_period_min: number;
  resend_enabled: boolean;
  play_sound: boolean;
  show_banner: boolean;
  current_state?: string;
  last_value?: number;
  last_evaluated_at?: string;
  acknowledged_at?: string;
  ack_comment?: string;
  created_at: string;
}

export interface ActiveAlarm {
  id: number;
  name: string;
  severity: 'aviso' | 'alerta' | 'critico';
  dev_eui: string;
  measurement: string;
  comparison_operator: string;
  threshold_value: number;
  play_sound: boolean;
  show_banner: boolean;
  current_state: string;
  last_value: number;
  last_triggered_at: string;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  ack_comment: string | null;
  group_name: string;
  site_name: string;
  municipality: string;
}

export interface AlarmRecipient {
  id: number;
  contact_name: string;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  comments: string | null;
  created_by_name: string;
}

export interface RecipientCollection {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
}

export interface AlarmHistoryEntry {
  id: number;
  alarm_id: number;
  alarm_name: string;
  dev_eui: string;
  group_name: string;
  severity: string;
  previous_state: string;
  new_state: string;
  trigger_value: number;
  threshold_value: number;
  transition_reason: string;
  user_name: string;
  ack_comment: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AlarmService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/alarms`;

  // Signal for active alarm count (used in header badge)
  activeAlarms = signal<ActiveAlarm[]>([]);
  activeCount = computed(() => this.activeAlarms().length);
  criticalCount = computed(() => this.activeAlarms().filter(a => a.severity === 'critico').length);
  bannerAlarms = computed(() => this.activeAlarms().filter(a => a.show_banner && a.current_state === 'ACTIVE_UNACK'));
  soundAlarms = computed(() => this.activeAlarms().filter(a => a.play_sound && a.current_state === 'ACTIVE_UNACK'));

  private pollingInterval: any = null;
  private isLeader = false;
  private bc: BroadcastChannel | null = null;
  private leaderHeartbeat: any = null;
  private lastLeaderSeen = 0;

  startPolling(intervalMs = 15000): void {
    this.stopPolling();
    this.setupLeaderElection(intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.leaderHeartbeat) {
      clearInterval(this.leaderHeartbeat);
      this.leaderHeartbeat = null;
    }
    if (this.isLeader && this.bc) {
      this.bc.postMessage({ type: 'leader-resign' });
    }
    this.isLeader = false;
  }

  private setupLeaderElection(intervalMs: number): void {
    if (typeof BroadcastChannel === 'undefined') {
      // Fallback: no BroadcastChannel support, poll directly
      this.becomeLeader(intervalMs);
      return;
    }

    this.bc = new BroadcastChannel('scada-alarm-polling');
    this.bc.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'alarms-update') {
        this.activeAlarms.set(msg.alarms);
      } else if (msg.type === 'leader-heartbeat') {
        this.lastLeaderSeen = Date.now();
      } else if (msg.type === 'leader-resign') {
        // Leader left, try to become leader after short random delay
        setTimeout(() => this.tryBecomeLeader(intervalMs), Math.random() * 1000);
      }
    };

    // Try to claim leadership
    this.tryBecomeLeader(intervalMs);
  }

  private tryBecomeLeader(intervalMs: number): void {
    if (this.isLeader) return;
    // If we've seen a leader recently, stay follower
    if (Date.now() - this.lastLeaderSeen < 5000) return;
    this.becomeLeader(intervalMs);
  }

  private becomeLeader(intervalMs: number): void {
    this.isLeader = true;
    this.fetchActive();
    this.pollingInterval = setInterval(() => this.fetchActive(), intervalMs);
    // Send heartbeat so other tabs know there's a leader
    if (this.bc) {
      this.leaderHeartbeat = setInterval(() => {
        this.bc!.postMessage({ type: 'leader-heartbeat' });
      }, 3000);
      this.bc.postMessage({ type: 'leader-heartbeat' });
    }
  }

  private fetchActive(): void {
    this.http.get<ActiveAlarm[]>(`${this.base}/active`).subscribe({
      next: (alarms) => {
        this.activeAlarms.set(alarms);
        // Broadcast to other tabs
        if (this.isLeader && this.bc) {
          this.bc.postMessage({ type: 'alarms-update', alarms });
        }
      },
      error: () => {},
    });
  }

  // Groups
  getGroups(): Observable<AlarmGroup[]> {
    return this.http.get<AlarmGroup[]>(`${this.base}/groups`);
  }

  createGroup(data: Partial<AlarmGroup>): Observable<AlarmGroup> {
    return this.http.post<AlarmGroup>(`${this.base}/groups`, data);
  }

  updateGroup(id: number, data: Partial<AlarmGroup>): Observable<AlarmGroup> {
    return this.http.put<AlarmGroup>(`${this.base}/groups/${id}`, data);
  }

  deleteGroup(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/groups/${id}`);
  }

  // Alarms
  getAlarms(groupId?: number): Observable<Alarm[]> {
    let params = new HttpParams();
    if (groupId) params = params.set('group_id', groupId.toString());
    return this.http.get<Alarm[]>(this.base, { params });
  }

  createAlarm(data: Partial<Alarm>): Observable<Alarm> {
    return this.http.post<Alarm>(this.base, data);
  }

  updateAlarm(id: number, data: Partial<Alarm>): Observable<Alarm> {
    return this.http.put<Alarm>(`${this.base}/${id}`, data);
  }

  deleteAlarm(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  getActiveAlarms(): Observable<ActiveAlarm[]> {
    return this.http.get<ActiveAlarm[]>(`${this.base}/active`);
  }

  acknowledgeAlarm(id: number, comment: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${id}/acknowledge`, { comment });
  }

  // History
  getHistory(params: { page?: number; limit?: number; from?: string; to?: string; severity?: string; dev_eui?: string }): Observable<{ data: AlarmHistoryEntry[]; total: number; page: number; limit: number }> {
    let httpParams = new HttpParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) httpParams = httpParams.set(key, String(val));
    }
    return this.http.get<{ data: AlarmHistoryEntry[]; total: number; page: number; limit: number }>(`${this.base}/history`, { params: httpParams });
  }

  exportHistory(from?: string, to?: string): Observable<Blob> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get(`${this.base}/history/export`, { params, responseType: 'blob' });
  }

  // Recipients
  getRecipients(): Observable<AlarmRecipient[]> {
    return this.http.get<AlarmRecipient[]>(`${this.base}/recipients`);
  }

  createRecipient(data: Partial<AlarmRecipient>): Observable<AlarmRecipient> {
    return this.http.post<AlarmRecipient>(`${this.base}/recipients`, data);
  }

  updateRecipient(id: number, data: Partial<AlarmRecipient>): Observable<AlarmRecipient> {
    return this.http.put<AlarmRecipient>(`${this.base}/recipients/${id}`, data);
  }

  deleteRecipient(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/recipients/${id}`);
  }

  // Collections
  getCollections(): Observable<RecipientCollection[]> {
    return this.http.get<RecipientCollection[]>(`${this.base}/collections`);
  }

  createCollection(data: { name: string; description?: string; recipient_ids?: number[] }): Observable<RecipientCollection> {
    return this.http.post<RecipientCollection>(`${this.base}/collections`, data);
  }

  updateCollection(id: number, data: { name?: string; description?: string; recipient_ids?: number[] }): Observable<RecipientCollection> {
    return this.http.put<RecipientCollection>(`${this.base}/collections/${id}`, data);
  }

  deleteCollection(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/collections/${id}`);
  }
}
