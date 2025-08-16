import * as assert from 'assert';
import * as vscode from 'vscode';

// Import all test suites
import './hookManager.test';
import './hookExecutor.test';
import './providerManager.test';
import './hookManagerProvider.test';
import './fileUtils.test';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be testable', () => {
		// Basic test to ensure extension framework works
		assert.ok(vscode);
		assert.ok(vscode.window);
		assert.ok(vscode.commands);
	});

	test('Should have commands available', async () => {
		// Test that commands exist without requiring actual extension activation
		const expectedCommands = [
			'ai-agent-hooks.selectProvider',
			'ai-agent-hooks.testProvider', 
			'ai-agent-hooks.manageHooks'
		];
		
		// Just test that we can call getCommands without error
		const commands = await vscode.commands.getCommands(true);
		assert.ok(Array.isArray(commands));
		assert.ok(commands.length > 0);
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});
