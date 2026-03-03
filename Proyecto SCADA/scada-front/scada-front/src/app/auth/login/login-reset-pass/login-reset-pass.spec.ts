import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginResetPass } from './login-reset-pass';

describe('LoginResetPass', () => {
  let component: LoginResetPass;
  let fixture: ComponentFixture<LoginResetPass>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginResetPass]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginResetPass);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
