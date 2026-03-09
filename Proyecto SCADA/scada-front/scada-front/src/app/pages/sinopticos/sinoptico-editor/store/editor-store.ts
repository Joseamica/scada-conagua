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
      label: { width: 200, height: 100 },
      chart: { width: 500, height: 300 },
      map: { width: 500, height: 400 },
      table: { width: 600, height: 300 },
      header: { width: 800, height: 80 },
      image: { width: 300, height: 200 },
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

  // --- Selection ---
  select(id: string, additive = false): void {
    if (additive) {
      this._selectedIds.update((ids) => {
        const next = new Set(ids);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      this._selectedIds.set(new Set([id]));
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
}
