import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroTrash,
  heroDocumentDuplicate,
  heroArrowLeft,
  heroPencilSquare,
  heroEye,
  heroArrowPath,
  heroShare,
  heroXMark,
  heroMagnifyingGlass,
  heroUserPlus,
} from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  Sinoptico,
  SinopticoShare,
} from '../../../core/services/sinoptico.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [
    provideIcons({ heroPlus, heroTrash, heroDocumentDuplicate, heroArrowLeft, heroPencilSquare, heroEye, heroArrowPath, heroShare, heroXMark, heroMagnifyingGlass, heroUserPlus }),
  ],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.css',
})
export class ProjectDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sinopticoService = inject(SinopticoService);

  projectId = 0;
  projectName = signal('');
  sinopticos = signal<Sinoptico[]>([]);
  loading = signal(true);
  showCreateDialog = signal(false);
  showTrash = signal(false);
  trashItems = signal<{ id: number; name: string; description: string | null; version: number; deleted_at: string }[]>([]);
  newName = '';
  newDescription = '';

  // Permission options
  readonly permOptions = [
    { key: 'view', label: 'Ver' },
    { key: 'edit', label: 'Editar' },
    { key: 'create', label: 'Crear' },
    { key: 'delete', label: 'Eliminar' },
  ] as const;

  // Create dialog — user assignment (per-user permissions)
  createCandidates = signal<{
    id: number; full_name: string; email: string;
    role_id: number; role_name: string; municipio_name: string | null;
  }[]>([]);
  createSearch = signal('');
  createAssignees = signal<{
    id: number; full_name: string; email: string;
    role_id: number; role_name: string; municipio_name: string | null;
    perms: Record<string, boolean>;
  }[]>([]);

  // Share dialog
  showShareDialog = signal(false);
  shareSinopticoId = signal(0);
  shareSinopticoName = signal('');
  shares = signal<SinopticoShare[]>([]);
  shareCandidates = signal<{
    id: number; full_name: string; email: string;
    role_id: number; role_name: string; municipio_name: string | null;
  }[]>([]);
  shareSearch = signal('');

  ngOnInit(): void {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadProject();
    this.loadSinopticos();
  }

  loadProject(): void {
    this.sinopticoService.getProjects().subscribe({
      next: (projects) => {
        const p = projects.find((p) => p.id === this.projectId);
        if (p) this.projectName.set(p.name);
      },
    });
  }

  loadSinopticos(): void {
    this.loading.set(true);
    this.sinopticoService.getProjectSinopticos(this.projectId).subscribe({
      next: (data) => {
        this.sinopticos.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openEditor(sinoptico: Sinoptico): void {
    this.router.navigate(['/sinopticos/editor', sinoptico.id]);
  }

  openViewer(sinoptico: Sinoptico, event?: Event): void {
    this.router.navigate(['/sinopticos/viewer', sinoptico.id]);
  }

  openCreateDialog(): void {
    this.newName = '';
    this.newDescription = '';
    this.createSearch.set('');
    this.createCandidates.set([]);
    this.createAssignees.set([]);
    this.showCreateDialog.set(true);
  }

  searchCreateCandidates(): void {
    const q = this.createSearch();
    if (q.length < 1) {
      this.createCandidates.set([]);
      return;
    }
    this.sinopticoService.searchCandidates(q).subscribe({
      next: (data) => {
        const assignedIds = new Set(this.createAssignees().map((a) => a.id));
        this.createCandidates.set(data.filter((c) => !assignedIds.has(c.id)));
      },
    });
  }

  private buildPermString(perms: Record<string, boolean>): string {
    const selected = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
    return selected.length > 0 ? selected.join(',') : 'view';
  }

  addCreateAssignee(candidate: { id: number; full_name: string; email: string; role_id: number; role_name: string; municipio_name: string | null }): void {
    this.createAssignees.update((list) => [
      ...list,
      { ...candidate, perms: { view: true, edit: false, create: false, delete: false } },
    ]);
    this.createCandidates.update((list) => list.filter((c) => c.id !== candidate.id));
    this.createSearch.set('');
  }

  toggleAssigneePerm(userId: number, key: string): void {
    this.createAssignees.update((list) =>
      list.map((a) => a.id === userId ? { ...a, perms: { ...a.perms, [key]: !a.perms[key] } } : a),
    );
  }

  removeCreateAssignee(userId: number): void {
    this.createAssignees.update((list) => list.filter((a) => a.id !== userId));
  }

  permLabel(perm: string): string {
    const map: Record<string, string> = {
      view: 'Ver', edit: 'Editar', create: 'Crear', delete: 'Eliminar', admin: 'Admin',
      read: 'Ver',
    };
    return perm.split(',').map((p) => map[p.trim()] || p).join(', ');
  }

  hasPermission(perm: string, key: string): boolean {
    return perm.split(',').map((p) => p.trim()).includes(key);
  }

  createSinoptico(): void {
    if (!this.newName.trim()) return;
    this.sinopticoService
      .createSinoptico(this.projectId, {
        name: this.newName.trim(),
        description: this.newDescription.trim() || undefined,
      })
      .subscribe({
        next: (s) => {
          const assignees = this.createAssignees();
          if (assignees.length === 0) {
            this.showCreateDialog.set(false);
            this.sinopticos.update((list) => [s, ...list]);
            return;
          }
          let completed = 0;
          for (const a of assignees) {
            this.sinopticoService.addShare(s.id, a.id, this.buildPermString(a.perms)).subscribe({
              next: () => {
                completed++;
                if (completed === assignees.length) {
                  this.showCreateDialog.set(false);
                  this.sinopticos.update((list) => [s, ...list]);
                }
              },
            });
          }
        },
      });
  }

  duplicate(sinoptico: Sinoptico, event: Event): void {
    event.stopPropagation();
    this.sinopticoService.duplicateSinoptico(sinoptico.id).subscribe({
      next: (copy) => this.sinopticos.update((list) => [copy, ...list]),
    });
  }

  deleteSinoptico(sinoptico: Sinoptico, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Mover "${sinoptico.name}" a la papelera?`)) return;
    this.sinopticoService.deleteSinoptico(sinoptico.id).subscribe({
      next: () => {
        this.sinopticos.update((list) => list.filter((s) => s.id !== sinoptico.id));
        // Refresh trash if visible
        if (this.showTrash()) this.loadTrash();
      },
    });
  }

  toggleTrash(): void {
    this.showTrash.update((v) => !v);
    if (this.showTrash() && this.trashItems().length === 0) {
      this.loadTrash();
    }
  }

  loadTrash(): void {
    this.sinopticoService.getTrash(this.projectId).subscribe({
      next: (data) => this.trashItems.set(data),
    });
  }

  restoreSinoptico(item: { id: number; name: string }, event: Event): void {
    event.stopPropagation();
    this.sinopticoService.restoreSinoptico(item.id).subscribe({
      next: () => {
        this.trashItems.update((list) => list.filter((t) => t.id !== item.id));
        this.loadSinopticos();
      },
    });
  }

  openShareDialog(sinoptico: Sinoptico, event: Event): void {
    event.stopPropagation();
    this.shareSinopticoId.set(sinoptico.id);
    this.shareSinopticoName.set(sinoptico.name);
    this.shareSearch.set('');
    this.shareCandidates.set([]);
    this.showShareDialog.set(true);
    this.loadShares(sinoptico.id);
  }

  loadShares(sinopticoId: number): void {
    this.sinopticoService.getShares(sinopticoId).subscribe({
      next: (data) => this.shares.set(data),
    });
  }

  searchShareCandidates(): void {
    const q = this.shareSearch();
    if (q.length < 1) {
      this.shareCandidates.set([]);
      return;
    }
    this.sinopticoService.searchShareCandidates(this.shareSinopticoId(), q).subscribe({
      next: (data) => this.shareCandidates.set(data),
    });
  }

  addShare(userId: number): void {
    // Default: view only. User configures per-user permissions after adding.
    this.sinopticoService
      .addShare(this.shareSinopticoId(), userId, 'view')
      .subscribe({
        next: () => {
          this.loadShares(this.shareSinopticoId());
          this.shareCandidates.set([]);
          this.shareSearch.set('');
        },
        error: (err) => {
          const msg = err?.error?.error || 'Error al compartir';
          alert(msg);
        },
      });
  }

  toggleExistingSharePerm(share: SinopticoShare, key: string): void {
    const current = new Set(share.permission.split(',').map((p) => p.trim()));
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    if (current.size === 0) current.add('view');
    const newPerm = [...current].sort().join(',');
    this.sinopticoService.addShare(this.shareSinopticoId(), share.user_id, newPerm).subscribe({
      next: () => this.loadShares(this.shareSinopticoId()),
    });
  }

  removeShare(shareId: number): void {
    this.sinopticoService.removeShare(this.shareSinopticoId(), shareId).subscribe({
      next: () => this.loadShares(this.shareSinopticoId()),
    });
  }

  goBack(): void {
    this.router.navigate(['/sinopticos']);
  }
}
