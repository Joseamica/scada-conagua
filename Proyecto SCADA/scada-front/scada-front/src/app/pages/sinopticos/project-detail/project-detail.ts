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
} from '@ng-icons/heroicons/outline';
import { SinopticoService, Sinoptico } from '../../../core/services/sinoptico.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [
    provideIcons({ heroPlus, heroTrash, heroDocumentDuplicate, heroArrowLeft, heroPencilSquare, heroEye }),
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
  newName = '';
  newDescription = '';

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
    this.showCreateDialog.set(true);
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
          this.showCreateDialog.set(false);
          this.sinopticos.update((list) => [s, ...list]);
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
    if (!confirm(`Eliminar sinoptico "${sinoptico.name}"?`)) return;
    this.sinopticoService.deleteSinoptico(sinoptico.id).subscribe({
      next: () => this.sinopticos.update((list) => list.filter((s) => s.id !== sinoptico.id)),
    });
  }

  goBack(): void {
    this.router.navigate(['/sinopticos']);
  }
}
