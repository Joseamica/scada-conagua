import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroArrowUturnLeft,
  heroPlay,
  heroPlus,
  heroTrash,
  heroTableCells,
  heroCalculator,
  heroLightBulb,
  heroShare,
  heroXMark,
  heroChartBar,
} from '@ng-icons/heroicons/outline';
import {
  VariableService,
  VariableViewDetail,
  ViewColumn,
  ViewFormula,
  ViewExecutionResult,
  ViewShare,
  ShareCandidate,
  FormulaSeriesResult,
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
      heroArrowUturnLeft,
      heroPlay,
      heroPlus,
      heroTrash,
      heroTableCells,
      heroCalculator,
      heroLightBulb,
      heroShare,
      heroXMark,
      heroChartBar,
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
  formulaErrorExpr = signal<string | null>(null);
  formulaSuggestedFix = signal<string | null>(null);
  formulaVars = signal<string[]>([]);
  private incognitaNames = new Map<number, string>();

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

  // Formula helper
  showFormulaHelper = signal(false);

  // Share dialog
  showShareDialog = signal(false);
  shares = signal<ViewShare[]>([]);
  candidates = signal<ShareCandidate[]>([]);
  shareSearchQuery = '';
  selectedCandidateId = 0;
  sharePermission = 'read';

  // Series chart
  showSeriesChart = signal(false);
  seriesFormulaId = signal<number | null>(null);
  seriesRange = signal('24h');
  seriesLoading = signal(false);
  seriesData = signal<[number, number][]>([]);
  seriesAlias = signal('');
  private chartInstance: any = null;

  // Execution range (for aggregation)
  execRange = '24h';

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
        // Restore persisted incognita names
        (data.columns || []).forEach((col, idx) => {
          if (col.incognita_name) {
            this.incognitaNames.set(idx, col.incognita_name);
          }
        });
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
    this.formulaErrorExpr.set(null);
    this.formulaVars.set([]);

    const expr = this.newFormulaExpr.trim();
    this.formulaSuggestedFix.set(null);

    // Smart pre-validation with friendly errors + highlight
    const smartResult = this.detectFormulaError(expr);
    if (smartResult) {
      this.formulaError.set(smartResult);
      this.formulaErrorExpr.set(this.highlightError(expr));
      this.formulaSuggestedFix.set(this.tryAutoCorrect(expr));
      return;
    }

    // Check for unknown variables
    const unknownCheck = this.detectUnknownVariables(expr);
    if (unknownCheck) {
      this.formulaError.set(unknownCheck.message);
      this.formulaErrorExpr.set(unknownCheck.highlighted);
      this.formulaSuggestedFix.set(unknownCheck.fix);
      return;
    }

    this.variableService.validateFormula(this.viewId, expr).subscribe({
      next: (result) => {
        if (result.valid) {
          this.formulaValid.set(true);
          this.formulaVars.set(result.variables || []);
        } else {
          const translated = this.translateBackendError(result.error || '') || 'Formula invalida';
          this.formulaError.set(translated);
          this.formulaErrorExpr.set(this.highlightErrorFromBackend(expr, result.error || ''));
          this.formulaSuggestedFix.set(this.tryAutoCorrect(expr));
        }
      },
      error: (err) => {
        const msg = err.error?.error || err.message || '';
        this.formulaError.set(this.translateBackendError(msg) || 'Error al validar');
        this.formulaErrorExpr.set(this.highlightErrorFromBackend(expr, msg));
        this.formulaSuggestedFix.set(this.tryAutoCorrect(expr));
      },
    });
  }

  addFormula(): void {
    if (!this.newFormulaAlias.trim() || !this.newFormulaExpr.trim()) return;

    // Translate custom incognita names → i_N for backend
    let expr = this.newFormulaExpr.trim();
    const cols = this.columns();
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
      .addFormula(this.viewId, {
        alias: this.newFormulaAlias.trim(),
        expression: expr,
      })
      .subscribe({
        next: (f) => {
          this.formulas.update((list) => [...list, f]);
          this.newFormulaAlias = '';
          this.newFormulaExpr = '';
          this.formulaValid.set(false);
          this.formulaError.set(null);
          this.formulaErrorExpr.set(null);
          this.formulaSuggestedFix.set(null);
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
    this.variableService.executeView(this.viewId, this.execRange).subscribe({
      next: (result) => {
        this.executionResult.set(result);
        this.lastExecuted.set(result.timestamp);
        this.executing.set(false);
      },
      error: () => this.executing.set(false),
    });
  }

  // ---- Incognitas + Operators ----

  getIncognitaName(index: number): string {
    const custom = this.incognitaNames.get(index);
    if (custom) return custom;
    const col = this.columns()[index];
    if (!col) return `i_${index + 1}`;
    const sitePart = col.alias.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
    return `i_${sitePart}`;
  }

  renameIncognita(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (!value) return;
    const name = value.startsWith('i_') ? value : `i_${value}`;
    this.incognitaNames.set(index, name);
    // Persist to backend
    const col = this.columns()[index];
    if (col) {
      this.variableService.updateColumn(this.viewId, col.id, { incognita_name: name } as any).subscribe();
    }
  }

  insertIncognita(index: number): void {
    const name = this.getIncognitaName(index);
    this.newFormulaExpr += name;
  }

  insertOperator(value: string): void {
    this.newFormulaExpr += value;
  }

  getResultValue(alias: string): string {
    const val = this.executionResult()?.values?.[alias];
    if (val == null) return '--';
    return typeof val === 'number' ? val.toFixed(2) : String(val);
  }

  // ---- Smart Error Detection ----

  private errorPosition = -1;

  detectFormulaError(expr: string): string | null {
    if (!expr) return null;
    this.errorPosition = -1;

    // 1. Parentheses balance
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') depth--;
      if (depth < 0) {
        this.errorPosition = i;
        return 'Parentesis ")" de mas — hay un cierre sin apertura.';
      }
    }
    if (depth > 0) {
      // Find last unclosed (
      let d = 0;
      for (let i = expr.length - 1; i >= 0; i--) {
        if (expr[i] === ')') d++;
        if (expr[i] === '(') {
          if (d === 0) {
            this.errorPosition = i;
            break;
          }
          d--;
        }
      }
      return `Falta${depth > 1 ? 'n' : ''} ${depth} parentesis de cierre ")".`;
    }

    // 2. IF function checks
    if (/^IF\s*\(/i.test(expr)) {
      let d = 0;
      let semiCount = 0;
      const startIdx = expr.indexOf('(') + 1;
      const semiPositions: number[] = [];
      for (let i = startIdx; i < expr.length - 1; i++) {
        if (expr[i] === '(') d++;
        if (expr[i] === ')') d--;
        if (expr[i] === ';' && d === 0) {
          semiCount++;
          semiPositions.push(i);
        }
      }
      if (semiCount < 2) {
        this.errorPosition = expr.length - 1;
        return `IF necesita 3 argumentos separados por ";": IF(condicion; si_verdadero; si_falso). Solo tienes ${semiCount + 1}.`;
      }
      if (semiCount > 2) {
        this.errorPosition = semiPositions[2];
        return `IF solo acepta 3 argumentos pero tienes ${semiCount + 1}. Hay ";" de mas.`;
      }

      // Empty argument: ;)
      const emptyArgMatch = expr.match(/;\s*\)/);
      if (emptyArgMatch) {
        this.errorPosition = expr.indexOf(emptyArgMatch[0]);
        return 'Argumento vacio antes de ")". Falta la variable o valor del tercer argumento del IF.';
      }
    }

    // 3. Text after root-level closing paren
    let d2 = 0;
    let rootClose = -1;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') d2++;
      if (expr[i] === ')') {
        d2--;
        if (d2 === 0) {
          rootClose = i;
          break;
        }
      }
    }
    if (rootClose >= 0 && rootClose < expr.length - 1) {
      const after = expr.substring(rootClose + 1).trim();
      if (after && !/^[+\-*/><= ]/.test(after)) {
        this.errorPosition = rootClose;
        return 'El ")" esta en el lugar equivocado. Debe ir despues del ultimo argumento, no antes.';
      }
    }

    // 4. Double operators
    const noSpaces = expr.replace(/\s/g, '');
    const dblMatch = noSpaces.match(/[+\-*/]{2}/);
    if (dblMatch && !/\(-/.test(noSpaces)) {
      this.errorPosition = expr.indexOf(dblMatch[0]);
      return 'Operadores consecutivos. Revisa que entre cada operador haya un valor o variable.';
    }

    // 5. Starts/ends with invalid operator
    if (/^[*/>=<]/.test(expr)) {
      this.errorPosition = 0;
      return `No puede empezar con "${expr[0]}". Debe empezar con variable, numero o funcion.`;
    }
    if (/[+\-*/><;]\s*$/.test(expr)) {
      this.errorPosition = expr.length - 1;
      return 'Incompleta — termina con un operador. Falta un valor al final.';
    }

    // 6. Empty function call
    const emptyFn = expr.match(/(IF|ABS|ROUND|MIN|MAX|SQRT|POW|ISNULL)\s*\(\s*\)/i);
    if (emptyFn) {
      this.errorPosition = expr.indexOf(emptyFn[0]);
      return `${emptyFn[1].toUpperCase()}() esta vacia. Agrega argumentos dentro de los parentesis.`;
    }

    return null;
  }

  translateBackendError(error: string): string {
    if (!error) return '';
    if (/unexpected TPAREN/i.test(error))
      return 'Parentesis ")" inesperado. Revisa que cada "(" tenga su ")" en el lugar correcto.';
    if (/unexpected TCOMMA/i.test(error))
      return 'Coma inesperada. Usa ";" como separador en lugar de ",".';
    if (/unexpected TSEMICOLON/i.test(error))
      return '";" inesperado. Revisa la cantidad de argumentos de la funcion.';
    if (/unexpected end of expression/i.test(error))
      return 'Formula incompleta. Falta un valor, variable o parentesis de cierre al final.';
    if (/undefined variable/i.test(error)) {
      const varName = error.match(/variable[:\s]+(\S+)/i)?.[1] || '';
      return `Variable "${varName}" no reconocida. Revisa que el nombre coincida con una incognita de la tabla.`;
    }
    if (/unexpected TNAME/i.test(error))
      return 'Nombre inesperado. Tal vez falte un operador entre dos variables o un nombre esta mal escrito.';
    if (/unexpected TNUMBER/i.test(error))
      return 'Numero inesperado. Tal vez falte un operador antes del numero.';
    if (/unexpected TEOF/i.test(error))
      return 'Formula incompleta. Falta cerrar un parentesis o agregar un valor al final.';
    // Return original if no translation found
    return error;
  }

  detectUnknownVariables(expr: string): { message: string; highlighted: string; fix: string | null } | null {
    // Extract all i_* tokens from the expression
    const varPattern = /\bi_[a-zA-Z0-9_]+/g;
    const usedVars: { name: string; index: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(expr)) !== null) {
      usedVars.push({ name: match[0], index: match.index });
    }
    if (usedVars.length === 0) return null;

    // Build set of known incógnita names + canonical i_N names
    const knownNames = new Set<string>();
    const cols = this.columns();
    for (let i = 0; i < cols.length; i++) {
      knownNames.add(this.getIncognitaName(i));
      knownNames.add(`i_${i + 1}`);
    }

    // Find unknowns
    const unknowns = usedVars.filter((v) => !knownNames.has(v.name));
    if (unknowns.length === 0) return null;

    const first = unknowns[0];

    // Find closest match for suggestion
    const closest = this.findClosestVariable(first.name, knownNames);
    let message = `Variable "${first.name}" no existe.`;
    if (closest) {
      message += ` Quizas quisiste escribir "${closest}"?`;
    } else {
      message += ' Revisa el nombre en la tabla de incognitas.';
    }

    // Highlight the unknown variable
    this.errorPosition = first.index;
    const highlighted = this.highlightError(expr);

    // Auto-fix if there's a close match and only 1 unknown
    let fix: string | null = null;
    if (closest && unknowns.length === 1) {
      fix = expr.substring(0, first.index) + closest + expr.substring(first.index + first.name.length);
    }

    return { message, highlighted, fix };
  }

  private findClosestVariable(name: string, known: Set<string>): string | null {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const k of known) {
      const dist = this.levenshtein(name.toLowerCase(), k.toLowerCase());
      if (dist < bestDist && dist <= Math.max(3, Math.floor(name.length * 0.3))) {
        bestDist = dist;
        best = k;
      }
    }
    return best;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[m][n];
  }

  tryAutoCorrect(expr: string): string | null {
    // Only correct patterns that are 100% unambiguous

    // 1. IF(cond;val;)textAfter → IF(cond;val;textAfter)
    //    Empty 3rd arg + non-operator text after closing paren
    const ifEmptyThird = expr.match(/^(IF\s*\([^)]*;\s*[^;]*;\s*)\)(.+)$/i);
    if (ifEmptyThird) {
      const inside = ifEmptyThird[1];
      const after = ifEmptyThird[2].trim();
      // Only if 'after' looks like a variable or number (not another expression)
      if (/^[a-zA-Z_i][a-zA-Z0-9_]*$/.test(after) || /^\d+(\.\d+)?$/.test(after)) {
        return `${inside}${after})`;
      }
    }

    // 2. Missing closing parens at end — add them
    let depth = 0;
    for (const ch of expr) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    if (depth > 0 && depth <= 3) {
      // Only if no other structural issues
      const fixed = expr + ')'.repeat(depth);
      // Verify the fix doesn't have other problems
      const recheck = this.detectFormulaError(fixed);
      if (!recheck) return fixed;
    }

    // 3. Commas used instead of semicolons in function calls
    if (/\(.*,.*\)/.test(expr) && !/;/.test(expr)) {
      const fixed = expr.replace(/,/g, ';');
      const recheck = this.detectFormulaError(fixed);
      if (!recheck) return fixed;
    }

    return null;
  }

  applyFix(): void {
    const fix = this.formulaSuggestedFix();
    if (!fix) return;
    this.newFormulaExpr = fix;
    this.formulaError.set(null);
    this.formulaErrorExpr.set(null);
    this.formulaSuggestedFix.set(null);
  }

  copyFix(): void {
    const fix = this.formulaSuggestedFix();
    if (!fix) return;
    navigator.clipboard.writeText(fix);
  }

  highlightError(expr: string): string {
    if (this.errorPosition < 0 || this.errorPosition >= expr.length) {
      return this.escapeHtml(expr);
    }
    // Highlight a range around the error position
    const start = Math.max(0, this.errorPosition);
    const end = Math.min(expr.length, this.errorPosition + Math.max(1, this.getErrorSpan(expr, this.errorPosition)));
    const before = this.escapeHtml(expr.substring(0, start));
    const error = this.escapeHtml(expr.substring(start, end));
    const after = this.escapeHtml(expr.substring(end));
    return `${before}<span class="err-highlight">${error}</span>${after}`;
  }

  highlightErrorFromBackend(expr: string, error: string): string {
    // Try to find position from backend error patterns
    const posMatch = error.match(/at character (\d+)/i) || error.match(/position (\d+)/i);
    if (posMatch) {
      this.errorPosition = parseInt(posMatch[1], 10) - 1;
      return this.highlightError(expr);
    }
    // Try to find the problematic token
    const tokenMatch = error.match(/TPAREN|TCOMMA|TSEMICOLON|TNAME|TNUMBER/i);
    if (tokenMatch) {
      const token = tokenMatch[0];
      const charMap: Record<string, string> = {
        TPAREN: ')',
        TCOMMA: ',',
        TSEMICOLON: ';',
      };
      const searchChar = charMap[token];
      if (searchChar) {
        // Find first problematic occurrence working backwards
        const lastIdx = expr.lastIndexOf(searchChar);
        if (lastIdx >= 0) {
          this.errorPosition = lastIdx;
          return this.highlightError(expr);
        }
      }
    }
    return this.escapeHtml(expr);
  }

  private getErrorSpan(expr: string, pos: number): number {
    // If error is at a variable name, highlight the whole name
    if (/[a-zA-Z_]/.test(expr[pos])) {
      let end = pos;
      while (end < expr.length && /[a-zA-Z0-9_]/.test(expr[end])) end++;
      return end - pos;
    }
    return 1;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Formula Helper ----

  getFormulaTemplates(): { icon: string; name: string; desc: string; formula: string }[] {
    const i1 = this.columns().length > 0 ? this.getIncognitaName(0) : 'i_1';
    const i2 = this.columns().length > 1 ? this.getIncognitaName(1) : 'i_2';
    return [
      { icon: '+', name: 'Suma', desc: 'Sumar dos variables', formula: `${i1} + ${i2}` },
      { icon: '-', name: 'Diferencia', desc: 'Restar una de otra', formula: `${i1} - ${i2}` },
      { icon: 'x\u0304', name: 'Promedio', desc: 'Promedio de dos variables', formula: `(${i1} + ${i2}) / 2` },
      {
        icon: '\u00f7',
        name: 'Proporcion',
        desc: 'Dividir una entre otra',
        formula: `${i1} / (${i2} + 0.01)`,
      },
      {
        icon: '?',
        name: 'Condicional',
        desc: 'Si valor supera umbral, usar 0',
        formula: `IF(${i1} > 100; 0; ${i1})`,
      },
      { icon: '|x|', name: 'Valor absoluto', desc: 'Diferencia absoluta', formula: `ABS(${i1} - ${i2})` },
      { icon: '\u2248', name: 'Redondear', desc: 'Redondear a 2 decimales', formula: `ROUND(${i1}; 2)` },
      {
        icon: '\u2205',
        name: 'Si es nulo',
        desc: 'Reemplazar nulo con 0',
        formula: `IF(ISNULL(${i1}); 0; ${i1})`,
      },
    ];
  }

  applyTemplate(tpl: { formula: string; name: string }): void {
    this.newFormulaExpr = tpl.formula;
    if (!this.newFormulaAlias.trim()) {
      this.newFormulaAlias = tpl.name.toLowerCase().replace(/\s+/g, '_');
    }
    this.showFormulaHelper.set(false);
    this.formulaValid.set(false);
    this.formulaError.set(null);
  }

  resetFormulaForm(): void {
    this.newFormulaAlias = '';
    this.newFormulaExpr = '';
    this.formulaValid.set(false);
    this.formulaError.set(null);
    this.formulaErrorExpr.set(null);
    this.formulaSuggestedFix.set(null);
    this.formulaVars.set([]);
    this.showFormulaHelper.set(false);
  }

  getFormulaPreview(): string {
    const expr = this.newFormulaExpr.trim();
    if (!expr) return '';

    let readable = expr;
    const cols = this.columns();
    for (let i = 0; i < cols.length; i++) {
      const name = this.getIncognitaName(i);
      const alias = cols[i].alias.split(' / ').pop() || cols[i].alias;
      readable = readable.split(name).join(alias);
    }

    if (/^IF\s*\(/i.test(expr)) return `Condicional: ${readable}`;
    if (/^ABS\s*\(/i.test(expr)) return `Valor absoluto: ${readable}`;
    if (/^ROUND\s*\(/i.test(expr)) return `Redondeo: ${readable}`;
    if (/^MIN\s*\(/i.test(expr)) return `Minimo: ${readable}`;
    if (/^MAX\s*\(/i.test(expr)) return `Maximo: ${readable}`;
    if (/^SQRT\s*\(/i.test(expr)) return `Raiz cuadrada: ${readable}`;
    if (/\+/.test(expr) && !/[-*/]/.test(expr)) return `Suma: ${readable}`;
    if (/-/.test(expr) && !/[+*/]/.test(expr)) return `Diferencia: ${readable}`;
    if (/\//.test(expr)) return `Division: ${readable}`;
    if (/\*/.test(expr)) return `Multiplicacion: ${readable}`;
    return readable;
  }

  // ---- Series Chart ----

  openSeriesChart(formula: ViewFormula): void {
    this.seriesFormulaId.set(formula.id);
    this.seriesAlias.set(formula.alias);
    this.showSeriesChart.set(true);
    this.loadSeries();
  }

  changeSeriesRange(range: string): void {
    this.seriesRange.set(range);
    this.loadSeries();
  }

  private loadSeries(): void {
    const fid = this.seriesFormulaId();
    if (!fid) return;
    this.seriesLoading.set(true);
    this.variableService.executeViewSeries(this.viewId, fid, this.seriesRange()).subscribe({
      next: (result) => {
        this.seriesData.set(result.data || []);
        this.seriesLoading.set(false);
        this.renderChart();
      },
      error: () => {
        this.seriesLoading.set(false);
        this.seriesData.set([]);
      },
    });
  }

  private renderChart(): void {
    const container = document.getElementById('series-chart-container');
    if (!container) return;

    // Lazy-load ECharts
    import('echarts').then((echarts) => {
      if (this.chartInstance) {
        this.chartInstance.dispose();
      }
      this.chartInstance = echarts.init(container);
      const data = this.seriesData();
      this.chartInstance.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const p = params[0];
            const date = new Date(p.value[0]);
            const timeStr = date.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
            return `${timeStr}<br/><strong>${p.seriesName}:</strong> ${p.value[1]?.toFixed(2) ?? '--'}`;
          },
        },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: 'time',
          axisLabel: { fontSize: 10, color: '#94a3b8' },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 10, color: '#94a3b8' },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series: [{
          name: this.seriesAlias(),
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#6d002b' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(109,0,43,0.15)' }, { offset: 1, color: 'rgba(109,0,43,0)' }] } },
          data: data.map(([ts, val]) => [ts, val]),
        }],
      });
    });
  }

  closeSeriesChart(): void {
    this.showSeriesChart.set(false);
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  }

  // ---- Sharing ----

  openShareDialog(): void {
    this.showShareDialog.set(true);
    this.loadShares();
  }

  loadShares(): void {
    this.variableService.getViewShares(this.viewId).subscribe({
      next: (data) => this.shares.set(data),
    });
  }

  searchCandidates(): void {
    const q = this.shareSearchQuery.trim();
    if (q.length < 2) {
      this.candidates.set([]);
      return;
    }
    this.variableService.searchShareCandidates(this.viewId, q).subscribe({
      next: (data) => this.candidates.set(data),
    });
  }

  addShare(): void {
    if (!this.selectedCandidateId) return;
    this.variableService
      .addViewShare(this.viewId, this.selectedCandidateId, this.sharePermission)
      .subscribe({
        next: () => {
          this.loadShares();
          this.selectedCandidateId = 0;
          this.shareSearchQuery = '';
          this.candidates.set([]);
        },
      });
  }

  removeShare(share: ViewShare): void {
    this.variableService.removeViewShare(this.viewId, share.id).subscribe({
      next: () => this.shares.update((list) => list.filter((s) => s.id !== share.id)),
    });
  }

  selectCandidate(c: ShareCandidate): void {
    this.selectedCandidateId = c.id;
    this.shareSearchQuery = c.full_name;
    this.candidates.set([]);
  }
}
