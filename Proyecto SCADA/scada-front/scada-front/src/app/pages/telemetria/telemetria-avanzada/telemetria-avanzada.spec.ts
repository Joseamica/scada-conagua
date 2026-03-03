import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TelemetriaAvanzada } from './telemetria-avanzada';

describe('TelemetriaAvanzada', () => {
  let component: TelemetriaAvanzada;
  let fixture: ComponentFixture<TelemetriaAvanzada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetriaAvanzada]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TelemetriaAvanzada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
