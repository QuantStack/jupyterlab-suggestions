import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestions,
  ISuggestionChange,
  ISuggestionsManager,
  ISuggestionsModel
} from '../types';
import { ISignal, Signal } from '@lumino/signaling';
import { Cell, ICellModel } from '@jupyterlab/cells';
export class SuggestionsModel implements ISuggestionsModel {
  constructor(options: SuggestionsModel.IOptions) {
    this.switchNotebook(options.panel);
    this.switchManager(options.suggestionsManager);
  }

  get sourceLiveUpdate(): boolean {
    return Boolean(this._suggestionsManager?.sourceLiveUpdate);
  }
  get filePath(): string {
    return this._filePath ?? '-';
  }
  get notebookSwitched(): ISignal<ISuggestionsModel, void> {
    return this._notebookSwitched;
  }
  get activeCellChanged(): ISignal<ISuggestionsModel, { cellId?: string }> {
    return this._activeCellChanged;
  }
  get suggestionChanged(): ISignal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  > {
    return this._suggestionChanged;
  }
  get currentNotebookPanel(): NotebookPanel | null {
    return this._notebookPanel;
  }
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get allSuggestions(): IAllSuggestions | undefined {
    return this._allSuggestions;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );
    Signal.clearData(this);
  }

  async addSuggestion(): Promise<void> {
    const activeCell = this._notebookPanel?.content.activeCell;
    if (activeCell && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.addSuggestion({
        notebook: this._notebookPanel,
        cell: activeCell
      });
    }
  }
  async deleteSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<void> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.deleteSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId
      });
    }
  }

  async acceptSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      return await this._suggestionsManager.acceptSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId
      });
    }
    return false;
  }
  async updateSuggestion(options: {
    cellId?: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    const { cellId, suggestionId, newSource } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.updateSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId,
        newSource
      });
    }
  }
  async getSuggestion(options: { cellId: string; suggestionId: string }) {
    if (!this._filePath || !this._suggestionsManager) {
      return;
    }
    return await this._suggestionsManager.getSuggestion({
      notebookPath: this._filePath,
      ...options
    });
  }
  getCellIndex(cellId?: string): number {
    if (!cellId) {
      return -1;
    }

    const allCells = this._notebookPanel?.content.model?.cells;
    if (!allCells) {
      return -1;
    }
    for (let idx = 0; idx < allCells.length; idx++) {
      const element = allCells.get(idx);
      if (element.id === cellId) {
        return idx;
      }
    }
    return -1;
  }
  async switchNotebook(panel: NotebookPanel | null): Promise<void> {
    if (panel) {
      await panel.context.ready;
      this._allSuggestions =
        await this._suggestionsManager?.getAllSuggestions(panel);
    } else {
      this._allSuggestions = undefined;
    }
    this._disconnectPanelSignal();
    this._notebookPanel = panel;
    this._connectPanelSignal();
    this._filePath = this._notebookPanel?.context.localPath;
    this._notebookSwitched.emit();
  }
  async switchManager(manager: ISuggestionsManager | undefined): Promise<void> {
    if (!manager) {
      return;
    }
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );

    this._suggestionsManager = manager;
    this._suggestionsManager.suggestionChanged.connect(
      this._handleSuggestionChanged,
      this
    );
    if (this._notebookPanel) {
      this._allSuggestions = await this._suggestionsManager?.getAllSuggestions(
        this._notebookPanel
      );
    }
  }
  private _connectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.connect(
      this._handleActiveCellChanged,
      this
    );
  }

  private _disconnectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.disconnect(
      this._handleActiveCellChanged
    );
  }
  private _handleActiveCellChanged(
    nb: Notebook,
    cell: Cell<ICellModel> | null
  ) {
    this._activeCellChanged.emit({ cellId: cell?.model.id });
  }
  private _handleSuggestionChanged(
    manager: ISuggestionsManager,
    changed: ISuggestionChange
  ) {
    const { notebookPath, ...newChanged } = changed;
    if (notebookPath === this._filePath) {
      this._suggestionChanged.emit(newChanged);
    }
  }

  private _isDisposed = false;
  private _filePath?: string;
  private _notebookPanel: NotebookPanel | null = null;
  private _notebookSwitched: Signal<this, void> = new Signal(this);
  private _allSuggestions?: IAllSuggestions;
  private _suggestionsManager?: ISuggestionsManager;
  private _suggestionChanged = new Signal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  >(this);
  private _activeCellChanged = new Signal<
    ISuggestionsModel,
    { cellId?: string }
  >(this);
}

export namespace SuggestionsModel {
  export interface IOptions {
    panel: NotebookPanel | null;
    suggestionsManager?: ISuggestionsManager;
  }
}
