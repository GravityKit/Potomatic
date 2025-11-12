/**
 * XML Translation with Dictionary tests
 */

import { describe, it, expect } from 'vitest';
import { buildXmlPrompt, parseXmlResponse, buildDictionaryResponse } from '../../src/utils/xmlTranslation.js';

describe('XML Translation with Dictionary', () => {
	const mockLogger = {
		warn: () => {},
		debug: () => {},
	};

	describe('buildXmlPrompt with dictionary', () => {
		it('should build prompt without dictionary when none provided', () => {
			const batch = [{ msgid: 'Hello' }, { msgid: 'Goodbye' }];

			const result = buildXmlPrompt(batch, 'fr_FR', 1);

			expect(result.xmlPrompt).toContain('Translate to French');
			expect(result.xmlPrompt).toContain('<source i="1">Hello</source>');
			expect(result.xmlPrompt).toContain('<source i="2">Goodbye</source>');
			expect(result.dictionaryCount).toBe(0);
			expect(result.metadata.hasDictionary).toBe(false);
		});

		it('should include dictionary examples before translation strings', () => {
			const batch = [{ msgid: 'Hello World' }, { msgid: 'Save changes' }];

			const dictionaryMatches = [
				{ source: 'Hello', target: 'Bonjour' },
				{ source: 'Save', target: 'Enregistrer' },
			];

			const result = buildXmlPrompt(batch, 'fr_FR', 1, dictionaryMatches);

			// Should contain dictionary section
			expect(result.xmlPrompt).toContain('<!-- Dictionary Examples for Consistency -->');
			expect(result.xmlPrompt).toContain('<source i="1">Hello</source>');
			expect(result.xmlPrompt).toContain('<source i="2">Save</source>');
			expect(result.xmlPrompt).toContain('<!-- End Dictionary Examples -->');

			// Should contain actual strings starting after dictionary
			expect(result.xmlPrompt).toContain('<source i="3">Hello World</source>');
			expect(result.xmlPrompt).toContain('<source i="4">Save changes</source>');

			expect(result.dictionaryCount).toBe(2);
			expect(result.metadata.hasDictionary).toBe(true);
			expect(result.metadata.batchStartIndex).toBe(3);
		});

		it('should handle plural forms with dictionary', () => {
			const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];

			const dictionaryMatches = [{ source: 'item', target: 'élément' }];

			const result = buildXmlPrompt(batch, 'fr_FR', 2, dictionaryMatches);

			expect(result.xmlPrompt).toContain('<source i="1">item</source>');
			expect(result.xmlPrompt).toContain('<singular>One item</singular>');
			expect(result.xmlPrompt).toContain('<plural>%d items</plural>');
			expect(result.xmlPrompt).toContain('For entries with <singular> and <plural> tags, provide 2 translations');
		});

		it('should escape XML in dictionary terms', () => {
			const batch = [{ msgid: 'Test message' }];

			const dictionaryMatches = [
				{ source: 'XML & HTML', target: 'XML et HTML' },
				{ source: 'Text with "quotes"', target: 'Texte avec « guillemets »' },
			];

			const result = buildXmlPrompt(batch, 'fr_FR', 1, dictionaryMatches);

			expect(result.xmlPrompt).toContain('XML &amp; HTML');
			expect(result.xmlPrompt).toContain('Text with &quot;quotes&quot;');
		});
	});

	describe('buildDictionaryResponse', () => {
		it('should build correct dictionary response format', () => {
			const dictionaryMatches = [
				{ source: 'Login', target: 'Connexion' },
				{ source: 'Logout', target: 'Déconnexion' },
			];

			const response = buildDictionaryResponse(dictionaryMatches);

			expect(response).toBe('<t i="1">Connexion</t>\n<t i="2">Déconnexion</t>');
		});

		it('should handle empty dictionary matches', () => {
			const response = buildDictionaryResponse([]);
			expect(response).toBe('');
		});

		it('should escape XML in dictionary targets', () => {
			const dictionaryMatches = [{ source: 'XML', target: 'XML & HTML' }];

			const response = buildDictionaryResponse(dictionaryMatches);
			expect(response).toContain('XML &amp; HTML');
		});
	});

	describe('parseXmlResponse with dictionary', () => {
		it('should parse response without dictionary correctly', () => {
			const batch = [{ msgid: 'Hello' }, { msgid: 'Goodbye' }];

			const xmlResponse = `
				<t i="1">Bonjour</t>
				<t i="2">Au revoir</t>
			`;

			const result = parseXmlResponse(xmlResponse, batch, 1, mockLogger, 0);

			expect(result.translations).toEqual([
				{ msgid: 'Hello', msgstr: ['Bonjour'] },
				{ msgid: 'Goodbye', msgstr: ['Au revoir'] },
			]);
		});

		it('should skip dictionary indices in response', () => {
			const batch = [{ msgid: 'Hello World' }, { msgid: 'Save changes' }];

			// Response includes dictionary examples (indices 1-2) and translations (indices 3-4)
			const xmlResponse = `
				<t i="1">Bonjour</t>
				<t i="2">Enregistrer</t>
				<t i="3">Bonjour le monde</t>
				<t i="4">Enregistrer les modifications</t>
			`;

			const result = parseXmlResponse(xmlResponse, batch, 1, mockLogger, 2);

			// Should only use indices 3-4 for actual translations
			expect(result.translations).toEqual([
				{ msgid: 'Hello World', msgstr: ['Bonjour le monde'] },
				{ msgid: 'Save changes', msgstr: ['Enregistrer les modifications'] },
			]);
		});

		it('should handle plural forms with dictionary offset', () => {
			const batch = [{ msgid: 'One item', msgid_plural: '%d items' }];

			const xmlResponse = `
				<t i="1">élément</t>
				<t i="2"><f0>Un élément</f0><f1>%d éléments</f1></t>
			`;

			const result = parseXmlResponse(xmlResponse, batch, 2, mockLogger, 1);

			expect(result.translations).toEqual([{ msgid: 'One item', msgstr: ['Un élément', '%d éléments'] }]);
		});

		it('should handle missing dictionary responses gracefully', () => {
			const batch = [{ msgid: 'Hello' }];

			// Response with only translation, no dictionary
			const xmlResponse = `<t i="2">Bonjour</t>`;

			const result = parseXmlResponse(xmlResponse, batch, 1, mockLogger, 1);

			expect(result.translations).toEqual([{ msgid: 'Hello', msgstr: ['Bonjour'] }]);
		});

		it('should handle mixed response with some missing translations', () => {
			const batch = [{ msgid: 'First' }, { msgid: 'Second' }, { msgid: 'Third' }];

			// Dictionary entry + partial translations
			const xmlResponse = `
				<t i="1">Premier</t>
				<t i="2">Premier message</t>
				<t i="4">Troisième message</t>
			`;

			const result = parseXmlResponse(xmlResponse, batch, 1, mockLogger, 1);

			expect(result.translations).toEqual([
				{ msgid: 'First', msgstr: ['Premier message'] },
				{ msgid: 'Second', msgstr: [''] }, // Missing
				{ msgid: 'Third', msgstr: ['Troisième message'] },
			]);
		});

		it('should warn about invalid indices outside batch range', () => {
			const batch = [{ msgid: 'Test' }];

			const xmlResponse = `
				<t i="1">Dict</t>
				<t i="5">Invalid index</t>
			`;

			const warnings = [];
			const logger = {
				warn: (msg) => warnings.push(msg),
			};

			const result = parseXmlResponse(xmlResponse, batch, 1, logger, 1);

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('Invalid batch index');
			expect(result.translations).toEqual([{ msgid: 'Test', msgstr: [''] }]);
		});
	});

	describe('integration scenarios', () => {
		it('should handle complete dictionary-enhanced workflow', () => {
			const batch = [{ msgid: 'Login to dashboard' }, { msgid: 'User settings panel' }];

			const dictionaryMatches = [
				{ source: 'Login', target: 'Connexion' },
				{ source: 'Dashboard', target: 'Tableau de bord' },
			];

			// 1. Build prompt with dictionary
			const promptResult = buildXmlPrompt(batch, 'fr_FR', 1, dictionaryMatches);

			expect(promptResult.dictionaryCount).toBe(2);
			expect(promptResult.xmlPrompt).toContain('<source i="1">Login</source>');
			expect(promptResult.xmlPrompt).toContain('<source i="3">Login to dashboard</source>');

			// 2. Build expected dictionary response
			const dictResponse = buildDictionaryResponse(dictionaryMatches);
			expect(dictResponse).toBe('<t i="1">Connexion</t>\n<t i="2">Tableau de bord</t>');

			// 3. Parse complete AI response
			const aiResponse = `
				<t i="1">Connexion</t>
				<t i="2">Tableau de bord</t>
				<t i="3">Se connecter au tableau de bord</t>
				<t i="4">Panneau des paramètres utilisateur</t>
			`;

			const parsed = parseXmlResponse(aiResponse, batch, 1, mockLogger, 2);

			expect(parsed.translations).toEqual([
				{ msgid: 'Login to dashboard', msgstr: ['Se connecter au tableau de bord'] },
				{ msgid: 'User settings panel', msgstr: ['Panneau des paramètres utilisateur'] },
			]);
		});
	});
});
