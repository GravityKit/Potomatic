/**
 * XML-based translation utilities.
 * Provides simple and reliable XML format for AI translation requests.
 *
 * @since 1.0.0
 */

import { getLanguageName } from './languageMapping.js';
import { createEmptyValidationStats } from './validationStats.js';

/**
 * Builds XML prompt for translation batch with optional dictionary examples.
 *
 * @since 1.0.0
 *
 * @param {Array}  batch            - Array of translation entries.
 * @param {string} targetLang       - Target language code.
 * @param {number} pluralCount      - Number of plural forms for target language.
 * @param {Array}  dictionaryMatches - Optional dictionary examples to include.
 *
 * @return {Object} Object containing xmlPrompt, dictionaryCount, and metadata.
 */
export function buildXmlPrompt(batch, targetLang, pluralCount, dictionaryMatches = []) {
	const languageName = getLanguageName(targetLang);
	let prompt = `Translate to ${languageName}:\n\n`;
	let startIndex = 1;

	// Add dictionary examples first, if any.
	if (dictionaryMatches.length > 0) {
		prompt += '<!-- Dictionary Examples for Consistency -->\n';
		dictionaryMatches.forEach((match, index) => {
			const dictIndex = index + 1;
			const ph = extractPlaceholders(match.source);
			const phAttr = ph ? `placeholders="${escapeXmlAttribute(ph)}"` : 'placeholders="none"';

			prompt += `<source i="${dictIndex}" ${phAttr}>${escapeXmlAttribute(match.source)}</source>\n`;
		});
		prompt += '<!-- End Dictionary Examples -->\n\n';
		startIndex = dictionaryMatches.length + 1;
	}

	const hasPlurals = batch.some((entry) => entry.msgid_plural);

	const xmlTags = batch
		.map((entry, index) => {
			const actualIndex = startIndex + index;
			const attrs = [`i="${actualIndex}"`];

			if (entry.extractedComments) {
				attrs.push(`c="${escapeXmlAttribute(entry.extractedComments)}"`);
			}

			// Include expected placeholders so the LLM can verify its output.
			const ph = extractPlaceholders(entry.msgid);

			if (ph) {
				attrs.push(`placeholders="${escapeXmlAttribute(ph)}"`);
			} else {
				attrs.push('placeholders="none"');
			}

			// For plural forms, use separate <singular> and <plural> tags.
			if (entry.msgid_plural) {
				return `<source ${attrs.join(' ')}>
  <singular>${escapeXmlAttribute(entry.msgid)}</singular>
  <plural>${escapeXmlAttribute(entry.msgid_plural)}</plural>
</source>`;
			}

			// For singular forms, use simple format.
			return `<source ${attrs.join(' ')}>${escapeXmlAttribute(entry.msgid)}</source>`;
		})
		.join('\n');

	prompt += xmlTags + '\n\nRespond:\n';

	if (hasPlurals) {
		const formTags = Array.from({ length: pluralCount }, (_, i) => `<f${i}>translation for form ${i}</f${i}>`).join('');

		prompt += `For entries with <singular> and <plural> tags, provide ${pluralCount} plural forms:\n`;
		prompt += `Format: <t i="N">${formTags}</t>\n\n`;
		prompt += `For all other entries (no <singular>/<plural>), provide a single translation:\n`;
		prompt += `Format: <t i="N">translation</t>\n`;
	} else {
		prompt += `Format: <t i="N">translation</t>\n`;
	}

	return {
		xmlPrompt: prompt,
		dictionaryCount: dictionaryMatches.length,
		metadata: {
			hasDictionary: dictionaryMatches.length > 0,
			dictionaryEntries: dictionaryMatches.length,
			batchStartIndex: startIndex,
		},
	};
}

/**
 * Creates dictionary response content for AI context.
 * Builds the expected AI response for dictionary examples.
 *
 * @since 1.0.0
 *
 * @param {Array} dictionaryMatches - Dictionary examples.
 *
 * @return {string} Dictionary response XML content.
 */
export function buildDictionaryResponse(dictionaryMatches) {
	return dictionaryMatches.map((match, index) => `<t i="${index + 1}">${escapeXmlAttribute(match.target)}</t>`).join('\n');
}

/**
 * Validates plural form translations.
 * Ensures correct form count and warns about incomplete translations.
 *
 * @since 1.1.0
 *
 * @param {Array<string>} forms - Array of translated forms.
 * @param {string} originalMsgid - Original msgid for logging context.
 * @param {number} expectedCount - Expected number of plural forms.
 * @param {number} itemId - Item ID for logging.
 * @param {Object} logger - Logger instance.
 * @param {number} verbosityLevel - Logger verbosity level (0-3). Warnings shown at level 2+.
 *
 * @return {Object} Object with correctedForms array and hasIssues boolean.
 */
