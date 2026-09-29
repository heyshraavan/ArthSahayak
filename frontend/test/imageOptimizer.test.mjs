import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTargetDimensions, optimizeImageForOcr } from '../src/lib/imageOptimizer.ts';

test('calculateTargetDimensions: preserves dimensions when image is within maxDimension', () => {
  const result = calculateTargetDimensions(1200, 900, 1600);
  assert.strictEqual(result.width, 1200);
  assert.strictEqual(result.height, 900);
  assert.strictEqual(result.scaled, false);
});

test('calculateTargetDimensions: scales down 4000x3000 landscape camera image to 1600x1200', () => {
  const result = calculateTargetDimensions(4000, 3000, 1600);
  assert.strictEqual(result.width, 1600);
  assert.strictEqual(result.height, 1200);
  assert.strictEqual(result.scaled, true);
  // Verify aspect ratio preservation: 4000/3000 == 1600/1200 == 1.3333...
  assert.strictEqual(result.width / result.height, 4000 / 3000);
});

test('calculateTargetDimensions: scales down 3000x4000 portrait receipt image to 1200x1600', () => {
  const result = calculateTargetDimensions(3000, 4000, 1600);
  assert.strictEqual(result.width, 1200);
  assert.strictEqual(result.height, 1600);
  assert.strictEqual(result.scaled, true);
  assert.strictEqual(result.width / result.height, 3000 / 4000);
});

test('calculateTargetDimensions: scales down square image proportionally', () => {
  const result = calculateTargetDimensions(3200, 3200, 1600);
  assert.strictEqual(result.width, 1600);
  assert.strictEqual(result.height, 1600);
  assert.strictEqual(result.scaled, true);
});

test('calculateTargetDimensions: handles non-positive dimensions gracefully', () => {
  assert.deepStrictEqual(calculateTargetDimensions(0, 0, 1600), { width: 0, height: 0, scaled: false });
  assert.deepStrictEqual(calculateTargetDimensions(-100, 200, 1600), { width: -100, height: 200, scaled: false });
});

test('optimizeImageForOcr: runs safely in Node/headless environment with graceful fallback', async () => {
  const fakeBlob = new Blob(['fake_binary_image_content'], { type: 'image/jpeg' });
  const result = await optimizeImageForOcr(fakeBlob);

  assert.ok(result.dataUrl.startsWith('data:image/jpeg;base64,'));
  assert.strictEqual(typeof result.base64, 'string');
  assert.ok(result.base64.length > 0);
  assert.strictEqual(result.mimeType, 'image/jpeg');
  assert.strictEqual(result.originalSizeBytes, fakeBlob.size);
});
