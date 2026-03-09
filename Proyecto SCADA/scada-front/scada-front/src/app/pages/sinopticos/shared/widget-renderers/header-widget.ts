import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HeaderConfig {
  title: string;
  subtitle: string;
  logoUrl: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
}

@Component({
  selector: 'widget-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="header-widget"
      [style.backgroundColor]="cfg().bgColor || '#6d002b'"
      [style.color]="cfg().textColor || '#ffffff'"
    >
      <img *ngIf="cfg().logoUrl" [src]="cfg().logoUrl" class="header-logo" alt="Logo" />
      <div class="header-text">
        <div class="header-title" [style.fontSize.px]="cfg().fontSize || 24">
          {{ cfg().title || 'Titulo' }}
        </div>
        <div class="header-subtitle" *ngIf="cfg().subtitle">
          {{ cfg().subtitle }}
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .header-widget {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 100%;
        padding: 8px 16px;
        box-sizing: border-box;
        border-radius: 4px;
      }
      .header-logo {
        height: 80%;
        max-height: 48px;
        object-fit: contain;
      }
      .header-text {
        flex: 1;
        min-width: 0;
      }
      .header-title {
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .header-subtitle {
        font-size: 12px;
        opacity: 0.8;
        margin-top: 2px;
      }
    `,
  ],
})
export class HeaderWidget {
  cfg = input.required<HeaderConfig>({ alias: 'config' });
}
