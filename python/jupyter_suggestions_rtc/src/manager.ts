import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import {
  IForkChangedEvent,
  IForkManager,
  requestDocSession
} from '@jupyter/docprovider';
import {
  BaseSuggestionsManager,
  IAllSuggestionData,
  IDict,
  ISuggestionData,
  ISuggestionsManager
} from '@jupyter/suggestions-base';
import { YNotebook } from '@jupyter/ydoc';
import {
  Cell,
  CellModel,
  CodeCellModel,
  ICellModel,
  MarkdownCellModel,
  RawCellModel
} from '@jupyterlab/cells';
import { URLExt } from '@jupyterlab/coreutils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { PromiseDelegate } from '@lumino/coreutils';
import { WebsocketProvider as YWebsocketProvider } from 'y-websocket';

const DOCUMENT_PROVIDER_URL = 'api/collaboration/room';

export class RtcSuggestionsManager
  extends BaseSuggestionsManager
  implements ISuggestionsManager
{
  constructor(options: RtcSuggestionsManager.IOptions) {
    super(options);
    this._tracker = options.tracker;
    this._tracker;
    this._forkManager = options.forkManager;
    this._drive = options.drive;
    this._serverUrl = URLExt.join(
      this._drive.serverSettings.wsUrl,
      DOCUMENT_PROVIDER_URL
    );
    this._forkManager.forkAdded.connect(this._handleForkAdded, this);
    this._forkManager.forkDeleted.connect(this._handleForkDeleted, this);
  }

  sourceLiveUpdate = true;

  name = 'RTC Suggestion Manager';

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._forkManager.forkAdded.disconnect(this._handleForkAdded);
    this._forkManager.forkDeleted.disconnect(this._handleForkDeleted);
    super.dispose();
  }
  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestionData | undefined> {
    const rootDocId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;

    const [format, type] = rootDocId.split(':');
    const path = notebook.context.localPath;
    if (!this._serverSession) {
      const docSession = await requestDocSession(format, type, path);
      this._serverSession = docSession.sessionId;
    }
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
        const forkMeta = JSON.parse(forkData.description ?? '{}');
        const cellId = forkMeta.cellId;
        const cellModel = await this._cellModelFactory({
          rootDocId,
          forkRoomId,
          cellId,
          mimeType: cellMap[cellId].mimeType
        });
        const data: ISuggestionData = {
          cellModel,
          originalCellId: cellId
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

    const cellId = cell.model.id;
    const rootId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const response = await this._forkManager.createFork({
      rootId,
      synchronize: true,
      //TODO: Update when the fork manager supports metadata
      description: JSON.stringify({
        cellId,
        path,
        mimeType: cell.model.mimeType
      })
    });
    return response?.fork_roomid ?? '';
  }

  async acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { suggestionId } = options;
    try {
      await this._forkManager.deleteFork({ forkId: suggestionId, merge: true });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void> {
    const { suggestionId } = options;
    await this._forkManager.deleteFork({ forkId: suggestionId, merge: false });
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

  private _handleForkDeleted(
    manager: IForkManager,
    changed: IForkChangedEvent
  ) {
    const forkInfo = changed.fork_info;
    const forkMeta = JSON.parse(forkInfo.description ?? '{}');
    const { cellId, path } = forkMeta;
    const suggestionId = changed.fork_roomid;
    if (this._suggestionsMap.has(path)) {
      const nbSuggestions = this._suggestionsMap.get(path);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        delete nbSuggestions.get(cellId)![suggestionId];
        this._suggestionChanged.emit({
          notebookPath: path,
          cellId,
          suggestionId,
          operator: 'deleted'
        });
      }
    }
  }

  private async _handleForkAdded(
    manager: IForkManager,
    changed: IForkChangedEvent
  ) {
    const forkInfo = changed.fork_info;
    const forkMeta = JSON.parse(forkInfo.description ?? '{}');
    const { cellId, path, mimeType } = forkMeta;
    const rootId = forkInfo.root_roomid;
    const suggestionId = changed.fork_roomid;
    if (!path || !cellId) {
      return;
    }
    if (!this._suggestionsMap.has(path)) {
      this._suggestionsMap.set(path, new Map());
    }
    const currentSuggestions = this._suggestionsMap.get(path)!;

    if (!currentSuggestions.has(cellId)) {
      currentSuggestions.set(cellId, {});
    }
    const cellSuggesions = currentSuggestions.get(cellId)!;
    if (cellSuggesions[suggestionId]) {
      return;
    }

    const cellModel = await this._cellModelFactory({
      rootDocId: rootId,
      forkRoomId: suggestionId,
      cellId,
      mimeType
    });
    const suggestionContent: ISuggestionData = {
      originalCellId: cellId,
      cellModel
    };
    cellSuggesions[suggestionId] = suggestionContent;
    this._suggestionChanged.emit({
      notebookPath: path,
      cellId,
      suggestionId,
      operator: 'added'
    });
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

  private _forkManager: IForkManager;
  private _drive: ICollaborativeDrive;
  private _serverSession?: string;
  private _serverUrl: string;
}

export namespace RtcSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
    forkManager: IForkManager;
    drive: ICollaborativeDrive;
  }
}
