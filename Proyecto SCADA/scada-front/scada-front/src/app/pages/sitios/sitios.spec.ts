import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Sitios } from './sitios';

describe('Sitios', () => {
  let component: Sitios;
  let fixture: ComponentFixture<Sitios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sitios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sitios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
