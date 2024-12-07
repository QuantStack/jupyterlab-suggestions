import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestions,
  IDict,
  ISuggestionChange,
  ISuggestionData,
  ISuggestionsManager
} from '@jupyter/jupyter-suggestions-base';
import { ISignal, Signal } from '@lumino/signaling';
import {
  Cell,
  CellModel,
  CodeCellModel,
  ICellModel,
  MarkdownCellModel,
  RawCellModel
} from '@jupyterlab/cells';
import { IForkManager, requestAPI } from '@jupyter/docprovider';
import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import { WebsocketProvider as YWebsocketProvider } from 'y-websocket';
import { YNotebook } from '@jupyter/ydoc';
import { URLExt } from '@jupyterlab/coreutils';
import { PromiseDelegate } from '@lumino/coreutils';

const DOCUMENT_PROVIDER_URL = 'api/collaboration/room';

export class RtcSuggestionsManager implements ISuggestionsManager {
  constructor(options: RtcSuggestionsManager.IOptions) {
    this._tracker = options.tracker;
    this._tracker;
    this._forkManager = options.forkManager;
    this._drive = options.drive;
    this._serverUrl = URLExt.join(
      this._drive.serverSettings.wsUrl,
      DOCUMENT_PROVIDER_URL
    );
  }

  sourceLiveUpdate = true;

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
    Signal.clearData(this);
    this._isDisposed = true;
  }

  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestions | undefined> {
    if (!this._serverSession) {
      const res = await requestAPI<{ sessionId: string }>(
        URLExt.join('api/collaboration/session/'),
        {
          method: 'GET'
        }
      );
      this._serverSession = res.sessionId;
    }
    const rootDocId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const path = notebook.context.localPath;
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path);
    } else {
      const allForks = await this._forkManager.getAllForks(rootDocId);
      const currentSuggestion = new Map<string, IDict<ISuggestionData>>();
      const cellList = notebook.content.model?.cells ?? [];
      const cellMap: IDict<ICellModel> = {};
      for (const element of cellList) {
        cellMap[element.id] = element;
      }
      for (const [forkRoomId, forkData] of Object.entries(allForks)) {
        const cellId = forkData.description ?? '';
        const cellModel = await this._cellModelFactory({
          rootDocId,
          forkRoomId,
          cellId,
          mimeType: cellMap[cellId].mimeType
        });
        const data: ISuggestionData = {
          cellModel,
          originalCellModel: cellMap[cellId]
        };
        if (currentSuggestion.has(cellId)) {
          const currentData = currentSuggestion.get(cellId)!;
          currentData[forkRoomId] = data;
        } else {
          currentSuggestion.set(cellId, {
            [forkRoomId]: data
          });
        }
      }

      this._suggestionsMap.set(path, currentSuggestion);
      return currentSuggestion;
    }
  }

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
  async addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
  }): Promise<string> {
    const { notebook, cell } = options;
    const path = notebook.context.localPath;
    if (!this._suggestionsMap.has(path)) {
      this._suggestionsMap.set(path, new Map());
    }
    const currentSuggestions = this._suggestionsMap.get(path)!;
    const cellId = cell.model.id;

    if (!currentSuggestions.has(cellId)) {
      currentSuggestions.set(cellId, {});
    }
    const cellSuggesions = currentSuggestions.get(cellId)!;
    const rootId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const response = await this._forkManager.createFork({
      rootId,
      synchronize: true,
      description: cellId
    });
    if (response?.fork_roomid) {
      const suggestionId = response.fork_roomid;
      const cellModel = await this._cellModelFactory({
        rootDocId: rootId,
        forkRoomId: suggestionId,
        cellId,
        mimeType: cell.model.mimeType
      });
      const suggestionContent: ISuggestionData = {
        originalCellModel: cell.model,
        cellModel
      };
      cellSuggesions[suggestionId] = suggestionContent;

      this._suggestionChanged.emit({
        notebookPath: path,
        cellId,
        suggestionId,
        operator: 'added'
      });
      return suggestionId;
    } else {
      return '';
    }
  }

  async acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean> {
    return await this._deleteSuggesion({ ...options, merge: true });
  }

  async deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void> {
    await this._deleteSuggesion({ ...options, merge: false });
  }

  async _deleteSuggesion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    merge: boolean;
  }): Promise<boolean> {
    const { notebook, cellId, suggestionId, merge } = options;
    const notebookPath = notebook.context.localPath;
    await this._forkManager.deleteFork({ forkId: suggestionId, merge });
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        delete nbSuggestions.get(cellId)![suggestionId];
        this._suggestionChanged.emit({
          notebookPath,
          cellId,
          suggestionId,
          operator: 'deleted'
        });
      }
      return true;
    }
    return false;
  }

  async updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    // no-op
    return;
  }
  private async _cellModelFactory(options: {
    rootDocId: string;
    forkRoomId: string;
    cellId: string;
    mimeType: string;
  }): Promise<CellModel> {
    const { rootDocId, forkRoomId, cellId, mimeType } = options;
    const [format, type] = rootDocId.split(':');
    const sharedModelFactory =
      this._drive.sharedModelFactory.documentFactories.get(type);
    const pd = new PromiseDelegate<CellModel>();
    if (sharedModelFactory) {
      const shared = sharedModelFactory({
        path: forkRoomId,
        format: format as any,
        contentType: type,
        collaborative: true
      }) as any as YNotebook;

      const _yWebsocketProvider = new YWebsocketProvider(
        this._serverUrl,
        forkRoomId,
        shared.ydoc,
        {
          disableBc: true,
          params: { sessionId: this._serverSession! },
          awareness: shared.awareness
        }
      );
      _yWebsocketProvider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          const selectedCell = shared.cells.filter(it => {
            return it.getId() === cellId;
          });
          if (selectedCell[0]) {
            const currentCell = selectedCell[0];
            let copiedCellModel: CellModel | undefined;
            switch (currentCell.cell_type) {
              case 'code': {
                copiedCellModel = new CodeCellModel({
                  sharedModel: currentCell
                });
                copiedCellModel.mimeType = mimeType;
                break;
              }
              case 'markdown': {
                copiedCellModel = new MarkdownCellModel({
                  sharedModel: currentCell
                });
                break;
              }
              case 'raw': {
                copiedCellModel = new RawCellModel({
                  sharedModel: currentCell
                });
                break;
              }
              default:
                break;
            }
            if (copiedCellModel) {
              pd.resolve(copiedCellModel);
            } else {
              pd.reject('Invalid cell type');
            }
          }
        }
      });
    } else {
      pd.reject('Missing factory');
    }
    return pd.promise;
  }
  private _suggestionChanged = new Signal<
    ISuggestionsManager,
    ISuggestionChange
  >(this);
  private _isDisposed = false;
  private _tracker: INotebookTracker;
  private _forkManager: IForkManager;
  private _drive: ICollaborativeDrive;
  private _serverSession?: string;
  private _serverUrl: string;
  private _suggestionsMap = new Map<string, IAllSuggestions>();
}

export namespace RtcSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
    forkManager: IForkManager;
    drive: ICollaborativeDrive;
  }
}
