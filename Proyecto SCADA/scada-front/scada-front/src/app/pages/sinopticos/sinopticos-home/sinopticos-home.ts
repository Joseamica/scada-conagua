import { Component, OnInit, inject, signal } from '@angular/core';
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
} from '@ng-icons/heroicons/outline';
import { SinopticoService, SinopticoProject } from '../../../core/services/sinoptico.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-sinopticos-home',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [
    provideIcons({ heroPlus, heroFolder, heroTrash, heroPencilSquare, heroGlobeAlt, heroLockClosed }),
  ],
  templateUrl: './sinopticos-home.html',
  styleUrl: './sinopticos-home.css',
})
export class SinopticosHome implements OnInit {
  private sinopticoService = inject(SinopticoService);
  private router = inject(Router);

  projects = signal<SinopticoProject[]>([]);
  loading = signal(true);
  showCreateDialog = signal(false);
  newProjectName = '';
  newProjectDescription = '';
  newProjectPublic = false;

  ngOnInit(): void {
    this.loadProjects();
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
}
