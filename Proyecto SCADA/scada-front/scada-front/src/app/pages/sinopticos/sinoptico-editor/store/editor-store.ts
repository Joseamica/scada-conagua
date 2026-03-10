import { Injectable, signal, computed } from '@angular/core';
import {
  CanvasState,
  CanvasWidget,
  defaultWidgetConfig,
} from '../../../../core/services/sinoptico.service';

@Injectable()
export class EditorStore {
  // --- Canvas State ---
  private _widgets = signal<CanvasWidget[]>([]);
  private _grid = signal<{ snap: boolean; size: number }>({ snap: true, size: 10 });
  private _zoom = signal(1);

  // --- Selection ---
  private _selectedIds = signal<Set<string>>(new Set());

  // --- Undo/Redo ---
  private _undoStack = signal<CanvasWidget[][]>([]);
  private _redoStack = signal<CanvasWidget[][]>([]);
  private readonly MAX_UNDO = 50;

  // --- Clipboard ---
  private _clipboard = signal<CanvasWidget[]>([]);

  // --- Dirty tracking ---
  private _dirty = signal(false);
  private _nextZIndex = signal(1);

  // --- Public computed ---
  readonly widgets = this._widgets.asReadonly();
  readonly grid = this._grid.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly dirty = this._dirty.asReadonly();
  readonly widgetCount = computed(() => this._widgets().length);
  readonly canUndo = computed(() => this._undoStack().length > 0);
  readonly canRedo = computed(() => this._redoStack().length > 0);
  readonly selectedWidgets = computed(() => {
    const ids = this._selectedIds();
    return this._widgets().filter((w) => ids.has(w.id));
  });
  readonly selectedWidget = computed(() => {
    const sel = this.selectedWidgets();
    return sel.length === 1 ? sel[0] : null;
  });
  readonly hasGroupedSelection = computed(() =>
    this.selectedWidgets().some((w) => !!w.groupId),
  );
  readonly canGroup = computed(() => this.selectedWidgets().length >= 2);
  readonly hasClipboard = computed(() => this._clipboard().length > 0);

  // --- Initialize from loaded sinoptico ---
  loadCanvas(state: CanvasState): void {
    this._widgets.set([...state.widgets]);
    this._grid.set({ ...state.grid });
    this._zoom.set(state.zoom);
    this._dirty.set(false);
    this._undoStack.set([]);
    this._redoStack.set([]);
    this._selectedIds.set(new Set());
    // Calculate next zIndex
    const maxZ = state.widgets.reduce((max, w) => Math.max(max, w.zIndex), 0);
    this._nextZIndex.set(maxZ + 1);
  }

  // --- Get current canvas state for saving ---
  getCanvasState(): CanvasState {
    return {
      widgets: this._widgets(),
      grid: this._grid(),
      zoom: this._zoom(),
    };
  }

  // --- Push undo snapshot before mutation ---
  private pushUndo(): void {
    const stack = [...this._undoStack()];
    stack.push([...this._widgets().map((w) => ({ ...w, config: { ...w.config } }))]);
    if (stack.length > this.MAX_UNDO) stack.shift();
    this._undoStack.set(stack);
    this._redoStack.set([]); // clear redo on new action
    this._dirty.set(true);
  }

  // --- Undo ---
  undo(): void {
    const undoStack = [...this._undoStack()];
    if (undoStack.length === 0) return;
    const prev = undoStack.pop()!;
    this._undoStack.set(undoStack);
    // Push current to redo
    const redoStack = [...this._redoStack()];
    redoStack.push([...this._widgets().map((w) => ({ ...w, config: { ...w.config } }))]);
    this._redoStack.set(redoStack);
    this._widgets.set(prev);
  }

  // --- Redo ---
  redo(): void {
    const redoStack = [...this._redoStack()];
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    this._redoStack.set(redoStack);
    // Push current to undo
    const undoStack = [...this._undoStack()];
    undoStack.push([...this._widgets().map((w) => ({ ...w, config: { ...w.config } }))]);
    this._undoStack.set(undoStack);
    this._widgets.set(next);
  }

