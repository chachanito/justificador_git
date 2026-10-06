import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWidth, justifyText, normalizeTypography, textStats } from '../assets/js/justifier.js';

test('normaliza signos tipográficos sin alterar saltos de línea', () => {
    assert.equal(normalizeTypography('“Hola”\r\nmañana—sí'), '"Hola"\nmañana-sí');
});

test('justifica las líneas intermedias al ancho solicitado', () => {
    const result = justifyText('uno dos tres cuatro cinco seis siete ocho nueve diez', 30);
    const lines = result.split('\n');
    assert.equal([...lines[0]].length, 30);
    assert.ok([...lines.at(-1)].length <= 30);
});

test('conserva viñetas y aplica sangría a las continuaciones', () => {
    const result = justifyText('• Esta es una viñeta suficientemente larga para ocupar más de una línea', 30);
    const lines = result.split('\n');
    assert.ok(lines[0].startsWith('• '));
    assert.ok(lines[1].startsWith('  '));
});

test('divide palabras mayores que el ancho sin crear líneas vacías', () => {
    const result = justifyText('abcdefghijklmnop', 10);
    assert.equal(result, 'abcdefghij\nklmnop');
});

test('respeta líneas en blanco y límites de ancho', () => {
    const result = justifyText('primer párrafo\n\nsegundo párrafo', 75);
    assert.equal(result.split('\n')[1], '');
    assert.equal(clampWidth(10), 30);
    assert.equal(clampWidth(500), 140);
    assert.equal(textStats(result).lines, 3);
});
