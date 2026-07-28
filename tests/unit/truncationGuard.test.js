import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { TRUNCATED_ERROR_CODE } from '../../src/providers/openai/modelCapabilities.js';

const silentLogger = { debug: () => {}, warn: () => {}, info: () => {}, error: () => {}, success: () => {} };

/**
 * A response cut short at the completion limit still contains whatever blocks arrived
 * before the cut, so accepting it writes the remaining strings out as blank msgstrs under
 * a success status. Reasoning models reach the limit easily, because their hidden
 * reasoning is charged against the same budget as the visible answer.
 */
const truncatedResponse = (completionTokens = 780, reasoningTokens = 780) => ({
	id: 'chatcmpl-truncated',
	choices: [{ finish_reason: 'length', message: { content: '<t i="1">Eins</t><t i="2">Zwe' } }],
	usage: {
		prompt_tokens: 200,
		completion_tokens: completionTokens,
		total_tokens: 200 + completionTokens,
		completion_tokens_details: { reasoning_tokens: reasoningTokens },
	},
});

describe('truncation guard', () => {
	let provider;
	let callCount;

	beforeEach(async () => {
		provider = new OpenAIProvider({ apiKey: 'test-key', model: 'gpt-5-nano', temperature: 0.1, timeout: 60 }, silentLogger);
		await provider.initialize();

		callCount = 0;
	});

	const runBatch = async (response, maxRetries) => {
		provider.client = {
			chat: {
				completions: {
					create: async () => {
						callCount++;

						return response;
					},
				},
			},
		};

		return provider.translateBatch([{ msgid: 'One' }, { msgid: 'Two' }], 'de_DE', 'gpt-5-nano', 'Translate.', maxRetries, 1, 60, false);
	};

	it('fails the batch instead of writing out the partial response', async () => {
		const result = await runBatch(truncatedResponse(), 0);

		expect(result.success).toBe(false);
		expect(result.translations).toEqual([]);
		expect(result.error).toMatch(/truncated/i);
	});

	it('does not retry, since an unchanged request would be cut off the same way', async () => {
		await runBatch(truncatedResponse(), 3);

		expect(callCount).toBe(1);
	});

	it('reports the attempts actually made rather than the retry allowance', async () => {
		const result = await runBatch(truncatedResponse(), 3);

		expect(result.error).toMatch(/after 1 attempt\./);
	});

	it('charges the tokens the truncated call actually consumed', async () => {
		const result = await runBatch(truncatedResponse(), 0);

		expect(result.cost.totalCost).toBeGreaterThan(0);
		expect(result.cost.completionTokens).toBe(780);
	});

	it('names the reasoning tokens so the cause is actionable', async () => {
		const result = await runBatch(truncatedResponse(780, 780), 0);

		expect(result.error).toMatch(/780 of them spent on reasoning/);
	});

	it('treats the truncation code as terminal', () => {
		const error = new Error('truncated');

		error.code = TRUNCATED_ERROR_CODE;

		expect(provider._shouldStopRetrying(error)).toBe(true);
		expect(provider._shouldStopRetrying(new Error('ECONNRESET'))).toBe(false);
	});

	it('still accepts a response that finished normally', async () => {
		const complete = {
			id: 'chatcmpl-ok',
			choices: [{ finish_reason: 'stop', message: { content: '<t i="1">Eins</t><t i="2">Zwei</t>' } }],
			usage: { prompt_tokens: 200, completion_tokens: 20, total_tokens: 220 },
		};
		const result = await runBatch(complete, 0);

		expect(result.success).toBe(true);
		expect(result.translations.map((t) => t.msgstr[0])).toEqual(['Eins', 'Zwei']);
	});
});
