import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  output,
  input,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  VariableService,
  TagEntry,
  VariableView,
  ViewColumn,
  ViewFormula,
  VariableViewDetail,
} from '../../../../core/services/variable.service';

export interface TagSelection {
  devEUI: string;
  measurement: string;
  siteName: string;
  municipality: string;
  // Variable view integration
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}

interface MunicipalityNode {
  name: string;
  sites: SiteNode[];
  expanded: boolean;
}

interface SiteNode {
  devEUI: string;
  siteName: string;
  measurements: string[];
  expanded: boolean;
}

@Component({
  selector: 'tag-browser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tag-browser" [class.open]="isOpen()">
      <button class="tag-trigger" (click)="toggle()" type="button">
        @if (currentLabel()) {
          <span class="tag-selected">{{ currentLabel() }}</span>
        } @else {
          <span class="tag-placeholder">{{ placeholder() }}</span>
        }
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      @if (isOpen()) {
        <div class="tag-dropdown">
          <input
            class="tag-search"
            type="text"
            placeholder="Buscar sitio o variable..."
            [(ngModel)]="searchTerm"
            (input)="onSearch()"
            #searchInput
          />

          @if (loading()) {
            <div class="tag-loading">
              <div class="tag-spinner"></div>
              Cargando tags...
            </div>
          } @else {
            <div class="tag-tree">
              @for (muni of filteredTree(); track muni.name) {
                <div class="tree-municipality">
                  <div class="tree-node tree-muni" (click)="toggleMuni(muni)">
                    <svg
                      class="tree-arrow"
                      [class.expanded]="muni.expanded"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                    >
                      <path d="M3 2l4 3-4 3z" fill="currentColor" />
                    </svg>
                    <span>{{ muni.name }}</span>
                    <span class="tree-count">{{ muni.sites.length }}</span>
                  </div>

                  @if (muni.expanded) {
                    @for (site of muni.sites; track site.devEUI) {
                      <div class="tree-site-group">
                        <div class="tree-node tree-site" (click)="toggleSite(site)">
                          <svg
                            class="tree-arrow"
                            [class.expanded]="site.expanded"
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                          >
                            <path d="M3 2l4 3-4 3z" fill="currentColor" />
                          </svg>
                          <span class="site-name">{{ site.siteName }}</span>
                        </div>

                        @if (site.expanded) {
                          @for (m of site.measurements; track m) {
                            <div
                              class="tree-node tree-measurement"
                              (click)="selectTag(site, m, muni.name)"
                            >
                              <span class="measurement-dot"></span>
                              {{ m }}
                            </div>
                          }
                        }
                      </div>
                    }
                  }
                </div>
              }

              @if (filteredTree().length === 0 && !loading() && views().length === 0) {
                <div class="tag-empty">
                  @if (searchTerm) {
                    Sin resultados para "{{ searchTerm }}"
                  } @else {
                    No hay tags disponibles
                  }
                </div>
              }

              <!-- Mis Vistas section -->
              @if (views().length > 0) {
                <div class="tag-separator">
                  <span class="separator-label">Mis Vistas</span>
                </div>

                @for (view of views(); track view.id) {
                  <div class="view-node">
                    <div class="view-header" (click)="toggleView(view.id)">
                      <svg
                        class="tree-arrow"
                        [class.expanded]="expandedViews().has(view.id)"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                      >
                        <path d="M3 2l4 3-4 3z" fill="currentColor" />
                      </svg>
                      <svg class="view-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3h18v18H3z" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3 9h18M9 3v18" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span class="view-name">{{ view.name }}</span>
                      @if (view.formula_count) {
                        <span class="view-badge">{{ view.formula_count }}f</span>
                      }
                    </div>

                    @if (expandedViews().has(view.id)) {
                      <div class="view-children">
                        @if (!viewDetails().has(view.id)) {
                          <div class="tag-loading">
                            <div class="tag-spinner"></div>
                            Cargando...
                          </div>
                        }

                        @if (viewDetails().has(view.id)) {
                          @if (viewDetails().get(view.id)!.columns.length > 0) {
                            <div class="section-label">Columnas</div>
                            @for (col of viewDetails().get(view.id)!.columns; track col.id) {
                              <div
                                class="tree-node tree-measurement column-leaf"
                                (click)="selectViewColumn(view, col); $event.stopPropagation()"
                              >
                                <span class="measurement-dot"></span>
                                <span>{{ col.alias }}</span>
                                <span class="tag-agg">{{ col.aggregation }}</span>
                              </div>
                            }
                          }

                          @if (viewDetails().get(view.id)!.formulas.length > 0) {
                            <div class="section-label">Formulas</div>
                            @for (formula of viewDetails().get(view.id)!.formulas; track formula.id) {
                              <div
                                class="tree-node tree-measurement formula-leaf"
                                (click)="selectFormula(view, formula); $event.stopPropagation()"
                              >
                                <span class="formula-dot"></span>
                                <span>{{ formula.alias }}</span>
                                <span class="formula-expr">{{ truncateExpr(formula.expression) }}</span>
                              </div>
                            }
                          }
                        }
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .tag-browser {
        position: relative;
      }

      .tag-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 6px 8px;
        font-size: 12px;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--text-primary);
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        cursor: pointer;
        transition: border-color 0.15s;
        text-align: left;
        box-sizing: border-box;
      }

      .tag-trigger:hover {
        border-color: var(--border-strong);
      }

      .tag-browser.open .tag-trigger {
        border-color: var(--accent);
      }

      .tag-placeholder {
        color: var(--text-muted);
        opacity: 0.6;
      }

      .tag-selected {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .tag-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        min-width: 220px;
        max-height: 320px;
        background: var(--bg-card);
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        box-shadow: var(--shadow-md);
        z-index: 100;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .tag-search {
        padding: 8px 10px;
        font-size: 12px;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--text-primary);
        background: var(--bg-card-hover);
        border: none;
        border-bottom: 1px solid var(--border-default);
        outline: none;
      }

      .tag-search::placeholder {
        color: var(--text-muted);
        opacity: 0.6;
      }

      .tag-tree {
        overflow-y: auto;
        max-height: 270px;
        padding: 4px 0;
      }

      .tree-node {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        color: var(--text-secondary);
        transition: background 0.1s;
      }

      .tree-node:hover {
        background: var(--bg-card-hover);
      }

      .tree-muni {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-muted);
        padding-left: 6px;
      }

      .tree-site {
        padding-left: 18px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .site-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }

      .tree-measurement {
        padding-left: 36px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        color: var(--text-secondary);
      }

      .tree-measurement:hover {
        background: var(--accent-light);
        color: var(--accent);
      }

      .tree-arrow {
        flex-shrink: 0;
        color: var(--text-muted);
        transition: transform 0.15s;
      }

      .tree-arrow.expanded {
        transform: rotate(90deg);
      }

      .tree-count {
        font-size: 10px;
        color: var(--text-muted);
        background: var(--bg-card-hover);
        padding: 0 5px;
        border-radius: 8px;
        margin-left: auto;
      }

      .measurement-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        flex-shrink: 0;
      }

      .tag-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
        font-size: 12px;
        color: var(--text-muted);
      }

      .tag-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--border-default);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: tagspin 0.6s linear infinite;
      }

      @keyframes tagspin {
        to {
          transform: rotate(360deg);
        }
      }

      .tag-empty {
        padding: 16px;
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }

      /* === Mis Vistas Section === */
      .tag-separator {
        padding: 8px 12px 4px;
        border-top: 1px solid var(--border-default);
        margin-top: 4px;
      }

      .separator-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }

      .view-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        transition: background 0.1s ease;
      }

      .view-header:hover {
        background: var(--bg-card-hover);
      }

      .view-icon {
        color: var(--accent);
        flex-shrink: 0;
      }

      .view-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .view-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--accent);
        color: var(--text-on-accent);
      }

      .view-children {
        padding-left: 16px;
      }

      .section-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        padding: 6px 12px 2px;
      }

      .formula-leaf {
        border-left: 2px solid var(--accent);
      }

      .formula-dot {
        width: 6px;
        height: 6px;
        border-radius: 2px;
        background: var(--accent);
        flex-shrink: 0;
      }

      .formula-expr {
        margin-left: auto;
        font-size: 10px;
        color: var(--text-muted);
        font-family: 'SF Mono', 'Fira Code', monospace;
      }

      .tag-agg {
        margin-left: auto;
        font-size: 10px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .column-leaf {
        border-left: 2px solid #059669;
      }
    `,
  ],
})
export class TagBrowser implements OnInit {
  private variableService = inject(VariableService);
  private elRef = inject(ElementRef);

  placeholder = input('Seleccionar variable...');
  currentDevEUI = input('');
  currentMeasurement = input('');

  tagSelect = output<TagSelection>();

  isOpen = signal(false);
  loading = signal(false);
  searchTerm = '';

  private allTags = signal<TagEntry[]>([]);
  private tree = signal<MunicipalityNode[]>([]);

  views = signal<VariableView[]>([]);
  expandedViews = signal<Set<number>>(new Set());
  viewDetails = signal<Map<number, VariableViewDetail>>(new Map());

  currentLabel = computed(() => {
    const dev = this.currentDevEUI();
    const meas = this.currentMeasurement();
    if (!dev || !meas) return '';
    const tag = this.allTags().find((t) => t.devEUI === dev);
    if (tag) return `${tag.siteName} / ${meas}`;
    return `${dev.slice(0, 8)}... / ${meas}`;
  });

  filteredTree = computed(() => {
    const search = this.searchTerm.toLowerCase().trim();
    const base = this.tree();
    if (!search) return base;

    return base
      .map((muni) => {
        const filteredSites = muni.sites
          .map((site) => {
            const matchSite =
              site.siteName.toLowerCase().includes(search) ||
              site.devEUI.toLowerCase().includes(search);
            const filteredMeasurements = site.measurements.filter((m) =>
              m.toLowerCase().includes(search),
            );
            if (matchSite) return { ...site, expanded: true };
            if (filteredMeasurements.length > 0)
              return { ...site, measurements: filteredMeasurements, expanded: true };
            return null;
          })
          .filter((s): s is SiteNode => s !== null);

        if (filteredSites.length > 0) return { ...muni, sites: filteredSites, expanded: true };
        if (muni.name.toLowerCase().includes(search))
          return { ...muni, expanded: true };
        return null;
      })
      .filter((m): m is MunicipalityNode => m !== null);
  });

  ngOnInit(): void {
    this.loadTags();
    this.loadViews();
  }

  private loadTags(): void {
    this.loading.set(true);
    this.variableService.getTags().subscribe({
      next: (tags) => {
        this.allTags.set(tags);
        this.buildTree(tags);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private buildTree(tags: TagEntry[]): void {
    const muniMap = new Map<string, SiteNode[]>();
    for (const tag of tags) {
      const muni = tag.municipality || 'Sin municipio';
      if (!muniMap.has(muni)) muniMap.set(muni, []);
      muniMap.get(muni)!.push({
        devEUI: tag.devEUI,
        siteName: tag.siteName,
        measurements: tag.measurements,
        expanded: false,
      });
    }
    const tree: MunicipalityNode[] = [];
    for (const [name, sites] of muniMap.entries()) {
      tree.push({ name, sites, expanded: tree.length === 0 });
    }
    tree.sort((a, b) => a.name.localeCompare(b.name));
    this.tree.set(tree);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen() && this.allTags().length === 0) {
      this.loadTags();
    }
  }

  toggleMuni(muni: MunicipalityNode): void {
    muni.expanded = !muni.expanded;
    this.tree.update((t) => [...t]);
  }

  toggleSite(site: SiteNode): void {
    site.expanded = !site.expanded;
    this.tree.update((t) => [...t]);
  }

  selectTag(site: SiteNode, measurement: string, municipality: string): void {
    this.tagSelect.emit({
      devEUI: site.devEUI,
      measurement,
      siteName: site.siteName,
      municipality,
    });
    this.isOpen.set(false);
  }

  loadViews(): void {
    this.variableService.getMyViews().subscribe({
      next: (views) => this.views.set(views),
      error: () => this.views.set([]),
    });
  }

  toggleView(viewId: number): void {
    const expanded = new Set(this.expandedViews());
    if (expanded.has(viewId)) {
      expanded.delete(viewId);
    } else {
      expanded.add(viewId);
      if (!this.viewDetails().has(viewId)) {
        this.variableService.getViewDetail(viewId).subscribe({
          next: (detail) => {
            const map = new Map(this.viewDetails());
            map.set(viewId, detail);
            this.viewDetails.set(map);
          },
        });
      }
    }
    this.expandedViews.set(expanded);
  }

  selectFormula(view: VariableView, formula: ViewFormula): void {
    this.tagSelect.emit({
      devEUI: '',
      measurement: '',
      siteName: view.name,
      municipality: 'Vista',
      source: 'view',
      viewId: view.id,
      formulaId: formula.id,
      formulaAlias: formula.alias,
    });
    this.isOpen.set(false);
  }

  selectViewColumn(view: VariableView, column: ViewColumn): void {
    this.tagSelect.emit({
      devEUI: column.dev_eui,
      measurement: column.measurement,
      siteName: view.name,
      municipality: 'Vista',
      source: 'tag',
    });
    this.isOpen.set(false);
  }

  truncateExpr(expr: string): string {
    return expr.length > 20 ? expr.slice(0, 20) + '...' : expr;
  }

  onSearch(): void {
    // filteredTree computed reacts to searchTerm binding
  }

  @HostListener('document:mousedown', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.isOpen() && !this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
