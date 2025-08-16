import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileUtils {
    static async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.access(dirPath);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }

    static async readJsonFile<T>(filePath: string): Promise<T | null> {
        try {
            await fs.promises.access(filePath);
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet - this is normal for first run
                return null;
            }
            console.error(`Error reading JSON file ${filePath}:`, error);
            return null;
        }
    }

    static async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
        try {
            const dir = path.dirname(filePath);
            await this.ensureDirectoryExists(dir);
            await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error writing JSON file ${filePath}:`, error);
            throw error;
        }
    }

    static getExtensionStoragePath(context: vscode.ExtensionContext, fileName: string): string {
        return path.join(context.globalStorageUri.fsPath, fileName);
    }

    static getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }

    static getFileName(filePath: string): string {
        return path.basename(filePath);
    }

    static isFileType(filePath: string, extensions: string[]): boolean {
        const ext = this.getFileExtension(filePath);
        return extensions.includes(ext);
    }
}