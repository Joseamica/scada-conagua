import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporteActividad } from './reporte-actividad';

describe('ReporteActividad', () => {
  let component: ReporteActividad;
  let fixture: ComponentFixture<ReporteActividad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteActividad]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReporteActividad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
