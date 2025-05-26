import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

/**
 * Creates a temporary directory for test files
 * @returns {Promise<string>} Path to temporary directory
 */
export async function createTempDir() {
	const tempDirName = `gk-translate-test-${randomBytes(8).toString('hex')}`;
	const tempPath = path.join(tmpdir(), tempDirName);

	await fs.mkdir(tempPath, { recursive: true });

	return tempPath;
}

/**
 * Copies a test data file to a temporary location
 * @param {string} testDataFile - Name of file in tests/data/
 * @param {string} tempDir - Temporary directory path
 * @param {string} [newName] - Optional new name for the file
 * @returns {Promise<string>} Path to copied file
 */
export async function copyTestFile(testDataFile, tempDir, newName = null) {
	const sourcePath = path.join(process.cwd(), 'tests', 'data', testDataFile);
	const targetName = newName || testDataFile;
	const targetPath = path.join(tempDir, targetName);

	await fs.copyFile(sourcePath, targetPath);

	return targetPath;
}

/**
 * Creates a temporary file with given content
 * @param {string} tempDir - Temporary directory path
 * @param {string} fileName - Name of file to create
 * @param {string} content - File content
 * @returns {Promise<string>} Path to created file
 */
export async function createTempFile(tempDir, fileName, content) {
	const filePath = path.join(tempDir, fileName);
	await fs.writeFile(filePath, content, 'utf8');
	return filePath;
}

/**
 * Reads a file and returns its content
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} File content
 */
export async function readFile(filePath) {
	return await fs.readFile(filePath, 'utf8');
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Cleans up a temporary directory and all its contents
 * @param {string} tempDir - Temporary directory path
 */
export async function cleanupTempDir(tempDir) {
	try {
		await fs.rm(tempDir, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors in tests
		console.warn(`Failed to cleanup temp dir ${tempDir}:`, error.message);
	}
}
