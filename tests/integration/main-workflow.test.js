import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { parsePotFile, countUntranslatedStrings, mergePoData, compilePoFile } from '../../src/utils/poFileUtils.js';
import { createLogger } from '../../src/logging/index.js';

describe('Main Translation Workflow', () => {
	let tempDir;
	let logger;

	beforeEach(async () => {
		tempDir = path.join(process.cwd(), 'tests', 'temp', `workflow-test-${Date.now()}`);
		await fs.mkdir(tempDir, { recursive: true });
		logger = createLogger(0); // Silent logger for tests
	});

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	describe('POT File Loading and Parsing', () => {
		it('should load and parse a POT file correctly', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);
			const stringCount = countUntranslatedStrings(potData);

			expect(stringCount).toBe(5);
			expect(potData.translations['']).toBeDefined();
			expect(potData.translations['']['Hello World']).toBeDefined();
			expect(potData.translations[''].Save).toBeDefined();
		});

		it('should identify strings that need translation', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);
			const translations = potData.translations[''];

			// All strings should have empty msgstr (need translation)
			expect(translations['Hello World'].msgstr).toEqual(['']);
			expect(translations.Save.msgstr).toEqual(['']);
			expect(translations.Cancel.msgstr).toEqual(['']);
		});
	});

	describe('Existing Translation Merging', () => {
		it('should merge existing translations with POT data', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			const existingPoFile = path.join(tempDir, 'existing.po');

			await fs.copyFile('tests/data/simple.pot', potFile);
			await fs.copyFile('tests/data/existing-fr_FR.po', existingPoFile);

			const potData = await parsePotFile(potFile, logger);
			const existingPoData = await parsePotFile(existingPoFile, logger);

			const { outputPoData, mergedStringsCount } = mergePoData(potData, existingPoData, logger);

			expect(mergedStringsCount).toBe(2); // "Hello World" and "Welcome" are translated
			expect(outputPoData.translations['']['Hello World'].msgstr[0]).toBe('Bonjour le monde');
			expect(outputPoData.translations['']['Welcome to our application'].msgstr[0]).toBe('Bienvenue dans notre application');

			// Untranslated strings should remain empty
			expect(outputPoData.translations[''].Save.msgstr[0]).toBe('');
			expect(outputPoData.translations[''].Cancel.msgstr[0]).toBe('');
		});

		it('should handle case when no existing PO file exists', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);
			// Create empty PO data structure for null case
			const emptyPoData = { translations: {}, headers: {} };
			const { outputPoData, mergedStringsCount } = mergePoData(potData, emptyPoData, logger);

			expect(mergedStringsCount).toBe(0);
			expect(outputPoData.translations).toEqual(potData.translations);
		});
	});

	describe('PO File Compilation and Output', () => {
		it('should compile and save PO file with correct structure', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			const outputFile = path.join(tempDir, 'output.po');

			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);

			// Simulate some translations
			potData.translations['']['Hello World'].msgstr = ['Bonjour le monde'];
			potData.translations[''].Save.msgstr = ['Enregistrer'];

			const success = await compilePoFile(potData, 'fr_FR', outputFile, logger);
			expect(success).toBe(true);

			// Verify file was created
			const fileExists = await fs
				.access(outputFile)
				.then(() => true)
				.catch(() => false);
			expect(fileExists).toBe(true);

			// Verify content
			const content = await fs.readFile(outputFile, 'utf-8');
			expect(content).toContain('msgstr "Bonjour le monde"');
			expect(content).toContain('msgstr "Enregistrer"');
			expect(content).toContain('Language: fr-FR'); // Note: function converts fr_FR to fr-FR
		});

		it('should preserve comments and metadata', async () => {
			const potFile = path.join(tempDir, 'test.pot');
			const outputFile = path.join(tempDir, 'output.po');

			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);
			await compilePoFile(potData, 'fr_FR', outputFile, logger);

			const content = await fs.readFile(outputFile, 'utf-8');

			// Should preserve source references
			expect(content).toContain('#: src/example.js:10');
			expect(content).toContain('#: src/example.js:30');

			// Should preserve translator comments
			expect(content).toContain('#. Translators: This is a button label');
		});
	});

	describe('Complete Workflow Simulation', () => {
		it('should simulate complete translation workflow', async () => {
			// Step 1: Load POT file
			const potFile = path.join(tempDir, 'test.pot');
			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);
			const totalStrings = countUntranslatedStrings(potData);
			expect(totalStrings).toBe(5);

			// Step 2: Check for existing PO file (none exists)
			const emptyPoData = { translations: {}, headers: {} };
			const { outputPoData, mergedStringsCount } = mergePoData(potData, emptyPoData, logger);
			expect(mergedStringsCount).toBe(0);

			// Step 3: Simulate translation of remaining strings
			const finalPoData = JSON.parse(JSON.stringify(outputPoData));
			finalPoData.translations['']['Hello World'].msgstr = ['Bonjour le monde'];
			finalPoData.translations['']['Welcome to our application'].msgstr = ['Bienvenue dans notre application'];
			finalPoData.translations[''].Save.msgstr = ['Enregistrer'];
			finalPoData.translations[''].Cancel.msgstr = ['Annuler'];
			finalPoData.translations[''].Delete.msgstr = ['Supprimer'];

			// Step 4: Save final PO file
			const outputFile = path.join(tempDir, 'fr_FR.po');
			const success = await compilePoFile(finalPoData, 'fr_FR', outputFile, logger);
			expect(success).toBe(true);

			// Step 5: Verify results
			const fileExists = await fs
				.access(outputFile)
				.then(() => true)
				.catch(() => false);
			expect(fileExists).toBe(true);

			const content = await fs.readFile(outputFile, 'utf-8');
			expect(content).toContain('msgstr "Bonjour le monde"');
			expect(content).toContain('msgstr "Enregistrer"');
			expect(content).toContain('Language: fr-FR');

			// Verify all original strings are present
			expect(content).toContain('msgid "Hello World"');
			expect(content).toContain('msgid "Save"');
			expect(content).toContain('msgid "Cancel"');
		});

		it('should handle workflow with existing translations', async () => {
			// Step 1: Load POT file
			const potFile = path.join(tempDir, 'test.pot');
			await fs.copyFile('tests/data/simple.pot', potFile);

			const potData = await parsePotFile(potFile, logger);

			// Step 2: Load existing PO file
			const existingPoFile = path.join(tempDir, 'existing.po');
			await fs.copyFile('tests/data/existing-fr_FR.po', existingPoFile);

			const existingPoData = await parsePotFile(existingPoFile, logger);

			// Step 3: Merge existing translations
			const { outputPoData, mergedStringsCount } = mergePoData(potData, existingPoData, logger);
			expect(mergedStringsCount).toBe(2);

			// Step 4: Translate remaining strings (3 left)
			const finalPoData = JSON.parse(JSON.stringify(outputPoData));
			finalPoData.translations[''].Save.msgstr = ['Enregistrer'];
			finalPoData.translations[''].Cancel.msgstr = ['Annuler'];
			finalPoData.translations[''].Delete.msgstr = ['Supprimer'];

			// Step 5: Save final PO file
			const outputFile = path.join(tempDir, 'fr_FR.po');
			const success = await compilePoFile(finalPoData, 'fr_FR', outputFile, logger);
			expect(success).toBe(true);

			// Step 6: Verify results
			const content = await fs.readFile(outputFile, 'utf-8');

			// Should have existing translations
			expect(content).toContain('msgstr "Bonjour le monde"');
			expect(content).toContain('msgstr "Bienvenue dans notre application"');

			// Should have new translations
			expect(content).toContain('msgstr "Enregistrer"');
			expect(content).toContain('msgstr "Annuler"');
			expect(content).toContain('msgstr "Supprimer"');
		});

		it('should prevent infinite re-translation with contextual duplicates', async () => {
			// Create POT with duplicate msgids in different contexts
			const potContent = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

#: test.php:1
msgid "[product] logo"
msgstr ""

#: test.php:2
msgctxt "Placeholders inside [] are not to be translated."
msgid "[product] logo"
msgstr ""
`;

			const potFile = path.join(tempDir, 'context-test.pot');
			await fs.writeFile(potFile, potContent);

			// First translation run - simulate translating the contextual entry
			const potData = await parsePotFile(potFile, logger);

			// Simulate translation applied to contextual entry only
			potData.translations['Placeholders inside [] are not to be translated.']['[product] logo'].msgstr = ['logo de [product]'];

			// Save as PO file
			const poFile = path.join(tempDir, 'test.po');
			await compilePoFile(potData, 'es_ES', poFile, logger);

			// Second run - merge existing and check for re-translation needs
			const potData2 = await parsePotFile(potFile, logger);
			const existingPoData = await parsePotFile(poFile, logger);

			const { outputPoData, mergedStringsCount } = mergePoData(potData2, existingPoData, logger);

			// Should have merged 1 translation (the contextual one)
			expect(mergedStringsCount).toBe(1);

			// The contextual entry should be translated
			expect(outputPoData.translations['Placeholders inside [] are not to be translated.']['[product] logo'].msgstr[0]).toBe('logo de [product]');

			// The non-contextual entry should still be untranslated
			expect(outputPoData.translations['']['[product] logo'].msgstr[0]).toBe('');

			// Count remaining untranslated - should be 1 (the non-contextual entry)
			const remainingUntranslated = countUntranslatedStrings(outputPoData);
			expect(remainingUntranslated).toBe(1);
		});
	});
});
