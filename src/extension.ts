import * as vscode from 'vscode';
import { WebviewProvider } from './WebviewProvider';
import { CodeAnalyzer } from './analyzer/parser';

/**
 * Global status bar item for CodeAtlas analysis state.
 */
let statusBarItem: vscode.StatusBarItem;

/**
 * Activates the CodeAtlas extension.
 * @param context The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('CodeAtlas is now active!');

  // Create Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'codeatlas.analyzeProject';
  statusBarItem.text = '$(project) CodeAtlas: Ready';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  /**
   * Disposable for the analyzeProject command.
   */
  let disposable = vscode.commands.registerCommand('codeatlas.analyzeProject', async () => {
    // Ensure we have a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showInformationMessage('CodeAtlas: Please open a workspace or folder first to analyze the project.');
      return;
    }

    if (statusBarItem) {
      statusBarItem.text = '$(sync~spin) CodeAtlas: Analyzing...';
    }

    // Show loading progress
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "CodeAtlas: Analyzing workspace...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      
      // Read settings
      const config = vscode.workspace.getConfiguration('codeatlas');
      const maxFiles = config.get<number>('maxFiles', 500);
      const excludedDirectories = config.get<string[]>('excludedDirectories', ['node_modules', 'dist', 'out', '.git', '__pycache__', '.venv']);
      const fileExtensions = config.get<string[]>('fileExtensions', ['.ts', '.tsx', '.js', '.jsx', '.py']);

      // Initialize analyzer
      const analyzer = new CodeAnalyzer(workspaceRoot, maxFiles, excludedDirectories, fileExtensions);
      
      progress.report({ increment: 30, message: "Parsing ASTs..." });
      
      try {
        const result = await analyzer.analyzeProject();
        
        progress.report({ increment: 70, message: "Generating Webview..." });
        
        // Show webview
        WebviewProvider.createOrShow(context.extensionUri, workspaceRoot);
        
        // Send data to webview
        WebviewProvider.currentPanel?.sendAnalysisData(result);
        
        // Pass graph physics configuration
        const graphPhysics = config.get<string>('graphPhysics', 'default');
        WebviewProvider.currentPanel?.sendGraphPhysics(graphPhysics);

        if (statusBarItem) {
          const numNodes = result.graph.nodes.length;
          const numLinks = result.graph.links.length;
          statusBarItem.text = `$(project) CodeAtlas: ${numNodes} nodes | ${numLinks} rels`;
        }

        vscode.window.showInformationMessage('CodeAtlas: Analysis complete!');
      } catch (error) {
        console.error(error);
        if (statusBarItem) {
          statusBarItem.text = '$(error) CodeAtlas: Error';
        }
        vscode.window.showErrorMessage('CodeAtlas Analysis failed: ' + (error as Error).message);
      }
    });
  });

  /**
   * Disposable for the openPanel command.
   */
  const openPanelDisposable = vscode.commands.registerCommand('codeatlas.openPanel', () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showInformationMessage('CodeAtlas: Please open a workspace or folder first to view insights.');
      return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    WebviewProvider.createOrShow(context.extensionUri, workspaceRoot);
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(openPanelDisposable);

  // File Watcher
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
  let debounceTimer: NodeJS.Timeout | undefined;

  const triggerReanalysis = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      if (WebviewProvider.currentPanel) {
        if (statusBarItem) {
          statusBarItem.text = '$(sync~spin) CodeAtlas: Updating...';
        }
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders && workspaceFolders.length > 0) {
            const analyzer = new CodeAnalyzer(workspaceFolders[0].uri.fsPath);
            const result = await analyzer.analyzeProject();
            WebviewProvider.currentPanel.sendAnalysisData(result);
            if (statusBarItem) {
              statusBarItem.text = `$(project) CodeAtlas: ${result.graph.nodes.length} nodes | ${result.graph.links.length} rels`;
            }
          }
        } catch (error) {
          console.error('CodeAtlas Auto-Analysis failed:', error);
          if (statusBarItem) {
            statusBarItem.text = '$(error) CodeAtlas: Error';
          }
        }
      }
    }, 2000);
  };

  watcher.onDidChange(triggerReanalysis);
  watcher.onDidCreate(triggerReanalysis);
  watcher.onDidDelete(triggerReanalysis);
  context.subscriptions.push(watcher);

  // Listen for configuration changes
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('codeatlas')) {
      if (WebviewProvider.currentPanel) {
        // Re-analyze if analysis-related settings changed
        if (
          e.affectsConfiguration('codeatlas.maxFiles') ||
          e.affectsConfiguration('codeatlas.excludedDirectories') ||
          e.affectsConfiguration('codeatlas.fileExtensions')
        ) {
          vscode.commands.executeCommand('codeatlas.analyzeProject');
        }
      }
    }
  });
}

/**
 * Deactivates the CodeAtlas extension and cleans up resources.
 */
export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
