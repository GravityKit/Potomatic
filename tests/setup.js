/**
 * Test setup file for vitest
 *
 * This file is loaded before all tests and sets up the testing environment.
 * We use direct OpenAI client mocking instead of nock to avoid compatibility issues.
 */

import { beforeEach, afterEach, vi } from 'vitest';
// Note: Not importing 'dotenv/config' here to avoid loading .env during tests
// This allows config tests to properly test validation without env vars

// Global test setup without nock (which has issues with vitest)
beforeEach(() => {
	// Set test environment variables
	process.env.NODE_ENV = 'test';

	// Mock console methods to reduce noise during tests
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	// Restore all mocks
	vi.restoreAllMocks();

	// Cleanup after each test
	delete process.env.NODE_ENV;
});

// Export test utilities
export const testUtils = {
	// Helper to create mock logger
	createMockLogger: () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
	}),

	// Helper to wait for async operations
	wait: (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms)),

	// Helper to create OpenAI API mock responses
	createOpenAIMockResponse: (translations, usage = null) => ({
		choices: [
			{
				message: {
					content: JSON.stringify(translations),
				},
			},
		],
		usage: usage || {
			prompt_tokens: 100,
			completion_tokens: 50,
			total_tokens: 150,
		},
	}),
};
