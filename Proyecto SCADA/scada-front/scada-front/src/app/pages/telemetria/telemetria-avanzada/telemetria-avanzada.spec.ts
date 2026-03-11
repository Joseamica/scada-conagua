import '../../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { TelemetriaAvanzada } from './telemetria-avanzada';

describe('TelemetriaAvanzada', () => {
  let component: TelemetriaAvanzada;
  let fixture: ComponentFixture<TelemetriaAvanzada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetriaAvanzada],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null },
              queryParams: {},
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TelemetriaAvanzada);
    component = fixture.componentInstance;
    // Skip whenStable/detectChanges to avoid echarts.init on a jsdom canvas
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
