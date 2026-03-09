import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="spinner-overlay" [class.spinner-overlay--inline]="mode === 'inline'">
      <div class="spinner-ring"></div>
      @if (label) { <span class="spinner-text">{{ label }}</span> }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .spinner-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 48px 16px;
      width: 100%;
    }

    .spinner-overlay--inline {
      padding: 24px 16px;
    }

    .spinner-ring {
      width: 36px;
      height: 36px;
      border: 3px solid var(--border-default, #e2e8f0);
      border-top-color: var(--accent, #6d002b);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .spinner-text {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted, #94a3b8);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  imports: [],
})
export class LoadingSpinnerComponent {
  @Input() label = '';
  @Input() mode: 'fullpage' | 'inline' = 'fullpage';
}
