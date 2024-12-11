import { Cell, ICellModel } from '@jupyterlab/cells';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISignal, Signal } from '@lumino/signaling';

import {
  IAllSuggestionData,
  ISuggestionChange,
  ISuggestionData,
  ISuggestionsManager
} from './types';

export abstract class BaseSuggestionsManager implements ISuggestionsManager {
  constructor(options: BaseSuggestionsManager.IOptions) {
    this._tracker = options.tracker;
    this._tracker.widgetAdded.connect(this._notebookAdded, this);
  }

  name = 'Base Suggestion Manager';
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get suggestionChanged(): ISignal<ISuggestionsManager, ISuggestionChange> {
    return this._suggestionChanged;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._tracker.widgetAdded.disconnect(this._notebookAdded);
    Signal.clearData(this);
    this._isDisposed = true;
  }

  abstract sourceLiveUpdate: boolean;

  abstract getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestionData | undefined>;

  async getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionData | undefined> {
    const { notebookPath, cellId, suggestionId } = options;
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        return nbSuggestions.get(cellId)![suggestionId];
      }
    }
  }
  abstract addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
  }): Promise<string>;

  abstract acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean>;

  abstract deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void>;

  abstract updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void>;

  protected _suggestionsMap = new Map<string, IAllSuggestionData>();

  protected _notebookAdded(tracker: INotebookTracker, panel: NotebookPanel) {
    panel.disposed.connect(p => {
      const localPath = p.context.localPath;
      if (this._suggestionsMap.has(localPath)) {
        this._suggestionsMap.delete(localPath);
      }
    });
  }

  protected _suggestionChanged = new Signal<
    ISuggestionsManager,
    ISuggestionChange
  >(this);
  protected _isDisposed = false;
  protected _tracker: INotebookTracker;
}

export namespace BaseSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
  }
}
