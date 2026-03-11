import '../../../../test-init';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Token } from './token';

describe('Token', () => {
  let component: Token;
  let fixture: ComponentFixture<Token>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Token]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Token);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
