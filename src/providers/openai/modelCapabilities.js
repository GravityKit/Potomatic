import { encoding_for_model as encodingForModel, get_encoding as getEncoding } from 'tiktoken';

/**
 * Default OpenAI model used when none is configured.
 *
 * @since 1.3.0
 *
 * @type {string}
 */
export const DEFAULT_MODEL = 'gpt-5.4-mini';

/**
 * Encoding used by the GPT-4o, GPT-4.1 and GPT-5 model families.
 *
 * @since 1.3.0
 *
 * @type {string}
 */
const DEFAULT_ENCODING = 'o200k_base';

/**
 * Encoders are ~10 MB each and expensive to build, so they are created once per model
 * and shared. Callers must not free them.
 *
 * @since 1.3.0
 *
 * @type {Map<string, Object|null>}
 */
const encoders = new Map();

/**
 * Marks a response that hit its completion-token ceiling. Retrying the identical request
 * cannot succeed, so this is treated as terminal rather than transient.
 *
 * @since 1.3.0
 *
 * @type {string}
 */
export const TRUNCATED_ERROR_CODE = 'OPENAI_RESPONSE_TRUNCATED';

/**
 * Extra completion budget for models that reason before answering. Measured worst case is
 * ~2400 reasoning tokens on a 20-string batch, and the cost is largely fixed rather than
 * proportional to batch size, so this is a flat floor rather than a multiplier.
 *
 * @since 1.3.0
 *
 * @type {number}
 */
export const REASONING_HEADROOM_TOKENS = 4096;

/**
 * Optional dated-snapshot suffix, e.g. `gpt-5.4-mini-2026-03-17`.
 *
 * @since 1.3.0
 *
 * @type {string}
 */
const SNAPSHOT_SUFFIX = '(?:-\\d{4}-\\d{2}-\\d{2})?$';

/**
 * Models that accept the legacy `max_tokens` parameter. Everything else requires
 * `max_completion_tokens`; sending `max_tokens` to them fails the request outright.
 * Unrecognised names fall on the `max_completion_tokens` side, which is what every
 * model released since the GPT-4.1 family expects.
 *
 * @since 1.3.0
 *
 * @type {RegExp}
 */
const LEGACY_MAX_TOKENS_PATTERN = new RegExp('^gpt-4\\.1(?:-(?:mini|nano))?' + SNAPSHOT_SUFFIX);

/**
 * Models that accept a custom `temperature`. The remaining models only allow the
 * default of 1 and reject any explicit value, so the parameter must be omitted.
 * Unrecognised names are treated as not supporting it, since omitting the parameter
 * is accepted by every model while sending it is not.
 *
 * @since 1.3.0
 *
 * @type {RegExp}
 */
const CUSTOM_TEMPERATURE_PATTERN = new RegExp('^(?:gpt-4\\.1(?:-(?:mini|nano))?|gpt-5\\.[124](?:-(?:mini|nano))?)' + SNAPSHOT_SUFFIX);

/**
 * Pricing per 1,000 tokens used when `config/openai-pricing.json` cannot be read.
 * Must stay in step with that file; `tests/unit/modelCapabilities.test.js` asserts it.
 *
 * @since 1.3.0
 *
 * @type {Object}
 */
export const FALLBACK_PRICING = {
	models: {
		'gpt-5.6-sol': { prompt: 0.005, completion: 0.03 },
		'gpt-5.6-terra': { prompt: 0.0025, completion: 0.015 },
		'gpt-5.6-luna': { prompt: 0.001, completion: 0.006 },
		'gpt-5.5': { prompt: 0.005, completion: 0.03 },
		'gpt-5.4': { prompt: 0.0025, completion: 0.015 },
		'gpt-5.4-mini': { prompt: 0.00075, completion: 0.0045 },
		'gpt-5.4-nano': { prompt: 0.0002, completion: 0.00125 },
		'gpt-5.2': { prompt: 0.00175, completion: 0.014 },
		'gpt-5.1': { prompt: 0.00125, completion: 0.01 },
		'gpt-5': { prompt: 0.00125, completion: 0.01 },
		'gpt-5-mini': { prompt: 0.00025, completion: 0.002 },
		'gpt-5-nano': { prompt: 0.00005, completion: 0.0004 },
		'gpt-4.1': { prompt: 0.002, completion: 0.008 },
		'gpt-4.1-mini': { prompt: 0.0004, completion: 0.0016 },
		'gpt-4.1-nano': { prompt: 0.0001, completion: 0.0004 },
		'o4-mini': { prompt: 0.0011, completion: 0.0044 },
		o3: { prompt: 0.002, completion: 0.008 },
		'o3-mini': { prompt: 0.0011, completion: 0.0044 },
	},
	fallback: { prompt: 0.00075, completion: 0.0045 },
};

/**
 * Every model this provider accepts, used when the pricing file cannot be read.
 *
 * @since 1.3.0
 *
 * @type {Array<string>}
 */
export const KNOWN_MODELS = Object.keys(FALLBACK_PRICING.models);

/**
 * Returns a tiktoken encoder for a model, falling back to the encoding shared by
 * current OpenAI families when tiktoken does not recognise the model name.
 *
 * @since 1.3.0
 *
 * @param {string} model - Model identifier.
 *
 * @return {Object|null} Shared encoder instance that must not be freed, or null when none could be created.
 */
export function getEncodingForModel(model) {
	if (encoders.has(model)) {
		return encoders.get(model);
	}

	let encoder = null;

	try {
		encoder = encodingForModel(model);
	} catch {
		try {
			encoder = getEncoding(DEFAULT_ENCODING);
		} catch {
			encoder = null;
		}
	}

	if (encoder) {
		encoders.set(model, encoder);
	}

	return encoder;
}

/**
 * Indicates whether a model accepts an explicit `temperature` value.
 *
 * @since 1.3.0
 *
 * @param {string} model - Model identifier.
 *
 * @return {boolean} True when a custom temperature may be sent.
 */
export function supportsLegacyMaxTokens(model) {
	return LEGACY_MAX_TOKENS_PATTERN.test(model || '');
}

/**
 * Indicates whether a model accepts an explicit `temperature` value.
 *
 * @since 1.3.0
 *
 * @param {string} model - Model identifier.
 *
 * @return {boolean} True when a custom temperature may be sent.
 */
export function supportsCustomTemperature(model) {
	return CUSTOM_TEMPERATURE_PATTERN.test(model || '');
}

/**
 * Builds the chat completion parameters for a model, applying the token-limit and
 * temperature rules that differ between the GPT-4 and GPT-5 families.
 *
 * @since 1.3.0
 *
 * @param {string} model       - Model identifier.
 * @param {Array}  messages    - Chat messages for the request.
 * @param {number} maxTokens   - Upper bound on generated tokens.
 * @param {number} temperature - Requested sampling temperature.
 *
 * @return {Object} Parameters ready to pass to the chat completions endpoint.
 */
export function buildRequestParams(model, messages, maxTokens, temperature) {
	const params = { model, messages };

	if (supportsLegacyMaxTokens(model)) {
		params.max_tokens = maxTokens;
	} else {
		params.max_completion_tokens = maxTokens;
	}

	if (supportsCustomTemperature(model)) {
		params.temperature = temperature;
	}

	return params;
}
