import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { buildRequestParams, supportsCustomTemperature, getEncodingForModel, DEFAULT_MODEL, FALLBACK_PRICING, KNOWN_MODELS, REASONING_HEADROOM_TOKENS } from '../../src/providers/openai/modelCapabilities.js';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';

const PRICING = JSON.parse(readFileSync(new URL('../../config/openai-pricing.json', import.meta.url)));

/**
 * Parameter support verified against the live OpenAI API. Only the gpt-4.x family
 * accepts `max_tokens`; only gpt-4.x and the non-pro gpt-5.1/5.2/5.4 tiers accept a
 * custom temperature. Sending an unsupported parameter fails the whole request.
 */
const TEMPERATURE_SUPPORT = {
	'gpt-4.1': true,
	'gpt-4.1-mini': true,
	'gpt-4.1-nano': true,
	'gpt-5.1': true,
	'gpt-5.2': true,
	'gpt-5.4': true,
	'gpt-5.4-mini': true,
	'gpt-5.4-nano': true,
	'gpt-5.2-pro': false,
	'gpt-5.4-pro': false,
	'gpt-5.5': false,
	'gpt-5.5-pro': false,
	'gpt-5.6-sol': false,
	'gpt-5.6-terra': false,
	'gpt-5.6-luna': false,
	'gpt-5': false,
	'gpt-5-mini': false,
	'gpt-5-nano': false,
	'gpt-5-pro': false,
	o3: false,
	'o3-mini': false,
	'o4-mini': false,
};

describe('modelCapabilities', () => {
	describe('supportsCustomTemperature', () => {
		for (const [model, expected] of Object.entries(TEMPERATURE_SUPPORT)) {
			it(`${expected ? 'allows' : 'rejects'} a custom temperature for ${model}`, () => {
				expect(supportsCustomTemperature(model)).toBe(expected);
			});
		}
	});

	describe('buildRequestParams', () => {
		const messages = [{ role: 'user', content: 'hi' }];

		it('uses max_tokens for the gpt-4 family', () => {
			const params = buildRequestParams('gpt-4.1-mini', messages, 500, 0.7);

			expect(params.max_tokens).toBe(500);
			expect(params.max_completion_tokens).toBeUndefined();
			expect(params.temperature).toBe(0.7);
		});

		it('uses max_completion_tokens for every gpt-5 model', () => {
			for (const model of Object.keys(TEMPERATURE_SUPPORT).filter((m) => !m.startsWith('gpt-4'))) {
				const params = buildRequestParams(model, messages, 500, 0.7);

				expect(params.max_completion_tokens, model).toBe(500);
				expect(params.max_tokens, model).toBeUndefined();
			}
		});

		it('omits temperature for models that only accept the default', () => {
			expect(buildRequestParams('gpt-5.6-luna', messages, 500, 0.7)).not.toHaveProperty('temperature');
			expect(buildRequestParams('gpt-5-mini', messages, 500, 0.7)).not.toHaveProperty('temperature');
			expect(buildRequestParams('gpt-5.4-pro', messages, 500, 0.7)).not.toHaveProperty('temperature');
		});

		it('keeps temperature for the gpt-5.4 mini and nano tiers', () => {
			expect(buildRequestParams('gpt-5.4-mini', messages, 500, 0.3).temperature).toBe(0.3);
			expect(buildRequestParams('gpt-5.4-nano', messages, 500, 0.3).temperature).toBe(0.3);
		});

		it('always carries the model and messages through', () => {
			const params = buildRequestParams('gpt-5.4-mini', messages, 10, 1);

			expect(params.model).toBe('gpt-5.4-mini');
			expect(params.messages).toBe(messages);
		});
	});

	describe('getEncodingForModel', () => {
		it('returns an encoder for a model tiktoken does not know', () => {
			const encoding = getEncodingForModel('gpt-5.6-luna');

			expect(encoding).not.toBeNull();
			expect(encoding.encode('Select a Field').length).toBeGreaterThan(0);
		});

		// This text tokenizes differently under o200k_base (8) and cl100k_base (12), so the
		// assertion fails if the fallback ever silently reverts to the older encoding.
		it('falls back to o200k_base, not an older encoding', () => {
			const text = 'Выберите как минимум %d поле.';

			expect(getEncodingForModel('gpt-5.4-mini').encode(text).length).toBe(8);
			expect(getEncodingForModel('gpt-4.1-mini').encode(text).length).toBe(8);
		});

		it('reuses one encoder per model instead of rebuilding it', () => {
			expect(getEncodingForModel('gpt-5.4-mini')).toBe(getEncodingForModel('gpt-5.4-mini'));
		});
	});

	describe('name variants', () => {
		it('classifies dated snapshots like their base model', () => {
			expect(supportsCustomTemperature('gpt-5.4-mini-2026-03-17')).toBe(true);
			expect(supportsCustomTemperature('gpt-5.5-2026-04-23')).toBe(false);
			expect(buildRequestParams('gpt-4.1-mini-2025-04-14', [], 5, 0.7).max_tokens).toBe(5);
			expect(buildRequestParams('gpt-5.4-mini-2026-03-17', [], 5, 0.7).max_completion_tokens).toBe(5);
		});

		it('does not treat unrelated families as gpt-4.1 or as temperature-capable', () => {
			for (const model of ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']) {
				expect(supportsCustomTemperature(model), model).toBe(false);
				expect(buildRequestParams(model, [], 5, 0.7).max_tokens, model).toBeUndefined();
			}
		});

		it('does not let a higher minor version match a lower one', () => {
			expect(supportsCustomTemperature('gpt-5.10')).toBe(false);
			expect(supportsCustomTemperature('gpt-5.2-codex')).toBe(false);
			expect(supportsCustomTemperature('gpt-5.1-codex-max')).toBe(false);
			expect(supportsCustomTemperature('gpt-5-chat-latest')).toBe(false);
		});

		it('falls back safely for an unknown model', () => {
			const params = buildRequestParams('gpt-6-future', [], 5, 0.7);

			expect(params.max_completion_tokens).toBe(5);
			expect(params).not.toHaveProperty('temperature');
		});
	});

	describe('FALLBACK_PRICING', () => {
		it('covers exactly the models in the pricing configuration', () => {
			expect(KNOWN_MODELS.sort()).toEqual(Object.keys(PRICING.models).sort());
		});

		it('matches the rates in the pricing configuration', () => {
			for (const [model, rates] of Object.entries(PRICING.models)) {
				expect(FALLBACK_PRICING.models[model], model).toEqual(rates);
			}
		});

		it('uses the same unknown-model fallback rate as the pricing configuration', () => {
			expect(FALLBACK_PRICING.fallback.prompt).toBe(PRICING.fallback.prompt);
			expect(FALLBACK_PRICING.fallback.completion).toBe(PRICING.fallback.completion);
		});
	});

	describe('DEFAULT_MODEL', () => {
		it('is priced in the pricing configuration', () => {
			expect(PRICING.models).toHaveProperty(DEFAULT_MODEL);
		});

		it('accepts a custom temperature, which the CLI sends by default', () => {
			expect(supportsCustomTemperature(DEFAULT_MODEL)).toBe(true);
		});
	});
});

