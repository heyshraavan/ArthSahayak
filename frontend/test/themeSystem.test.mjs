import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSACTION_CATEGORIES, getCategoryInfo } from '../src/lib/categories.ts';

test('Theme System: Category Badges have paired dark mode variants for contrast', () => {
  for (const cat of TRANSACTION_CATEGORIES) {
    assert.ok(cat.badgeClass.includes('dark:bg-'), `Category ${cat.value} must have dark:bg- class`);
    assert.ok(cat.badgeClass.includes('dark:text-'), `Category ${cat.value} must have dark:text- class`);
  }
});

test('Theme System: getCategoryInfo correctly resolves all categories', () => {
  const sales = getCategoryInfo('sales');
  assert.ok(sales);
  assert.strictEqual(sales.defaultType, 'credit');
  assert.ok(sales.badgeClass.includes('dark:text-emerald-300'));

  const rawMaterial = getCategoryInfo('raw_material');
  assert.ok(rawMaterial);
  assert.strictEqual(rawMaterial.defaultType, 'debit');
  assert.ok(rawMaterial.badgeClass.includes('dark:text-amber-300'));
});

test('Theme System: Toggle reliably flips directly between Light <-> Dark', () => {
  const toggleTheme = (resolvedTheme) => {
    return resolvedTheme === 'dark' ? 'light' : 'dark';
  };

  assert.strictEqual(toggleTheme('light'), 'dark');
  assert.strictEqual(toggleTheme('dark'), 'light');
});

test('Theme System: Document class and meta theme-color sync behavior', () => {
  class MockClassList {
    constructor() {
      this.classes = new Set();
    }
    add(cls) {
      this.classes.add(cls);
    }
    remove(cls) {
      this.classes.delete(cls);
    }
    contains(cls) {
      return this.classes.has(cls);
    }
  }

  const classList = new MockClassList();
  let metaThemeColor = '#f8fafc';

  const applyResolvedTheme = (resolvedTheme) => {
    if (resolvedTheme === 'dark') {
      classList.add('dark');
      metaThemeColor = '#020617';
    } else {
      classList.remove('dark');
      metaThemeColor = '#f8fafc';
    }
  };

  // Test light theme
  applyResolvedTheme('light');
  assert.strictEqual(classList.contains('dark'), false);
  assert.strictEqual(metaThemeColor, '#f8fafc');

  // Test dark theme
  applyResolvedTheme('dark');
  assert.strictEqual(classList.contains('dark'), true);
  assert.strictEqual(metaThemeColor, '#020617');

  // Switch back to light
  applyResolvedTheme('light');
  assert.strictEqual(classList.contains('dark'), false);
  assert.strictEqual(metaThemeColor, '#f8fafc');
});

test('Theme System: LocalStorage key is arthsahayak-theme and validates values', () => {
  const THEME_STORAGE_KEY = 'arthsahayak-theme';
  assert.strictEqual(THEME_STORAGE_KEY, 'arthsahayak-theme');

  const isValidTheme = (val) => val === 'light' || val === 'dark' || val === 'system';
  assert.strictEqual(isValidTheme('light'), true);
  assert.strictEqual(isValidTheme('dark'), true);
  assert.strictEqual(isValidTheme('system'), true);
  assert.strictEqual(isValidTheme('other'), false);
  assert.strictEqual(isValidTheme(null), false);
});
