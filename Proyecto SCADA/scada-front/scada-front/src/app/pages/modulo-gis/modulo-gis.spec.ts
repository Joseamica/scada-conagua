import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuloGis } from './modulo-gis';

describe('Geolocalizacion', () => {
  let component: ModuloGis;
  let fixture: ComponentFixture<ModuloGis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloGis]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModuloGis);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
