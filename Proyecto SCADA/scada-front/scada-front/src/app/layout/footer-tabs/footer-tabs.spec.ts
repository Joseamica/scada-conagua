import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterTabs } from './footer-tabs';

describe('FooterTabs', () => {
  let component: FooterTabs;
  let fixture: ComponentFixture<FooterTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterTabs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FooterTabs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