function validatePluralForms(forms, originalMsgid, expectedCount, itemId, logger, verbosityLevel = 1) {
	let correctedForms = [...forms];
	let hasIssues = false;
	const issues = [];

	// Find first non-empty form to use as fallback.
	const fallbackForm = correctedForms.find((f) => f && f.trim() !== '') || '';

	// Ensure we have exactly the right number of forms.
	if (correctedForms.length < expectedCount) {
		hasIssues = true;

		issues.push(`insufficient forms (expected ${expectedCount}, got ${correctedForms.length})`);

		if (verbosityLevel >= 2) {
			logger.warn(`Insufficient plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` + `Expected ${expectedCount}, got ${correctedForms.length}. Padding with first form as fallback.`);
		}

		while (correctedForms.length < expectedCount) {
			correctedForms.push(fallbackForm);
		}
	} else if (correctedForms.length > expectedCount) {
		hasIssues = true;

		issues.push(`excess forms (expected ${expectedCount}, got ${correctedForms.length})`);

		if (verbosityLevel >= 2) {
			logger.warn(`Too many plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` + `Expected ${expectedCount}, got ${correctedForms.length}. Truncating.`);
		}

		correctedForms = correctedForms.slice(0, expectedCount);
	}

	// Warn about empty forms (except when all are empty - likely not translated yet).
	const nonEmptyCount = correctedForms.filter((f) => f && f.trim() !== '').length;

	if (nonEmptyCount > 0 && nonEmptyCount < expectedCount) {
		hasIssues = true;

		const emptyIndices = correctedForms.map((f, i) => (f && f.trim() !== '' ? null : i)).filter((i) => i !== null);

		issues.push(`incomplete forms (empty at indices [${emptyIndices.join(', ')}])`);

		if (verbosityLevel >= 2) {
			logger.warn(`Incomplete plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` + `Forms at indices [${emptyIndices.join(', ')}] are empty. Filling with first form as fallback.`);
		}

		// Fill empty forms with the first non-empty form as fallback.
		correctedForms = correctedForms.map((f) => (f && f.trim() !== '' ? f : fallbackForm));
	}

	if (hasIssues && verbosityLevel >= 3) {
		logger.debug(`Plural issues at index ${itemId}: ${issues.join(', ')}`);
		logger.debug(`Corrected forms:`, correctedForms);
	}

	return { correctedForms, hasIssues };
}

/**
 * Parses XML response and extracts translations, accounting for dictionary indices.
 *
 * @since 1.0.0
 *
 * @param {string} xmlResponse    - XML response from AI provider.
 * @param {Array}  batch          - Original batch for fallback.
 * @param {number} pluralCount    - Expected number of plural forms.
 * @param {Object} logger         - Logger instance.
 * @param {number} dictionaryCount - Number of dictionary entries to skip.
 * @param {number} verbosityLevel - Logger verbosity level (0-3). Warnings shown at level 2+.
 *
 * @return {Object} Object with translations array and validationStats.
 */
