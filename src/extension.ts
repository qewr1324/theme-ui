import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ThemeManager } from "./utils/themeManager";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	console.log("Theme UI extension is now active!");

	const themeManager = new ThemeManager(context);

	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = "theme-ui.showThemeMenu";
	statusBarItem.text = "$(color-mode) Theme";
	statusBarItem.tooltip = "Click to change theme";
	statusBarItem.show();

	context.subscriptions.push(statusBarItem);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand("theme-ui.showThemeMenu", async () => {
			await showThemeMenu(themeManager, context);
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("theme-ui.createTheme", async () => {
			await createTheme(themeManager, context);
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("theme-ui.editTheme", async () => {
			await editTheme(themeManager, context);
		}),
	);

	// Load saved themes
	themeManager.loadCustomThemes();
}

async function showThemeMenu(themeManager: ThemeManager, context: vscode.ExtensionContext) {
	const menuOptions = [
		{
			label: "Intellij Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "$(triangle-right) Intellij Darkula Classic",
			description: "IntelliJ classic dark (🔶 borange/yellow syntax)",
			themeId: "intellij-darkula-classic",
		},
		{
			label: "$(triangle-right) Intellij Darkula Modern",
			description: "IntelliJ modern dark (🔷 blue syntax)",
			themeId: "intellij-darkula-modern",
		},
		{
			label: "$(triangle-right) Intellij Lightula",
			description: "IntelliJ light theme",
			themeId: "intellij-lightula",
		},
		{
			label: "Microsoft Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "$(triangle-right) Microsoft Dark",
			description: "Microsoft dark theme",
			themeId: "microsoft-dark",
		},
		{
			label: "$(triangle-right) Microsoft Light",
			description: "Microsoft light theme",
			themeId: "microsoft-light",
		},
		{
			label: "GhurbeSABZI Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "$(triangle-right) GhurbeSABZI Darkest",
			description: "Dark military green theme with MS syntax",
			themeId: "ghurbeSABZI-darkest",
		},
		{
			label: "$(triangle-right) GhurbeSABZI Lightest",
			description: "Light green theme with IntelliJ syntax",
			themeId: "ghurbeSABZI-lightest",
		},
		{
			label: "Self Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		...themeManager.getCustomThemes().map((theme) => ({
			label: theme.name,
			description: "Custom theme",
			themeId: theme.id,
			isCustom: true,
		})),
		{
			label: "Create Theme From...",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "$(folder) Create from Intellij Darkula Classic",
			description: "Create new theme based on IntelliJ classic dark",
			baseTheme: "intellij-darkula-classic",
		},
		{
			label: "$(folder) Create from Intellij Darkula Modern",
			description: "Create new theme based on IntelliJ modern dark",
			baseTheme: "intellij-darkula-modern",
		},
		{
			label: "$(folder) Create from Intellij Lightula",
			description: "Create new theme based on IntelliJ light",
			baseTheme: "intellij-lightula",
		},
		{
			label: "$(folder) Create from Microsoft Dark",
			description: "Create new theme based on Microsoft dark",
			baseTheme: "microsoft-dark",
		},
		{
			label: "$(folder) Create from Microsoft Light",
			description: "Create new theme based on Microsoft light",
			baseTheme: "microsoft-light",
		},
		{
			label: "$(folder) Create from GhurbeSABZI Darkest",
			description: "Create new theme based on GhurbeSABZI Darkest",
			baseTheme: "ghurbeSABZI-darkest",
		},
		{
			label: "$(folder) Create from GhurbeSABZI Lightest",
			description: "Create new theme based on GhurbeSABZI Lightest",
			baseTheme: "ghurbeSABZI-lightest",
		},
	];

	const selected = await vscode.window.showQuickPick(menuOptions, {
		placeHolder: "Select a theme or action",
		matchOnDescription: true,
	});

	if (!selected) return;

	if (selected.themeId) {
		// Apply theme
		await applyTheme(themeManager, selected.themeId, selected.isCustom);
	} else if (selected.baseTheme) {
		// Create new theme from base
		await createThemeFromBase(themeManager, context, selected.baseTheme);
	}
}

