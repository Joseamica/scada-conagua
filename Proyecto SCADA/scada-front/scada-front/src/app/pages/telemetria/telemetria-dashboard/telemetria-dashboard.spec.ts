import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TelemetriaDashboard } from './telemetria-dashboard';

describe('TelemetriaDashboard', () => {
  let component: TelemetriaDashboard;
  let fixture: ComponentFixture<TelemetriaDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetriaDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TelemetriaDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
