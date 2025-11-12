/**
 * XML-based translation utilities.
 * Provides simple and reliable XML format for AI translation requests.
 *
 * @since 1.0.0
 */

import { getLanguageName } from './languageMapping.js';

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
 * Parses XML response and extracts translations, accounting for dictionary indices.
 *
 * @since 1.0.0
 *
 * @param {string} xmlResponse    - XML response from AI provider.
 * @param {Array}  batch          - Original batch for fallback.
 * @param {number} pluralCount    - Expected number of plural forms.
 * @param {Object} logger         - Logger instance.
 * @param {number} dictionaryCount - Number of dictionary entries to skip.
 *
 * @return {Array} Parsed translations.
 */
export function parseXmlResponse(xmlResponse, batch, pluralCount, logger, dictionaryCount = 0) {
	const result = batch.map((entry) => ({
		msgid: entry.msgid,
		msgstr: Array(pluralCount).fill(''),
	}));

	if (!xmlResponse || xmlResponse.trim() === '') {
		logger.warn('Empty XML response received');

		return result;
	}

	try {
		const translationBlocks = xmlResponse.match(/<t[^>]*>[\s\S]*?<\/t>/g);

		if (!translationBlocks) {
			logger.warn('No translation blocks found in XML response');

			return result;
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
						logger.warn(`Missing f${i} form in translation block for index ${responseIndex}`);
						forms[i] = '';
					}
				}
				result[batchIndex].msgstr = forms;
			} else {
				const contentMatch = block.match(/<t[^>]*>(.*?)<\/t>/s);

				if (contentMatch) {
					const translation = decodeXmlEntities(contentMatch[1]);

					result[batchIndex].msgstr = [translation];
				} else {
					logger.warn(`Could not extract translation from block for index ${responseIndex}`);
				}
			}
		});

		return result;
	} catch (error) {
		logger.warn(`Failed to parse XML response: ${error.message}`);

		return result;
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