export function parseXmlResponse(xmlResponse, batch, pluralCount, logger, dictionaryCount = 0, verbosityLevel = 1) {
	const result = batch.map((entry) => ({
		msgid: entry.msgid,
		msgstr: Array(entry.msgid_plural ? pluralCount : 1).fill(''),
	}));

	const validationStats = createEmptyValidationStats();

	if (!xmlResponse || xmlResponse.trim() === '') {
		if (verbosityLevel >= 2) {
			logger.warn('Empty XML response received');
		}

		return { translations: result, validationStats };
	}

	try {
		const translationBlocks = xmlResponse.match(/<t[^>]*>[\s\S]*?<\/t>/g);

		if (!translationBlocks) {
			if (verbosityLevel >= 2) {
				logger.warn('No translation blocks found in XML response');
			}

			return { translations: result, validationStats };
		}

		translationBlocks.forEach((block) => {
			const indexMatch = block.match(/i="(\d+)"/);

			if (!indexMatch) {
				logger.warn('No index found in translation block');
				return;
			}

			const responseIndex = parseInt(indexMatch[1], 10);

			// Skip dictionary indices - only process translation indices.
			if (responseIndex <= dictionaryCount) {
				return;
			}

			// Convert to 0-based batch index.
			const batchIndex = responseIndex - dictionaryCount - 1;

			if (batchIndex < 0 || batchIndex >= batch.length) {
				logger.warn(`Invalid batch index ${batchIndex} (response index ${responseIndex}) in translation block`);

				return;
			}

			const hasFormTags = block.includes('<f0>');
			const isSingularEntry = !batch[batchIndex].msgid_plural;

			if (hasFormTags && !isSingularEntry) {
				const forms = [];

				for (let i = 0; i < pluralCount; i++) {
					const formRegex = new RegExp(`<f${i}>(.*?)</f${i}>`, 's');
					const formMatch = block.match(formRegex);

					if (formMatch) {
						const source = i === 0 ? batch[batchIndex].msgid : batch[batchIndex].msgid_plural || batch[batchIndex].msgid;
						const translation = normalizeNbsp(decodeXmlEntities(formMatch[1]), source);

						forms[i] = translation;
					} else {
						if (verbosityLevel >= 2) {
							logger.warn(`Missing f${i} form in translation block for index ${responseIndex}`);
						}
						forms[i] = '';
					}
				}

				// Validate and auto-correct plural forms.
				const { correctedForms, hasIssues } = validatePluralForms(forms, batch[batchIndex].msgid, pluralCount, responseIndex, logger, verbosityLevel);

				if (hasIssues) {
					validationStats.stringsWithPluralIssues++;
				}

				result[batchIndex].msgstr = correctedForms;
			} else if (hasFormTags && isSingularEntry) {
				// AI incorrectly returned plural forms for a singular entry.
				// Extract only form 0 and discard the rest.
				const formRegex = /<f0>(.*?)<\/f0>/s;
				const formMatch = block.match(formRegex);

				if (formMatch) {
					const translation = normalizeNbsp(decodeXmlEntities(formMatch[1]), batch[batchIndex].msgid);

					result[batchIndex].msgstr = [translation];
				}
			} else {
				const contentMatch = block.match(/<t[^>]*>(.*?)<\/t>/s);

				if (contentMatch) {
					const translation = normalizeNbsp(decodeXmlEntities(contentMatch[1]), batch[batchIndex].msgid);

					// If this entry expects plural forms, validate the result
					if (batch[batchIndex].msgid_plural) {
						if (verbosityLevel >= 2) {
							logger.warn(`Missing plural forms at index ${responseIndex} for "${batch[batchIndex].msgid.substring(0, 50)}...": ` + `Expected ${pluralCount} forms but received singular translation. Using single translation for form 0 only.`);
						}
						const { correctedForms, hasIssues } = validatePluralForms([translation], batch[batchIndex].msgid, pluralCount, responseIndex, logger, verbosityLevel);

						if (hasIssues) {
							validationStats.stringsWithPluralIssues++;
						}

						result[batchIndex].msgstr = correctedForms;
					} else {
						result[batchIndex].msgstr = [translation];
					}
				} else {
					if (verbosityLevel >= 2) {
						logger.warn(`Could not extract translation from block for index ${responseIndex}`);
					}
				}
			}
		});

		// Post-process: reject translations where placeholders don't match the source.
		for (let idx = 0; idx < result.length; idx++) {
			const entry = batch[idx];
			const singularPh = extractPlaceholders(entry.msgid);
			const pluralPh = entry.msgid_plural ? extractPlaceholders(entry.msgid_plural) : singularPh;

			for (let fi = 0; fi < result[idx].msgstr.length; fi++) {
				const translation = result[idx].msgstr[fi];

				if (!translation) {
					continue;
				}

				// Form 0 validates against singular, forms 1+ against plural.
				// For plural strings, form 0 (singular) may legitimately drop %d/%d
				// when the language uses a word like "one" instead of the number.
				const expectedPh = fi === 0 ? singularPh : pluralPh;
				const transPlaceholders = extractPlaceholders(translation);

				let isValid = expectedPh === transPlaceholders;

				if (!isValid && entry.msgid_plural && pluralCount > 1) {
					// Plural forms that represent specific small counts may
					// legitimately drop %d and use words instead:
					// - Form 0 (zero/singular): "no items" or "one item"
					// - Form 1 (one/singular in 6-form languages): "مراجعة واحدة"
					// - Form 2 (two/dual in 6-form languages): "مراجعتان"
					// Not allowed when pluralCount === 1 (Japanese, Chinese, Korean)
					// because form 0 is the ONLY form and must retain all placeholders.
					const isSmallCountForm = fi === 0 || (pluralCount === 6 && fi <= 2);

					if (isSmallCountForm) {
						// Allow dropping only numeric placeholders (%d, %f, %u and
						// positional variants). String placeholders (%s, %1$s) must
						// always be retained — they carry non-count data.
						// NOTE: pluralCount === 6 only matches Arabic in our current
						// locale map. If a non-Arabic 6-form language is added, revisit.
						// Uses frequency maps (not Sets) to preserve duplicate placeholder counts.
						const expectedArr = (expectedPh || '').split(',').filter(Boolean);
						const transArr = (transPlaceholders || '').split(',').filter(Boolean);

						const buildFreqMap = (arr) => {
							const freq = {};

							for (const p of arr) {
								freq[p] = (freq[p] || 0) + 1;
							}

							return freq;
						};

						const expectedFreq = buildFreqMap(expectedArr);
						const transFreq = buildFreqMap(transArr);

						// Find dropped placeholders (count-aware).
						// A numeric placeholder can only be dropped entirely (all
						// instances), not partially. "%d of %d" → dropping one %d
						// but keeping the other breaks sprintf.
						let allDropsValid = true;
						let hasExtra = false;

						for (const [ph, count] of Object.entries(expectedFreq)) {
							const transCount = transFreq[ph] || 0;

							if (transCount < count) {
								const isNumeric = /^%(?:\d+\$)?[-+0 '#]*(?:\*|\d+)?(?:\.(?:\*|\d+))?[dfueEfFgGuxX]$/.test(ph);

								if (!isNumeric || transCount !== 0) {
									// Non-numeric dropped, or numeric partially dropped.
									allDropsValid = false;
								}
							}
						}

						for (const [ph, count] of Object.entries(transFreq)) {
							if (count > (expectedFreq[ph] || 0)) {
								hasExtra = true;
							}
						}

						isValid = allDropsValid && !hasExtra;
					}
				}

				if (!isValid) {
					if (verbosityLevel >= 1) {
						logger.warn(`Placeholder mismatch for "${entry.msgid.substring(0, 50)}..." [form ${fi}] — ` + `expected [${expectedPh}], got [${transPlaceholders}]. Blanking translation.`);
					}

					result[idx].msgstr[fi] = '';
					validationStats.stringsWithPluralIssues++;
					validationStats.blankedStrings.push({
						msgid: entry.msgid.substring(0, 100),
						form: fi,
						expected: expectedPh || 'none',
						got: transPlaceholders || 'none',
					});
				}
			}
		}

		return { translations: result, validationStats };
	} catch (error) {
		if (verbosityLevel >= 2) {
			logger.warn(`Failed to parse XML response: ${error.message}`);
		}

		return { translations: result, validationStats };
	}
}

/**
 * Extracts sorted printf-style placeholders from a string.
 *
 * @since 1.2.0
 *
 * @param {string} text - Text to extract from.
 *
 * @return {string} Comma-separated sorted placeholders.
 */
function extractPlaceholders(text) {
	if (!text) {
		return '';
	}

	// Full PHP sprintf format: %[position$][flags][width][.precision]type
	// First replace %% with a sentinel to avoid false matches, then extract.
	const cleaned = text.replace(/%%/g, '\x00\x00');

	return (cleaned.match(/%(?:\d+\$)?[-+0 '#]*(?:\*|\d+)?(?:\.(?:\*|\d+))?[bcdeEfFgGosuxX]/g) || []).sort().join(',');
}

/**
 * Decodes XML entities.
 *
 * @since 1.0.0
 *
 * @param {string} text - Text to decode.
 *
 * @return {string} Decoded text.
 */
function decodeXmlEntities(text) {
	if (!text) {
		return '';
	}

	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Normalizes non-breaking spaces (U+00A0) in a translation to match the
 * source string's whitespace. LLMs sometimes produce nbsp where the source
 * has regular spaces, which triggers GlotPress "missing spaces" warnings.
 *
 * Only normalizes leading/trailing whitespace — interior nbsp is preserved
 * as it may be intentional (e.g., French punctuation spacing).
 *
 * @since 1.2.0
 *
 * @param {string} translation - Translated text.
 * @param {string} source      - Source text to match whitespace against.
 *
 * @return {string} Translation with leading/trailing nbsp normalized.
 */
function normalizeNbsp(translation, source) {
	if (!translation || !translation.includes('\u00A0')) {
		return translation;
	}

	let result = translation;

	const origLeading = source.match(/^(\s*)/)[1];
	const origTrailing = source.match(/(\s*)$/)[1];
	const transLeading = result.match(/^(\s*)/)[1];
	const transTrailing = result.match(/(\s*)$/)[1];

	if (origLeading && transLeading.includes('\u00A0')) {
		result = transLeading.replace(/\u00A0/g, ' ') + result.slice(transLeading.length);
	}

	if (origTrailing && transTrailing.includes('\u00A0')) {
		result = result.slice(0, -transTrailing.length) + transTrailing.replace(/\u00A0/g, ' ');
	}

	return result;
}

/**
 * Escapes XML attribute values.
 *
 * @since 1.0.0
 *
 * @param {string} text - Text to escape.
 *
 * @return {string} Escaped text.
 */
function escapeXmlAttribute(text) {
	if (!text) {
		return '';
	}

	return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
