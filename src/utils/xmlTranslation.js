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

			prompt += `<source i="${dictIndex}">${escapeXmlAttribute(match.source)}</source>\n`;
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

			// For plural forms, use separate <singular> and <plural> tags.
			if (entry.msgid_plural) {
				/*return `<source ${attrs.join(' ')}>
  <singular>${escapeXmlAttribute(entry.msgid)}</singular>
  <plural>${escapeXmlAttribute(entry.msgid_plural)}</plural>
</source>`;*/
			}

			// For singular forms, use simple format.
			return `<source ${attrs.join(' ')}>${escapeXmlAttribute(entry.msgid)}</source>`;
		})
		.join('\n');

	prompt += xmlTags + '\n\nRespond:\n';

	if (hasPlurals) {
		prompt += `For entries with <singular> and <plural> tags, provide ${pluralCount} translations:\n\n`;

		const formTags = Array.from({ length: pluralCount }, (_, i) => `<f${i}>translation for form ${i}</f${i}>`).join('');

		prompt += `Format: <t i="N">${formTags}</t>\n`;
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
 * @since TBD
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

	// Ensure we have exactly the right number of forms.
	if (correctedForms.length < expectedCount) {
		hasIssues = true;

		issues.push(`insufficient forms (expected ${expectedCount}, got ${correctedForms.length})`);

		if (verbosityLevel >= 2) {
			logger.warn(
				`Insufficient plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` +
				`Expected ${expectedCount}, got ${correctedForms.length}. Padding with empty strings.`
			);
		}

		while (correctedForms.length < expectedCount) {
			correctedForms.push('');
		}
	} else if (correctedForms.length > expectedCount) {
		hasIssues = true;

		issues.push(`excess forms (expected ${expectedCount}, got ${correctedForms.length})`);

		if (verbosityLevel >= 2) {
			logger.warn(
				`Too many plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` +
				`Expected ${expectedCount}, got ${correctedForms.length}. Truncating.`
			);
		}

		correctedForms = correctedForms.slice(0, expectedCount);
	}

	// Warn about empty forms (except when all are empty - likely not translated yet).
	const nonEmptyCount = correctedForms.filter(f => f && f.trim() !== '').length;

	if (nonEmptyCount > 0 && nonEmptyCount < expectedCount) {
		hasIssues = true;

		const emptyIndices = correctedForms
			.map((f, i) => (f && f.trim() !== '' ? null : i))
			.filter(i => i !== null);

		issues.push(`incomplete forms (empty at indices [${emptyIndices.join(', ')}])`);

		if (verbosityLevel >= 2) {
			logger.warn(
				`Incomplete plural forms at index ${itemId} for "${originalMsgid.substring(0, 50)}...": ` +
				`Forms at indices [${emptyIndices.join(', ')}] are empty.`
			);
		}
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
		msgstr: Array(pluralCount).fill(''),
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

			if (hasFormTags) {
				const forms = [];

				for (let i = 0; i < pluralCount; i++) {
					const formRegex = new RegExp(`<f${i}>(.*?)</f${i}>`, 's');
					const formMatch = block.match(formRegex);

					if (formMatch) {
						const translation = decodeXmlEntities(formMatch[1]);

						forms[i] = translation;
					} else {
						if (verbosityLevel >= 2) {
							logger.warn(`Missing f${i} form in translation block for index ${responseIndex}`);
						}
						forms[i] = '';
					}
				}

				// Validate and auto-correct plural forms.
				const { correctedForms, hasIssues } = validatePluralForms(
					forms,
					batch[batchIndex].msgid,
					pluralCount,
					responseIndex,
					logger,
					verbosityLevel
				);

				if (hasIssues) {
					validationStats.stringsWithPluralIssues++;
				}

				result[batchIndex].msgstr = correctedForms;
			} else {
				const contentMatch = block.match(/<t[^>]*>(.*?)<\/t>/s);

				if (contentMatch) {
					const translation = decodeXmlEntities(contentMatch[1]);

					// If this entry expects plural forms, validate the result
					if (batch[batchIndex].msgid_plural) {
						if (verbosityLevel >= 2) {
							logger.warn(
								`Missing plural forms at index ${responseIndex} for "${batch[batchIndex].msgid.substring(0, 50)}...": ` +
								`Expected ${pluralCount} forms but received singular translation. Using single translation for form 0 only.`
							);
						}
						const { correctedForms, hasIssues } = validatePluralForms(
							[translation],
							batch[batchIndex].msgid,
							pluralCount,
							responseIndex,
							logger,
							verbosityLevel
						);

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

		return { translations: result, validationStats };
	} catch (error) {
		if (verbosityLevel >= 2) {
			logger.warn(`Failed to parse XML response: ${error.message}`);
		}

		return { translations: result, validationStats };
	}
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
