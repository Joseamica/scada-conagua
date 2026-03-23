import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroFolder,
  heroTrash,
  heroPencilSquare,
  heroGlobeAlt,
  heroLockClosed,
  heroShare,
  heroEye,
} from '@ng-icons/heroicons/outline';
import { SinopticoService, SinopticoProject, Sinoptico } from '../../../core/services/sinoptico.service';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarNavComponent } from '../../../layout/sidebar-nav/sidebar-nav';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-sinopticos-home',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, SidebarNavComponent, HeaderBarComponent],
  providers: [
    provideIcons({ heroPlus, heroFolder, heroTrash, heroPencilSquare, heroGlobeAlt, heroLockClosed, heroShare, heroEye }),
  ],
  templateUrl: './sinopticos-home.html',
  styleUrl: './sinopticos-home.css',
})
export class SinopticosHome implements OnInit {
  private sinopticoService = inject(SinopticoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  canEditSinopticos = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role_id === 1) return true; // Admin always
    return user.can_edit_sinopticos === true;
  });

  projects = signal<SinopticoProject[]>([]);
  sharedWithMe = signal<(Sinoptico & { permission: string; project_name: string })[]>([]);
  loading = signal(true);
  showCreateDialog = signal(false);
  newProjectName = '';
  newProjectDescription = '';
  newProjectPublic = false;

  ngOnInit(): void {
    this.loadProjects();
    this.loadSharedWithMe();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.sinopticoService.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    this.newProjectName = '';
    this.newProjectDescription = '';
    this.newProjectPublic = false;
    this.showCreateDialog.set(true);
  }

  createProject(): void {
    if (!this.newProjectName.trim()) return;
    this.sinopticoService
      .createProject({
        name: this.newProjectName.trim(),
        description: this.newProjectDescription.trim() || undefined,
        is_public: this.newProjectPublic,
      })
      .subscribe({
        next: (project) => {
          this.showCreateDialog.set(false);
          this.projects.update((list) => [project, ...list]);
        },
        error: () => {},
      });
  }

  deleteProject(project: SinopticoProject, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Eliminar proyecto "${project.name}"? Esto eliminara todos sus sinopticos.`)) return;
    this.sinopticoService.deleteProject(project.id).subscribe({
      next: () => this.projects.update((list) => list.filter((p) => p.id !== project.id)),
    });
  }

  openProject(project: SinopticoProject): void {
    this.router.navigate(['/sinopticos/proyecto', project.id]);
  }

  loadSharedWithMe(): void {
    this.sinopticoService.getSharedWithMe().subscribe({
      next: (data) => this.sharedWithMe.set(data),
    });
  }

  openSharedViewer(sinoptico: any): void {
    this.router.navigate(['/sinopticos/viewer', sinoptico.id]);
  }

  openSharedEditor(sinoptico: any): void {
    this.router.navigate(['/sinopticos/editor', sinoptico.id]);
  }
}
