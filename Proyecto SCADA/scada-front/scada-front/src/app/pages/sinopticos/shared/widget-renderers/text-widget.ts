import { Component, input } from '@angular/core';

interface TextConfig {
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  bgColor: string;
  padding: number;
}

@Component({
  selector: 'widget-text',
  standalone: true,
  template: `
    <div
      class="text-body"
      [style.fontSize.px]="cfg().fontSize"
      [style.fontWeight]="cfg().fontWeight"
      [style.fontStyle]="cfg().fontStyle"
      [style.textAlign]="cfg().textAlign"
      [style.color]="cfg().color"
      [style.backgroundColor]="cfg().bgColor"
      [style.padding.px]="cfg().padding"
    >
      {{ cfg().text }}
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .text-body {
        width: 100%;
        height: 100%;
        word-wrap: break-word;
        overflow: hidden;
        box-sizing: border-box;
        font-family: 'Inter', system-ui, sans-serif;
        line-height: 1.4;
      }
    `,
  ],
})
export class TextWidget {
  cfg = input.required<TextConfig>({ alias: 'config' });
}
