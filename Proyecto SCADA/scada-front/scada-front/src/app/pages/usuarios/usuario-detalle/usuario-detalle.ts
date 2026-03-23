import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../../layout/sidebar-nav/sidebar-nav';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroUser, heroLockClosed, heroShieldCheck, heroKey,
  heroEye, heroEyeSlash, heroArrowLeft, heroCheck, heroPlus,
  heroPencilSquare, heroArrowDownTray, heroNoSymbol, heroBolt
} from '@ng-icons/heroicons/outline';

// JSON directo
import estadosJson from '../../../../assets/data/estados.json';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserScope, UserStatus } from '../../../core/models/user.model';
import { EntityService } from '../../../core/services/entity.service';
import { Entity } from '../../../core/models/entity.model';
import { ROLE_MAP, ROLE_ID_MAP, ROLE_OPTIONS } from '../../../core/constants/roles';

type EstadoValue = string | 'FEDERAL';
type MunicipioValue = string | 'Todos';

@Component({
  selector: 'usuario-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HeaderBarComponent,
    SidebarNavComponent,
    NgIconComponent
  ],
  providers: [
    provideIcons({
      heroUser, heroLockClosed, heroShieldCheck, heroKey,
      heroEye, heroEyeSlash, heroArrowLeft, heroCheck, heroPlus,
      heroPencilSquare, heroArrowDownTray, heroNoSymbol, heroBolt
    })
  ],
  templateUrl: './usuario-detalle.html',
  styleUrl: './usuario-detalle.css',
})
export class UsuarioDetalle implements OnInit {

  form!: FormGroup;
  mode: 'create' | 'edit' = 'create';
  userId: number = 0;
  showPassword = false;
  showConfirm = false;

  estadoActual = signal<EstadoValue | null>(null);
  nivelActual = signal<string>('');
  private pendingEditEntityId?: number;

  // OCAVM opera exclusivamente en Estado de Mexico
  estados: EstadoValue[] = ['ESTADO DE MEXICO'];

