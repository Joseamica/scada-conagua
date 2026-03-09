import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroPlay,
  heroPlus,
  heroTrash,
  heroTableCells,
  heroCalculator,
} from '@ng-icons/heroicons/outline';
import {
  VariableService,
  VariableViewDetail,
  ViewColumn,
  ViewFormula,
  ViewExecutionResult,
} from '../../../core/services/variable.service';
import {
  TagBrowser,
  TagSelection,
} from '../../sinopticos/shared/tag-browser/tag-browser';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-variable-view-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    TagBrowser,
    FooterTabsComponent,
    HeaderBarComponent,
  ],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroPlay,
      heroPlus,
      heroTrash,
      heroTableCells,
      heroCalculator,
    }),
  ],
  templateUrl: './variable-view-editor.html',
  styleUrl: './variable-view-editor.css',
})
export class VariableViewEditor implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private variableService = inject(VariableService);

  viewId = 0;
  view = signal<VariableViewDetail | null>(null);
  columns = signal<ViewColumn[]>([]);
  formulas = signal<ViewFormula[]>([]);
  loading = signal(true);
  executing = signal(false);
  executionResult = signal<ViewExecutionResult | null>(null);
  lastExecuted = signal<string | null>(null);

  // Formula form state
  newFormulaAlias = '';
  newFormulaExpr = '';
  formulaValid = signal(false);
  formulaError = signal<string | null>(null);
  formulaVars = signal<string[]>([]);

  ngOnInit(): void {
    this.viewId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadView();
  }

  loadView(): void {
    this.loading.set(true);
    this.variableService.getView(this.viewId).subscribe({
      next: (data) => {
        this.view.set(data);
        this.columns.set(data.columns || []);
        this.formulas.set(data.formulas || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/variables']);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/variables']);
  }

  // ---- Columns ----

  onColumnTagSelected(tag: TagSelection): void {
    const alias = `${tag.siteName} / ${tag.measurement}`;
    this.variableService
      .addColumn(this.viewId, {
        alias,
        dev_eui: tag.devEUI,
        measurement: tag.measurement,
        aggregation: 'LAST_VALUE',
      })
      .subscribe({
        next: (col) => this.columns.update((list) => [...list, col]),
      });
  }

  updateColumnAlias(col: ViewColumn, event: Event): void {
    const alias = (event.target as HTMLInputElement).value.trim();
    if (!alias || alias === col.alias) return;
    this.variableService.updateColumn(this.viewId, col.id, { alias }).subscribe({
      next: (updated) =>
        this.columns.update((list) => list.map((c) => (c.id === col.id ? { ...c, alias: updated.alias } : c))),
    });
  }

  updateColumnAggregation(col: ViewColumn, event: Event): void {
    const aggregation = (event.target as HTMLSelectElement).value as ViewColumn['aggregation'];
    this.variableService.updateColumn(this.viewId, col.id, { aggregation }).subscribe({
      next: (updated) =>
        this.columns.update((list) =>
          list.map((c) => (c.id === col.id ? { ...c, aggregation: updated.aggregation } : c)),
        ),
    });
  }

  deleteColumn(col: ViewColumn): void {
    this.variableService.deleteColumn(this.viewId, col.id).subscribe({
      next: () => this.columns.update((list) => list.filter((c) => c.id !== col.id)),
    });
  }

  // ---- Formulas ----

  validateFormula(): void {
    if (!this.newFormulaExpr.trim()) return;
    this.formulaValid.set(false);
    this.formulaError.set(null);
    this.formulaVars.set([]);

    this.variableService.validateFormula(this.viewId, this.newFormulaExpr.trim()).subscribe({
      next: (result) => {
        if (result.valid) {
          this.formulaValid.set(true);
          this.formulaVars.set(result.variables || []);
        } else {
          this.formulaError.set(result.error || 'Formula invalida');
        }
      },
      error: () => this.formulaError.set('Error al validar'),
    });
  }

  addFormula(): void {
    if (!this.newFormulaAlias.trim() || !this.newFormulaExpr.trim()) return;
    this.variableService
      .addFormula(this.viewId, {
        alias: this.newFormulaAlias.trim(),
        expression: this.newFormulaExpr.trim(),
      })
      .subscribe({
        next: (f) => {
          this.formulas.update((list) => [...list, f]);
          this.newFormulaAlias = '';
          this.newFormulaExpr = '';
          this.formulaValid.set(false);
          this.formulaError.set(null);
          this.formulaVars.set([]);
        },
        error: (err) => this.formulaError.set(err.error?.error || 'Error al crear formula'),
      });
  }

  updateFormulaAlias(f: ViewFormula, event: Event): void {
    const alias = (event.target as HTMLInputElement).value.trim();
    if (!alias || alias === f.alias) return;
    this.variableService.updateFormula(this.viewId, f.id, { alias }).subscribe({
      next: (updated) =>
        this.formulas.update((list) => list.map((fm) => (fm.id === f.id ? { ...fm, alias: updated.alias } : fm))),
    });
  }

  deleteFormula(f: ViewFormula): void {
    this.variableService.deleteFormula(this.viewId, f.id).subscribe({
      next: () => this.formulas.update((list) => list.filter((fm) => fm.id !== f.id)),
    });
  }

  // ---- Execute ----

  executeView(): void {
    this.executing.set(true);
    this.variableService.executeView(this.viewId).subscribe({
      next: (result) => {
        this.executionResult.set(result);
        this.lastExecuted.set(result.timestamp);
        this.executing.set(false);
      },
      error: () => this.executing.set(false),
    });
  }

  getResultValue(alias: string): string {
    const val = this.executionResult()?.values?.[alias];
    if (val == null) return '--';
    return typeof val === 'number' ? val.toFixed(2) : String(val);
  }
}
