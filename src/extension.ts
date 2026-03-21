import * as vscode from 'vscode';
import { WebviewProvider } from './WebviewProvider';
import { CodeAnalyzer } from './analyzer/parser';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeAtlas is now active!');

  let disposable = vscode.commands.registerCommand('codeatlas.analyzeProject', async () => {
    // Show loading progress
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "CodeAtlas: Analyzing workspace...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      // Ensure we have a workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('CodeAtlas requires an open workspace.');
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      
      // Initialize analyzer
      const analyzer = new CodeAnalyzer(workspaceRoot);
      
      progress.report({ increment: 30, message: "Parsing ASTs..." });
      
      try {
        const result = await analyzer.analyzeProject();
        
        progress.report({ increment: 70, message: "Generating Webview..." });
        
        // Show webview
        WebviewProvider.createOrShow(context.extensionUri, workspaceRoot);
        
        // Send data to webview
        WebviewProvider.currentPanel?.sendAnalysisData(result);
        
        vscode.window.showInformationMessage('CodeAtlas: Analysis complete!');
      } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage('CodeAtlas Analysis failed: ' + (error as Error).message);
      }
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
