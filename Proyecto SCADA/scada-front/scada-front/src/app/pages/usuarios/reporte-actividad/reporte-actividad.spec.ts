import '../../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { ReporteActividad } from './reporte-actividad';

describe('ReporteActividad', () => {
  let component: ReporteActividad;
  let fixture: ComponentFixture<ReporteActividad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteActividad],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReporteActividad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
