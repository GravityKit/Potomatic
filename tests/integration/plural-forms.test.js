import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAIProvider } from '../../src/providers/openai/OpenAIProvider.js';
import { createLogger } from '../../src/logging/index.js';
import { compilePoFile } from '../../src/utils/poFileUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Integration tests for plural forms functionality.
 * Tests the complete workflow from POT file with placeholders to final PO file with proper plural forms.
 *
 * @since 1.0.0
 */
describe('Plural Forms Integration Tests', () => {
	let tempDir;
	let logger;
	let provider;

	beforeEach(() => {
		// Create temporary directory for test files.
		tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
		logger = createLogger({ level: 'error' }); // Suppress logs during tests

		// Create OpenAI provider with mock config.
		const config = {
			apiKey: 'test-key',
			baseURL: 'https://api.openai.com/v1',
			model: 'gpt-3.5-turbo',
		};
		provider = new OpenAIProvider(config, logger);
	});

	afterEach(() => {
		// Clean up temporary directory.
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('should parse Arabic plural forms correctly', () => {
		const batch = [
			{
				msgid: 'You can only select %d item',
				msgid_plural: 'You can only select %d items',
				isPlural: true,
			},
		];

		// Mock API response with 6 Arabic plural forms in XML format.
		const apiResponse = `<t i="1">
<f0>يمكنك اختيار عنصر واحد فقط</f0>
<f1>يمكنك اختيار عنصرين فقط</f1>
<f2>يمكنك اختيار %d عناصر فقط</f2>
<f3>يمكنك اختيار %d عناصر فقط</f3>
<f4>يمكنك اختيار %d عنصراً فقط</f4>
<f5>يمكنك اختيار %d عنصر فقط</f5>
</t>`;

		const result = provider._parseApiResponse(apiResponse, batch, 6);

		expect(result.translations).toHaveLength(1);
		expect(result.translations[0].msgid).toBe('You can only select %d item');
		expect(result.translations[0].msgstr).toHaveLength(6);
		expect(result.translations[0].msgstr[0]).toBe('يمكنك اختيار عنصر واحد فقط');
		expect(result.translations[0].msgstr[5]).toBe('يمكنك اختيار %d عنصر فقط');
	});

	it('should parse Polish plural forms correctly', () => {
		const batch = [
			{
				msgid: 'You can only select %d item',
				msgid_plural: 'You can only select %d items',
				isPlural: true,
			},
		];

		// Mock API response with 3 Polish plural forms in XML format.
		const apiResponse = `<t i="1">
<f0>Możesz wybrać tylko %d element</f0>
<f1>Możesz wybrać tylko %d elementy</f1>
<f2>Możesz wybrać tylko %d elementów</f2>
</t>`;

		const result = provider._parseApiResponse(apiResponse, batch, 3);

		expect(result.translations).toHaveLength(1);
		expect(result.translations[0].msgid).toBe('You can only select %d item');
		expect(result.translations[0].msgstr).toHaveLength(3);
		expect(result.translations[0].msgstr[0]).toBe('Możesz wybrać tylko %d element');
		expect(result.translations[0].msgstr[2]).toBe('Możesz wybrać tylko %d elementów');
	});

	it('should parse Chinese singular form correctly', () => {
		const batch = [
			{
				msgid: 'You can only select %d item',
				msgid_plural: 'You can only select %d items',
				isPlural: true,
			},
		];

		// Mock API response with 1 Chinese form (no plural distinction) in XML format.
		const apiResponse = `<t i="1">
<f0>您只能选择 %d 个项目</f0>
</t>`;

		const result = provider._parseApiResponse(apiResponse, batch, 1);

		expect(result.translations).toHaveLength(1);
		expect(result.translations[0].msgid).toBe('You can only select %d item');
		expect(result.translations[0].msgstr).toHaveLength(1);
		expect(result.translations[0].msgstr[0]).toBe('您只能选择 %d 个项目');
	});

	it('should replace placeholder headers with proper plural forms', async () => {
		// Create mock POT data with placeholder header.
		const mockPotData = {
			charset: 'UTF-8',
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Plural-Forms': 'nplurals=INTEGER; plural=EXPRESSION;',
			},
			translations: {
				'': {
					'You can only select %d item': {
						msgid: 'You can only select %d item',
						msgid_plural: 'You can only select %d items',
						msgstr: ['', ''],
					},
				},
			},
		};

		// Test Arabic plural forms replacement.
		const outputPath = path.join(tempDir, 'test-ar.po');
		await compilePoFile(mockPotData, 'ar', outputPath, logger);

		// Read the compiled file and check header.
		const compiledContent = fs.readFileSync(outputPath, 'utf8');
		expect(compiledContent).toContain('nplurals=6');
		expect(compiledContent).toContain('n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3');
		expect(compiledContent).toContain('n%100<=10 ? 3 : n%100>=11 ? 4 : 5');
	});

	it('should preserve existing proper plural forms headers', async () => {
		// Create mock POT data with existing proper header.
		const mockPotData = {
			charset: 'UTF-8',
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Plural-Forms': 'nplurals=2; plural=(n > 1);', // French plural form
			},
			translations: {
				'': {
					'You can only select %d item': {
						msgid: 'You can only select %d item',
						msgid_plural: 'You can only select %d items',
						msgstr: ['', ''],
					},
				},
			},
		};

		// Test that existing header is preserved.
		const outputPath = path.join(tempDir, 'test-fr.po');
		await compilePoFile(mockPotData, 'fr_FR', outputPath, logger);

		// Read the compiled file and check header is preserved.
		const compiledContent = fs.readFileSync(outputPath, 'utf8');
		expect(compiledContent).toContain('nplurals=2; plural=(n > 1);');
	});
});
