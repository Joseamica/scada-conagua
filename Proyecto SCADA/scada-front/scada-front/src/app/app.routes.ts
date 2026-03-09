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
import { SinopticosHome } from './pages/sinopticos/sinopticos-home/sinopticos-home';
import { ProjectDetail } from './pages/sinopticos/project-detail/project-detail';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { totpSetupGuard } from './core/guards/totp-setup.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  {
    path: 'auth/login/token',
    loadComponent: () =>
      import('./auth/login/token/token').then((m) => m.Token),
    canActivate: [guestGuard],
  },

  {
    path: 'auth/login/reset-pass',
    loadComponent: () =>
      import('./auth/login/login-reset-pass/login-reset-pass').then((m) => m.LoginResetPass),
  },

  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },

  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },

  {
    path: 'auth/setup-totp',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/setup-totp/setup-totp').then((m) => m.SetupTotp),
  },

  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./auth/verify-email/verify-email').then((m) => m.VerifyEmail),
  },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Dashboard General' },
    children: [
      { path: 'hidrometria', component: Hidrometria },
      { path: 'alarmas', component: Alarmas },
      { path: 'sitios', component: Sitios },
    ],
  },

  {
    path: 'telemetria',
    canActivate: [authGuard, totpSetupGuard],
    children: [
      {
        path: '',
        component: TelemetriaDashboard,
        data: { title: 'Telemetria' },
      },
      {
        path: 'avanzadas',
        component: TelemetriaAvanzada,
        data: { title: 'Graficas avanzadas' },
      },
    ],
  },

  {
    path: 'modulo-gis',
    component: ModuloGis,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Modulo SIG' },
  },

  {
    path: 'pozos/:id',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/pozos/pozo-detalle/pozo-detalle').then((m) => m.PozoDetalleComponent),
  },
  {
    path: 'gerencia/municipio/:id',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/gerencia-municipio/gerencia-municipio').then((m) => m.GerenciaMunicipio),
    data: { title: 'Gasto total por municipio' },
  },

  {
    path: 'gerencia/overview-gastos',
    canActivate: [authGuard, totpSetupGuard, roleGuard],
    component: Overview,
    data: { title: 'Resumen gasto general', expectedRole: 4 },
  },

  {
    path: 'usuarios',
    component: Usuarios,
    canActivate: [authGuard, totpSetupGuard, roleGuard],
    data: {
      expectedRole: 1,
      title: 'Gestion de Usuarios',
    },
  },
  {
    path: 'usuarios/nuevo',
    canActivate: [authGuard, totpSetupGuard, roleGuard],
    component: UsuarioDetalle,
    data: { title: 'Nuevo Usuario', expectedRole: 1 },
  },
  {
    path: 'usuarios/:id/editar',
    canActivate: [authGuard, totpSetupGuard, roleGuard],
    component: UsuarioDetalle,
    data: { title: 'Editar Usuario', expectedRole: 1 },
  },
  {
    path: 'perfil',
    component: PerfilUsuario,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Perfil de Usuario' },
  },
  {
    path: 'reporte',
    component: ReporteActividad,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Bitacora' },
  },

  {
    path: 'sitios/nuevo',
    component: SitioForm,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Nuevo Sitio' },
  },
  {
    path: 'sitios/editar/:id',
    component: SitioForm,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Editar Sitio' },
  },

  // ===== SINOPTICOS =====
  {
    path: 'sinopticos',
    component: SinopticosHome,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Sinopticos' },
  },
  {
    path: 'sinopticos/proyecto/:id',
    component: ProjectDetail,
    canActivate: [authGuard, totpSetupGuard],
    data: { title: 'Proyecto' },
  },
  {
    path: 'sinopticos/editor/:id',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/sinopticos/sinoptico-editor/sinoptico-editor').then((m) => m.SinopticoEditor),
    data: { title: 'Editor de Sinoptico' },
  },
  {
    path: 'sinopticos/viewer/:id',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/sinopticos/sinoptico-viewer/sinoptico-viewer').then((m) => m.SinopticoViewer),
    data: { title: 'Visor de Sinoptico' },
  },

  // ===== VARIABLES =====
  {
    path: 'variables',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/variables/variable-explorer/variable-explorer').then((m) => m.VariableExplorer),
    data: { title: 'Explorador de Variables' },
  },
  {
    path: 'variables/view/:id',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/variables/variable-view-editor/variable-view-editor').then(
        (m) => m.VariableViewEditor,
      ),
    data: { title: 'Editor de Vista' },
  },

  // ===== ALARMAS CONFIG =====
  {
    path: 'alarmas/configuracion',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/alarmas/alarm-config/alarm-config').then((m) => m.AlarmConfig),
    data: { title: 'Configuracion de Alarmas' },
  },
  {
    path: 'alarmas/historial',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/alarmas/alarm-history/alarm-history').then((m) => m.AlarmHistory),
    data: { title: 'Historial de Alarmas' },
  },
  {
    path: 'alarmas/destinatarios',
    canActivate: [authGuard, totpSetupGuard],
    loadComponent: () =>
      import('./pages/alarmas/recipients/recipients').then((m) => m.Recipients),
    data: { title: 'Destinatarios de Alarmas' },
  },

  { path: '**', redirectTo: 'login' },
];
