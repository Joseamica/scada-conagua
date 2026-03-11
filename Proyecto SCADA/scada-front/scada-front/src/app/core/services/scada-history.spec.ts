import '../../../test-init';
import { TestBed } from '@angular/core/testing';

import { ScadaHistoryService } from './scada-history';

describe('ScadaHistoryService', () => {
  let service: ScadaHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScadaHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
