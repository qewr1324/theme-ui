import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface CustomTheme {
	id: string;
	name: string;
	filePath: string;
}

export class ThemeManager {
	private context: vscode.ExtensionContext;
	private customThemes: Map<string, CustomTheme> = new Map();

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	getThemeContent(themeId: string): any {
		const themePath = path.join(this.context.extensionPath, "src", "themes", `${themeId}.json`);

		if (fs.existsSync(themePath)) {
			const content = fs.readFileSync(themePath, "utf-8");
			return JSON.parse(content);
		}

		return null;
	}

	getCustomThemes(): CustomTheme[] {
		return Array.from(this.customThemes.values());
	}

	getCustomThemeContent(themeId: string): any {
		const theme = this.customThemes.get(themeId);
		if (!theme) return null;

		try {
			const content = fs.readFileSync(theme.filePath, "utf-8");
			return JSON.parse(content);
		} catch (error) {
			console.error(`Failed to load custom theme: ${error}`);
			return null;
		}
	}

	loadCustomThemes() {
		const customThemesDir = path.join(this.context.globalStorageUri.fsPath, "custom-themes");

		if (!fs.existsSync(customThemesDir)) {
			fs.mkdirSync(customThemesDir, { recursive: true });
			return;
		}

		const files = fs.readdirSync(customThemesDir);

		for (const file of files) {
			if (file.endsWith(".json")) {
				try {
					const filePath = path.join(customThemesDir, file);
					const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

					this.customThemes.set(file.replace(".json", ""), {
						id: file.replace(".json", ""),
						name: content.name || file.replace(".json", ""),
						filePath: filePath,
					});
				} catch (error) {
					console.error(`Failed to load theme file ${file}:`, error);
				}
			}
		}
	}

	async saveCustomTheme(themeName: string, themeData: any): Promise<void> {
		const themeId = themeName.toLowerCase().replace(/\s+/g, "-");
		const customThemesDir = path.join(this.context.globalStorageUri.fsPath, "custom-themes");

		if (!fs.existsSync(customThemesDir)) {
			fs.mkdirSync(customThemesDir, { recursive: true });
		}

		const filePath = path.join(customThemesDir, `${themeId}.json`);

		// Add name to theme data
		themeData.name = themeName;

		fs.writeFileSync(filePath, JSON.stringify(themeData, null, 2));

		this.customThemes.set(themeId, {
			id: themeId,
			name: themeName,
			filePath: filePath,
		});

		// Also contribute the theme dynamically if possible
		await this.contributeCustomTheme(themeId, themeName, filePath);
	}

	async applyCustomTheme(themeId: string): Promise<void> {
		const theme = this.customThemes.get(themeId);
		if (!theme) {
			throw new Error(`Custom theme "${themeId}" not found`);
		}

		// Apply via workbench color customizations
		const themeData = this.getCustomThemeContent(themeId);
		if (!themeData) {
			throw new Error(`Failed to load theme data for "${themeId}"`);
		}

		// Apply colors
		if (themeData.colors) {
			await vscode.workspace.getConfiguration().update("workbench.colorCustomizations", themeData.colors, vscode.ConfigurationTarget.Global);
		}

		// Apply token colors
		if (themeData.tokenColors) {
			await vscode.workspace.getConfiguration().update("editor.tokenColorCustomizations", { textMateRules: themeData.tokenColors }, vscode.ConfigurationTarget.Global);
		}

		// Apply semantic token colors
		if (themeData.semanticTokenColors) {
			await vscode.workspace.getConfiguration().update(
				"editor.semanticTokenColorCustomizations",
				{
					enabled: true,
					rules: themeData.semanticTokenColors,
				},
				vscode.ConfigurationTarget.Global,
			);
		}

		vscode.window.showInformationMessage(`Custom theme "${theme.name}" applied!`);
	}

	private async contributeCustomTheme(themeId: string, themeName: string, filePath: string): Promise<void> {
		// Note: Dynamic theme contribution is limited in VSCode
		// Users will need to reload the window for new themes to appear in the theme list
		// Alternative: Apply theme directly using color customizations
		vscode.window.showInformationMessage(`Theme "${themeName}" saved. Use "Show Theme Menu" to apply it.`, "Apply Now").then((selection) => {
			if (selection === "Apply Now") {
				this.applyCustomTheme(themeId);
			}
		});
	}
}
