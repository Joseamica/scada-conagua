import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

// Polyfill window.matchMedia for test environments (jsdom/happy-dom)
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

const INIT_KEY = Symbol.for('__angular_testbed_init__');

if (!(globalThis as any)[INIT_KEY]) {
  (globalThis as any)[INIT_KEY] = true;
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
}
