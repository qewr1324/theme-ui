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
			label: "$(color-mode) Built-in Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "Darkula (IntelliJ Dark Classic)",
			description: "Dark theme based on IntelliJ",
			themeId: "darkula",
		},
		{
			label: "Lightula (IntelliJ Light Classic)",
			description: "Light theme based on IntelliJ",
			themeId: "lightula",
		},
		{
			label: "Microsoft Dark",
			description: "Microsoft dark theme style",
			themeId: "microsoft-dark",
		},
		{
			label: "Microsoft Light",
			description: "Microsoft light theme style",
			themeId: "microsoft-light",
		},
		{
			label: "$(star) GhurbeSABZI Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "GhurbeSABZI Darkula",
			description: "Custom darkula with personal settings",
			themeId: "ghurbeSABZI-darkula",
		},
		{
			label: "GhurbeSABZI Microsoft",
			description: "Custom Microsoft theme",
			themeId: "ghurbeSABZI-microsoft",
		},
		{
			label: "GhurbeSABZI Intellij Classic",
			description: "Custom IntelliJ classic theme",
			themeId: "ghurbeSABZI-intellij-classic",
		},
		{
			label: "GhurbeSABZI Intellij Modern",
			description: "Custom IntelliJ modern theme",
			themeId: "ghurbeSABZI-intellij-modern",
		},
		{
			label: "$(folder) Self Themes",
			kind: vscode.QuickPickItemKind.Separator,
		},
		...themeManager.getCustomThemes().map((theme) => ({
			label: theme.name,
			description: "Custom theme",
			themeId: theme.id,
			isCustom: true,
		})),
		{
			label: "$(add) Create Theme From...",
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: "Create from Darkula",
			description: "Create new theme based on Darkula",
			baseTheme: "darkula",
		},
		{
			label: "Create from Lightula",
			description: "Create new theme based on Lightula",
			baseTheme: "lightula",
		},
		{
			label: "Create from Microsoft Dark",
			description: "Create new theme based on Microsoft Dark",
			baseTheme: "microsoft-dark",
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
				darkula: "Darkula (IntelliJ Dark Classic)",
				lightula: "Lightula (IntelliJ Light Classic)",
				"microsoft-dark": "Microsoft Dark",
				"microsoft-light": "Microsoft Light",
				"ghurbeSABZI-darkula": "GhurbeSABZI Darkula",
				"ghurbeSABZI-microsoft": "GhurbeSABZI Microsoft",
				"ghurbeSABZI-intellij-classic": "GhurbeSABZI Intellij Classic",
				"ghurbeSABZI-intellij-modern": "GhurbeSABZI Intellij Modern",
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
			{ label: "Darkula", id: "darkula" },
			{ label: "Lightula", id: "lightula" },
			{ label: "Microsoft Dark", id: "microsoft-dark" },
			{ label: "Microsoft Light", id: "microsoft-light" },
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
	const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "src", "webview", "themeEditor.js")));

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
                    
                    // Colors section
                    if (themeData.colors) {
                        const colorSection = document.createElement('div');
                        colorSection.className = 'section';
                        colorSection.innerHTML = '<div class="section-title">Colors</div>';
                        
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
                    
                    // Token Colors section
                    if (themeData.tokenColors) {
                        const tokenSection = document.createElement('div');
                        tokenSection.className = 'section';
                        tokenSection.innerHTML = '<div class="section-title">Token Colors</div>';
                        
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
                    
                    // Add event listeners
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
                    const isColorPicker = element.classList.contains('color-picker');
                    
                    const colorKey = element.dataset.colorKey;
                    const tokenIndex = element.dataset.tokenIndex;
                    
                    const newColor = element.value;
                    
                    // Update paired input/picker
                    const pair = isColorInput 
                        ? element.nextElementSibling 
                        : element.previousElementSibling;
                    if (pair) pair.value = newColor;
                    
                    // Update theme data
                    if (colorKey) {
                        themeData.colors[colorKey] = newColor;
                    } else if (tokenIndex !== undefined) {
                        themeData.tokenColors[tokenIndex].settings.foreground = newColor;
                    }
                    
                    // Update preview background
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
                
                // Initialize editor
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
