/**
 * OpenAI Provider with Dictionary Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { MockOpenAIClient, createSuccessResponse } from '../helpers/mock-openai-client.js';
import { createTempDir, cleanupTempDir } from '../helpers/temp-files.js';

describe('OpenAI Provider with Dictionary Integration', () => {
	let provider;
	let mockClient;
	let tempDictDir;
	let mockLogger;

	beforeEach(async () => {
		tempDictDir = await createTempDir();
		mockClient = new MockOpenAIClient();

		mockLogger = {
			debug: () => {},
			warn: () => {},
			info: () => {},
			error: () => {},
		};

		const config = {
			model: 'gpt-4o-mini',
			temperature: 0.7,
			useDictionary: true,
			dictionaryPath: tempDictDir,
		};

		provider = new OpenAIProvider(config, mockLogger);
		provider.client = mockClient;
	});

	afterEach(async () => {
		await cleanupTempDir(tempDictDir);
	});

	it('should translate batch without dictionary when none exists', async () => {
		const batch = [{ msgid: 'Hello' }, { msgid: 'Goodbye' }];

		// Mock API response without dictionary
		const translations = ['Bonjour', 'Au revoir'];
		mockClient.queueResponse(createSuccessResponse(translations));

		const result = await provider.translateBatch(batch, 'fr_FR', 'gpt-4o-mini', 'Translate to French', 3, 1000, 60, false, null, null, 1);

		expect(result.success).toBe(true);
		expect(result.translations).toHaveLength(2);
		expect(result.translations[0].msgstr).toEqual(['Bonjour']);
		expect(result.translations[1].msgstr).toEqual(['Au revoir']);

		// Verify request content
		const lastRequest = mockClient.getLastRequest();
		expect(lastRequest.messages).toHaveLength(2); // System + user only
		expect(lastRequest.messages[1].content).toContain('<source i="1">Hello</source>');
		expect(lastRequest.messages[1].content).toContain('<source i="2">Goodbye</source>');
	});

	it('should include dictionary examples when matches found', async () => {
		// Create dictionary file
		const dictionaryPath = path.join(tempDictDir, 'dictionary.json');
		const dictionary = {
			hello: 'Bonjour',
			login: 'Connexion',
			dashboard: 'Tableau de bord',
		};
		fs.writeFileSync(dictionaryPath, JSON.stringify(dictionary));

		const batch = [{ msgid: 'Hello World' }, { msgid: 'Login to dashboard' }, { msgid: 'Save changes' }];

		// Mock AI response with dictionary examples first, then actual translations
		const aiResponse = `<t i="1">Bonjour</t>
<t i="2">Connexion</t>
<t i="3">Tableau de bord</t>
<t i="4">Bonjour le monde</t>
<t i="5">Se connecter au tableau de bord</t>
<t i="6">Enregistrer les modifications</t>`;

		mockClient.queueResponse({
			choices: [{ message: { content: aiResponse } }],
			usage: { prompt_tokens: 200, completion_tokens: 120, total_tokens: 320 },
		});

		const result = await provider.translateBatch(batch, 'fr_FR', 'gpt-4o-mini', 'Translate to French', 3, 1000, 60, false, null, null, 1);

		expect(result.success).toBe(true);
		expect(result.translations).toHaveLength(3);
		expect(result.translations[0].msgstr).toEqual(['Bonjour le monde']);
		expect(result.translations[1].msgstr).toEqual(['Se connecter au tableau de bord']);
		expect(result.translations[2].msgstr).toEqual(['Enregistrer les modifications']);

		// Verify request includes dictionary examples
		const lastRequest = mockClient.getLastRequest();
		expect(lastRequest.messages).toHaveLength(4); // System + user + assistant + user

		// First user message should include dictionary examples
		const promptMessage = lastRequest.messages[1].content;
		expect(promptMessage).toContain('<!-- Dictionary Examples for Consistency -->');
		expect(promptMessage).toContain('<source i="1">hello</source>');
		expect(promptMessage).toContain('<source i="2">login</source>');
		expect(promptMessage).toContain('<source i="3">dashboard</source>');

		// And actual strings with offset indices
		expect(promptMessage).toContain('<source i="4">Hello World</source>');
		expect(promptMessage).toContain('<source i="5">Login to dashboard</source>');
	});

	it('should handle dry run with dictionary cost calculation', async () => {
		// Create dictionary file
		const dictionaryPath = path.join(tempDictDir, 'dictionary.json');
		const dictionary = {
			login: 'Connexion',
			settings: 'Paramètres',
		};
		fs.writeFileSync(dictionaryPath, JSON.stringify(dictionary));

		const batch = [{ msgid: 'Login required' }, { msgid: 'User settings panel' }];

		const result = await provider.translateBatch(
			batch,
			'fr_FR',
			'gpt-4o-mini',
			'Translate to French',
			3,
			1000,
			60,
			true, // Dry run
			null,
			null,
			1
		);

		expect(result.isDryRun).toBe(true);
		expect(result.cost.totalCost).toBeGreaterThan(0);
		expect(result.cost.dictionaryCount).toBe(2);

		// Translations should be dry run format
		expect(result.translations[0].msgstr[0]).toContain('[DRY RUN]');
		expect(result.translations[1].msgstr[0]).toContain('[DRY RUN]');
	});

	it('should fallback to language-specific dictionary', async () => {
		// Create specific and base dictionaries
		const specificPath = path.join(tempDictDir, 'dictionary-fr-ca.json');
		const basePath = path.join(tempDictDir, 'dictionary-fr.json');

		fs.writeFileSync(specificPath, JSON.stringify({ login: 'Connexion (CA)' }));
		fs.writeFileSync(basePath, JSON.stringify({ login: 'Connexion (FR)' }));

		const batch = [{ msgid: 'Login here' }];

		mockClient.queueResponse(createSuccessResponse(['Expected response']));

		await provider.translateBatch(batch, 'fr_CA', 'gpt-4o-mini', 'Translate to French', 3, 1000, 60, false, null, null, 1);

		// Should use the specific CA dictionary
		const lastRequest = mockClient.getLastRequest();
		const promptMessage = lastRequest.messages[1].content;
		expect(promptMessage).toContain('<source i="1">login</source>');

		const assistantMessage = lastRequest.messages[2].content;
		expect(assistantMessage).toContain('Connexion (CA)');
	});

	it('should handle disabled dictionary configuration', async () => {
		// Reconfigure provider with dictionary disabled
		provider.config.useDictionary = false;

		const batch = [{ msgid: 'Hello' }];
		mockClient.queueResponse(createSuccessResponse(['Bonjour']));

		const result = await provider.translateBatch(batch, 'fr_FR', 'gpt-4o-mini', 'Translate to French', 3, 1000, 60, false, null, null, 1);

		expect(result.success).toBe(true);

		// Should not include dictionary examples
		const lastRequest = mockClient.getLastRequest();
		expect(lastRequest.messages).toHaveLength(2); // Only system + user
		expect(lastRequest.messages[1].content).not.toContain('Dictionary Examples');
	});

	it('should handle plural forms with dictionary', async () => {
		// Create dictionary
		const dictionaryPath = path.join(tempDictDir, 'dictionary.json');
		fs.writeFileSync(dictionaryPath, JSON.stringify({ item: 'élément' }));

		const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];

		const aiResponse = `<t i="1">élément</t>
<t i="2"><f0>Un élément</f0><f1>%d éléments</f1></t>`;

		mockClient.queueResponse({
			choices: [{ message: { content: aiResponse } }],
			usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 },
		});

		const result = await provider.translateBatch(
			batch,
			'fr_FR',
			'gpt-4o-mini',
			'Translate to French',
			3,
			1000,
			60,
			false,
			null,
			null,
			2 // Plural count
		);

		expect(result.success).toBe(true);
		expect(result.translations[0].msgstr).toEqual(['Un élément', '%d éléments']);

		// Verify prompt includes dictionary and plural instructions
		const lastRequest = mockClient.getLastRequest();
		const promptMessage = lastRequest.messages[1].content;
		expect(promptMessage).toContain('<source i="1">item</source>');
		expect(promptMessage).toContain('<singular>One item</singular>');
		expect(promptMessage).toContain('<plural>%d items</plural>');
		expect(promptMessage).toContain('For entries with <singular> and <plural> tags, provide 2 translations');
	});

	it('should handle API errors gracefully with dictionary', async () => {
		// Create dictionary
		const dictionaryPath = path.join(tempDictDir, 'dictionary.json');
		fs.writeFileSync(dictionaryPath, JSON.stringify({ login: 'Connexion' }));

		const batch = [{ msgid: 'Login here' }];

		// Queue API error
		mockClient.queueError({ status: 500, message: 'Server error' });

		const result = await provider.translateBatch(
			batch,
			'fr_FR',
			'gpt-4o-mini',
			'Translate to French',
			0, // No retries
			1000,
			60,
			false,
			null,
			null,
			1
		);

		expect(result.success).toBe(false);
		expect(result.translations).toEqual([]); // Failed requests return empty array
	});
});
