import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroUser, heroLockClosed, heroShieldCheck, heroKey,
  heroEye, heroEyeSlash, heroArrowLeft, heroCheck, heroPlus,
  heroPencilSquare, heroArrowDownTray, heroNoSymbol
} from '@ng-icons/heroicons/outline';

// JSON directo
import estadosJson from '../../../../assets/data/estados.json';
import { UserService } from '../../../core/services/user.service';
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
    FooterTabsComponent,
    NgIconComponent
  ],
  providers: [
    provideIcons({
      heroUser, heroLockClosed, heroShieldCheck, heroKey,
      heroEye, heroEyeSlash, heroArrowLeft, heroCheck, heroPlus,
      heroPencilSquare, heroArrowDownTray, heroNoSymbol
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

  estados: EstadoValue[] = [
    'FEDERAL',
    ...Object.values(estadosJson)
      .map((e: any) => e.estado as string)
      .filter(e => e !== 'Todos')
      .sort((a, b) => a.localeCompare(b))
  ];

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
  roleOptions = ROLE_OPTIONS;

  constructor( private fb: FormBuilder,
               private router: Router,
               private userService: UserService,
               private entityService: EntityService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellido: [''],
      usuario: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      telefono: [''],
      password: ['', this.mode === 'create' ? Validators.required : []],
      confirmPassword: [''],
      is_2fa_enabled: [false],
      rol: ['', Validators.required],
      nivel: ['', Validators.required],
      estado: [''],
      municipio: [''],
      entity_id: [''],
      can_view: [true],
      can_edit: [false],
      can_export: [false],
      can_block: [false]
    }, { validators: passwordMatchValidator });

    this.entityService.getAll().subscribe({
      next: (data) => this.entities.set(data),
      error: (err) => console.error('Error loading entities:', err)
    });

    const estadoCtrl = this.form.get('estado');
    const municipioCtrl = this.form.get('municipio');

    // inicial
    this.estadoActual.set((estadoCtrl?.value || '') as EstadoValue);

    estadoCtrl?.valueChanges.subscribe((estado: EstadoValue) => {
      const val = (estado || '') as EstadoValue;
      this.estadoActual.set(val || null);

      // reset inmediato
      municipioCtrl?.setValue('', { emitEvent: false });
      municipioCtrl?.disable({ emitEvent: false });

      // esperar a que el DOM pinte nuevas opciones
      queueMicrotask(() => {
        if (val === 'FEDERAL' || !val) {
          municipioCtrl?.setValue('Todos', { emitEvent: false });
          municipioCtrl?.disable({ emitEvent: false });
        } else {
          municipioCtrl?.enable({ emitEvent: false });
        }
      });
    });

    // Modo edición
    const navigation = this.router.getCurrentNavigation();
    const usuario = (navigation?.extras.state?.['usuario'] || history.state?.['usuario']) as User;

    if (usuario) {
      this.mode = 'edit';
      this.userId = usuario.id;

      this.form.patchValue({
        nombre: usuario.full_name,
        apellido: usuario.last_name,
        usuario: usuario.email,
        correo: usuario.email,
        telefono: usuario.phone || '',
        rol: this.getRoleNameById(usuario.role_id),
        is_2fa_enabled: usuario.is_2fa_enabled,
        nivel: usuario.scope === 'Federal' ? 'FEDERAL' : (usuario as any).estado,
        estado: usuario.estado_name,
        municipio: usuario.scope_id.toString(),
        entity_id: usuario.entity_id || ''
      });

      // Load permissions for this user
      this.userService.getPermissions(usuario.id).subscribe({
        next: (perms) => {
          this.form.patchValue({
            can_view: perms.can_view,
            can_edit: perms.can_edit,
            can_export: perms.can_export,
            can_block: perms.can_block
          });
        },
        error: () => {} // Permissions may not exist yet
      });

      // Lógica para combos de Estado/Municipio basada en scope_id
      if (usuario.scope === 'Municipio' && usuario.scope_id) {
      // Si es del Edomex (ID 15 en tu JSON), forzamos el estado
      this.form.get('estado')?.setValue('MEXICO', { emitEvent: true });
    
      queueMicrotask(() => {
        const nombreMuni = this.getMunicipioNameById(usuario.scope_id);
          this.form.get('municipio')?.setValue(nombreMuni, { emitEvent: false });
        });
      }
      // Si es edición, el password no es obligatorio
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

      const formVal = this.form.value;

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
            can_block: !!formVal.can_block
          }).subscribe({
            error: (err) => console.error('Error saving permissions:', err)
          });
        }
        this.userService.logNavigation('USUARIO_GESTION_EXITOSA').subscribe({
          error: () => {} // best-effort audit log
        });
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