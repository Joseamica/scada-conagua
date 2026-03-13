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

interface WizardColumn {
  devEUI: string;
  measurement: string;
  siteName: string;
  municipality: string;
  alias: string;
  aggregation: string;
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
          <!-- Create view button -->
          @if (showCreateView()) {
            <button class="create-view-btn" (click)="openWizard(); $event.stopPropagation()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
              </svg>
              Crear Vista de Variables
            </button>
          }

          <input
            class="tag-search"
            type="text"
            placeholder="Buscar sitio o variable..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
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
                  @if (searchTerm()) {
                    Sin resultados para "{{ searchTerm() }}"
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

    <!-- Wizard Modal -->
    @if (wizardOpen()) {
      <div class="wizard-overlay" (click)="closeWizard()">
        <div class="wizard-dialog" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="wizard-header">
            <h3>Crear Vista de Variables</h3>
            <button class="wizard-close" (click)="closeWizard()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Steps indicator -->
          <div class="wizard-steps">
            @for (s of wizardStepLabels; track s; let i = $index) {
              <div class="wizard-step" [class.active]="wizardStep() === i" [class.done]="wizardStep() > i">
                <span class="step-num">{{ wizardStep() > i ? '&#10003;' : i + 1 }}</span>
                <span class="step-label">{{ s }}</span>
              </div>
              @if (i < wizardStepLabels.length - 1) {
                <div class="step-line" [class.done]="wizardStep() > i"></div>
              }
            }
          </div>

          <!-- Step 0: Name -->
          @if (wizardStep() === 0) {
            <div class="wizard-body">
              <label class="wizard-label">Nombre de la vista</label>
              <input
                class="wizard-input"
                type="text"
                placeholder="ej: Presion pozos Chalco"
                [(ngModel)]="wizardName"
                (keydown.enter)="wizardNextStep()"
                autofocus
              />
              <label class="wizard-label">Descripcion (opcional)</label>
              <input
                class="wizard-input"
                type="text"
                placeholder="ej: Monitoreo de presion en 5 pozos"
                [(ngModel)]="wizardDesc"
              />
            </div>
          }

          <!-- Step 1: Columns -->
          @if (wizardStep() === 1) {
            <div class="wizard-body">
              <p class="wizard-hint">Selecciona las variables que quieres incluir en la vista.</p>

              <!-- Added columns -->
              @if (wizardColumns().length > 0) {
                <div class="wizard-columns-list">
                  @for (col of wizardColumns(); track col.devEUI + col.measurement; let i = $index) {
                    <div class="wizard-col-item">
                      <span class="wizard-col-num">{{ i + 1 }}</span>
                      <div class="wizard-col-info">
                        <span class="wizard-col-alias">{{ col.alias }}</span>
                        <span class="wizard-col-tag">{{ col.siteName }} / {{ col.measurement }}</span>
                      </div>
                      <select class="wizard-agg-select" [(ngModel)]="col.aggregation">
                        <option value="LAST_VALUE">Ultimo</option>
                        <option value="AVG">Promedio</option>
                        <option value="MIN">Minimo</option>
                        <option value="MAX">Maximo</option>
                        <option value="SUM">Suma</option>
                      </select>
                      <button class="wizard-col-remove" (click)="wizardRemoveColumn(i)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- Inline tag picker for adding columns -->
              <div class="wizard-tag-picker">
                <input
                  class="wizard-tag-search"
                  type="text"
                  placeholder="Buscar sitio o variable para agregar..."
                  [(ngModel)]="wizardSearchTerm"
                  (input)="onWizardSearch()"
                />
                <div class="wizard-tag-tree">
                  @for (muni of wizardFilteredTree(); track muni.name) {
                    <div class="tree-municipality">
                      <div class="tree-node tree-muni" (click)="toggleWizardMuni(muni)">
                        <svg class="tree-arrow" [class.expanded]="muni.expanded" width="10" height="10" viewBox="0 0 10 10">
                          <path d="M3 2l4 3-4 3z" fill="currentColor" />
                        </svg>
                        <span>{{ muni.name }}</span>
                        <span class="tree-count">{{ muni.sites.length }}</span>
                      </div>
                      @if (muni.expanded) {
                        @for (site of muni.sites; track site.devEUI) {
                          <div class="tree-site-group">
                            <div class="tree-node tree-site" (click)="toggleWizardSite(site)">
                              <svg class="tree-arrow" [class.expanded]="site.expanded" width="10" height="10" viewBox="0 0 10 10">
                                <path d="M3 2l4 3-4 3z" fill="currentColor" />
                              </svg>
                              <span class="site-name">{{ site.siteName }}</span>
                            </div>
                            @if (site.expanded) {
                              @for (m of site.measurements; track m) {
                                <div
                                  class="tree-node tree-measurement"
                                  [class.already-added]="isColumnAdded(site.devEUI, m)"
                                  (click)="wizardAddColumn(site, m, muni.name)"
                                >
                                  <span class="measurement-dot"></span>
                                  {{ m }}
                                  @if (isColumnAdded(site.devEUI, m)) {
                                    <svg class="added-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                      <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                  }
                                </div>
                              }
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Step 2: Formula (optional) — ICH-style split layout -->
          @if (wizardStep() === 2) {
            <div class="wizard-body wizard-body-formula">
              <label class="wizard-label">Nombre de la formula</label>
              <input
                class="wizard-input"
                type="text"
                placeholder="ej: gasto_total"
                [(ngModel)]="wizardFormulaAlias"
              />

              <div class="formula-split">
                <!-- Left: Incognitas table -->
                <div class="incognitas-panel">
                  <div class="incognitas-header">
                    <span>Incognitas</span>
                  </div>
                  <div class="incognitas-table">
                    <div class="incognitas-row incognitas-head">
                      <span class="inc-name-col">Nombre</span>
                      <span class="inc-origin-col">Columna origen</span>
                    </div>
                    @for (col of wizardColumns(); track col.devEUI + col.measurement; let i = $index) {
                      <div
                        class="incognitas-row"
                        (click)="insertIncognita(i)"
                        title="Click para insertar en formula"
                      >
                        <span class="inc-name-col">
                          <input
                            class="inc-name-input"
                            [value]="getIncognitaName(i)"
                            (change)="renameIncognita(i, $event)"
                            (click)="$event.stopPropagation()"
                            title="Editar nombre de incognita"
                          />
                        </span>
                        <span class="inc-origin-col inc-origin-text">{{ col.alias }}</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Right: Formula editor -->
                <div class="formula-panel">
                  <div class="formula-panel-header">
                    <span>Escribir formula</span>
                    <div class="operators-bar">
                      <span class="operators-label">OPERADORES</span>
                      @for (op of operatorButtons; track op.label) {
                        <button
                          class="op-btn"
                          (click)="insertOperator(op.value)"
                          [title]="op.title"
                        >{{ op.label }}</button>
                      }
                    </div>
                  </div>
                  <textarea
                    class="formula-textarea"
                    [(ngModel)]="wizardFormulaExpr"
                    placeholder="ej: if(i_Flujo > 150; 0; i_Flujo)"
                    rows="5"
                    #formulaTextarea
                  ></textarea>
                  <div class="formula-fn-bar">
                    @for (fn of functionButtons; track fn) {
                      <button class="fn-btn" (click)="insertOperator(fn + '(')">{{ fn }}</button>
                    }
                  </div>
                </div>
              </div>

              <div class="wizard-skip-hint">
                Puedes saltar este paso y agregar formulas despues.
              </div>
            </div>
          }

          <!-- Footer -->
          <div class="wizard-footer">
            @if (wizardStep() > 0) {
              <button class="wizard-btn wizard-btn-secondary" (click)="wizardPrevStep()">
                Atras
              </button>
            }
            <div class="wizard-footer-spacer"></div>
            @if (wizardStep() < 2) {
              <button
                class="wizard-btn wizard-btn-primary"
                (click)="wizardNextStep()"
                [disabled]="wizardStep() === 0 && !wizardName.trim() || wizardStep() === 1 && wizardColumns().length === 0"
              >
                Siguiente
              </button>
            } @else {
              <button
                class="wizard-btn wizard-btn-primary"
                (click)="wizardCreate()"
                [disabled]="wizardCreating()"
              >
                @if (wizardCreating()) {
                  Creando...
                } @else {
                  Crear Vista
                }
              </button>
            }
          </div>
        </div>
      </div>
    }
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

      /* === Create View Button === */
      .create-view-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--accent);
        background: var(--accent-light, rgba(59, 130, 246, 0.08));
        border: none;
        border-bottom: 1px solid var(--border-default);
        cursor: pointer;
        transition: background 0.15s;
        text-align: left;
      }

      .create-view-btn:hover {
        background: var(--accent-light, rgba(59, 130, 246, 0.15));
      }

      /* === Wizard Modal === */
      .wizard-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: wizFadeIn 0.15s ease;
        padding: 16px;
      }

      @keyframes wizFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .wizard-dialog {
        width: 100%;
        max-width: 640px;
        max-height: 85vh;
        background: var(--bg-card);
        border: 1px solid var(--border-strong);
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: wizSlideUp 0.2s ease;
      }

      @keyframes wizSlideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .wizard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 1px solid var(--border-default);
      }

      .wizard-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .wizard-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        padding: 4px;
        border-radius: 6px;
        transition: background 0.1s;
      }

      .wizard-close:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }

      /* Steps indicator */
      .wizard-steps {
        display: flex;
        align-items: center;
        gap: 0;
        padding: 14px 20px;
        border-bottom: 1px solid var(--border-default);
      }

      .wizard-step {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .step-num {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        background: var(--bg-card-hover);
        color: var(--text-muted);
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .wizard-step.active .step-num {
        background: var(--accent);
        color: #fff;
      }

      .wizard-step.done .step-num {
        background: #059669;
        color: #fff;
      }

      .step-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .wizard-step.active .step-label {
        color: var(--text-primary);
        font-weight: 600;
      }

      .step-line {
        flex: 1;
        height: 2px;
        background: var(--border-default);
        margin: 0 8px;
        border-radius: 1px;
        min-width: 16px;
      }

      .step-line.done {
        background: #059669;
      }

      /* Body */
      .wizard-body {
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .wizard-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 4px;
        margin-top: 12px;
      }

      .wizard-label:first-child {
        margin-top: 0;
      }

      .wizard-input {
        width: 100%;
        padding: 8px 10px;
        font-size: 13px;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--text-primary);
        background: var(--bg-card-hover);
        border: 1px solid var(--border-default);
        border-radius: 6px;
        outline: none;
        transition: border-color 0.15s;
        box-sizing: border-box;
      }

      .wizard-input:focus {
        border-color: var(--accent);
      }

      .wizard-input-mono {
        font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
        font-size: 12px;
      }

      .wizard-hint {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0 0 12px;
        line-height: 1.4;
      }

      .wizard-hint code {
        background: var(--bg-card-hover);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 11px;
      }

      /* Wizard columns list */
      .wizard-columns-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
      }

      .wizard-col-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: var(--bg-card-hover);
        border-radius: 6px;
        font-size: 12px;
      }

      .wizard-col-num {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--accent);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .wizard-col-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .wizard-col-alias {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wizard-col-tag {
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wizard-agg-select {
        padding: 2px 4px;
        font-size: 10px;
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .wizard-col-remove {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        padding: 2px;
        border-radius: 4px;
        flex-shrink: 0;
        transition: color 0.1s;
      }

      .wizard-col-remove:hover {
        color: #ef4444;
      }

      /* Wizard inline tag picker */
      .wizard-tag-picker {
        border: 1px solid var(--border-default);
        border-radius: 8px;
        overflow: hidden;
      }

      .wizard-tag-search {
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
        font-family: 'Inter', system-ui, sans-serif;
        color: var(--text-primary);
        background: var(--bg-card-hover);
        border: none;
        border-bottom: 1px solid var(--border-default);
        outline: none;
        box-sizing: border-box;
      }

      .wizard-tag-search::placeholder {
        color: var(--text-muted);
        opacity: 0.6;
      }

      .wizard-tag-tree {
        max-height: 200px;
        overflow-y: auto;
        padding: 4px 0;
      }

      .already-added {
        opacity: 0.5;
      }

      .added-check {
        margin-left: auto;
        color: #059669;
      }

      /* === ICH-style Formula Split Layout === */
      .wizard-body-formula {
        padding: 12px 16px;
      }

      .formula-split {
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 0;
        border: 1px solid var(--border-default);
        border-radius: 8px;
        overflow: hidden;
        margin-top: 10px;
        min-height: 200px;
      }

      /* Left: Incognitas */
      .incognitas-panel {
        border-right: 1px solid var(--border-default);
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .incognitas-header {
        padding: 8px 10px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        background: var(--bg-card-hover);
        border-bottom: 1px solid var(--border-default);
      }

      .incognitas-table {
        flex: 1;
        overflow-y: auto;
      }

      .incognitas-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        font-size: 11px;
        border-bottom: 1px solid var(--border-default);
        cursor: pointer;
        transition: background 0.1s;
      }

      .incognitas-row:last-child {
        border-bottom: none;
      }

      .incognitas-row:not(.incognitas-head):hover {
        background: var(--accent-light, rgba(59, 130, 246, 0.06));
      }

      .incognitas-head {
        cursor: default;
        background: var(--bg-card-hover);
        font-weight: 600;
        color: var(--text-muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .inc-name-col, .inc-origin-col {
        padding: 6px 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .inc-name-col {
        border-right: 1px solid var(--border-default);
      }

      .inc-name-input {
        width: 100%;
        background: none;
        border: none;
        font-size: 11px;
        font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
        color: var(--accent);
        font-weight: 600;
        padding: 0;
        outline: none;
        cursor: text;
      }

      .inc-name-input:focus {
        background: var(--bg-card);
        border-radius: 3px;
        box-shadow: 0 0 0 1px var(--accent);
        padding: 0 2px;
      }

      .inc-origin-text {
        font-size: 10px;
        color: var(--text-secondary);
      }

      /* Right: Formula editor */
      .formula-panel {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .formula-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        background: var(--bg-card-hover);
        border-bottom: 1px solid var(--border-default);
        gap: 8px;
      }

      .formula-panel-header > span {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .operators-bar {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .operators-label {
        font-size: 9px;
        font-weight: 700;
        color: var(--text-muted);
        letter-spacing: 0.05em;
        margin-right: 2px;
      }

      .op-btn {
        min-width: 24px;
        height: 22px;
        font-size: 11px;
        font-weight: 600;
        font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.1s;
        padding: 0 4px;
      }

      .op-btn:hover {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .formula-textarea {
        flex: 1;
        min-height: 100px;
        padding: 10px;
        font-size: 13px;
        font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
        color: var(--text-primary);
        background: var(--bg-card);
        border: none;
        outline: none;
        resize: none;
        line-height: 1.5;
      }

      .formula-textarea::placeholder {
        color: var(--text-muted);
        opacity: 0.5;
      }

      .formula-fn-bar {
        display: flex;
        gap: 3px;
        padding: 6px 8px;
        border-top: 1px solid var(--border-default);
        background: var(--bg-card-hover);
        flex-wrap: wrap;
      }

      .fn-btn {
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 3px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.1s;
      }

      .fn-btn:hover {
        background: var(--accent-light, rgba(59, 130, 246, 0.1));
        color: var(--accent);
        border-color: var(--accent);
      }

      .wizard-skip-hint {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 12px;
        font-style: italic;
      }

      @media (max-width: 480px) {
        .formula-split {
          grid-template-columns: 1fr;
        }
        .incognitas-panel {
          border-right: none;
          border-bottom: 1px solid var(--border-default);
          max-height: 120px;
        }
      }

      /* Footer */
      .wizard-footer {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        border-top: 1px solid var(--border-default);
        gap: 8px;
      }

      .wizard-footer-spacer {
        flex: 1;
      }

      .wizard-btn {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
      }

      .wizard-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .wizard-btn-primary {
        background: var(--accent);
        color: #fff;
      }

      .wizard-btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
      }

      .wizard-btn-secondary {
        background: var(--bg-card-hover);
        color: var(--text-secondary);
      }

      .wizard-btn-secondary:hover {
        background: var(--border-default);
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
  showCreateView = input(true);

  tagSelect = output<TagSelection>();

  isOpen = signal(false);
  loading = signal(false);
  searchTerm = signal('');
  private savedScrollTop = 0;

  private allTags = signal<TagEntry[]>([]);
  private tree = signal<MunicipalityNode[]>([]);

  views = signal<VariableView[]>([]);
  expandedViews = signal<Set<number>>(new Set());
  viewDetails = signal<Map<number, VariableViewDetail>>(new Map());

  // Wizard state
  wizardOpen = signal(false);
  wizardStep = signal(0);
  wizardCreating = signal(false);
  wizardName = '';
  wizardDesc = '';
  wizardColumns = signal<WizardColumn[]>([]);
  wizardFormulaAlias = '';
  wizardFormulaExpr = '';
  wizardSearchTerm = '';
  private wizardTree = signal<MunicipalityNode[]>([]);
  wizardStepLabels = ['Nombre', 'Columnas', 'Formula'];
  private incognitaNames = signal<Map<number, string>>(new Map());

  operatorButtons = [
    { label: '+', value: ' + ', title: 'Suma' },
    { label: '-', value: ' - ', title: 'Resta' },
    { label: '*', value: ' * ', title: 'Multiplicacion' },
    { label: '/', value: ' / ', title: 'Division' },
    { label: '>', value: ' > ', title: 'Mayor que' },
    { label: '<', value: ' < ', title: 'Menor que' },
    { label: '=', value: ' == ', title: 'Igual a' },
    { label: ';', value: '; ', title: 'Separador' },
    { label: '(', value: '(', title: 'Abrir parentesis' },
    { label: ')', value: ')', title: 'Cerrar parentesis' },
  ];

  functionButtons = ['IF', 'ABS', 'ROUND', 'MIN', 'MAX', 'SQRT', 'POW', 'ISNULL'];

  currentLabel = computed(() => {
    const dev = this.currentDevEUI();
    const meas = this.currentMeasurement();
    if (!dev || !meas) return '';
    const tag = this.allTags().find((t) => t.devEUI === dev);
    if (tag) return `${tag.siteName} / ${meas}`;
    return `${dev.slice(0, 8)}... / ${meas}`;
  });

  filteredTree = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
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
    // Save scroll before closing
    if (this.isOpen()) {
      const tree = this.elRef.nativeElement.querySelector('.tag-tree');
      if (tree) this.savedScrollTop = tree.scrollTop;
    }
    this.isOpen.update((v) => !v);
    if (this.isOpen() && this.allTags().length === 0) {
      this.loadTags();
    }
    // Restore scroll after opening
    if (this.isOpen()) {
      setTimeout(() => {
        const tree = this.elRef.nativeElement.querySelector('.tag-tree');
        if (tree) tree.scrollTop = this.savedScrollTop;
      });
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
    // Save scroll before closing
    const tree = this.elRef.nativeElement.querySelector('.tag-tree');
    if (tree) this.savedScrollTop = tree.scrollTop;
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

  // ---- Wizard ----

  openWizard(): void {
    this.wizardOpen.set(true);
    this.wizardStep.set(0);
    this.wizardName = '';
    this.wizardDesc = '';
    this.wizardColumns.set([]);
    this.wizardFormulaAlias = '';
    this.wizardFormulaExpr = '';
    this.wizardSearchTerm = '';
    this.incognitaNames.set(new Map());
    this.isOpen.set(false);
    // Clone the tag tree for the wizard's own expand state
    const cloned = this.tree().map((m) => ({
      ...m,
      expanded: false,
      sites: m.sites.map((s) => ({ ...s, expanded: false })),
    }));
    this.wizardTree.set(cloned);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
  }

  wizardNextStep(): void {
    if (this.wizardStep() === 0 && !this.wizardName.trim()) return;
    if (this.wizardStep() === 1 && this.wizardColumns().length === 0) return;
    this.wizardStep.update((s) => Math.min(s + 1, 2));
  }

  wizardPrevStep(): void {
    this.wizardStep.update((s) => Math.max(s - 1, 0));
  }

  wizardFilteredTree(): MunicipalityNode[] {
    const search = this.wizardSearchTerm.toLowerCase().trim();
    const base = this.wizardTree();
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
        if (muni.name.toLowerCase().includes(search)) return { ...muni, expanded: true };
        return null;
      })
      .filter((m): m is MunicipalityNode => m !== null);
  }

  toggleWizardMuni(muni: MunicipalityNode): void {
    muni.expanded = !muni.expanded;
    this.wizardTree.update((t) => [...t]);
  }

  toggleWizardSite(site: SiteNode): void {
    site.expanded = !site.expanded;
    this.wizardTree.update((t) => [...t]);
  }

  onWizardSearch(): void {
    // triggers change detection for wizardFilteredTree()
  }

  getIncognitaName(index: number): string {
    const custom = this.incognitaNames().get(index);
    if (custom) return custom;
    // Generate default name from site/measurement
    const col = this.wizardColumns()[index];
    if (!col) return `i_${index + 1}`;
    const sitePart = col.siteName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
    const measPart = col.measurement.replace(/[^a-zA-Z0-9_]/g, '_');
    return `i_${sitePart}_${measPart}`;
  }

  renameIncognita(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (!value) return;
    // Ensure starts with i_ prefix
    const name = value.startsWith('i_') ? value : `i_${value}`;
    const map = new Map(this.incognitaNames());
    map.set(index, name);
    this.incognitaNames.set(map);
  }

  insertIncognita(index: number): void {
    const name = this.getIncognitaName(index);
    this.wizardFormulaExpr += name;
  }

  insertOperator(value: string): void {
    this.wizardFormulaExpr += value;
  }

  wizardAddColumn(site: SiteNode, measurement: string, municipality: string): void {
    if (this.isColumnAdded(site.devEUI, measurement)) return;
    const alias = `${site.siteName} / ${measurement}`;
    this.wizardColumns.update((cols) => [
      ...cols,
      {
        devEUI: site.devEUI,
        measurement,
        siteName: site.siteName,
        municipality,
        alias,
        aggregation: 'LAST_VALUE',
      },
    ]);
  }

  wizardRemoveColumn(index: number): void {
    this.wizardColumns.update((cols) => cols.filter((_, i) => i !== index));
  }

  isColumnAdded(devEUI: string, measurement: string): boolean {
    return this.wizardColumns().some((c) => c.devEUI === devEUI && c.measurement === measurement);
  }

  wizardCreate(): void {
    if (!this.wizardName.trim() || this.wizardColumns().length === 0) return;
    this.wizardCreating.set(true);

    // Step 1: Create the view
    this.variableService
      .createView({ name: this.wizardName.trim(), description: this.wizardDesc.trim() || undefined })
      .subscribe({
        next: (view) => {
          // Step 2: Add all columns sequentially
          const cols = this.wizardColumns();

          const addColumnsSequentially = (idx: number): void => {
            if (idx >= cols.length) {
              // Step 3: Add formula if provided (translate custom incognita names → i_N)
              if (this.wizardFormulaAlias.trim() && this.wizardFormulaExpr.trim()) {
                let expr = this.wizardFormulaExpr.trim();
                // Replace custom names with i_N, longest names first to avoid partial matches
                const replacements: [string, string][] = [];
                for (let j = 0; j < cols.length; j++) {
                  const customName = this.getIncognitaName(j);
                  const canonical = `i_${j + 1}`;
                  if (customName !== canonical) {
                    replacements.push([customName, canonical]);
                  }
                }
                replacements.sort((a, b) => b[0].length - a[0].length);
                for (const [from, to] of replacements) {
                  expr = expr.split(from).join(to);
                }

                this.variableService
                  .addFormula(view.id, {
                    alias: this.wizardFormulaAlias.trim(),
                    expression: expr,
                  })
                  .subscribe({
                    next: () => this.finishWizard(view),
                    error: () => this.finishWizard(view), // still finish even if formula fails
                  });
              } else {
                this.finishWizard(view);
              }
              return;
            }
            const col = cols[idx];
            this.variableService
              .addColumn(view.id, {
                alias: col.alias,
                dev_eui: col.devEUI,
                measurement: col.measurement,
                aggregation: col.aggregation as ViewColumn['aggregation'],
              })
              .subscribe({
                next: () => addColumnsSequentially(idx + 1),
                error: () => addColumnsSequentially(idx + 1),
              });
          };

          addColumnsSequentially(0);
        },
        error: () => this.wizardCreating.set(false),
      });
  }

  private finishWizard(view: VariableView): void {
    this.wizardCreating.set(false);
    this.wizardOpen.set(false);
    // Reload views so the new one appears in "Mis Vistas"
    this.loadViews();
  }

  @HostListener('document:mousedown', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.isOpen() && !this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
