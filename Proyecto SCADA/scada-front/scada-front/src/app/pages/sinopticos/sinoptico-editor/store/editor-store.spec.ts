import { EditorStore } from './editor-store';
import { CanvasWidget } from '../../../../core/services/sinoptico.service';

function makeWidget(overrides: Partial<CanvasWidget> = {}): CanvasWidget {
  return {
    id: crypto.randomUUID(),
    type: 'label',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    zIndex: 0,
    locked: false,
    config: { devEUI: '', measurement: '', title: '', unit: '', fontSize: 24, decimals: 2 },
    ...overrides,
  };
}

describe('EditorStore', () => {
  let store: EditorStore;

  beforeEach(() => {
    store = new EditorStore();
  });

  describe('Alignment', () => {
    it('alignLeft should set all selected widgets to the leftmost x', () => {
      const w1 = makeWidget({ x: 100, y: 50 });
      const w2 = makeWidget({ x: 300, y: 80 });
      const w3 = makeWidget({ x: 500, y: 20 });
      store.loadCanvas({ widgets: [w1, w2, w3], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.select(w3.id, true);
      store.alignLeft();

      const widgets = store.widgets();
      expect(widgets.find((w) => w.id === w1.id)!.x).toBe(100);
      expect(widgets.find((w) => w.id === w2.id)!.x).toBe(100);
      expect(widgets.find((w) => w.id === w3.id)!.x).toBe(100);
    });

    it('alignRight should set all selected widgets to rightmost edge', () => {
      const w1 = makeWidget({ x: 100, width: 100 });
      const w2 = makeWidget({ x: 200, width: 150 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignRight();

      const widgets = store.widgets();
      // maxR = 200 + 150 = 350
      expect(widgets.find((w) => w.id === w1.id)!.x).toBe(250); // 350 - 100
      expect(widgets.find((w) => w.id === w2.id)!.x).toBe(200); // 350 - 150
    });

    it('alignTop should set all selected widgets to the topmost y', () => {
      const w1 = makeWidget({ y: 50 });
      const w2 = makeWidget({ y: 200 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignTop();

      const widgets = store.widgets();
      expect(widgets.find((w) => w.id === w1.id)!.y).toBe(50);
      expect(widgets.find((w) => w.id === w2.id)!.y).toBe(50);
    });

    it('alignBottom should set all selected widgets to bottommost edge', () => {
      const w1 = makeWidget({ y: 50, height: 50 });
      const w2 = makeWidget({ y: 100, height: 80 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignBottom();

      const widgets = store.widgets();
      // maxB = 100 + 80 = 180
      expect(widgets.find((w) => w.id === w1.id)!.y).toBe(130); // 180 - 50
      expect(widgets.find((w) => w.id === w2.id)!.y).toBe(100); // 180 - 80
    });

    it('alignCenterH should center all widgets horizontally', () => {
      const w1 = makeWidget({ x: 0, width: 100 });
      const w2 = makeWidget({ x: 200, width: 100 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignCenterH();

      const widgets = store.widgets();
      // avg center = ((0+50) + (200+50)) / 2 = 150
      expect(widgets.find((w) => w.id === w1.id)!.x).toBe(100); // 150 - 50
      expect(widgets.find((w) => w.id === w2.id)!.x).toBe(100); // 150 - 50
    });

    it('alignCenterV should center all widgets vertically', () => {
      const w1 = makeWidget({ y: 0, height: 40 });
      const w2 = makeWidget({ y: 200, height: 60 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignCenterV();

      const widgets = store.widgets();
      // avg center = ((0+20) + (200+30)) / 2 = 125
      expect(widgets.find((w) => w.id === w1.id)!.y).toBe(105); // 125 - 20
      expect(widgets.find((w) => w.id === w2.id)!.y).toBe(95); // 125 - 30
    });

    it('should not align with fewer than 2 selected', () => {
      const w1 = makeWidget({ x: 100 });
      store.loadCanvas({ widgets: [w1], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.alignLeft();

      expect(store.widgets()[0].x).toBe(100); // unchanged
    });

    it('alignLeft should be undoable', () => {
      const w1 = makeWidget({ x: 100 });
      const w2 = makeWidget({ x: 300 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.alignLeft();

      expect(store.widgets().find((w) => w.id === w2.id)!.x).toBe(100);

      store.undo();

      expect(store.widgets().find((w) => w.id === w2.id)!.x).toBe(300);
    });
  });

  describe('Distribution', () => {
    it('distributeH should space 3+ widgets evenly', () => {
      const w1 = makeWidget({ x: 0, width: 40 });
      const w2 = makeWidget({ x: 50, width: 40 });
      const w3 = makeWidget({ x: 200, width: 40 });
      store.loadCanvas({ widgets: [w1, w2, w3], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.select(w3.id, true);
      store.distributeH();

      const widgets = store.widgets();
      const sorted = [w1, w2, w3]
        .map((orig) => widgets.find((w) => w.id === orig.id)!)
        .sort((a, b) => a.x - b.x);

      // Total span: 0 to 240. Total widget width: 120. Gap: (240-120)/2 = 60
      expect(sorted[0].x).toBe(0);
      expect(sorted[1].x).toBe(100); // 0 + 40 + 60
      expect(sorted[2].x).toBe(200); // 100 + 40 + 60
    });

    it('distributeV should space 3+ widgets evenly vertically', () => {
      const w1 = makeWidget({ y: 0, height: 40 });
      const w2 = makeWidget({ y: 50, height: 40 });
      const w3 = makeWidget({ y: 200, height: 40 });
      store.loadCanvas({ widgets: [w1, w2, w3], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.select(w3.id, true);
      store.distributeV();

      const widgets = store.widgets();
      const sorted = [w1, w2, w3]
        .map((orig) => widgets.find((w) => w.id === orig.id)!)
        .sort((a, b) => a.y - b.y);

      // Total span: 0 to 240. Total widget height: 120. Gap: (240-120)/2 = 60
      expect(sorted[0].y).toBe(0);
      expect(sorted[1].y).toBe(100);
      expect(sorted[2].y).toBe(200);
    });

    it('should not distribute with fewer than 3 selected', () => {
      const w1 = makeWidget({ x: 0 });
      const w2 = makeWidget({ x: 200 });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.distributeH();

      expect(store.widgets().find((w) => w.id === w1.id)!.x).toBe(0);
      expect(store.widgets().find((w) => w.id === w2.id)!.x).toBe(200);
    });
  });

  describe('Grouping', () => {
    it('groupSelected should assign same groupId to all selected', () => {
      const w1 = makeWidget();
      const w2 = makeWidget();
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.groupSelected();

      const widgets = store.widgets();
      const g1 = widgets.find((w) => w.id === w1.id)!.groupId;
      const g2 = widgets.find((w) => w.id === w2.id)!.groupId;
      expect(g1).toBeDefined();
      expect(g1).toBe(g2);
    });

    it('ungroupSelected should clear groupId', () => {
      const groupId = 'test-group';
      const w1 = makeWidget({ groupId });
      const w2 = makeWidget({ groupId });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      // w2 should also be selected due to group expansion
      store.ungroupSelected();

      const widgets = store.widgets();
      expect(widgets.find((w) => w.id === w1.id)!.groupId).toBeUndefined();
      expect(widgets.find((w) => w.id === w2.id)!.groupId).toBeUndefined();
    });

    it('select should expand to group siblings', () => {
      const groupId = 'g1';
      const w1 = makeWidget({ groupId });
      const w2 = makeWidget({ groupId });
      const w3 = makeWidget(); // not grouped
      store.loadCanvas({ widgets: [w1, w2, w3], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);

      const selectedIds = store.selectedIds();
      expect(selectedIds.has(w1.id)).toBe(true);
      expect(selectedIds.has(w2.id)).toBe(true);
      expect(selectedIds.has(w3.id)).toBe(false);
    });

    it('hasGroupedSelection should be true when grouped widget is selected', () => {
      const w1 = makeWidget({ groupId: 'g1' });
      const w2 = makeWidget({ groupId: 'g1' });
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      expect(store.hasGroupedSelection()).toBe(false);

      store.select(w1.id);
      expect(store.hasGroupedSelection()).toBe(true);
    });

    it('grouping should be undoable', () => {
      const w1 = makeWidget();
      const w2 = makeWidget();
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      store.groupSelected();

      expect(store.widgets()[0].groupId).toBeDefined();

      store.undo();

      expect(store.widgets()[0].groupId).toBeUndefined();
    });

    it('should not group with fewer than 2 selected', () => {
      const w1 = makeWidget();
      store.loadCanvas({ widgets: [w1], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.groupSelected();

      expect(store.widgets()[0].groupId).toBeUndefined();
    });
  });

  describe('canGroup computed', () => {
    it('should be false with 0 or 1 selected', () => {
      const w1 = makeWidget();
      store.loadCanvas({ widgets: [w1], grid: { snap: true, size: 10 }, zoom: 1 });
      expect(store.canGroup()).toBe(false);

      store.select(w1.id);
      expect(store.canGroup()).toBe(false);
    });

    it('should be true with 2+ selected', () => {
      const w1 = makeWidget();
      const w2 = makeWidget();
      store.loadCanvas({ widgets: [w1, w2], grid: { snap: true, size: 10 }, zoom: 1 });

      store.select(w1.id);
      store.select(w2.id, true);
      expect(store.canGroup()).toBe(true);
    });
  });
});
