import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TagEntry {
  devEUI: string;
  siteName: string;
  municipality: string;
  siteType: string;
  provider: string;
  measurements: string[];
}

export interface VariableFolder {
  id: number;
  name: string;
  parent_id: number | null;
  owner_id: number;
  created_at: string;
}

export interface VariableView {
  id: number;
  name: string;
  description: string | null;
  folder_id: number | null;
  owner_id: number;
  owner_name: string;
  is_shared: boolean;
  column_count: number;
  formula_count: number;
  created_at: string;
  updated_at: string;
}

export interface ViewColumn {
  id: number;
  view_id: number;
  alias: string;
  dev_eui: string;
  measurement: string;
  aggregation: 'AVG' | 'MIN' | 'MAX' | 'SUM' | 'LAST_VALUE' | 'BAL';
  sort_order: number;
  incognita_name?: string | null;
}

export interface ViewFormula {
  id: number;
  view_id: number;
  alias: string;
  expression: string;
  depends_on: number[];
  sort_order: number;
}

export interface VariableViewDetail extends VariableView {
  columns: ViewColumn[];
  formulas: ViewFormula[];
}

export interface FormulaSeriesResult {
  formulaId: number;
  alias: string;
  data: [number, number][];
}

export interface ViewShare {
  id: number;
  user_id: number;
  permission: 'read' | 'edit';
  full_name: string;
  email: string;
  created_at: string;
}

export interface ShareCandidate {
  id: number;
  full_name: string;
  email: string;
}

export interface FormulaValidation {
  valid: boolean;
  variables: string[];
  error?: string;
}

export interface ViewExecutionResult {
  view: VariableView;
  columns: ViewColumn[];
  formulas: ViewFormula[];
  values: Record<string, number | null>;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class VariableService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/variables`;

  // Tags
  getTags(): Observable<TagEntry[]> {
    return this.http.get<TagEntry[]>(`${this.base}/tags`);
  }

  // Folders
  getFolders(): Observable<VariableFolder[]> {
    return this.http.get<VariableFolder[]>(`${this.base}/folders`);
  }

  createFolder(name: string, parentId?: number): Observable<VariableFolder> {
    return this.http.post<VariableFolder>(`${this.base}/folders`, { name, parent_id: parentId });
  }

  deleteFolder(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/folders/${id}`);
  }

  // Views
  getViews(): Observable<VariableView[]> {
    return this.http.get<VariableView[]>(`${this.base}/views`);
  }

  getView(id: number): Observable<VariableViewDetail> {
    return this.http.get<VariableViewDetail>(`${this.base}/views/${id}`);
  }

  createView(data: { name: string; description?: string; folder_id?: number }): Observable<VariableView> {
    return this.http.post<VariableView>(`${this.base}/views`, data);
  }

  updateView(id: number, data: Partial<VariableView>): Observable<VariableView> {
    return this.http.put<VariableView>(`${this.base}/views/${id}`, data);
  }

  deleteView(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/views/${id}`);
  }

  // Columns
  addColumn(viewId: number, data: Partial<ViewColumn>): Observable<ViewColumn> {
    return this.http.post<ViewColumn>(`${this.base}/views/${viewId}/columns`, data);
  }

  updateColumn(viewId: number, colId: number, data: Partial<ViewColumn>): Observable<ViewColumn> {
    return this.http.put<ViewColumn>(`${this.base}/views/${viewId}/columns/${colId}`, data);
  }

  deleteColumn(viewId: number, colId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/views/${viewId}/columns/${colId}`);
  }

  // Formulas
  addFormula(viewId: number, data: Partial<ViewFormula>): Observable<ViewFormula> {
    return this.http.post<ViewFormula>(`${this.base}/views/${viewId}/formulas`, data);
  }

  updateFormula(viewId: number, formulaId: number, data: Partial<ViewFormula>): Observable<ViewFormula> {
    return this.http.put<ViewFormula>(`${this.base}/views/${viewId}/formulas/${formulaId}`, data);
  }

  deleteFormula(viewId: number, formulaId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/views/${viewId}/formulas/${formulaId}`);
  }

  validateFormula(viewId: number, expression: string): Observable<FormulaValidation> {
    return this.http.post<FormulaValidation>(`${this.base}/views/${viewId}/formulas/validate`, { expression });
  }

  // Execute
  executeView(viewId: number, range?: string): Observable<ViewExecutionResult> {
    return this.http.post<ViewExecutionResult>(`${this.base}/views/${viewId}/execute`, { range });
  }

  getMyViews(): Observable<VariableView[]> {
    return this.http.get<VariableView[]>(`${this.base}/views?mine=true`);
  }

  getViewDetail(viewId: number): Observable<VariableViewDetail> {
    return this.http.get<VariableViewDetail>(`${this.base}/views/${viewId}`);
  }

  executeViewSeries(
    viewId: number,
    formulaId: number,
    range: string,
  ): Observable<FormulaSeriesResult> {
    return this.http.post<FormulaSeriesResult>(
      `${this.base}/views/${viewId}/execute-series`,
      { formulaId, range },
    );
  }

  // Sharing
  getViewShares(viewId: number): Observable<ViewShare[]> {
    return this.http.get<ViewShare[]>(`${this.base}/views/${viewId}/shares`);
  }

  addViewShare(viewId: number, userId: number, permission: string): Observable<ViewShare> {
    return this.http.post<ViewShare>(`${this.base}/views/${viewId}/shares`, {
      user_id: userId,
      permission,
    });
  }

  removeViewShare(viewId: number, shareId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/views/${viewId}/shares/${shareId}`);
  }

  searchShareCandidates(viewId: number, q: string): Observable<ShareCandidate[]> {
    return this.http.get<ShareCandidate[]>(`${this.base}/views/${viewId}/share-candidates`, {
      params: { q },
    });
  }
}
