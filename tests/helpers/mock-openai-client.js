/**
 * Mock OpenAI client for testing
 */

export class MockOpenAIClient {
	constructor() {
		this.mockResponses = [];
		this.callCount = 0;
		this.lastRequest = null;
	}

	// Queue up mock responses
	queueResponse(response) {
		this.mockResponses.push(response);
	}

	// Queue multiple responses for batch testing
	queueMultipleResponses(responses) {
		responses.forEach((response) => this.queueResponse(response));
	}

	// Queue error response
	queueError(error) {
		this.mockResponses.push({ error });
	}

	// Queue retry scenario: failures followed by success
	queueRetryScenario(failureCount, finalTranslations, errorStatus = 500) {
		// Add failures
		for (let i = 0; i < failureCount; i++) {
			this.queueError({
				status: errorStatus,
				message: `Server error ${i + 1}`,
			});
		}

		// Add final success
		this.queueResponse(createSuccessResponse(finalTranslations));
	}

	// Queue complete failure scenario (all retries fail)
	queueCompleteFailure(maxRetries, errorStatus = 500) {
		for (let i = 0; i <= maxRetries; i++) {
			// Initial attempt + retries
			this.queueError({
				status: errorStatus,
				message: 'Connection error',
			});
		}
	}

	// Queue timeout error
	queueTimeout() {
		this.queueError({
			code: 'ECONNABORTED',
			message: 'timeout of 60000ms exceeded',
		});
	}

	// Queue malformed response
	queueMalformedResponse(invalidContent = 'invalid json') {
		this.mockResponses.push({
			choices: [
				{
					message: {
						content: invalidContent, // This will cause JSON parsing to fail
					},
				},
			],
			usage: {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			},
		});
	}

	// Queue response with wrong translation count
	queueWrongCount(expectedCount, actualCount) {
		const translations = Array(actualCount)
			.fill(0)
			.map((_, i) => `Translation ${i + 1}`);
		this.queueResponse(createSuccessResponse(translations));
	}

	// Mock the chat.completions.create method
	chat = {
		completions: {
			create: async (params) => {
				this.lastRequest = params;
				this.callCount++;

				if (this.mockResponses.length === 0) {
					throw new Error('No mock responses queued');
				}

				const response = this.mockResponses.shift();

				if (response.error) {
					const error = new Error(response.error.message || 'API Error');
					error.status = response.error.status || 500;
					error.code = response.error.code;
					error.response = {
						status: response.error.status || 500,
						data: {
							error: {
								message: response.error.message || 'API Error',
								type: 'api_error',
							},
						},
					};
					throw error;
				}

				return response;
			},
		},
	};

	// Helper methods for testing
	getCallCount() {
		return this.callCount;
	}

	getLastRequest() {
		return this.lastRequest;
	}

	reset() {
		this.mockResponses = [];
		this.callCount = 0;
		this.lastRequest = null;
	}

	// Check if all queued responses were consumed
	isDone() {
		return this.mockResponses.length === 0;
	}
}

// Helper functions for common mock scenarios
export function createSuccessResponse(translations, usage = null) {
	const defaultUsage = {
		prompt_tokens: 100,
		completion_tokens: translations.length * 10,
		total_tokens: 100 + translations.length * 10,
	};

	// Generate XML response in the new compact format
	const xmlContent = translations
		.map((translation, index) => {
			if (Array.isArray(translation)) {
				// Handle plural forms
				const forms = translation.map((form, formIndex) => `<f${formIndex}>${form}</f${formIndex}>`).join('\n');
				return `<t i="${index + 1}">\n${forms}\n</t>`;
			} else {
				// Handle single translation
				return `<t i="${index + 1}"><f0>${translation}</f0></t>`;
			}
		})
		.join('\n');

	return {
		choices: [
			{
				message: {
					content: xmlContent,
				},
			},
		],
		usage: usage || defaultUsage,
	};
}

export function createErrorResponse(status = 500, message = 'API Error') {
	return {
		error: {
			status,
			message,
		},
	};
}

export function createMultipleSuccessResponses(batchTranslations) {
	return batchTranslations.map((translations, index) => {
		const usage = {
			prompt_tokens: 100 + index * 10,
			completion_tokens: translations.length * 10,
			total_tokens: 100 + index * 10 + translations.length * 10,
		};

		return createSuccessResponse(translations, usage);
	});
}
