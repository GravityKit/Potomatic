import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { config } from '../../src/config/index.js';

describe('API Integration Tests', () => {
	let provider;
	let testConfig;
	let mockLogger;

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		};

		testConfig = {
			...config,
			dryRun: true,
			model: 'gpt-3.5-turbo',
			apiKey: 'test-key',
		};
		provider = new OpenAIProvider(testConfig, mockLogger);
		await provider.initialize();
	});

	it('should handle dry run translation', async () => {
		const batch = [{ index: 0, msgid: 'Hello', msgstr: '', context: '' }];

		const result = await provider.translateBatch(batch, 'es', 'gpt-3.5-turbo', 'Translate to Spanish', 3, 1000, 30000, true);

		expect(result.success).toBe(true);
		expect(result.translations).toHaveLength(1);
		expect(result.translations[0]).toEqual({
			msgid: 'Hello',
			msgstr: ['[DRY RUN] Hello'],
		});
		expect(result.cost.totalCost).toBeGreaterThan(0);
		expect(result.cost.model).toBe('gpt-3.5-turbo');
	});

	it('should handle batch with multiple entries in dry run', async () => {
		const batch = [
			{ index: 0, msgid: 'Hello', msgstr: '', context: '' },
			{ index: 1, msgid: 'Goodbye', msgstr: '', context: '' },
			{ index: 2, msgid: 'Thank you', msgstr: '', context: '' },
		];

		const result = await provider.translateBatch(batch, 'fr', 'gpt-3.5-turbo', 'Translate to French', 3, 1000, 30000, true);

		expect(result.success).toBe(true);
		expect(result.translations).toHaveLength(3);
		expect(result.translations[0].msgstr).toEqual(['[DRY RUN] Hello']);
		expect(result.translations[1].msgstr).toEqual(['[DRY RUN] Goodbye']);
		expect(result.translations[2].msgstr).toEqual(['[DRY RUN] Thank you']);
		expect(result.cost.totalCost).toBeGreaterThan(0);
		expect(result.cost.model).toBe('gpt-3.5-turbo');
	});

	it('should calculate costs correctly', async () => {
		const usage = {
			prompt_tokens: 100,
			completion_tokens: 50,
			total_tokens: 150,
		};

		const cost = provider.calculateCost(usage, 'gpt-3.5-turbo');

		// gpt-3.5-turbo pricing: prompt $0.0005/1K, completion $0.0015/1K
		const expectedPromptCost = (100 / 1000) * 0.0005; // 0.00005
		const expectedCompletionCost = (50 / 1000) * 0.0015; // 0.000075
		const expectedTotalCost = expectedPromptCost + expectedCompletionCost; // 0.000125

		expect(cost.promptTokens).toBe(100);
		expect(cost.completionTokens).toBe(50);
		expect(cost.totalTokens).toBe(150);
		expect(cost.promptCost).toBeCloseTo(expectedPromptCost, 8);
		expect(cost.completionCost).toBeCloseTo(expectedCompletionCost, 8);
		expect(cost.totalCost).toBeCloseTo(expectedTotalCost, 8);
		expect(cost.model).toBe('gpt-3.5-turbo');
	});

	it('should get token count for text', () => {
		const text = 'Hello world, this is a test message.';
		const tokenCount = provider.getTokenCount(text, 'gpt-3.5-turbo');

		// This specific text tokenizes to exactly 9 tokens in gpt-3.5-turbo
		expect(tokenCount).toBe(9);
		expect(typeof tokenCount).toBe('number');
	});

	it('should validate config correctly', () => {
		const validConfig = {
			apiKey: 'test-key',
			model: 'gpt-3.5-turbo',
			temperature: 0.7,
			dryRun: false,
		};

		const result = provider.validateConfig(validConfig);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should detect invalid config', () => {
		const invalidConfig = {
			model: 'invalid-model',
			temperature: 3.0,
			dryRun: false,
		};

		const result = provider.validateConfig(invalidConfig);
		expect(result.isValid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
