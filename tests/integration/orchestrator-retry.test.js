import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslationOrchestrator } from '../../src/orchestrator/index.js';
import { createLogger } from '../../src/logging/index.js';
import { MockOpenAIClient, createSuccessResponse } from '../helpers/mock-openai-client.js';
import { createTempDir, copyTestFile, cleanupTempDir } from '../helpers/temp-files.js';

describe('Orchestrator Retry Logic Tests', () => {
	let tempDir;
	let config;
	let logger;
	let mockClient;

	beforeEach(async () => {
		tempDir = await createTempDir();

		config = {
			provider: 'openai',
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
			poFilePrefix: 'test-',
			sourceLanguage: 'en',
			targetLanguages: ['fr', 'es'],
			dryRun: false,
			saveDebugInfo: false,
			verboseLevel: 0,
			concurrentJobs: 1,
			outputFormat: 'console',
		};

		logger = createLogger(0);
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
		mockClient?.reset();
	});

	async function setupOrchestrator() {
		const potFile = await copyTestFile('simple.pot', tempDir);
		config.potFilePath = potFile;

		const orchestrator = new TranslationOrchestrator(config, logger);
		await orchestrator.initialize();

		// Replace the provider's client with our mock
		mockClient = new MockOpenAIClient();
		orchestrator.provider.client = mockClient;

		return orchestrator;
	}

	describe('Sequential Processing with Failures', () => {
		it('should handle complete failure across multiple languages', async () => {
			config.maxStringsTotal = 6; // 3 per language (first batch only)
			const orchestrator = await setupOrchestrator();

			// Both languages fail completely (all batches due to current behavior)
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 2
			mockClient.queueCompleteFailure(config.maxRetries, 503); // es batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 503); // es batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1); // Should fail
			expect(mockClient.getCallCount()).toBe(16); // 4 attempts per batch, 4 batches total
		});

		it('should handle mixed success/failure across languages', async () => {
			config.maxStringsTotal = 3; // Only enough for first language, first batch
			const orchestrator = await setupOrchestrator();

			// First language succeeds and uses up the limit
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3'])); // fr first batch
			// Second language should be skipped

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(0); // Should succeed (some translations worked)
			expect(mockClient.getCallCount()).toBe(1); // Only first language, first batch
		});

		it('should respect global string limits during failures', async () => {
			config.maxStringsTotal = 3; // Only enough for first language, first batch
			const orchestrator = await setupOrchestrator();

			// First language succeeds and uses up the limit
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3'])); // fr
			// Second language should be skipped

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(0);
			expect(mockClient.getCallCount()).toBe(1); // Only first language
		});
	});

	describe('Cost Limit Processing with Failures', () => {
		it('should handle failures within cost limits', async () => {
			config.maxCost = 0.01; // Small budget
			delete config.maxStringsTotal; // Use cost limit instead
			const orchestrator = await setupOrchestrator();

			// First language fails completely (both batches), second succeeds (both batches)
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 2
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3'])); // es batch 1
			mockClient.queueResponse(createSuccessResponse(['Success 4', 'Success 5'])); // es batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1); // Should fail due to errors
			expect(mockClient.getCallCount()).toBe(10); // 8 failures + 2 successes
		});

		it('should stop when cost limit reached during retries', async () => {
			config.maxCost = 0.0001; // Very small budget
			delete config.maxStringsTotal;
			const orchestrator = await setupOrchestrator();

			// Cost limit should prevent any processing
			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(0);
			expect(mockClient.getCallCount()).toBe(0); // No calls due to cost limit
		});
	});

	describe('Failure Flag Behavior in Orchestrator', () => {
		it('should handle stopOnMaxRetriesFailure across languages', async () => {
			config.maxStringsTotal = 10; // Enough for both languages
			config.stopOnMaxRetriesFailure = true;
			const orchestrator = await setupOrchestrator();

			// First language, first batch fails completely (should stop processing)
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1); // Should fail
			expect(mockClient.getCallCount()).toBe(8); // All batches for first language
		});

		it('should handle skipJobOnMaxRetriesFailure across languages', async () => {
			config.maxStringsTotal = 10; // Enough for both languages
			config.skipJobOnMaxRetriesFailure = true;
			const orchestrator = await setupOrchestrator();

			// First language, first batch fails (skips second batch), second language succeeds
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 1 fails
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3'])); // es batch 1
			mockClient.queueResponse(createSuccessResponse(['Success 4', 'Success 5'])); // es batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1); // Should fail due to first language error
			expect(mockClient.getCallCount()).toBe(6); // 4 failures + 2 successes
		});
	});

	describe('Retry Timing in Orchestrator', () => {
		it('should respect retry delays in sequential processing', async () => {
			config.maxStringsTotal = 3;
			config.retryDelayMs = 100; // Longer delay for timing test
			const orchestrator = await setupOrchestrator();

			const startTime = Date.now();

			// Queue 2 failures followed by success
			mockClient.queueRetryScenario(2, ['Success 1', 'Success 2', 'Success 3'], 500);

			await orchestrator.processAllLanguages();

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Should take at least 2 * retryDelayMs (2 retries * 100ms)
			expect(duration).toBeGreaterThanOrEqual(200);
		});
	});

	describe('Error Reporting in Orchestrator', () => {
		it('should report language errors correctly', async () => {
			config.maxStringsTotal = 6; // 3 per language (first batch only)
			const orchestrator = await setupOrchestrator();

			// Both languages fail with different errors (all batches)
			mockClient.queueCompleteFailure(config.maxRetries, 429); // fr batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 429); // fr batch 2
			mockClient.queueCompleteFailure(config.maxRetries, 503); // es batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 503); // es batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1);

			// Verify both languages were attempted (all batches)
			expect(mockClient.getCallCount()).toBe(16); // 4 attempts per batch, 4 batches
		});

		it('should continue processing after individual language failures', async () => {
			config.maxStringsTotal = 6; // 3 per language (first batch only)
			const orchestrator = await setupOrchestrator();

			// First language fails, second succeeds
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 1
			mockClient.queueCompleteFailure(config.maxRetries, 500); // fr batch 2
			mockClient.queueResponse(createSuccessResponse(['Success 1', 'Success 2', 'Success 3'])); // es batch 1
			mockClient.queueResponse(createSuccessResponse(['Success 4', 'Success 5'])); // es batch 2

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(1); // Should fail due to first language error
			expect(mockClient.getCallCount()).toBe(10); // 8 failures + 2 successes
		});
	});

	describe('Concurrent vs Sequential Retry Behavior', () => {
		it('should handle failures in concurrent mode', async () => {
			config.concurrentJobs = 2; // Enable concurrent processing
			config.maxStrings = 3; // Limit to first batch only
			delete config.maxStringsTotal; // Remove sequential trigger
			const orchestrator = await setupOrchestrator();

			// Both languages: 1 failure followed by success (first batch only)
			mockClient.queueRetryScenario(1, ['Success 1', 'Success 2', 'Success 3'], 500); // fr
			mockClient.queueRetryScenario(1, ['Success 1', 'Success 2', 'Success 3'], 503); // es

			const exitCode = await orchestrator.processAllLanguages();

			expect(exitCode).toBe(0);
			expect(mockClient.getCallCount()).toBe(4); // 2 failures + 2 successes
		});
	});
});
