import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { DashboardComponent } from './dashboard/dashboard';
import { ModuloGis } from './pages/modulo-gis/modulo-gis';
import { Hidrometria } from './pages/hidrometria/hidrometria';
import { Alarmas } from './pages/alarmas/alarmas';
import { ReporteActividad } from './pages/usuarios/reporte-actividad/reporte-actividad';
import { Usuarios } from './pages/usuarios/usuarios';
import { PerfilUsuario } from './pages/usuarios/perfil-usuario/perfil-usuario';
import { UsuarioDetalle } from './pages/usuarios/usuario-detalle/usuario-detalle';
import { Sitios } from './pages/sitios/sitios';
import { SitioForm } from './pages/sitios/sitio-form/sitio-form';
import { TelemetriaDashboard } from './pages/telemetria/telemetria-dashboard/telemetria-dashboard';
import { TelemetriaAvanzada } from './pages/telemetria/telemetria-avanzada/telemetria-avanzada';
import { Overview } from './pages/gerencia/overview/overview';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'auth/login/token', loadComponent: () => import('./auth/login/token/token').then(m => m.Token) },
  
  {
  path: 'auth/login/token',
  loadComponent: () =>
    import('./auth/login/token/token')
      .then(m => m.Token)
  },

  {
  path: 'auth/login/reset-pass',
  loadComponent: () =>
    import('./auth/login/login-reset-pass/login-reset-pass')
      .then(m => m.LoginResetPass)
  },

  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password')
        .then(m => m.ForgotPassword)
  },

  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password')
        .then(m => m.ResetPassword)
  },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard], // 🛡️ Protección activa
    data: { title: 'Dashboard General' },
    children: [
      { path: 'hidrometria', component: Hidrometria },
      { path: 'alarmas', component: Alarmas },
      { path: 'sitios', component: Sitios },
    ]
  },

  {
    path: 'telemetria',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: TelemetriaDashboard,
        data: { title: 'Telemetría' }
      },
      {
        path: 'avanzadas',
        component: TelemetriaAvanzada,
        data: { title: 'Gráficas avanzadas' }
      }
    ]
  },


  // 👉 RUTA SIMPLE PARA EL GIS
  { 
    path: 'modulo-gis', 
    component: ModuloGis,
    canActivate: [authGuard], // 🛡️ Protección activa 
    data: { title: 'Módulo SIG' } 
  },

  {
    path: 'pozos/:id',
    canActivate: [authGuard],
    loadComponent: () =>
    import('./pages/pozos/pozo-detalle/pozo-detalle')
      .then(m => m.PozoDetalleComponent),
  },
  {
    path:'gerencia/municipio/:id',
    canActivate: [authGuard],
    loadComponent:()=>import('./pages/gerencia-municipio/gerencia-municipio')
     .then(m=>m.GerenciaMunicipio),
     data: { title: 'Gasto total por municipio' }
  },

  {
    path: 'gerencia/overview-gastos',
    canActivate: [authGuard, roleGuard],
    component: Overview,
    data: { title: 'Resumen gasto general', expectedRole: 4 } // Todos los roles
  },
  // 👉 RUTA USUARIOS
  {
    path: 'usuarios',
    component: Usuarios,
    canActivate: [authGuard, roleGuard], // 🛡️ Protección activa
    data: {
      expectedRole: 1, // Solo Administradores 
      title: 'Gestión de Usuarios' 
    }
  },
  {
    path: 'usuarios/nuevo',
    canActivate: [authGuard, roleGuard],
    component: UsuarioDetalle,
    data: { title: 'Nuevo Usuario', expectedRole: 1 }
  },
  {
    path: 'usuarios/:id/editar',
    canActivate: [authGuard, roleGuard],
    component: UsuarioDetalle,
    data: { title: 'Editar Usuario', expectedRole: 1 }
  },
  {
    path: 'perfil',
    component: PerfilUsuario,
      data: { title: 'Perfil de Usuario' }
  },
  {
    path: 'reporte',
    component: ReporteActividad,
     data: { title: 'Bitácora' }
  },

  {
    path: 'sitios/nuevo',
    component: SitioForm,
    data: { title: 'Nuevo Sitio' }
  },
  {
    path: 'sitios/editar/:id',
    component: SitioForm,
    data: { title: 'Editar Sitio' }
  },
  
  { path: '**', redirectTo: 'login' }
  
];