describe('catalog admission', () => {
	// The `-pro` tiers are not served by the chat completions endpoint at all, so listing
	// them would offer models that can never complete a translation.
	const EXCLUDED = ['gpt-5-pro', 'gpt-5.2-pro', 'gpt-5.4-pro', 'gpt-5.5-pro'];

	for (const model of EXCLUDED) {
		it(`excludes ${model} from both the pricing file and the fallback catalog`, () => {
			expect(PRICING.models).not.toHaveProperty(model);
			expect(KNOWN_MODELS).not.toContain(model);
		});
	}

	it('still offers a usable model on every retained family', () => {
		for (const family of ['gpt-4.1', 'gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5.4', 'gpt-5.5', 'gpt-5.6', 'o3', 'o4']) {
			expect(
				KNOWN_MODELS.some((m) => m.startsWith(family)),
				family
			).toBe(true);
		}
	});

	// Reasoning tokens come out of the same budget as visible output and are largely fixed
	// rather than proportional to the batch, so a visible-output-only cap starves small
	// batches: gpt-5-nano and gpt-5-mini truncated 100% of the time at batch sizes 1-5.
	it('gives reasoning models headroom that does not shrink with the batch', () => {
		const provider = new OpenAIProvider({}, { debug() {}, warn() {} });

		for (const batchSize of [1, 3, 5]) {
			expect(provider._calculateMaxTokens('gpt-5-nano', batchSize)).toBeGreaterThan(REASONING_HEADROOM_TOKENS);
			expect(provider._calculateMaxTokens('gpt-4.1-mini', batchSize)).toBeLessThan(REASONING_HEADROOM_TOKENS);
		}
	});

	it('respects an explicitly configured max-tokens instead of adding headroom', () => {
		const provider = new OpenAIProvider({ maxTokens: 500 }, { debug() {}, warn() {} });

		expect(provider._calculateMaxTokens('gpt-5-nano', 5)).toBe(500);
	});
});

describe('--allow-unknown-model', () => {
	const provider = (config) => {
		const instance = new OpenAIProvider(config, { debug() {}, warn() {} });

		instance.providerPricing = FALLBACK_PRICING;

		return instance;
	};

	it('rejects a model missing from the catalogue by default', () => {
		const result = provider({ apiKey: 'k', model: 'gpt-9-imaginary' }).validateConfig({ apiKey: 'k', model: 'gpt-9-imaginary' });

		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toMatch(/--allow-unknown-model/);
	});

	it('accepts it when the flag is set', () => {
		const config = { apiKey: 'k', model: 'gpt-9-imaginary', allowUnknownModel: true };

		expect(provider(config).validateConfig(config).isValid).toBe(true);
	});

	it('still accepts a catalogued model without the flag', () => {
		const config = { apiKey: 'k', model: DEFAULT_MODEL };

		expect(provider(config).validateConfig(config).isValid).toBe(true);
	});
});
