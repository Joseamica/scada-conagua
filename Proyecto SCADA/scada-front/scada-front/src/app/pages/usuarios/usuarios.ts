import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../layout/sidebar-nav/sidebar-nav';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroDocumentChartBar,
  heroMagnifyingGlass,
  heroAdjustmentsHorizontal,
  heroPlus,
  heroPencilSquare,
  heroNoSymbol,
  heroUserGroup,
  heroShieldCheck,
  heroLockClosed,
  heroFunnel,
  heroBuildingOffice2
} from '@ng-icons/heroicons/outline';
import { UserService } from '../../core/services/user.service';
import { EntityService } from '../../core/services/entity.service';
import { AuditService, AuditLogEntry } from '../../core/services/audit.service';
import { User } from '../../core/models/user.model';
import { Entity, EntityTreeNode } from '../../core/models/entity.model';
import { ROLE_MAP } from '../../core/constants/roles';
import { translateAction, actionCategory } from '../../core/constants/audit-actions';

type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBarComponent,
    SidebarNavComponent,
    NgIconComponent
  ],
  providers: [
    provideIcons({
      heroArrowPath,
      heroDocumentChartBar,
      heroMagnifyingGlass,
      heroAdjustmentsHorizontal,
      heroPlus,
      heroPencilSquare,
      heroNoSymbol,
      heroUserGroup,
      heroShieldCheck,
      heroLockClosed,
      heroFunnel,
      heroBuildingOffice2
    })
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {

  constructor(
    private router: Router,
    private userService: UserService,
    private entityService: EntityService,
    private auditService: AuditService
  ) {}

  ngOnInit() {
    this.loadEntities();
    this.loadUsers();
    this.loadRecentLogs();
  }

  /* =========================
     STATE
  ========================= */

  search = signal('');
  filtersOpen = signal(false);
  filterRol = signal<string>('ALL');
  filterNivel = signal<string>('ALL');
  filterEstatus = signal<string>('ALL');

  selectedEntityId = signal<number | null>(null);
  selectedEntityName = signal<string>('Todos');

  usersList = signal<User[]>([]);
  entities = signal<Entity[]>([]);
  logs = signal<AuditLogEntry[]>([]);

  selectedUserId = signal<number | null>(null);

  roleOptions = Object.values(ROLE_MAP);

  /* =========================
     KPI COMPUTED
  ========================= */

  usersActivos = computed(() =>
    this.usersList().filter(u => !u.is_blocked).length
  );

  usersBloqueados = computed(() =>
    this.usersList().filter(u => u.is_blocked).length
  );

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterRol() !== 'ALL') count++;
    if (this.filterNivel() !== 'ALL') count++;
    if (this.filterEstatus() !== 'ALL') count++;
    if (this.search()) count++;
    return count;
  });

  /* =========================
     ENTITY TREE
  ========================= */

  entityTree = computed<EntityTreeNode[]>(() => {
    const all = this.entities();
    const nodeMap = new Map<number, EntityTreeNode>();

    for (const e of all) {
      nodeMap.set(e.id, { entity: e, children: [] });
    }

    const roots: EntityTreeNode[] = [];
    for (const e of all) {
      const node = nodeMap.get(e.id)!;
      if (e.parent_id && nodeMap.has(e.parent_id)) {
        nodeMap.get(e.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  });

  /* =========================
     FILTERED USERS
  ========================= */

  filteredUsers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const rol = this.filterRol();
    const nivel = this.filterNivel();
    const estatus = this.filterEstatus();

    return this.usersList().filter(u => {
      const matchesQ =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);

      const matchesRol = rol === 'ALL' || u.role_name === rol;
      const matchesNivel = nivel === 'ALL' || u.scope === nivel;
      const matchesEstatus = estatus === 'ALL' || (
        estatus === 'ACTIVO' ? !u.is_blocked :
        estatus === 'BLOQUEADO' ? u.is_blocked === true : false
      );

      return matchesQ && matchesRol && matchesNivel && matchesEstatus;
    });
  });

  /* =========================
     DATA LOADING
  ========================= */

  loadEntities() {
    this.entityService.getAll().subscribe({
      next: (data) => this.entities.set(data),
      error: (err) => console.error('Error loading entities:', err)
    });
  }

  loadUsers(entityId?: number) {
    this.userService.getAll(entityId).subscribe({
      next: (data) => this.usersList.set(data),
      error: (err) => console.error('Error loading users:', err)
    });
  }

  loadRecentLogs() {
    this.auditService.getLogs({ page: 1, limit: 10 }).subscribe({
      next: (res) => this.logs.set(res.data),
      error: (err) => console.error('Error loading audit logs:', err)
    });
  }

  /* =========================
     TREE ACTIONS
  ========================= */

  selectEntity(entity: Entity | null) {
    if (entity) {
      this.selectedEntityId.set(entity.id);
      this.selectedEntityName.set(entity.name);
      this.loadUsers(entity.id);
    } else {
      this.selectedEntityId.set(null);
      this.selectedEntityName.set('Todos');
      this.loadUsers();
    }
  }

  isEntitySelected(entityId: number): boolean {
    return this.selectedEntityId() === entityId;
  }

  /* =========================
     FILTER ACTIONS
  ========================= */

  toggleFilters() {
    this.filtersOpen.set(!this.filtersOpen());
  }

  clearFilters() {
    this.filterRol.set('ALL');
    this.filterNivel.set('ALL');
    this.filterEstatus.set('ALL');
    this.search.set('');
    this.selectEntity(null);
  }

  /* =========================
     USER ACTIONS
  ========================= */

  selectUser(id: number) {
    this.selectedUserId.set(id);
  }

  crearUsuario() {
    this.router.navigate(['/usuarios/nuevo']);
  }

  onReporteAuditoria() {
    this.router.navigate(['/reporte']);
  }

  onEditar(u: User) {
    this.router.navigate(
      ['/usuarios', u.id, 'editar'],
      { state: { usuario: u } }
    );
  }

  onEliminar(u: User) {
    if (confirm(`¿Estas seguro de revocar el acceso a ${u.full_name}?`)) {
      this.userService.block(u.id).subscribe(() => {
        this.loadUsers(this.selectedEntityId() ?? undefined);
      });
    }
  }

  /* =========================
     HELPERS
  ========================= */

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  statusLabel(u: User): string {
    if (u.is_blocked) return 'Bloqueado';
    return 'Activo';
  }

  statusClass(u: User): string {
    if (u.is_blocked) return 'pill--bad';
    return 'pill--ok';
  }

  translateAction = translateAction;
  actionCategory = actionCategory;

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
