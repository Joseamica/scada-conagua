import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ImageConfig {
  src: string;
  alt: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius: number;
}

@Component({
  selector: 'widget-image',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="image-widget">
      <img
        *ngIf="cfg().src"
        [src]="cfg().src"
        [alt]="cfg().alt"
        [style.objectFit]="cfg().objectFit || 'contain'"
        [style.borderRadius.px]="cfg().borderRadius || 0"
      />
      <div class="image-placeholder" *ngIf="!cfg().src">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span>Sin imagen</span>
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
      .image-widget {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--bg-card);
      }
      .image-widget img {
        width: 100%;
        height: 100%;
        display: block;
      }
      .image-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
    `,
  ],
})
export class ImageWidget {
  cfg = input.required<ImageConfig>({ alias: 'config' });
}