async function applyTheme(themeManager: ThemeManager, themeId: string, isCustom: boolean = false) {
	try {
		if (isCustom) {
			await themeManager.applyCustomTheme(themeId);
		} else {
			// Map theme IDs to actual theme names in package.json
			const themeMap: Record<string, string> = {
				"intellij-darkula-classic": "Intellij Darkula Classic",
				"intellij-darkula-modern": "Intellij Darkula Modern",
				"intellij-lightula": "Intellij Lightula",
				"microsoft-dark": "Microsoft Dark",
				"microsoft-light": "Microsoft Light",
				"ghurbeSABZI-darkest": "GhurbeSABZI Darkest",
				"ghurbeSABZI-lightest": "GhurbeSABZI Lightest",
			};

			const themeName = themeMap[themeId];
			if (themeName) {
				await vscode.workspace.getConfiguration().update("workbench.colorTheme", themeName, vscode.ConfigurationTarget.Global);
				vscode.window.showInformationMessage(`Theme "${themeName}" applied successfully!`);
			}
		}
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to apply theme: ${error}`);
	}
}

async function createThemeFromBase(themeManager: ThemeManager, context: vscode.ExtensionContext, baseThemeId: string) {
	const themeName = await vscode.window.showInputBox({
		prompt: "Enter a name for your new theme",
		placeHolder: "My Custom Theme",
	});

	if (!themeName) return;

	// Show theme editor
	const panel = vscode.window.createWebviewPanel("themeEditor", `Create Theme: ${themeName}`, vscode.ViewColumn.One, {
		enableScripts: true,
		retainContextWhenHidden: true,
	});

	// Get base theme content
	const baseTheme = themeManager.getThemeContent(baseThemeId);

	panel.webview.html = getThemeEditorHtml(panel.webview, context, baseTheme, themeName);

	// Handle messages from webview
	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case "save":
				await themeManager.saveCustomTheme(message.themeName, message.themeData);
				panel.dispose();
				vscode.window.showInformationMessage(`Theme "${message.themeName}" created successfully!`);
				break;
			case "cancel":
				panel.dispose();
				break;
		}
	});
}

async function createTheme(themeManager: ThemeManager, context: vscode.ExtensionContext) {
	const baseTheme = await vscode.window.showQuickPick(
		[
			{ label: "Intellij Darkula Classic", id: "intellij-darkula-classic" },
			{ label: "Intellij Darkula Modern", id: "intellij-darkula-modern" },
			{ label: "Intellij Lightula", id: "intellij-lightula" },
			{ label: "Microsoft Dark", id: "microsoft-dark" },
			{ label: "Microsoft Light", id: "microsoft-light" },
			{ label: "GhurbeSABZI Darkest", id: "ghurbeSABZI-darkest" },
			{ label: "GhurbeSABZI Lightest", id: "ghurbeSABZI-lightest" },
			{ label: "GhurbeSABZI Grayest", id: "ghurbeSABZI-grayest" },
		],
		{
			placeHolder: "Select base theme",
		},
	);

	if (!baseTheme) return;

	await createThemeFromBase(themeManager, context, baseTheme.id);
}

async function editTheme(themeManager: ThemeManager, context: vscode.ExtensionContext) {
	const customThemes = themeManager.getCustomThemes();

	if (customThemes.length === 0) {
		vscode.window.showInformationMessage("No custom themes to edit.");
		return;
	}

	const selected = await vscode.window.showQuickPick(
		customThemes.map((theme) => ({
			label: theme.name,
			id: theme.id,
		})),
		{ placeHolder: "Select theme to edit" },
	);

	if (!selected) return;

	const themeData = themeManager.getCustomThemeContent(selected.id);
	if (!themeData) return;

	const panel = vscode.window.createWebviewPanel("themeEditor", `Edit Theme: ${selected.label}`, vscode.ViewColumn.One, {
		enableScripts: true,
		retainContextWhenHidden: true,
	});

	panel.webview.html = getThemeEditorHtml(panel.webview, context, themeData, selected.label);

	panel.webview.onDidReceiveMessage(async (message) => {
		switch (message.command) {
			case "save":
				await themeManager.saveCustomTheme(message.themeName, message.themeData);
				panel.dispose();
				vscode.window.showInformationMessage(`Theme "${message.themeName}" updated successfully!`);
				break;
			case "cancel":
				panel.dispose();
				break;
		}
	});
}

function getThemeEditorHtml(webview: vscode.Webview, context: vscode.ExtensionContext, themeData: any, themeName: string): string {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Theme Editor</title>
            <style>
                body {
                    padding: 20px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }
                .section {
                    margin-bottom: 20px;
                    padding: 15px;
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 5px;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .color-input-group {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .color-label {
                    flex: 1;
                    margin-right: 10px;
                }
                .color-input {
                    width: 100px;
                    padding: 5px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                .color-picker {
                    width: 30px;
                    height: 30px;
                    border: none;
                    cursor: pointer;
                    margin-left: 10px;
                }
                .actions {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                }
                .btn-primary {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .theme-preview {
                    margin-top: 20px;
                    padding: 15px;
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 5px;
                    background: ${themeData.colors?.["editor.background"] || "#1e1e1e"};
                    color: ${themeData.colors?.["editor.foreground"] || "#d4d4d4"};
                }
            </style>
        </head>
        <body>
            <h1>Theme Editor - ${themeName}</h1>
            
            <div id="themeSections"></div>
            
            <div class="theme-preview">
                <h3>Preview</h3>
                <pre><code>function example() {
    const greeting = "Hello World";
    console.log(greeting);
    return 42;
}</code></pre>
            </div>
            
            <div class="actions">
                <button class="btn-primary" onclick="saveTheme()">Create Theme</button>
                <button class="btn-secondary" onclick="cancelEdit()">Cancel</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const themeData = ${JSON.stringify(themeData)};
                const themeName = "${themeName}";
                
                function buildEditor() {
                    const sections = document.getElementById('themeSections');
                    
                    if (themeData.colors) {
                        const colorSection = document.createElement('div');
                        colorSection.className = 'section';
                        colorSection.innerHTML = '<div class="section-title">UI Colors</div>';
                        
                        for (const [key, value] of Object.entries(themeData.colors)) {
                            const group = document.createElement('div');
                            group.className = 'color-input-group';
                            group.innerHTML = \`
                                <span class="color-label">\${key}</span>
                                <input type="text" class="color-input" value="\${value}" data-color-key="\${key}">
                                <input type="color" class="color-picker" value="\${value}" data-color-key="\${key}">
                            \`;
                            colorSection.appendChild(group);
                        }
                        
                        sections.appendChild(colorSection);
                    }
                    
                    if (themeData.tokenColors) {
                        const tokenSection = document.createElement('div');
                        tokenSection.className = 'section';
                        tokenSection.innerHTML = '<div class="section-title">Syntax Colors</div>';
                        
                        themeData.tokenColors.forEach((token, index) => {
                            const group = document.createElement('div');
                            group.className = 'color-input-group';
                            const name = token.name || \`Token \${index + 1}\`;
                            group.innerHTML = \`
                                <span class="color-label">\${name}</span>
                                <input type="text" class="color-input" value="\${token.settings?.foreground || ''}" data-token-index="\${index}">
                                <input type="color" class="color-picker" value="\${token.settings?.foreground || '#000000'}" data-token-index="\${index}">
                            \`;
                            tokenSection.appendChild(group);
                        });
                        
                        sections.appendChild(tokenSection);
                    }
                    
                    document.querySelectorAll('.color-input').forEach(input => {
                        input.addEventListener('input', updateColor);
                    });
                    document.querySelectorAll('.color-picker').forEach(picker => {
                        picker.addEventListener('input', updateColor);
                    });
                }
                
                function updateColor(event) {
                    const element = event.target;
                    const isColorInput = element.classList.contains('color-input');
                    
                    const colorKey = element.dataset.colorKey;
                    const tokenIndex = element.dataset.tokenIndex;
                    
                    const newColor = element.value;
                    
                    const pair = isColorInput 
                        ? element.nextElementSibling 
                        : element.previousElementSibling;
                    if (pair) pair.value = newColor;
                    
                    if (colorKey) {
                        themeData.colors[colorKey] = newColor;
                    } else if (tokenIndex !== undefined) {
                        themeData.tokenColors[tokenIndex].settings.foreground = newColor;
                    }
                    
                    if (colorKey === 'editor.background') {
                        document.querySelector('.theme-preview').style.background = newColor;
                    }
                    if (colorKey === 'editor.foreground') {
                        document.querySelector('.theme-preview').style.color = newColor;
                    }
                }
                
                function saveTheme() {
                    vscode.postMessage({
                        command: 'save',
                        themeName: themeName,
                        themeData: themeData
                    });
                }
                
                function cancelEdit() {
                    vscode.postMessage({
                        command: 'cancel'
                    });
                }
                
                buildEditor();
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {
	if (statusBarItem) {
		statusBarItem.dispose();
	}
}
