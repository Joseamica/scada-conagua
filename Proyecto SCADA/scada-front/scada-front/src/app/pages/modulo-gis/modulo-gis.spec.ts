import '../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { ModuloGis } from './modulo-gis';

describe('Geolocalizacion', () => {
  let component: ModuloGis;
  let fixture: ComponentFixture<ModuloGis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuloGis],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuloGis);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
