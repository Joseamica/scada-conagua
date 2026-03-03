import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

export interface UserPermissions {
  user_id: number;
  can_view: boolean;
  can_edit: boolean;
  can_export: boolean;
  can_block: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiQueryUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(entityId?: number): Observable<User[]> {
    let params = new HttpParams();
    if (entityId) params = params.set('entityId', entityId.toString());
    return this.http.get<User[]>(this.apiUrl, { params });
  }

  create(user: User): Observable<any> {
    return this.http.post(this.apiUrl, user);
  }

  update(id: number, user: Partial<User>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, user);
  }

  block(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/block`, {});
  }

  adminResetPassword(id: number, newPass: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reset-password`, { newPassword: newPass });
  }

  getPermissions(userId: number): Observable<UserPermissions> {
    return this.http.get<UserPermissions>(`${this.apiUrl}/${userId}/permissions`);
  }

  updatePermissions(userId: number, perms: Partial<UserPermissions>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${userId}/permissions`, perms);
  }

  logNavigation(moduleName: string): Observable<any> {
    return this.http.post(`${environment.apiQueryUrl}/audit/navigation`, { module: moduleName });
  }
}
