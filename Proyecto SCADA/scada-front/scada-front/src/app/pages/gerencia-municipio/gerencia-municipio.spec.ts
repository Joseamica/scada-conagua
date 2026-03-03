import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GerenciaMunicipio } from './gerencia-municipio';

describe('GerenciaMunicipio', () => {
  let component: GerenciaMunicipio;
  let fixture: ComponentFixture<GerenciaMunicipio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GerenciaMunicipio]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GerenciaMunicipio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
