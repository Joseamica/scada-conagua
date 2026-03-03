import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Hidrometria } from './hidrometria';

describe('Hidrometria', () => {
  let component: Hidrometria;
  let fixture: ComponentFixture<Hidrometria>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hidrometria]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Hidrometria);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
