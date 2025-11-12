/**
 * Tests for environment variable and CLI argument parsing.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateConfiguration, createConfiguration } from '../../src/config/index.js';

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

	describe('validateConfiguration', () => {
		it('passes validation with all required options', () => {
			const result = validateConfiguration({
				apiKey: 'test-key',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('passes validation when dryRun is true without API key', () => {
			const result = validateConfiguration({
				dryRun: true,
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('fails validation when API key is missing without dryRun', () => {
			const result = validateConfiguration({
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('API key required'))).toBe(true);
		});

		it('fails validation when target languages are missing', () => {
			const result = validateConfiguration({
				apiKey: 'test-key',
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('Target language required'))).toBe(true);
		});

		it('fails validation when target languages array is empty', () => {
			const result = validateConfiguration({
				apiKey: 'test-key',
				targetLanguages: [],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('Target language required'))).toBe(true);
		});

		it('fails validation when POT file path is missing', () => {
			const result = validateConfiguration({
				apiKey: 'test-key',
				targetLanguages: ['fr_FR'],
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('POT file required'))).toBe(true);
		});

		it('fails validation when model name is empty string', () => {
			const result = validateConfiguration({
				apiKey: 'test-key',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
				model: '   ',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('Model name cannot be empty'))).toBe(true);
		});

		it('collects multiple validation errors', () => {
			const result = validateConfiguration({});

			expect(result.isValid).toBe(false);
			expect(result.errors).toHaveLength(3);
			expect(result.errors.some((e) => e.includes('API key required'))).toBe(true);
			expect(result.errors.some((e) => e.includes('Target language required'))).toBe(true);
			expect(result.errors.some((e) => e.includes('POT file required'))).toBe(true);
		});

		it('generates provider-aware error message for OpenAI', () => {
			const result = validateConfiguration({
				provider: 'openai',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('OpenAI API key required'))).toBe(true);
			expect(result.errors.some((e) => e.includes('OPENAI_API_KEY'))).toBe(true);
		});

		it('generates provider-aware error message for Gemini', () => {
			const result = validateConfiguration({
				provider: 'gemini',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('Gemini API key required'))).toBe(true);
			expect(result.errors.some((e) => e.includes('GEMINI_API_KEY'))).toBe(true);
		});
	});

	describe('Provider Auto-Detection', () => {
		// Helper function that mimics detectProviderFromEnv logic.
		const detectProvider = (env) => {
			const knownProviders = ['gemini', 'anthropic', 'cohere', 'openai'];

			// Check POTOMATIC_<PROVIDER>_API_KEY first.
			for (const provider of knownProviders) {
				const providerUpper = provider.toUpperCase();

				if (env[`POTOMATIC_${providerUpper}_API_KEY`]) {
					return provider;
				}
			}

			// Check <PROVIDER>_API_KEY.
			for (const provider of knownProviders) {
				const providerUpper = provider.toUpperCase();

				if (env[`${providerUpper}_API_KEY`]) {
					return provider;
				}
			}

			return null;
		};

		it('auto-detects provider from POTOMATIC_GEMINI_API_KEY', () => {
			const detected = detectProvider({ POTOMATIC_GEMINI_API_KEY: 'test-key' });
			expect(detected).toBe('gemini');
		});

		it('auto-detects provider from GEMINI_API_KEY', () => {
			const detected = detectProvider({ GEMINI_API_KEY: 'test-key' });
			expect(detected).toBe('gemini');
		});

		it('prefers POTOMATIC_ prefix over standard key', () => {
			const detected = detectProvider({
				POTOMATIC_GEMINI_API_KEY: 'test-key-1',
				OPENAI_API_KEY: 'test-key-2',
			});
			expect(detected).toBe('gemini');
		});

		it('returns null when no provider keys present', () => {
			const detected = detectProvider({});
			expect(detected).toBeNull();
		});

		it('detects anthropic provider', () => {
			const detected = detectProvider({ ANTHROPIC_API_KEY: 'test-key' });
			expect(detected).toBe('anthropic');
		});

		it('prefers non-openai providers when multiple standard keys exist', () => {
			const detected = detectProvider({
				GEMINI_API_KEY: 'test-key-1',
				OPENAI_API_KEY: 'test-key-2',
			});
			expect(detected).toBe('gemini');
		});
	});

	describe('Custom Configuration File Paths', () => {
		it('passes through custom prompt file path', () => {
			const config = createConfiguration({
				promptFilePath: './custom/prompt.md',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(config.promptFilePath).toBe('./custom/prompt.md');
		});

		it('passes through custom PO header template path', () => {
			const config = createConfiguration({
				poHeaderTemplatePath: './custom/header.json',
				targetLanguages: ['fr_FR'],
				potFilePath: './test.pot',
			});

			expect(config.poHeaderTemplatePath).toBe('./custom/header.json');
		});
	});
});
