import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LanguageProcessor } from '../../src/processors/languageProcessor.js';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { createLogger } from '../../src/logging/index.js';
import { MockOpenAIClient, createSuccessResponse } from '../helpers/mock-openai-client.js';
import { createTempDir, copyTestFile, cleanupTempDir } from '../helpers/temp-files.js';

describe('Retry Logic Integration Tests', () => {
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
			batchSize: 3,
			maxRetries: 3,
			retryDelayMs: 50, // Fast for testing
			stopOnMaxRetriesFailure: false,
			skipJobOnMaxRetriesFailure: false,
			outputDir: tempDir,
			poFilePrefix: '',
			sourceLanguage: 'en',
			dryRun: false,
			saveDebugInfo: false,
		};

		provider = new OpenAIProvider(config, createLogger(0));
		await provider.initialize();

		mockClient = new MockOpenAIClient();
		provider.client = mockClient;

		logger = createLogger(0);
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
		mockClient?.reset();
	});

	describe('Basic Retry Behavior', () => {
		it('should retry failed requests up to maxRetries limit', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue 2 failures followed by success
			mockClient.queueRetryScenario(2, ['Success 1', 'Success 2', 'Success 3'], 500);

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			// Should succeed after retries
			expect(stats.translatedInRun).toBe(3);
			expect(stats.failedInRun).toBe(0);
			expect(mockClient.getCallCount()).toBe(3); // 2 failures + 1 success
		});

		it('should fail after exhausting all retries', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue complete failure (maxRetries + 1 = 4 total failures)
			mockClient.queueCompleteFailure(config.maxRetries, 503);

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			// Should fail completely
			expect(stats.translatedInRun).toBe(0);
			expect(stats.failedInRun).toBe(3);
			expect(mockClient.getCallCount()).toBe(4); // 1 initial + 3 retries
		});

		it('should handle different HTTP error codes', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 1; // Single string to test each error code

			// Test different error codes
			const errorCodes = [429, 500, 502, 503, 504];

			for (const errorCode of errorCodes) {
				mockClient.reset();
				mockClient.queueRetryScenario(1, ['Success'], errorCode);

				const processor = new LanguageProcessor(config, provider, logger);
				const stats = await processor.processLanguage('fr');

				expect(stats.translatedInRun).toBe(1);
				expect(mockClient.getCallCount()).toBe(2); // 1 failure + 1 success
			}
		});
	});

	describe('Retry Delay Configuration', () => {
		it('should respect custom retry delay', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;
			config.retryDelayMs = 100; // Longer delay

			const startTime = Date.now();

			// Queue 1 failure followed by success
			mockClient.queueRetryScenario(1, ['Success 1', 'Success 2', 'Success 3'], 500);

			const processor = new LanguageProcessor(config, provider, logger);
			await processor.processLanguage('fr');

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Should take at least the retry delay time
			expect(duration).toBeGreaterThanOrEqual(100);
		});
	});

	describe('Failure Behavior Flags', () => {
		it('should stop processing batches when stopOnMaxRetriesFailure is true', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 5; // All 5 strings from simple.pot (will create 2 batches: 3+2)
			config.stopOnMaxRetriesFailure = true;

			// First batch fails completely, second batch would succeed
			mockClient.queueCompleteFailure(config.maxRetries, 500);
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2']));

			const processor = new LanguageProcessor(config, provider, logger);

			// Should throw error and stop processing
			await expect(processor.processLanguage('fr')).rejects.toThrow();

			// Should only call the first batch (4 times: 1 initial + 3 retries)
			expect(mockClient.getCallCount()).toBe(4);
		});

		it('should skip remaining batches when skipJobOnMaxRetriesFailure is true', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 5; // All 5 strings from simple.pot (will create 2 batches: 3+2)
			config.skipJobOnMaxRetriesFailure = true;

			// First batch fails completely, second batch would succeed
			mockClient.queueCompleteFailure(config.maxRetries, 500);
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			// Should process first batch (fail) but skip second batch
			expect(stats.translatedInRun).toBe(0);
			expect(stats.failedInRun).toBe(5); // First batch failed (3) + remaining batch skipped (2) = 5
			expect(mockClient.getCallCount()).toBe(4); // Only first batch attempts
		});

		it('should continue processing all batches by default', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 5; // All 5 strings from simple.pot (will create 2 batches: 3+2)

			// First batch fails, second batch succeeds
			mockClient.queueCompleteFailure(config.maxRetries, 500);
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			// Should process both batches
			expect(stats.translatedInRun).toBe(2); // Second batch succeeded (2 strings)
			expect(stats.failedInRun).toBe(3); // First batch failed (3 strings)
			expect(mockClient.getCallCount()).toBe(5); // 4 for first batch + 1 for second
		});
	});

	describe('Mixed Success/Failure Scenarios', () => {
		it('should handle partial batch failures correctly', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 5; // All 5 strings from simple.pot (will create 2 batches: 3+2)

			// Batch 1: Success immediately (3 strings)
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3']));

			// Batch 2: Success immediately (2 strings)
			mockClient.queueResponse(createSuccessResponse(['Success 4', 'Success 5']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			expect(stats.translatedInRun).toBe(5); // All strings succeeded
			expect(stats.failedInRun).toBe(0); // No failures
			expect(mockClient.getCallCount()).toBe(2); // 2 successful batches
		});
	});

	describe('Network Error Handling', () => {
		it('should handle timeout errors', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue timeout followed by success
			mockClient.queueTimeout();
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			expect(stats.translatedInRun).toBe(3);
			expect(mockClient.getCallCount()).toBe(2);
		});

		it('should handle malformed responses with retries', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue parsing error followed by success
			mockClient.queueError({ status: 422, message: 'Invalid response format' });
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			expect(stats.translatedInRun).toBe(3);
			expect(mockClient.getCallCount()).toBe(2);
		});
	});

	describe('Cost Tracking During Retries', () => {
		it('should track costs correctly across retries', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			config.potFilePath = potFile;
			config.maxStrings = 3;

			// Queue 2 failures (no cost) followed by success (with cost)
			mockClient.queueError({ status: 500, message: 'Server error' });
			mockClient.queueError({ status: 503, message: 'Service unavailable' });
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3']));

			const processor = new LanguageProcessor(config, provider, logger);
			const stats = await processor.processLanguage('fr');

			// Should only count cost for successful request
			expect(stats.costData.requestCount).toBe(1); // Only successful requests count
			expect(stats.costData.totalCost).toBeGreaterThan(0);
			expect(mockClient.getCallCount()).toBe(3); // 2 failures + 1 success
		});
	});
});
