/**
 * Prompt Loader Utility.
 * Loads the translation system prompt from prompt.md.
 * This is the production prompt loader used by potomatic.js.
 *
 * @since 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_MODEL, getEncodingForModel } from '../providers/openai/modelCapabilities.js';
import { getApiTargetLanguage } from './languageMapping.js';
import { getPluralForms, extractPluralCount } from './poFileUtils.js';

/**
 * Loads the system prompt from prompt.md.
 *
 * @since 1.0.0
 *
 * @param {string} promptFilePath - Path to the prompt.md file.
 *
 * @return {string} The system prompt template.
 */
function loadPromptTemplate(promptFilePath) {
	try {
		const content = fs.readFileSync(promptFilePath, 'utf-8');
		const prompt = content.trim();

		if (!prompt) {
			throw new Error('Prompt file is empty');
		}

		return prompt;
	} catch (error) {
		throw new Error(`Failed to load prompt from ${promptFilePath}: ${error.message}`);
	}
}

/**
 * Builds a system prompt for translation.
 *
 * @since 1.0.0
 *
 * @param {string} targetLang     - Target language code (e.g., 'fr_FR', 'es_ES').
 * @param {string} sourceLang     - Source language code (e.g., 'en', 'English').
 * @param {string} promptFilePath - Path to the prompt.md file (optional).
 *
 * @return {string} Complete system prompt ready for use.
 */
export function buildSystemPrompt(targetLang, sourceLang = 'English', promptFilePath = null, extraPromptPath = null) {
	const currentDir = path.dirname(fileURLToPath(import.meta.url));
	const defaultPromptPath = path.resolve(currentDir, '../../config/prompt.md');

	// --prompt-file-path fully overrides the default prompt.
	// --extra-prompt-path appends to the default prompt (for domain-specific terminology).
	let template;

	if (promptFilePath) {
		template = loadPromptTemplate(promptFilePath);
	} else {
		template = loadPromptTemplate(defaultPromptPath);
	}

	if (extraPromptPath) {
		if (!fs.existsSync(extraPromptPath)) {
			throw new Error(`Extra prompt file not found: ${extraPromptPath}`);
		}

		const extraTemplate = loadPromptTemplate(extraPromptPath);

		template = template + '\n\n' + extraTemplate;
	}

	const targetLanguageName = getApiTargetLanguage(targetLang);
	const sourceLanguageName = getApiTargetLanguage(sourceLang);
	const pluralFormsString = getPluralForms(targetLang, { debug: () => {}, warn: () => {} });
	const pluralCount = extractPluralCount(pluralFormsString);

	return template
		.replace(/\{\{SOURCE_LANGUAGE\}\}/g, sourceLanguageName)
		.replace(/\{\{TARGET_LANGUAGE\}\}/g, targetLanguageName)
		.replace(/\{\{TARGET_LANGUAGE_CODE\}\}/g, targetLang)
		.replace(/\{\{PLURAL_COUNT\}\}/g, pluralCount.toString());
}

/**
 * Gets exact token count for a prompt using tiktoken.
 *
 * @since 1.0.0
 *
 * @param {string} prompt - The prompt text.
 * @param {string} model  - The model to get encoding for (defaults to the configured default model).
 *
 * @return {number} Exact token count.
 */
export function getPromptTokenCount(prompt, model = DEFAULT_MODEL) {
	if (!prompt || typeof prompt !== 'string') {
		return 0;
	}

	const encoding = getEncodingForModel(model);

	if (!encoding) {
		return Math.ceil(prompt.length / 4);
	}

	try {
		return encoding.encode(prompt).length;
	} catch (error) {
		console.warn(`Failed to get exact token count: ${error.message}`);

		return Math.ceil(prompt.length / 4);
	}
}