  private normalize(value: string): string {
    return (value || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  municipios = computed<MunicipioValue[]>(() => {
    const estado = this.estadoActual();
    if (!estado) return [];

    if (estado === 'FEDERAL') return ['Todos'];

    const estadoNorm = this.normalize(estado);
    const estadoObj = Object.values(estadosJson).find(
      (e: any) => this.normalize((e as any).estado) === estadoNorm
    );

    if (!estadoObj) return [];

    return [
      'Todos',
      ...Object.values((estadoObj as any).municipios)
        .map((m: any) => m as string)
        .filter(m => m !== 'Todos')
    ];
  });

  trackByValue = (_: number, v: string) => v;

  entities = signal<Entity[]>([]);
  filteredEntities = computed(() => {
    const nivel = this.nivelActual();
    const all = this.entities();
    if (!nivel) return all;
    // Map nivel values to entity level values
    const levelMap: Record<string, string> = {
      'Federal': 'Federal',
      'Estatal': 'Estatal',
      'Municipal': 'Municipal',
    };
    const targetLevel = levelMap[nivel];
    if (!targetLevel) return all;
    return all.filter((e) => e.level === targetLevel);
  });
  roleOptions = ROLE_OPTIONS;

  constructor( private fb: FormBuilder,
               private router: Router,
               private userService: UserService,
               private entityService: EntityService,
               private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellido: [''],
      correo: ['', [Validators.required, Validators.email]],
      telefono: [''],
      password: ['', this.mode === 'create' ? Validators.required : []],
      confirmPassword: [''],
      is_2fa_enabled: [false],
      rol: ['', Validators.required],
      nivel: ['', Validators.required],
      estado: [{ value: '', disabled: true }],
      municipio: [{ value: '', disabled: true }],
      entity_id: [{ value: '', disabled: true }],
      can_view: [true],
      can_edit: [false],
      can_export: [false],
      can_block: [false],
      can_operate: [false]
    }, { validators: passwordMatchValidator });

    // Preselect permission defaults when role changes (per CONAGUA questionnaire)
    this.form.get('rol')?.valueChanges.subscribe((rolName: string) => {
      const roleId = this.getRoleId(rolName);
      // Only preselect on create mode, or if user confirms on edit
      if (this.mode === 'create' || confirm('¿Restablecer permisos a los valores por defecto del rol?')) {
        this.form.patchValue({
          can_view: true,
          can_edit: roleId <= 3,         // Admin, Supervisor, Operador
          can_export: roleId <= 3,       // Admin, Supervisor, Operador
          can_block: roleId === 1,       // Admin only
          can_operate: roleId <= 3,      // Admin, Supervisor, Operador
        });
      }
    });

    this.entityService.getAll().subscribe({
      next: (data) => {
        this.entities.set(data);
        // Resolve municipio for Municipal edit mode once entities are loaded
        this.resolveEditMunicipio(data);
      },
      error: (err) => console.error('Error loading entities:', err)
    });

    const estadoCtrl = this.form.get('estado');
    const municipioCtrl = this.form.get('municipio');
    const nivelCtrl = this.form.get('nivel');
    const entityCtrl = this.form.get('entity_id');

    // inicial
    this.estadoActual.set((estadoCtrl?.value || '') as EstadoValue);

    // Nivel change: cascade estado → municipio → dependencia
    nivelCtrl?.valueChanges.subscribe((nivel: string) => {
      this.nivelActual.set(nivel);
      entityCtrl?.setValue('', { emitEvent: false });
      entityCtrl?.enable({ emitEvent: false });

      if (nivel === 'Federal' || nivel === 'Estatal') {
        estadoCtrl?.setValue('ESTADO DE MEXICO', { emitEvent: false });
        estadoCtrl?.disable({ emitEvent: false });
        this.estadoActual.set('ESTADO DE MEXICO');
        municipioCtrl?.clearValidators();
        municipioCtrl?.setValue('Todos', { emitEvent: false });
        municipioCtrl?.disable({ emitEvent: false });
      } else if (nivel === 'Municipal') {
        estadoCtrl?.setValue('ESTADO DE MEXICO', { emitEvent: false });
        estadoCtrl?.disable({ emitEvent: false });
        this.estadoActual.set('ESTADO DE MEXICO');
        municipioCtrl?.setValidators(Validators.required);
        municipioCtrl?.setValue('', { emitEvent: false });
        municipioCtrl?.disable({ emitEvent: false });
        municipioCtrl?.updateValueAndValidity({ emitEvent: false });
      } else {
        estadoCtrl?.setValue('', { emitEvent: false });
        estadoCtrl?.disable({ emitEvent: false });
        this.estadoActual.set(null);
        municipioCtrl?.clearValidators();
        municipioCtrl?.setValue('', { emitEvent: false });
        municipioCtrl?.disable({ emitEvent: false });
        entityCtrl?.disable({ emitEvent: false });
      }
    });

    // Dependencia change: auto-set municipio for Municipal level
    entityCtrl?.valueChanges.subscribe((entityId: string) => {
      if (this.nivelActual() !== 'Municipal' || !entityId) return;
      const entity = this.entities().find(e => e.id === Number(entityId));
      if (entity?.municipio_id) {
        const municipioNombre = this.getMunicipioNameById(entity.municipio_id);
        if (municipioNombre) {
          municipioCtrl?.setValue(municipioNombre, { emitEvent: false });
        }
      }
    });

    // Modo edición
    const navigation = this.router.getCurrentNavigation();
    const usuario = (navigation?.extras.state?.['usuario'] || history.state?.['usuario']) as User;

    if (usuario) {
      this.mode = 'edit';
      this.userId = usuario.id;

      // Enable disabled controls before patching values
      estadoCtrl?.enable({ emitEvent: false });
      municipioCtrl?.enable({ emitEvent: false });
      entityCtrl?.enable({ emitEvent: false });

      const nivel = usuario.scope || '';
      this.nivelActual.set(nivel);
      this.estadoActual.set(usuario.estado_name || 'ESTADO DE MEXICO');

      this.form.patchValue({
        nombre: usuario.full_name,
        apellido: usuario.last_name,
        correo: usuario.email,
        telefono: usuario.phone || '',
        rol: this.getRoleNameById(usuario.role_id),
        is_2fa_enabled: usuario.is_2fa_enabled,
        nivel: nivel,
        estado: usuario.estado_name || 'ESTADO DE MEXICO',
        entity_id: usuario.entity_id || ''
      });

      // Municipal: municipio is derived from entity — keep disabled
      // Non-Municipal: set Todos and disable
      if (nivel === 'Municipal') {
        this.pendingEditEntityId = usuario.entity_id;
        municipioCtrl?.disable({ emitEvent: false });
        // Will be resolved when entities load via resolveEditMunicipio()
      } else {
        this.form.get('municipio')?.setValue('Todos', { emitEvent: false });
        municipioCtrl?.disable({ emitEvent: false });
      }

      // Estado always locked to Estado de Mexico
      estadoCtrl?.disable({ emitEvent: false });

      // Load permissions for this user
      this.userService.getPermissions(usuario.id).subscribe({
        next: (perms) => {
          this.form.patchValue({
            can_view: perms.can_view,
            can_edit: perms.can_edit,
            can_export: perms.can_export,
            can_block: perms.can_block,
            can_operate: perms.can_operate
          });
        },
        error: () => {}
      });

      // Password not required in edit mode
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.form.get('confirmPassword')?.clearValidators();
      this.form.get('confirmPassword')?.updateValueAndValidity();
    }
  }

  private getMunicipioNameById(id: number | string): string {
    const municipiosEdomex = (estadosJson as any)["15"].municipios;
    return municipiosEdomex[id.toString()] || '';
  }

