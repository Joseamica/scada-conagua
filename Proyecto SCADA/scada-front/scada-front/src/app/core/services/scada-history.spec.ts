import { TestBed } from '@angular/core/testing';

import { ScadaHistory } from './scada-history';

describe('ScadaHistory', () => {
  let service: ScadaHistory;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScadaHistory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
