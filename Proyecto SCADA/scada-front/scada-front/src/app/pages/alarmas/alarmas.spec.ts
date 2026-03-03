import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Alarmas } from './alarmas';

describe('Alarmas', () => {
  let component: Alarmas;
  let fixture: ComponentFixture<Alarmas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alarmas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Alarmas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
