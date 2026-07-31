import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

await esbuild.build({
	entryPoints: ["src/webview/flowApp.ts"],
	bundle: true,
	outfile: "dist/webview/flowApp.js",
	platform: "browser",
	target: "es2020",
	format: "iife",
	minify: false,
	external: ["vscode"],
});

mkdirSync("dist/webview", { recursive: true });
copyFileSync("src/webview/flowStyle.css", "dist/webview/flowStyle.css");
console.log("✅ Flow webview built!");
