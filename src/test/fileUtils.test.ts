import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { FileUtils } from '../utils/fileUtils';

suite('FileUtils Test Suite', () => {
    let tempDir: string;
    let mockContext: vscode.ExtensionContext;

    suiteSetup(() => {
        tempDir = path.join(__dirname, 'temp_fileutils_test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockContext = {
            globalStorageUri: vscode.Uri.file(tempDir)
        } as any;
    });

    teardown(() => {
        // Clean up test files
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            });
        }
    });

    suiteTeardown(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should ensure directory exists', async () => {
        const testDir = path.join(tempDir, 'test-subdir');
        
        // Directory should not exist initially
        assert.ok(!fs.existsSync(testDir));
        
        // Create directory
        await FileUtils.ensureDirectoryExists(testDir);
        
        // Directory should now exist
        assert.ok(fs.existsSync(testDir));
        assert.ok(fs.statSync(testDir).isDirectory());
        
        // Should not throw if directory already exists
        await FileUtils.ensureDirectoryExists(testDir);
        assert.ok(fs.existsSync(testDir));
    });

    test('should create nested directories', async () => {
        const nestedDir = path.join(tempDir, 'deep', 'nested', 'directory');
        
        await FileUtils.ensureDirectoryExists(nestedDir);
        
        assert.ok(fs.existsSync(nestedDir));
        assert.ok(fs.statSync(nestedDir).isDirectory());
    });

    test('should read JSON file', async () => {
        const testData = { test: 'data', number: 42, array: [1, 2, 3] };
        const testFile = path.join(tempDir, 'test.json');
        
        // Write test data
        fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));
        
        // Read it back
        const result = await FileUtils.readJsonFile<typeof testData>(testFile);
        
        assert.deepStrictEqual(result, testData);
    });

    test('should return null for non-existent JSON file', async () => {
        const nonExistentFile = path.join(tempDir, 'does-not-exist.json');
        
        const result = await FileUtils.readJsonFile(nonExistentFile);
        
        assert.strictEqual(result, null);
    });

    test('should handle invalid JSON gracefully', async () => {
        const invalidJsonFile = path.join(tempDir, 'invalid.json');
        
        // Write invalid JSON
        fs.writeFileSync(invalidJsonFile, '{ invalid json content }');
        
        const result = await FileUtils.readJsonFile(invalidJsonFile);
        
        assert.strictEqual(result, null);
    });

    test('should write JSON file', async () => {
        const testData = { name: 'test', values: [1, 2, 3], nested: { key: 'value' } };
        const testFile = path.join(tempDir, 'write-test.json');
        
        await FileUtils.writeJsonFile(testFile, testData);
        
        // Verify file was created
        assert.ok(fs.existsSync(testFile));
        
        // Verify content
        const content = fs.readFileSync(testFile, 'utf8');
        const parsed = JSON.parse(content);
        assert.deepStrictEqual(parsed, testData);
    });

    test('should create directory when writing JSON file', async () => {
        const testData = { test: 'data' };
        const subDir = path.join(tempDir, 'new-subdir');
        const testFile = path.join(subDir, 'test.json');
        
        // Directory should not exist
        assert.ok(!fs.existsSync(subDir));
        
        await FileUtils.writeJsonFile(testFile, testData);
        
        // Directory and file should now exist
        assert.ok(fs.existsSync(subDir));
        assert.ok(fs.existsSync(testFile));
        
        const result = await FileUtils.readJsonFile(testFile);
        assert.deepStrictEqual(result, testData);
    });

    test('should get extension storage path', () => {
        const fileName = 'test-file.json';
        const result = FileUtils.getExtensionStoragePath(mockContext, fileName);
        
        assert.strictEqual(result, path.join(tempDir, fileName));
    });

    test('should get file extension', () => {
        assert.strictEqual(FileUtils.getFileExtension('test.js'), '.js');
        assert.strictEqual(FileUtils.getFileExtension('test.min.js'), '.js');
        assert.strictEqual(FileUtils.getFileExtension('README.md'), '.md');
        assert.strictEqual(FileUtils.getFileExtension('file-without-extension'), '');
        assert.strictEqual(FileUtils.getFileExtension('.hidden-file'), '');  // path.extname returns empty for files starting with dot
        assert.strictEqual(FileUtils.getFileExtension('path/to/file.tsx'), '.tsx');
    });

    test('should get file name', () => {
        assert.strictEqual(FileUtils.getFileName('test.js'), 'test.js');
        assert.strictEqual(FileUtils.getFileName('/path/to/file.ts'), 'file.ts');
        // Use path.sep for cross-platform compatibility
        const windowsPath = ['C:', 'Windows', 'Path', 'file.txt'].join(path.sep);
        assert.strictEqual(FileUtils.getFileName(windowsPath), 'file.txt');
        assert.strictEqual(FileUtils.getFileName('just-filename'), 'just-filename');
    });

    test('should check file type', () => {
        const jsExtensions = ['.js', '.jsx', '.ts', '.tsx'];
        
        assert.ok(FileUtils.isFileType('test.js', jsExtensions));
        assert.ok(FileUtils.isFileType('component.tsx', jsExtensions));
        assert.ok(!FileUtils.isFileType('style.css', jsExtensions));
        assert.ok(!FileUtils.isFileType('README.md', jsExtensions));
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
        assert.ok(FileUtils.isFileType('photo.jpg', imageExtensions));
        assert.ok(FileUtils.isFileType('image.PNG', imageExtensions)); // Case insensitive
        assert.ok(!FileUtils.isFileType('document.pdf', imageExtensions));
    });

    test('should handle edge cases in file operations', async () => {
        // Test with empty data
        await FileUtils.writeJsonFile(path.join(tempDir, 'empty.json'), {});
        const empty = await FileUtils.readJsonFile(path.join(tempDir, 'empty.json'));
        assert.deepStrictEqual(empty, {});
        
        // Test with null data
        await FileUtils.writeJsonFile(path.join(tempDir, 'null.json'), null);
        const nullResult = await FileUtils.readJsonFile(path.join(tempDir, 'null.json'));
        assert.strictEqual(nullResult, null);
        
        // Test with array data
        const arrayData = ['item1', 'item2', 'item3'];
        await FileUtils.writeJsonFile(path.join(tempDir, 'array.json'), arrayData);
        const arrayResult = await FileUtils.readJsonFile<string[]>(path.join(tempDir, 'array.json'));
        assert.deepStrictEqual(arrayResult, arrayData);
    });

    test('should handle file system errors gracefully', async () => {
        // Try to read from a directory (should fail gracefully)
        const result = await FileUtils.readJsonFile(tempDir);
        assert.strictEqual(result, null);
        
        // Try to write to a path that can't be created (permission issues, etc.)
        // This test might not work on all systems, so we wrap it in try-catch
        try {
            await FileUtils.writeJsonFile('/root/forbidden/path/test.json', { test: 'data' });
            // If it doesn't throw, that's also okay (different system permissions)
        } catch (error) {
            // Expected on systems where we don't have permission
            assert.ok(error instanceof Error);
        }
    });
});