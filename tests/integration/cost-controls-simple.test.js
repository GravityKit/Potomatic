import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateCost, createCostAccumulator } from '../../src/utils/costTracker.js';
import { prepareBatches } from '../../src/processors/batchProcessor.js';
import { LanguageProcessor } from '../../src/processors/languageProcessor.js';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { createLogger } from '../../src/logging/index.js';
import { MockOpenAIClient, createMultipleSuccessResponses } from '../helpers/mock-openai-client.js';
import { createTempDir, copyTestFile, cleanupTempDir, readFile } from '../helpers/temp-files.js';
import { po } from 'gettext-parser';

describe('Cost Controls Integration (Simplified)', () => {
	let tempDir;
	let config;
	let provider;
	let logger;
	let mockClient;

	beforeEach(async () => {
		tempDir = await createTempDir();

		config = {
			apiKey: 'test-api-key',
			model: 'gpt-3.5-turbo',
			temperature: 0.1,
			timeout: 60,
			batchSize: 5,
			maxRetries: 1,
			retryDelayMs: 50,
			quitOnMaxRetriesFailure: false,
			outputDir: tempDir,
			poFilePrefix: '',
			sourceLanguage: 'en',
			dryRun: false,
			saveDebugInfo: false,
		};

		provider = new OpenAIProvider(config, createLogger(0));
		await provider.initialize();

		// Replace the real OpenAI client with our mock
		mockClient = new MockOpenAIClient();
		provider.client = mockClient;

		logger = createLogger(0);
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
		mockClient?.reset();
	});

	describe('Cost Calculation', () => {
		it('should calculate costs correctly for different models', () => {
			const usage = { prompt_tokens: 1000, completion_tokens: 500 };

			const gpt35Cost = calculateCost(usage, 'openai', 'gpt-3.5-turbo');
			expect(gpt35Cost.totalCost).toBeCloseTo(0.00125, 5);

			const gpt4Cost = calculateCost(usage, 'openai', 'gpt-4-0613');
			// Using pricing file for gpt-4-0613: prompt: 0.03, completion: 0.06
			// 1000/1000 * 0.03 + 500/1000 * 0.06 = 0.03 + 0.03 = 0.06
			expect(gpt4Cost.totalCost).toBeCloseTo(0.06, 5);
		});

		it('should handle invalid usage data gracefully', () => {
			const invalidUsage = null;
			const cost = calculateCost(invalidUsage, 'openai', 'gpt-3.5-turbo');

			expect(cost.promptCost).toBe(0);
			expect(cost.completionCost).toBe(0);
			expect(cost.totalCost).toBe(0);
			expect(cost.error).toBe('Invalid usage data');
		});
	});

	describe('Cost Accumulator', () => {
		it('should accumulate costs across multiple requests', () => {
			const accumulator = createCostAccumulator();

			const usage1 = { prompt_tokens: 100, completion_tokens: 50 };
			const usage2 = { prompt_tokens: 200, completion_tokens: 100 };

			const cost1 = calculateCost(usage1, 'openai', 'gpt-3.5-turbo');
			const cost2 = calculateCost(usage2, 'openai', 'gpt-3.5-turbo');

			accumulator.addCost(cost1);
			accumulator.addCost(cost2);

			const totals = accumulator.getTotals();
			expect(totals.totalCost).toBe(cost1.totalCost + cost2.totalCost);
			expect(totals.totalTokens).toBe(450);
			expect(totals.requestCount).toBe(2);
		});
	});

	describe('String Limits', () => {
		it('should respect maxStrings limit in batch preparation', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const maxStrings = 3;
			const batches = prepareBatches(parsedPot, 10, logger, maxStrings);

			// Count total strings in all batches
			const totalStrings = batches.reduce((sum, batch) => sum + batch.length, 0);
			expect(totalStrings).toBe(maxStrings);
		});

		it('should integrate maxStrings with LanguageProcessor', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue mock response for exactly 3 strings
			const mockResponses = createMultipleSuccessResponses([['Translation 1', 'Translation 2', 'Translation 3']]);
			mockClient.queueMultipleResponses(mockResponses);

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr_FR');

			// Verify the mock was called
			expect(mockClient.isDone()).toBe(true);
			expect(mockClient.getCallCount()).toBeGreaterThan(0);

			// When API succeeds, we should have translated the maxStrings count
			expect(stats.translatedInRun).toBe(3);
		});
	});

	describe('Basic Translation with Cost Tracking', () => {
		it('should track costs during translation process', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;

			// Queue mock responses for the translation
			const mockResponses = createMultipleSuccessResponses([
				['Bonjour', 'Bienvenue', 'Enregistrer'],
				['Annuler', 'Supprimer'],
			]);
			mockClient.queueMultipleResponses(mockResponses);

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr_FR');

			// Verify cost tracking exists
			expect(stats.costData).toBeDefined();
			expect(stats.costData.totalCost).toBeGreaterThanOrEqual(0);
			expect(stats.costData.totalTokens).toBeGreaterThanOrEqual(0);
			expect(stats.costData.requestCount).toBeGreaterThanOrEqual(1);
		});
	});
});
