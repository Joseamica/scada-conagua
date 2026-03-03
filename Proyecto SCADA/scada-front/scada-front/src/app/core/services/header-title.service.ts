import { Injectable, signal } from '@angular/core';

type HeaderStatus = {
  text: string;
  cls: string;
} | null;

@Injectable({ providedIn: 'root' })
export class HeaderTitleService {

  private _title = signal<string | null>(null);
  private _status = signal<HeaderStatus>(null);

  title = this._title.asReadonly();
  status = this._status.asReadonly();

  setTitle(title: string) {
    this._title.set(title);
  }

  setStatus(text: string, cls: string) {
    this._status.set({ text, cls });
  }

  clear() {
    this._title.set(null);
    this._status.set(null);
  }
}
