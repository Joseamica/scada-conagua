import '../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { GerenciaMunicipio } from './gerencia-municipio';

describe('GerenciaMunicipio', () => {
  let component: GerenciaMunicipio;
  let fixture: ComponentFixture<GerenciaMunicipio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GerenciaMunicipio],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => '33' },
              queryParams: {},
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GerenciaMunicipio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
