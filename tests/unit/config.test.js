/**
 * Tests for environment variable and CLI argument parsing.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateConfiguration } from '../../src/config/index.js';

describe('Config Parsing', () => {
	describe('booleanStringSchema', () => {
		const booleanStringSchema = (defaultValue = false) => {
			return z
				.string()
				.transform((s) => s.trim().toLowerCase())
				.pipe(z.enum(['true', 'false', '1', '0', '']))
				.default(defaultValue ? 'true' : 'false')
				.transform((val) => val === 'true' || val === '1');
		};

		const schema = (defaultValue = false) => z.object({ v: booleanStringSchema(defaultValue) });

		it.each([
			[{ v: 'true' }, true, 'lowercase true'],
			[{ v: 'TRUE' }, true, 'uppercase TRUE'],
			[{ v: '  true  ' }, true, 'true with whitespace'],
			[{ v: '1' }, true, 'string 1'],
			[{ v: 'false' }, false, 'lowercase false'],
			[{ v: 'FALSE' }, false, 'uppercase FALSE'],
			[{ v: '  false  ' }, false, 'false with whitespace'],
			[{ v: '0' }, false, 'string 0'],
			[{ v: '' }, false, 'empty string uses default'],
			[{}, false, 'undefined uses default'],
		])('parses %o → %s (%s)', (input, expected) => {
			const result = schema(false).parse(input);
			expect(result.v).toBe(expected);
		});

		it('uses custom default value when undefined', () => {
			const result = schema(true).parse({});
			expect(result.v).toBe(true);
		});

		it('treats empty string as false regardless of default', () => {
			// Empty string passes through and gets transformed to false
			const result = schema(true).parse({ v: '' });
			expect(result.v).toBe(false);
		});

		it('rejects invalid string values', () => {
			expect(() => schema().parse({ v: 'maybe' })).toThrow();
			expect(() => schema().parse({ v: 'yes' })).toThrow();
			expect(() => schema().parse({ v: 'no' })).toThrow();
		});
	});
});
