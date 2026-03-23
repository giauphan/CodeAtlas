import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AnalysisResult, InitialLoadData, GraphData } from './analyzer/types';
import { getCachedData } from './extension';

export class WebviewProvider {
  public static currentPanel: WebviewProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _workspaceRoot: string;
  private _isReady: boolean = false;
  private _pendingMessages: any[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workspaceRoot: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._workspaceRoot = workspaceRoot;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'navigateToNode':
            const filePath = message.filePath;
            const line = message.line;
            if (filePath && path.isAbsolute(filePath)) {
              vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                  if (line) {
                    const pos = new vscode.Position(line - 1, 0);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(pos, pos);
                  }
                });
              });
            } else {
               vscode.window.showErrorMessage(`Cannot navigate to ${filePath}. Absolute path required.`);
            }
            return;
          case 'webviewReady':
            // Webview React app has mounted and is ready to receive messages
            this._isReady = true;
            // Flush any pending messages
            for (const msg of this._pendingMessages) {
              this._panel.webview.postMessage(msg);
            }
            this._pendingMessages = [];
            return;
          case 'requestAnalysis':
            // Trigger analysis again if requested
            vscode.commands.executeCommand('codeatlas.analyzeProject');
            return;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'codeatlas');
            return;
          case 'loadMore':
            this._handleLoadMore(message.currentCount || 0, message.batchSize || 100);
            return;
          case 'loadAll':
            this._handleLoadAll();
            return;
          case 'loadFolder':
            this._handleLoadFolder(message.folderPath);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Handles "Load More" request from webview: sends next batch of nodes
   */
  private _handleLoadMore(currentCount: number, batchSize: number) {
    const { result } = getCachedData();
    if (!result) return;

    const allNodes = result.graph.nodes;
    const nextBatch = allNodes.slice(currentCount, currentCount + batchSize);
    
    if (nextBatch.length === 0) return;

    // Get links for the expanded set (all nodes loaded so far + new batch)
    const expandedNodeIds = new Set(allNodes.slice(0, currentCount + batchSize).map(n => n.id));
    const relevantLinks = result.graph.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return expandedNodeIds.has(sourceId) && expandedNodeIds.has(targetId);
    });

    // Only send NEW links (links involving at least one new node)
    const existingNodeIds = new Set(allNodes.slice(0, currentCount).map(n => n.id));
    const newLinks = relevantLinks.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return !existingNodeIds.has(sourceId) || !existingNodeIds.has(targetId);
    });

    this._postMessage({
      command: 'appendNodes',
      nodes: nextBatch,
      links: newLinks,
      totalNodes: allNodes.length
    });
  }

  /**
   * Handles "Load All" request from webview: sends ALL remaining nodes
   */
  private _handleLoadAll() {
    const { result } = getCachedData();
    if (!result) return;

    this._postMessage({
      command: 'updateAnalysis',
      data: result
    });
  }

  /**
   * Handles loading a specific folder's chunk
   */
  private _handleLoadFolder(folderPath: string) {
    const { chunks, crossChunkLinks } = getCachedData();
    if (!chunks || !crossChunkLinks) return;

    const chunk = chunks.get(folderPath);
    if (!chunk) return;

    // Build nodeIds Set ONCE outside the filter
    const chunkNodeIds = new Set(chunk.nodes.map(n => n.id));

    this._postMessage({
      command: 'appendChunk',
      chunk,
      crossLinks: crossChunkLinks.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return chunkNodeIds.has(sourceId) || chunkNodeIds.has(targetId);
      })
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, workspaceRoot: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (WebviewProvider.currentPanel) {
      WebviewProvider.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'codeatlas',
      'CodeAtlas: Project Insights',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    WebviewProvider.currentPanel = new WebviewProvider(panel, extensionUri, workspaceRoot);
  }

  /** Send full analysis data (small projects or load-all) */
  public sendAnalysisData(data: AnalysisResult) {
    this._postMessage({ command: 'updateAnalysis', data });
  }

  /** Send initial load data for progressive loading (large projects) */
  public sendInitialLoadData(data: InitialLoadData) {
    this._postMessage({ command: 'initialLoad', data });
  }

  public sendGraphPhysics(physics: string) {
    this._postMessage({ command: 'updateGraphPhysics', physics });
  }

  private _postMessage(msg: any) {
    if (this._isReady) {
      this._panel.webview.postMessage(msg);
    } else {
      this._pendingMessages.push(msg);
    }
  }

  public dispose() {
    WebviewProvider.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', 'index.js');
    // Vite with cssCodeSplit: false outputs 'style.css'
    let stylesPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', 'style.css');
    if (!fs.existsSync(stylesPath.fsPath)) {
      stylesPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', 'index.css');
    }

    if (!fs.existsSync(scriptPath.fsPath)) {
      vscode.window.showErrorMessage('CodeAtlas: Webview build not found. Please run "npm run build" to build the extension assets.');
      return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeAtlas Error</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); }
          .error-container { background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); padding: 20px; border-radius: 4px; }
          h2 { margin-top: 0; color: var(--vscode-editorError-foreground); }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h2>CodeAtlas Webview Error</h2>
          <p>The webview assets could not be found. This usually means the extension hasn't been built properly.</p>
          <p><strong>Path not found:</strong> ${scriptPath.fsPath}</p>
          <p>If you are developing the extension, make sure to run <code>npm run build</code> or <code>npm run build:webview</code>.</p>
        </div>
      </body>
      </html>`;
    }

    // Get path to bundled frontend script
    const scriptUri = webview.asWebviewUri(scriptPath);
    const stylesUri = webview.asWebviewUri(stylesPath);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${stylesUri}" rel="stylesheet">
        <title>CodeAtlas Insights</title>
      </head>
      <body>
        <div id="root"></div>
        <div id="error-display" style="display:none; position:fixed; top:20px; left:20px; right:20px; background:#1a0000; border:2px solid #ff4444; color:#ff6666; padding:16px; border-radius:8px; font-family:monospace; font-size:13px; z-index:99999; white-space:pre-wrap;"></div>
        <script nonce="${nonce}">
          window.onerror = function(msg, url, line, col, error) {
            var _errDiv = document.getElementById('error-display');
            if (_errDiv) { _errDiv.style.display = 'block'; _errDiv.textContent = 'JS Error: ' + msg + '\\\\nAt: ' + url + ':' + line + ':' + col + '\\\\n' + (error ? error.stack : ''); }
          };
          try {
            var _vscodeApi = acquireVsCodeApi();
            window.vscode = _vscodeApi;
          } catch(_e) {
            var _errDiv2 = document.getElementById('error-display');
            if (_errDiv2) { _errDiv2.style.display = 'block'; _errDiv2.textContent = 'VsCode API Error: ' + _e.message; }
          }
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
