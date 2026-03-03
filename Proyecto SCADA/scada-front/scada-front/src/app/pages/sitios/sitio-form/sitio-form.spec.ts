import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SitioForm } from './sitio-form';

describe('SitioForm', () => {
  let component: SitioForm;
  let fixture: ComponentFixture<SitioForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SitioForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SitioForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
