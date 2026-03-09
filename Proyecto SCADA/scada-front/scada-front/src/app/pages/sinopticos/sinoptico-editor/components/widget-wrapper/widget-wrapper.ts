import { Component, input, output, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash, heroLockClosed, heroLockOpen, heroArrowsPointingOut } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'widget-wrapper',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ heroTrash, heroLockClosed, heroLockOpen, heroArrowsPointingOut })],
  template: `
    <div
      class="widget-wrapper"
      [class.selected]="selected()"
      [class.locked]="locked()"
      [style.left.px]="x()"
      [style.top.px]="y()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.zIndex]="zIndex()"
      (mousedown)="onMouseDown($event)"
    >
      <!-- Content slot -->
      <div class="widget-content">
        <ng-content />
      </div>

      <!-- Selection overlay -->
      @if (selected() && !locked()) {
        <!-- Resize handles -->
        <div class="handle handle-nw" (mousedown)="onResizeStart($event, 'nw')"></div>
        <div class="handle handle-n" (mousedown)="onResizeStart($event, 'n')"></div>
        <div class="handle handle-ne" (mousedown)="onResizeStart($event, 'ne')"></div>
        <div class="handle handle-e" (mousedown)="onResizeStart($event, 'e')"></div>
        <div class="handle handle-se" (mousedown)="onResizeStart($event, 'se')"></div>
        <div class="handle handle-s" (mousedown)="onResizeStart($event, 's')"></div>
        <div class="handle handle-sw" (mousedown)="onResizeStart($event, 'sw')"></div>
        <div class="handle handle-w" (mousedown)="onResizeStart($event, 'w')"></div>

        <!-- Mini toolbar -->
        <div class="widget-toolbar">
          <button class="tb-btn" (mousedown)="$event.stopPropagation()" (click)="onDelete.emit()" title="Eliminar">
            <ng-icon name="heroTrash" size="14" />
          </button>
          <button class="tb-btn" (mousedown)="$event.stopPropagation()" (click)="onToggleLock.emit()" title="Bloquear">
            <ng-icon [name]="locked() ? 'heroLockClosed' : 'heroLockOpen'" size="14" />
          </button>
          <button class="tb-btn" (mousedown)="$event.stopPropagation()" (click)="onBringFront.emit()" title="Al frente">
            <ng-icon name="heroArrowsPointingOut" size="14" />
          </button>
        </div>
      }

      @if (locked() && selected()) {
        <div class="locked-badge">
          <ng-icon name="heroLockClosed" size="12" />
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .widget-wrapper {
      position: absolute;
      cursor: move;
      user-select: none;
      border: 2px solid transparent;
      border-radius: 4px;
      transition: border-color 0.1s ease;
    }

    .widget-wrapper:hover:not(.selected) {
      border-color: rgba(109, 0, 43, 0.25);
    }

    .widget-wrapper.selected {
      border-color: var(--accent, #6d002b);
      box-shadow: 0 0 0 1px var(--accent, #6d002b);
    }

    .widget-wrapper.locked {
      cursor: default;
    }

    .widget-content {
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 2px;
      pointer-events: none; /* Prevents widget internals from capturing mouse during drag */
    }

    .widget-wrapper.selected .widget-content {
      pointer-events: auto; /* Re-enable when selected for interaction */
    }

    /* Resize handles */
    .handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--bg-card, #fff);
      border: 2px solid var(--accent, #6d002b);
      border-radius: 2px;
      z-index: 10;
    }

    .handle-nw { top: -5px; left: -5px; cursor: nw-resize; }
    .handle-n  { top: -5px; left: calc(50% - 5px); cursor: n-resize; }
    .handle-ne { top: -5px; right: -5px; cursor: ne-resize; }
    .handle-e  { top: calc(50% - 5px); right: -5px; cursor: e-resize; }
    .handle-se { bottom: -5px; right: -5px; cursor: se-resize; }
    .handle-s  { bottom: -5px; left: calc(50% - 5px); cursor: s-resize; }
    .handle-sw { bottom: -5px; left: -5px; cursor: sw-resize; }
    .handle-w  { top: calc(50% - 5px); left: -5px; cursor: w-resize; }

    /* Mini toolbar */
    .widget-toolbar {
      position: absolute;
      top: -32px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 2px;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-default, #e2e8f0);
      border-radius: 6px;
      padding: 2px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      z-index: 20;
    }

    .tb-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: var(--text-secondary, #475569);
      transition: background 0.1s, color 0.1s;
    }

    .tb-btn:hover {
      background: var(--bg-card-hover, #f8fafc);
      color: var(--text-primary, #0f172a);
    }

    .tb-btn:first-child:hover {
      color: var(--danger, #dc2626);
      background: var(--danger-bg, #fef2f2);
    }

    .locked-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      padding: 3px;
      color: var(--text-muted);
      display: flex;
    }
  `]
})
export class WidgetWrapper {
  // Inputs
  x = input.required<number>();
  y = input.required<number>();
  width = input.required<number>();
  height = input.required<number>();
  zIndex = input(0);
  selected = input(false);
  locked = input(false);
  zoom = input(1);

  // Outputs
  onSelect = output<MouseEvent>();
  onMove = output<{ x: number; y: number }>();
  onResize = output<{ width: number; height: number; x: number; y: number }>();
  onDelete = output<void>();
  onToggleLock = output<void>();
  onBringFront = output<void>();

  private el = inject(ElementRef);
  private dragState: { startX: number; startY: number; origX: number; origY: number } | null = null;
  private resizeState: {
    handle: string;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null = null;

  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.onSelect.emit(event);

    if (this.locked()) return;

    // Start move drag
    this.dragState = {
      startX: event.clientX,
      startY: event.clientY,
      origX: this.x(),
      origY: this.y(),
    };

    const z = this.zoom() || 1;
    const onMove = (e: MouseEvent) => {
      if (!this.dragState) return;
      const dx = (e.clientX - this.dragState.startX) / z;
      const dy = (e.clientY - this.dragState.startY) / z;
      this.onMove.emit({
        x: this.dragState.origX + dx,
        y: this.dragState.origY + dy,
      });
    };

    const onUp = () => {
      this.dragState = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  onResizeStart(event: MouseEvent, handle: string): void {
    event.stopPropagation();
    event.preventDefault();

    this.resizeState = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origX: this.x(),
      origY: this.y(),
      origW: this.width(),
      origH: this.height(),
    };

    const rz = this.zoom() || 1;
    const onMove = (e: MouseEvent) => {
      if (!this.resizeState) return;
      const s = this.resizeState;
      const dx = (e.clientX - s.startX) / rz;
      const dy = (e.clientY - s.startY) / rz;

      let newX = s.origX;
      let newY = s.origY;
      let newW = s.origW;
      let newH = s.origH;

      if (s.handle.includes('e')) newW = s.origW + dx;
      if (s.handle.includes('w')) { newW = s.origW - dx; newX = s.origX + dx; }
      if (s.handle.includes('s')) newH = s.origH + dy;
      if (s.handle.includes('n')) { newH = s.origH - dy; newY = s.origY + dy; }

      // Min sizes
      newW = Math.max(50, newW);
      newH = Math.max(30, newH);

      this.onResize.emit({ width: newW, height: newH, x: newX, y: newY });
    };

    const onUp = () => {
      this.resizeState = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}
