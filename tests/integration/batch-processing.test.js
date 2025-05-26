import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prepareBatches } from '../../src/processors/batchProcessor.js';
import { createLogger } from '../../src/logging/index.js';
import { createTempDir, copyTestFile, cleanupTempDir, readFile, createTempFile } from '../helpers/temp-files.js';
import { po } from 'gettext-parser';

describe('Batch Processing Integration', () => {
	let tempDir;
	let logger;

	beforeEach(async () => {
		tempDir = await createTempDir();
		logger = createLogger(0); // Silent logger for tests
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
	});

	describe('Basic Batch Creation', () => {
		it('should create correct batches from simple POT file', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batchSize = 2;
			const batches = prepareBatches(parsedPot, batchSize, logger);

			// Should create 3 batches: [2, 2, 1] strings
			expect(batches).toHaveLength(3);
			expect(batches[0]).toHaveLength(2);
			expect(batches[1]).toHaveLength(2);
			expect(batches[2]).toHaveLength(1);

			// Verify batch content structure
			batches.forEach((batch) => {
				batch.forEach((item) => {
					expect(item).toHaveProperty('msgid');
					expect(item).toHaveProperty('extractedComments');
					expect(item).toHaveProperty('comments');
					expect(item).toHaveProperty('references');
					expect(typeof item.msgid).toBe('string');
					expect(item.msgid).not.toBe(''); // Should not include header
				});
			});
		});

		it('should create single batch when batch size exceeds string count', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batchSize = 100; // Much larger than 5 strings
			const batches = prepareBatches(parsedPot, batchSize, logger);

			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(5); // All strings from simple.pot
		});

		it('should handle batch size of 1 (individual strings)', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batchSize = 1;
			const batches = prepareBatches(parsedPot, batchSize, logger);

			expect(batches).toHaveLength(5); // One batch per string
			batches.forEach((batch) => {
				expect(batch).toHaveLength(1);
			});
		});
	});

	describe('Complex POT File Processing', () => {
		it('should handle complex POT file with various string types', async () => {
			const potFile = await copyTestFile('complex.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batchSize = 5;
			const batches = prepareBatches(parsedPot, batchSize, logger);

			expect(batches.length).toBeGreaterThan(1);

			// Verify all batches contain valid items
			let totalItems = 0;
			batches.forEach((batch) => {
				expect(batch.length).toBeGreaterThan(0);
				expect(batch.length).toBeLessThanOrEqual(batchSize);
				totalItems += batch.length;

				batch.forEach((item) => {
					expect(item.msgid).toBeTruthy();
					expect(typeof item.msgid).toBe('string');
					expect(item.msgid).not.toBe(''); // No empty strings
				});
			});

			// Verify total count matches expected
			const expectedCount = Object.keys(parsedPot.translations['']).filter((key) => key !== '').length;
			expect(totalItems).toBe(expectedCount);
		});

		it('should preserve extracted comments and references', async () => {
			const potFile = await copyTestFile('complex.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batches = prepareBatches(parsedPot, 10, logger);

			// Find items with extracted comments
			let foundExtractedComment = false;
			let foundReference = false;

			batches.forEach((batch) => {
				batch.forEach((item) => {
					if (item.extractedComments && item.extractedComments.length > 0) {
						foundExtractedComment = true;
						expect(typeof item.extractedComments).toBe('string');
					}

					if (item.references && item.references.length > 0) {
						foundReference = true;
						expect(Array.isArray(item.references)).toBe(true);
					}
				});
			});

			// Complex.pot should have some comments and references
			expect(foundExtractedComment).toBe(true);
			expect(foundReference).toBe(true);
		});
	});

	describe('String Limits', () => {
		it('should respect maxStrings parameter', async () => {
			const potFile = await copyTestFile('complex.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const maxStrings = 7;
			const batchSize = 3;
			const batches = prepareBatches(parsedPot, batchSize, logger, maxStrings);

			const totalStrings = batches.reduce((sum, batch) => sum + batch.length, 0);
			expect(totalStrings).toBe(maxStrings);

			// Should create 3 batches: [3, 3, 1]
			expect(batches).toHaveLength(3);
			expect(batches[0]).toHaveLength(3);
			expect(batches[1]).toHaveLength(3);
			expect(batches[2]).toHaveLength(1);
		});

		it('should handle maxStrings smaller than batch size', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const maxStrings = 2;
			const batchSize = 5;
			const batches = prepareBatches(parsedPot, batchSize, logger, maxStrings);

			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(2);
		});

		it('should handle maxStrings of 0', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const maxStrings = 0;
			const batches = prepareBatches(parsedPot, 5, logger, maxStrings);

			expect(batches).toHaveLength(0);
		});

		it('should handle maxStrings larger than available strings', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const maxStrings = 100; // More than the 5 strings in simple.pot
			const batches = prepareBatches(parsedPot, 3, logger, maxStrings);

			const totalStrings = batches.reduce((sum, batch) => sum + batch.length, 0);
			expect(totalStrings).toBe(5); // Should process all available strings
		});
	});

	describe('Edge Cases and Error Handling', () => {
		it('should handle empty POT file', async () => {
			const emptyPotContent = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
`;
			const potFile = await createTempFile(tempDir, 'empty.pot', emptyPotContent);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batches = prepareBatches(parsedPot, 5, logger);
			expect(batches).toHaveLength(0);
		});

		it('should handle POT file with only header', async () => {
			const headerOnlyContent = `
msgid ""
msgstr ""
"Project-Id-Version: Test\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
`;
			const potFile = await createTempFile(tempDir, 'header-only.pot', headerOnlyContent);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batches = prepareBatches(parsedPot, 5, logger);
			expect(batches).toHaveLength(0);
		});

		it('should handle malformed POT data gracefully', () => {
			const malformedData = { translations: null };
			const batches = prepareBatches(malformedData, 5, logger);
			expect(batches).toHaveLength(0);
		});

		it('should handle missing translations object', () => {
			const invalidData = {};
			const batches = prepareBatches(invalidData, 5, logger);
			expect(batches).toHaveLength(0);
		});

		it('should handle POT with invalid context data', () => {
			const invalidPot = {
				translations: {
					'': {
						'': { msgstr: [''] }, // Header
						'Valid string': { msgstr: [''] },
						invalid: null, // Invalid entry
						'another valid': { msgstr: [''] },
					},
				},
			};

			const batches = prepareBatches(invalidPot, 5, logger);
			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(2); // Should skip invalid entry
		});

		it('should preserve context information for duplicate msgids', async () => {
			// Create POT content with duplicate msgids in different contexts
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

#: test.php:3
msgid "Save"
msgstr ""
`;
			const parsedPot = po.parse(potContent);

			const batches = prepareBatches(parsedPot, 10, logger);
			const firstBatch = batches[0];

			// Should have 3 entries: two "[product] logo" with different contexts, and "Save"
			expect(firstBatch).toHaveLength(3);

			// Find the duplicate msgid entries
			const productLogoEntries = firstBatch.filter((item) => item.msgid === '[product] logo');
			expect(productLogoEntries).toHaveLength(2);

			// Check that context information is preserved
			const contextKeys = productLogoEntries.map((item) => item.msgctxt).sort();
			expect(contextKeys).toEqual(['', 'Placeholders inside [] are not to be translated.']);

			// Verify all entries have required properties
			firstBatch.forEach((item) => {
				expect(item).toHaveProperty('msgid');
				expect(item).toHaveProperty('msgctxt');
				expect(typeof item.msgid).toBe('string');
			});
		});
	});

	describe('String Filtering', () => {
		it('should exclude header (empty msgid)', async () => {
			const potFile = await copyTestFile('simple.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const batches = prepareBatches(parsedPot, 10, logger);

			// Verify no batch contains empty msgid (header)
			batches.forEach((batch) => {
				batch.forEach((item) => {
					expect(item.msgid).not.toBe('');
				});
			});
		});

		it('should only include strings that need translation', async () => {
			// Create a POT-like structure with some already translated strings
			const mixedData = {
				translations: {
					'': {
						'': { msgstr: [''] }, // Header
						'Untranslated 1': { msgstr: [''] }, // Needs translation
						'Already translated': { msgstr: ['Déjà traduit'] }, // Has translation
						'Untranslated 2': { msgstr: [''] }, // Needs translation
						'Also translated': { msgstr: ['Aussi traduit'] }, // Has translation
					},
				},
			};

			const batches = prepareBatches(mixedData, 5, logger);

			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(2); // Only untranslated strings

			const msgids = batches[0].map((item) => item.msgid);
			expect(msgids).toContain('Untranslated 1');
			expect(msgids).toContain('Untranslated 2');
			expect(msgids).not.toContain('Already translated');
			expect(msgids).not.toContain('Also translated');
		});

		it('should handle strings with empty msgstr arrays', () => {
			const potData = {
				translations: {
					'': {
						'': { msgstr: [''] }, // Header
						'Empty array': { msgstr: [] }, // Needs translation
						'Empty string': { msgstr: [''] }, // Needs translation
						'Multiple empty': { msgstr: ['', ''] }, // Needs translation
						'Has content': { msgstr: ['Content'] }, // Already translated
					},
				},
			};

			const batches = prepareBatches(potData, 5, logger);

			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(3); // Three that need translation

			const msgids = batches[0].map((item) => item.msgid);
			expect(msgids).toContain('Empty array');
			expect(msgids).toContain('Empty string');
			expect(msgids).toContain('Multiple empty');
			expect(msgids).not.toContain('Has content');
		});
	});

	describe('Performance and Scalability', () => {
		it('should handle large number of strings efficiently', async () => {
			// Create a large POT-like structure
			const largeData = {
				translations: {
					'': {
						'': { msgstr: [''] }, // Header
					},
				},
			};

			// Add 1000 strings
			for (let i = 1; i <= 1000; i++) {
				largeData.translations[''][`String ${i}`] = { msgstr: [''] };
			}

			const startTime = Date.now();
			const batches = prepareBatches(largeData, 50, logger);
			const elapsed = Date.now() - startTime;

			// Should complete quickly (under 100ms)
			expect(elapsed).toBeLessThan(100);
			expect(batches).toHaveLength(20); // 1000 / 50 = 20 batches

			const totalStrings = batches.reduce((sum, batch) => sum + batch.length, 0);
			expect(totalStrings).toBe(1000);
		});

		it('should handle very small batch sizes efficiently', async () => {
			const potFile = await copyTestFile('complex.pot', tempDir);
			const potContent = await readFile(potFile);
			const parsedPot = po.parse(potContent);

			const startTime = Date.now();
			const batches = prepareBatches(parsedPot, 1, logger); // One string per batch
			const elapsed = Date.now() - startTime;

			// Should complete quickly
			expect(elapsed).toBeLessThan(100);
			expect(batches.length).toBeGreaterThan(1);

			// Each batch should have exactly 1 string
			batches.forEach((batch) => {
				expect(batch).toHaveLength(1);
			});
		});
	});
});
