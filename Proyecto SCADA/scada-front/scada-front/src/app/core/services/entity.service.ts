import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Entity } from '../models/entity.model';

@Injectable({ providedIn: 'root' })
export class EntityService {
  private readonly apiUrl = `${environment.apiQueryUrl}/entities`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Entity[]> {
    return this.http.get<Entity[]>(this.apiUrl);
  }

  create(entity: Partial<Entity>): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(this.apiUrl, entity);
  }
}