  private resolveEditMunicipio(entities: Entity[]) {
    if (this.mode !== 'edit' || this.nivelActual() !== 'Municipal' || !this.pendingEditEntityId) return;
    const entity = entities.find(e => e.id === Number(this.pendingEditEntityId));
    if (entity?.municipio_id) {
      const nombreMuni = this.getMunicipioNameById(entity.municipio_id);
      this.form.get('municipio')?.setValue(nombreMuni, { emitEvent: false });
    }
    this.pendingEditEntityId = undefined;
  }

  private getRoleNameById(id: number): string {
    return ROLE_MAP[id] || 'Tecnico';
  }

  cancelar() {
    // Verificación de cambios sin guardar (Dirty Check)
    if (this.form.dirty) {
      const confirmLeave = window.confirm(
      'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir? Los datos se perderán.'
    );
    if (!confirmLeave) return;
  }

  // Registro de auditoría por transición de módulo
  // Registramos que el usuario regresó a la lista sin guardar
  this.userService.logNavigation('USUARIOS_LISTA_RETORNO_CANCELAR').subscribe({
    error: () => {} // best-effort audit log
  });

  // 3. Navegación final
  this.router.navigate(['/usuarios']);
}

  //Helpers para el mapeo estricto
 
  private getRoleId(rolName: string): number {
    return ROLE_ID_MAP[rolName] || 4;
  }

  private findMunicipioId(municipioNombre: string): number {
    if (!municipioNombre || municipioNombre === 'Todos') return 0;

    const estadoNombre = this.form.get('estado')?.value;
    const estadoId = this.findEstadoId(estadoNombre);

    if (estadoId === 0) return 0;

    const municipiosDeEstado = (estadosJson as any)[estadoId.toString()]?.municipios;
    if (!municipiosDeEstado) return 0;

    const entry = Object.entries(municipiosDeEstado).find(
      ([key, value]) => value === municipioNombre
    );

    return entry ? Number(entry[0]) : 0;
  }

  private findEstadoId(estadoNombre: string): number {
    if (!estadoNombre || estadoNombre === 'Todos') return 0;

    // Buscamos la llave (ID) cuyo valor de "estado" coincida con el nombre
    const entry = Object.entries(estadosJson).find(
      ([key, value]: [string, any]) => value.estado === estadoNombre
    );

    return entry ? Number(entry[0]) : 0;
  }

  guardar() {
    if (this.form.invalid) return;

      const formVal = this.form.getRawValue();

    const userData: Partial<User> = {
      full_name: formVal.nombre,
      last_name: formVal.apellido,
      email: formVal.correo,
      phone: formVal.telefono || '',
      role_id: Number(this.getRoleId(formVal.rol)),
      is_2fa_enabled: !!formVal.is_2fa_enabled,
      scope: formVal.nivel,
      estado_id: this.findEstadoId(formVal.estado),
      estado_name: formVal.estado,
      scope_id: this.findMunicipioId(formVal.municipio),
      municipio_name: formVal.nivel === 'Municipio' ? formVal.municipio : '',
      entity_id: formVal.entity_id ? Number(formVal.entity_id) : undefined,
      is_active: true
    };

    const operation$ = this.mode === 'edit'
      ? this.userService.update(this.userId, userData)
      : this.userService.create({ ...userData, password: formVal.password } as User);

    operation$.subscribe({
      next: (res) => {
        const targetUserId = this.mode === 'edit' ? this.userId : res?.id;
        // Save permissions if we have a valid user ID
        if (targetUserId) {
          this.userService.updatePermissions(targetUserId, {
            can_view: !!formVal.can_view,
            can_edit: !!formVal.can_edit,
            can_export: !!formVal.can_export,
            can_block: !!formVal.can_block,
            can_operate: !!formVal.can_operate
          }).subscribe({
            error: (err) => console.error('Error saving permissions:', err)
          });
        }
        this.userService.logNavigation('USUARIO_GESTION_EXITOSA').subscribe({
          error: () => {}
        });

        // Detect self-edit: if the admin changed their own role/scope, force re-login
        const currentUser = this.authService.currentUser();
        if (this.mode === 'edit' && currentUser && currentUser.id === this.userId) {
          const newRoleId = Number(this.getRoleId(formVal.rol));
          const newScopeId = this.findMunicipioId(formVal.municipio);
          const changed = currentUser.role_id !== newRoleId
            || currentUser.scope !== formVal.nivel
            || currentUser.scope_id !== newScopeId;

          if (changed) {
            alert('Tus permisos han cambiado. Se cerrara la sesion para aplicar los cambios.');
            this.authService.logout();
            return;
          }
        }

        this.router.navigate(['/usuarios']);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          alert('El correo electronico ya esta registrado en el sistema SCADA.');
        } else {
          alert('Error al procesar el usuario.');
        }
        console.error('Error creando el usuario:', err);
      }
    });
  }

}

export function passwordMatchValidator(g: FormGroup) {
   return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : {'mismatch': true};
}