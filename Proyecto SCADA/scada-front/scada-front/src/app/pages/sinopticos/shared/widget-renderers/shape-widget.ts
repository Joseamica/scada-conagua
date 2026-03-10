import { Component, input } from '@angular/core';
import { ShapeConfig } from '../../../../core/services/sinoptico.service';

@Component({
  selector: 'widget-shape',
  standalone: true,
  template: `
    @switch (cfg().shapeType) {
      @case ('rectangle') {
        <div
          class="shape-rect"
          [style.backgroundColor]="cfg().fillColor"
          [style.borderColor]="cfg().borderColor"
          [style.borderWidth.px]="cfg().borderWidth"
          [style.borderRadius.px]="cfg().borderRadius"
        ></div>
      }
      @case ('ellipse') {
        <div
          class="shape-rect"
          [style.backgroundColor]="cfg().fillColor"
          [style.borderColor]="cfg().borderColor"
          [style.borderWidth.px]="cfg().borderWidth"
          [style.borderRadius]="'50%'"
        ></div>
      }
      @case ('line') {
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('triangle') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="50,2 98,98 2,98"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('diamond') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="50,2 98,50 50,98 2,50"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('arrow-right') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="0,25 65,25 65,5 100,50 65,95 65,75 0,75"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('arrow-down') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="25,0 75,0 75,65 95,65 50,100 5,65 25,65"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('pentagon') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="50,2 97,36 79,90 21,90 3,36"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('hexagon') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="50,2 93,27 93,73 50,98 7,73 7,27"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
      @case ('star') {
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
          <polygon
            points="50,2 61,35 97,35 68,57 79,90 50,70 21,90 32,57 3,35 39,35"
            [attr.fill]="cfg().fillColor"
            [attr.stroke]="cfg().borderColor"
            [attr.stroke-width]="cfg().borderWidth"
          />
        </svg>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .shape-rect {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-style: solid;
      }
      svg {
        display: block;
      }
    `,
  ],
})
export class ShapeWidget {
  cfg = input.required<ShapeConfig>({ alias: 'config' });
}
