import '../../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { TelemetriaDashboard } from './telemetria-dashboard';

describe('TelemetriaDashboard', () => {
  let component: TelemetriaDashboard;
  let fixture: ComponentFixture<TelemetriaDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetriaDashboard],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(TelemetriaDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
