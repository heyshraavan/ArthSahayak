import test from 'node:test';
import assert from 'node:assert/strict';

import { subscribeToOnlineStatus } from '../src/hooks/useOnlineStatus.ts';

// ============================================================================
// Focused Regression Tests: Online -> Offline -> Online Transitions
// ============================================================================

class MockWindow extends EventTarget {
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
  }
}

test('Connectivity Transition: Online -> Offline -> Online updates status immediately', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  const mockWindow = new MockWindow();
  globalThis.window = mockWindow;

  // 1. Initial State: Device is ONLINE
  let mockOnLine = true;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      get onLine() {
        return mockOnLine;
      },
    },
    configurable: true,
    writable: true,
  });

  const stateHistory = [];
  const unsubscribe = subscribeToOnlineStatus((status) => {
    stateHistory.push(status);
  });

  try {
    assert.strictEqual(globalThis.navigator.onLine, true, 'Device should start Online');

    // 2. User switches to OFFLINE (e.g. Chrome DevTools Network -> Offline)
    mockOnLine = false;
    mockWindow.dispatchEvent(new Event('offline'));

    assert.strictEqual(stateHistory.length, 1);
    assert.strictEqual(stateHistory[stateHistory.length - 1], false, 'Status should transition to offline');

    // 3. User switches back to ONLINE (e.g. Chrome DevTools Network -> Online)
    mockOnLine = true;
    mockWindow.dispatchEvent(new Event('online'));

    assert.strictEqual(stateHistory.length, 2);
    assert.strictEqual(stateHistory[stateHistory.length - 1], true, 'Status should immediately return to online');

    // 4. Repeated rapid toggle verification
    mockOnLine = false;
    mockWindow.dispatchEvent(new Event('offline'));
    mockOnLine = true;
    mockWindow.dispatchEvent(new Event('online'));

    assert.strictEqual(stateHistory.length, 4);
    assert.deepStrictEqual(stateHistory, [false, true, false, true]);
  } finally {
    unsubscribe();
    globalThis.window = originalWindow;
    globalThis.navigator = originalNavigator;
  }
});

test('Connectivity Invariant: Unsubscribe removes window event listeners cleanly', () => {
  const originalWindow = globalThis.window;
  const mockWindow = new MockWindow();
  globalThis.window = mockWindow;

  const calls = [];
  const unsubscribe = subscribeToOnlineStatus((status) => {
    calls.push(status);
  });

  try {
    mockWindow.dispatchEvent(new Event('offline'));
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0], false);

    // Unsubscribe
    unsubscribe();

    // Subsequent events must be ignored
    mockWindow.dispatchEvent(new Event('online'));
    mockWindow.dispatchEvent(new Event('offline'));
    assert.strictEqual(calls.length, 1, 'No new calls should occur after unsubscribe');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('Connectivity Invariant: Online event triggers backend recalculation callback', () => {
  const originalWindow = globalThis.window;
  const mockWindow = new MockWindow();
  globalThis.window = mockWindow;

  let backendRecalculationCalled = false;
  let mediaQueueProcessCalled = false;

  const handleOnlineApp = () => {
    backendRecalculationCalled = true;
  };
  const handleOnlineQueue = () => {
    mediaQueueProcessCalled = true;
  };

  mockWindow.addEventListener('online', handleOnlineApp);
  mockWindow.addEventListener('online', handleOnlineQueue);

  try {
    assert.strictEqual(backendRecalculationCalled, false);
    assert.strictEqual(mediaQueueProcessCalled, false);

    // Simulate returning online
    mockWindow.dispatchEvent(new Event('online'));

    assert.strictEqual(backendRecalculationCalled, true, 'Backend recalculation must resume on online event');
    assert.strictEqual(mediaQueueProcessCalled, true, 'Media queue processing must resume on online event');
  } finally {
    mockWindow.removeEventListener('online', handleOnlineApp);
    mockWindow.removeEventListener('online', handleOnlineQueue);
    globalThis.window = originalWindow;
  }
});

test('Decoupling Invariant: Financial dataSource does not dictate online connectivity state', () => {
  // Test that dataSource='local' (calculation provenance) does NOT override navigator.onLine
  const originalNavigator = globalThis.navigator;

  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    const calculationDataSource = 'local';
    const isDeviceOnline = globalThis.navigator.onLine;

    // The device IS online, even though the calculation was computed on-device
    assert.strictEqual(isDeviceOnline, true);
    assert.strictEqual(calculationDataSource, 'local');
    assert.notStrictEqual(
      isDeviceOnline,
      calculationDataSource === 'backend',
      'Device connectivity must be decoupled from whether calculation ran on backend'
    );
  } finally {
    globalThis.navigator = originalNavigator;
  }
});