  // --- Add widget ---
  addWidget(type: CanvasWidget['type'], x: number, y: number): CanvasWidget {
    this.pushUndo();
    const id = crypto.randomUUID();
    const defaults: Record<CanvasWidget['type'], { width: number; height: number }> = {
      label: { width: 240, height: 120 },
      chart: { width: 500, height: 300 },
      map: { width: 500, height: 400 },
      table: { width: 600, height: 300 },
      header: { width: 800, height: 80 },
      image: { width: 300, height: 200 },
      text: { width: 200, height: 60 },
      shape: { width: 150, height: 100 },
      link: { width: 160, height: 50 },
      clock: { width: 200, height: 100 },
      variable: { width: 240, height: 120 },
    };
    const size = defaults[type];
    const widget: CanvasWidget = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      width: size.width,
      height: size.height,
      zIndex: this._nextZIndex(),
      locked: false,
      config: defaultWidgetConfig(type),
    };
    this._nextZIndex.update((z) => z + 1);
    this._widgets.update((list) => [...list, widget]);
    this._selectedIds.set(new Set([id]));
    return widget;
  }

  // --- Remove widget ---
  removeWidget(id: string): void {
    this.pushUndo();
    this._widgets.update((list) => list.filter((w) => w.id !== id));
    this._selectedIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  // --- Move widget ---
  moveWidget(id: string, x: number, y: number): void {
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, x: Math.round(x), y: Math.round(y) } : w)),
    );
  }

  // --- Resize widget ---
  resizeWidget(id: string, width: number, height: number, x?: number, y?: number): void {
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => {
        if (w.id !== id) return w;
        const update: Partial<CanvasWidget> = {
          width: Math.max(50, Math.round(width)),
          height: Math.max(30, Math.round(height)),
        };
        if (x !== undefined) update.x = Math.round(x);
        if (y !== undefined) update.y = Math.round(y);
        return { ...w, ...update };
      }),
    );
  }

  // --- Update widget config ---
  updateWidgetConfig(id: string, config: Partial<any>): void {
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...config } } : w)),
    );
  }

  // --- Selection (with group expansion) ---
  select(id: string, additive = false): void {
    const widget = this._widgets().find((w) => w.id === id);
    const targetIds = [id];
    if (widget?.groupId) {
      for (const w of this._widgets()) {
        if (w.groupId === widget.groupId && w.id !== id) targetIds.push(w.id);
      }
    }
    if (additive) {
      this._selectedIds.update((ids) => {
        const next = new Set(ids);
        if (next.has(id)) {
          for (const g of targetIds) next.delete(g);
        } else {
          for (const g of targetIds) next.add(g);
        }
        return next;
      });
    } else {
      this._selectedIds.set(new Set(targetIds));
    }
  }

  clearSelection(): void {
    this._selectedIds.set(new Set());
  }

  // --- Bring to front / send to back ---
  bringToFront(id: string): void {
    this.pushUndo();
    const z = this._nextZIndex();
    this._nextZIndex.set(z + 1);
    this._widgets.update((list) => list.map((w) => (w.id === id ? { ...w, zIndex: z } : w)));
  }

  sendToBack(id: string): void {
    this.pushUndo();
    const minZ = Math.min(...this._widgets().map((w) => w.zIndex));
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, zIndex: minZ - 1 } : w)),
    );
  }

  // --- Lock/unlock ---
  toggleLock(id: string): void {
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, locked: !w.locked } : w)),
    );
  }

  // --- Copy/Paste ---
  copySelected(): void {
    const sel = this.selectedWidgets();
    this._clipboard.set(sel.map((w) => ({ ...w, config: { ...w.config } })));
  }

  paste(): void {
    const items = this._clipboard();
    if (items.length === 0) return;
    this.pushUndo();
    const newIds: string[] = [];
    const offset = 20;
    for (const item of items) {
      const id = crypto.randomUUID();
      newIds.push(id);
      const widget: CanvasWidget = {
        ...item,
        id,
        x: item.x + offset,
        y: item.y + offset,
        zIndex: this._nextZIndex(),
        config: { ...item.config },
      };
      this._nextZIndex.update((z) => z + 1);
      this._widgets.update((list) => [...list, widget]);
    }
    this._selectedIds.set(new Set(newIds));
  }

  // --- Delete selected ---
  deleteSelected(): void {
    const ids = this._selectedIds();
    if (ids.size === 0) return;
    this.pushUndo();
    this._widgets.update((list) => list.filter((w) => !ids.has(w.id)));
    this._selectedIds.set(new Set());
  }

  // --- Duplicate selected ---
  duplicateSelected(): void {
    const sel = this.selectedWidgets();
    if (sel.length === 0) return;
    this.pushUndo();
    const newIds: string[] = [];
    for (const item of sel) {
      const id = crypto.randomUUID();
      newIds.push(id);
      const widget: CanvasWidget = {
        ...item,
        id,
        x: item.x + 20,
        y: item.y + 20,
        zIndex: this._nextZIndex(),
        config: { ...item.config },
        groupId: undefined,
      };
      this._nextZIndex.update((z) => z + 1);
      this._widgets.update((list) => [...list, widget]);
    }
    this._selectedIds.set(new Set(newIds));
  }

  // --- Update widget field ---
  updateWidgetField(id: string, field: keyof CanvasWidget, value: any): void {
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
    );
  }

  // --- Mark dirty (for external changes like canvas size) ---
  markDirty(): void {
    this._dirty.set(true);
  }

  // --- Match Size (requires ≥2 selected) ---
  matchWidth(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const maxW = Math.max(...sel.map((w) => w.width));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) =>
      list.map((w) => (ids.has(w.id) ? { ...w, width: maxW } : w)),
    );
  }

  matchHeight(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const maxH = Math.max(...sel.map((w) => w.height));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) =>
      list.map((w) => (ids.has(w.id) ? { ...w, height: maxH } : w)),
    );
  }

  matchSize(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const maxW = Math.max(...sel.map((w) => w.width));
    const maxH = Math.max(...sel.map((w) => w.height));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) =>
      list.map((w) => (ids.has(w.id) ? { ...w, width: maxW, height: maxH } : w)),
    );
  }

  // --- Zoom ---
  setZoom(z: number): void {
    this._zoom.set(Math.max(0.2, Math.min(3, z)));
  }

  // --- Grid ---
  setGrid(grid: { snap: boolean; size: number }): void {
    this._grid.set(grid);
  }

  // --- Mark saved ---
  markSaved(): void {
    this._dirty.set(false);
  }

  // --- Snap to grid helper ---
  snapToGrid(value: number): number {
    const g = this._grid();
    if (!g.snap) return value;
    return Math.round(value / g.size) * g.size;
  }

  // --- Batch operations (for drag/resize without spamming undo) ---
  private _pendingSnapshot: CanvasWidget[] | null = null;

  beginBatch(): void {
    if (!this._pendingSnapshot) {
      this._pendingSnapshot = [...this._widgets().map((w) => ({ ...w, config: { ...w.config } }))];
    }
  }

  commitBatch(): void {
    if (this._pendingSnapshot) {
      const stack = [...this._undoStack()];
      stack.push(this._pendingSnapshot);
      if (stack.length > this.MAX_UNDO) stack.shift();
      this._undoStack.set(stack);
      this._redoStack.set([]);
      this._pendingSnapshot = null;
      this._dirty.set(true);
    }
  }

  moveWidgetDirect(id: string, x: number, y: number): void {
    this._widgets.update((list) =>
      list.map((w) => (w.id === id ? { ...w, x: Math.round(x), y: Math.round(y) } : w)),
    );
  }

  resizeWidgetDirect(id: string, width: number, height: number, x?: number, y?: number): void {
    this._widgets.update((list) =>
      list.map((w) => {
        if (w.id !== id) return w;
        const update: Partial<CanvasWidget> = {
          width: Math.max(50, Math.round(width)),
          height: Math.max(30, Math.round(height)),
        };
        if (x !== undefined) update.x = Math.round(x);
        if (y !== undefined) update.y = Math.round(y);
        return { ...w, ...update };
      }),
    );
  }

  selectAll(): void {
    this._selectedIds.set(new Set(this._widgets().map((w) => w.id)));
  }

  // --- Alignment (requires ≥2 selected) ---
  alignLeft(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const minX = Math.min(...sel.map((w) => w.x));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) => list.map((w) => (ids.has(w.id) ? { ...w, x: minX } : w)));
  }

  alignCenterH(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const avg = sel.reduce((s, w) => s + w.x + w.width / 2, 0) / sel.length;
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) =>
      list.map((w) => (ids.has(w.id) ? { ...w, x: Math.round(avg - w.width / 2) } : w)),
    );
  }

  alignRight(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const maxR = Math.max(...sel.map((w) => w.x + w.width));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) => list.map((w) => (ids.has(w.id) ? { ...w, x: maxR - w.width } : w)));
  }

  alignTop(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const minY = Math.min(...sel.map((w) => w.y));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) => list.map((w) => (ids.has(w.id) ? { ...w, y: minY } : w)));
  }

  alignCenterV(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const avg = sel.reduce((s, w) => s + w.y + w.height / 2, 0) / sel.length;
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) =>
      list.map((w) => (ids.has(w.id) ? { ...w, y: Math.round(avg - w.height / 2) } : w)),
    );
  }

  alignBottom(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const maxB = Math.max(...sel.map((w) => w.y + w.height));
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) => list.map((w) => (ids.has(w.id) ? { ...w, y: maxB - w.height } : w)));
  }

  // --- Distribution (requires ≥3 selected) ---
  distributeH(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 3) return;
    this.pushUndo();
    const sorted = [...sel].sort((a, b) => a.x - b.x);
    const left = sorted[0].x;
    const right = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
    const totalW = sorted.reduce((s, w) => s + w.width, 0);
    const gap = (right - left - totalW) / (sorted.length - 1);
    let cx = left;
    const posMap = new Map<string, number>();
    for (const w of sorted) {
      posMap.set(w.id, Math.round(cx));
      cx += w.width + gap;
    }
    this._widgets.update((list) =>
      list.map((w) => (posMap.has(w.id) ? { ...w, x: posMap.get(w.id)! } : w)),
    );
  }

  distributeV(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 3) return;
    this.pushUndo();
    const sorted = [...sel].sort((a, b) => a.y - b.y);
    const top = sorted[0].y;
    const bottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
    const totalH = sorted.reduce((s, w) => s + w.height, 0);
    const gap = (bottom - top - totalH) / (sorted.length - 1);
    let cy = top;
    const posMap = new Map<string, number>();
    for (const w of sorted) {
      posMap.set(w.id, Math.round(cy));
      cy += w.height + gap;
    }
    this._widgets.update((list) =>
      list.map((w) => (posMap.has(w.id) ? { ...w, y: posMap.get(w.id)! } : w)),
    );
  }

  // --- Tidy / Auto-arrange ---
  tidyUp(): void {
    const sel = this.selectedWidgets();
    const targets = sel.length >= 2 ? sel : this._widgets();
    if (targets.length < 2) return;
    this.pushUndo();

    const gap = 20;
    const gridSize = this._grid().size;
    const snap = (v: number) => (this._grid().snap ? Math.round(v / gridSize) * gridSize : Math.round(v));

    // Start position: top-left of current bounding box
    const startX = Math.min(...targets.map((w) => w.x));
    const startY = Math.min(...targets.map((w) => w.y));

    // Sort: larger widgets first (by area), then left-to-right
    const sorted = [...targets].sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaB !== areaA) return areaB - areaA;
      return a.x - b.x || a.y - b.y;
    });

    // Canvas width hint — fit within ~1200px or max existing right edge
    const maxRight = Math.max(...targets.map((w) => w.x + w.width));
    const canvasW = Math.max(1200, maxRight - startX);

    // Simple row packing
    const posMap = new Map<string, { x: number; y: number }>();
    let rowX = startX;
    let rowY = startY;
    let rowMaxH = 0;

    for (const w of sorted) {
      // If adding this widget exceeds canvas width, wrap to next row
      if (rowX > startX && rowX + w.width > startX + canvasW) {
        rowX = startX;
        rowY += rowMaxH + gap;
        rowMaxH = 0;
      }
      posMap.set(w.id, { x: snap(rowX), y: snap(rowY) });
      rowX += w.width + gap;
      rowMaxH = Math.max(rowMaxH, w.height);
    }

    const ids = posMap;
    this._widgets.update((list) =>
      list.map((w) => {
        const pos = ids.get(w.id);
        return pos ? { ...w, x: pos.x, y: pos.y } : w;
      }),
    );
  }

  // --- Grouping ---
  groupSelected(): void {
    const sel = this.selectedWidgets();
    if (sel.length < 2) return;
    this.pushUndo();
    const groupId = crypto.randomUUID();
    const ids = new Set(sel.map((w) => w.id));
    this._widgets.update((list) => list.map((w) => (ids.has(w.id) ? { ...w, groupId } : w)));
  }

  ungroupSelected(): void {
    const sel = this.selectedWidgets();
    const groupIds = new Set(sel.map((w) => w.groupId).filter(Boolean));
    if (groupIds.size === 0) return;
    this.pushUndo();
    this._widgets.update((list) =>
      list.map((w) => (groupIds.has(w.groupId) ? { ...w, groupId: undefined } : w)),
    );
  }
}
