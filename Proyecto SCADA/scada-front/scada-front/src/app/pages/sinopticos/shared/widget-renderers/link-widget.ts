import { Component, input, output } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowTopRightOnSquare } from '@ng-icons/heroicons/outline';

interface LinkConfig {
  targetSinopticoId: number | null;
  targetName: string;
  label: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
}

@Component({
  selector: 'widget-link',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ heroArrowTopRightOnSquare })],
  template: `
    <div
      class="link-body"
      [style.backgroundColor]="cfg().bgColor"
      [style.color]="cfg().textColor"
      [style.fontSize.px]="cfg().fontSize"
      (click)="navigate.emit(cfg().targetSinopticoId)"
    >
      <ng-icon name="heroArrowTopRightOnSquare" size="16" />
      <span>{{ cfg().label }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .link-body {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: filter 0.15s;
        box-sizing: border-box;
        padding: 8px;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .link-body:hover {
        filter: brightness(1.1);
      }
    `,
  ],
})
export class LinkWidget {
  cfg = input.required<LinkConfig>({ alias: 'config' });
  navigate = output<number | null>();
}
