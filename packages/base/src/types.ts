import { NotebookPanel } from '@jupyterlab/notebook';
import { ISignal } from '@lumino/signaling';
import { IDisposable } from '@lumino/disposable';
import { Cell, ICellModel } from '@jupyterlab/cells';
export interface IDict<T = any> {
  [key: string]: T;
}

/**
 * Interface defining the structure of a suggestion returned from a manager.
 **/
export interface ISuggestionData {
  /**
   * The current id of the cell being suggested.
   */
  originalCellId: string;

  /**
   * The model of the suggestion cell.
   */
  cellModel: ICellModel;
}

/**
 * Interface defining the structure of a suggestion used by the view widget.
 **/
export interface ISuggestionViewData {
  /**
   * The current model of the cell being suggested.
   */
  originalCellModel: ICellModel;

  /**
   * The model of the suggestion cell.
   */
  cellModel: ICellModel;
}

/**
 * Interface defining the structure and behavior of a suggestions model.
 *
 * The ISuggestionsModel interface represents the underlying data model
 * for managing suggestions of a notebook. It provides
 * methods and properties to track the current notebook, handle
 * suggestion-related changes, and interact with the notebook cells.
 */
export interface ISuggestionsModel extends IDisposable {
  /**
   * Does current manager support live update of the source cell.
   */
  sourceLiveUpdate: boolean;

  /**
   * The file path of the currently active notebook.
   */
  filePath: string;

  /**
   * The currently active notebook panel or null if no notebook is active.
   */
  currentNotebookPanel: NotebookPanel | null;

  /**
   * All suggestions associated with the current notebook.
   */
  allSuggestions: IAllSuggestionViewData | undefined;

  /**
   * Signal emitted when the notebook is switched.
   */
  notebookSwitched: ISignal<ISuggestionsModel, void>;

  /**
   * Signal emitted when the active cell in the notebook changes.
   *
   * The signal emits an object containing the ID of the new active
   * cell (if applicable).
   */
  activeCellChanged: ISignal<ISuggestionsModel, { cellId?: string }>;

  /**
   * Signal emitted when a suggestion is changed.
   *
   * This excludes the `notebookPath` property from the emitted suggestion
   * change data.
   */
  suggestionChanged: ISignal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  >;

  /**
   * Name of the current suggestion manager.
   */
  getSuggestionManagerName(): string;

  /**
   * Switches the active notebook to the specified panel or null.
   *
   * @param panel - The new notebook panel to activate, or null
   * to deactivate the current notebook.
   * @returns A promise that resolves when the switch is complete.
   */
  switchNotebook(panel: NotebookPanel | null): Promise<void>;

  /**
   * Switches the active suggestion manager.
   *
   * @param manager - The new suggestion to activate.
   * @returns A promise that resolves when the switch is complete.
   */
  switchManager(manager: ISuggestionsManager | undefined): Promise<void>;

  /**
   * Adds a new suggestion to the currently active cell.
   *
   * @returns A promise that resolves when the suggestion is added.
   */
  addSuggestion(): Promise<void>;

  /**
   * Deletes a suggestion from a specified cell.
   *
   * @param options - An object containing the cell ID (optional) and
   * suggestion ID.
   * @returns A promise that resolves when the suggestion is deleted.
   */
  deleteSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<void>;

  /**
   * Accepts a suggestion for a specified cell.
   *
   * @param options - An object containing the cell ID (optional)
   * and suggestion ID.
   * @returns A promise that resolves `true` when the suggestion is
   * accepted, `false` otherwise
   */
  acceptSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<boolean>;

  /**
   * Updates the content of a suggestion in a specified cell.
   *
   * @param options - An object containing the cell ID (optional),
   * suggestion ID, and new source.
   * @returns A promise that resolves when the suggestion is updated.
   */
  updateSuggestion(options: {
    cellId?: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void>;

  /**
   * Retrieves the details of a suggestion by cell ID and suggestion ID.
   *
   * @param options - An object containing the cell ID and suggestion ID.
   * @returns A promise that resolves to the suggestion data or undefined
   * if not found.
   */
  getSuggestion(options: {
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionViewData | undefined>;

  /**
   * Retrieves the index of a cell by its ID.
   *
   * @param cellId - The ID of the cell (optional).
   * @returns The index of the cell, or -1 if the cell is not found.
   */
  getCellIndex(cellId?: string): number;
}

export interface ISuggestionChange {
  notebookPath: string;
  cellId: string;
  operator: 'added' | 'deleted' | 'modified';
  suggestionId: string;
}
export type IAllSuggestionViewData = Map<string, IDict<ISuggestionViewData>>;
export type IAllSuggestionData = Map<string, IDict<ISuggestionData>>;

/**
 * Interface defining a suggestions manager.
 *
 * The ISuggestionsManager interface provides methods for managing code suggestions.
 * It allows for retrieving, adding, updating, and deleting suggestions linked to
 * specific cells in a notebook. The interface also emits a signal when a suggestion
 * is changed.
 */
export interface ISuggestionsManager extends IDisposable {
  /**
   * Suggestion manager name
   */
  name: string;

  /**
   * Does this manager support live update of the source cell?
   */
  sourceLiveUpdate: boolean;

  /**
   * Signal emitted when a suggestion is changed.
   */
  suggestionChanged: ISignal<ISuggestionsManager, ISuggestionChange>;
  /**
   * Retrieves all suggestions for a given notebook.
   *
   * @param notebook - The notebook panel for which suggestions are requested.
   * @returns An object containing all suggestions or undefined if
   * no suggestions are available.
   */
  getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestionData | undefined>;

  /**
   * Adds a new suggestion to a specified cell in the notebook.
   *
   * @param options - An object containing the target notebook and cell.
   * @returns A promise that resolves to the ID of the added suggestion.
   */
  addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
  }): Promise<string>;

  /**
   * Retrieves details of a specific suggestion by notebook path,
   * cell ID, and suggestion ID.
   *
   * @param options - An object specifying the notebook path, cell ID,
   * and suggestion ID.
   * @returns The data of the requested suggestion or undefined if not found.
   */
  getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionData | undefined>;

  /**
   * Deletes a suggestion from a specified cell in the notebook.
   *
   * @param options - An object containing the notebook, cell ID,
   * and suggestion ID.
   * @returns A promise that resolves when the deletion is complete.
   */
  deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void>;

  /**
   * Accepts a suggestion for a specified cell of a notebook.
   *
   * @param options - An object containing the notebook, cell ID,
   * and suggestion ID.
   * @returns A promise that resolves `true` when the suggestion is
   * accepted, `false` otherwise
   */
  acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean>;

  /**
   * Updates the content of a suggestion in a specified cell.
   *
   * @param options - An object containing the notebook, cell ID, suggestion ID,
   * and new suggestion source.
   * @returns A promise that resolves when the update is complete.
   */
  updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void>;
}

/**
 * Interface defining the structure and behavior of a suggestions manager
 * registry.
 *
 * The `ISuggestionsManagerRegistry` interface provides mechanisms for
 * registering, managing, and switching between multiple suggestions managers.
 * It supports operations such as activation, retrieval, and event signaling for
 * changes in managers.
 */
export interface ISuggestionsManagerRegistry extends IDisposable {
  /**
   * Registers a new suggestions manager with the registry.
   *
   * @param options - An object containing:
   *   - `id`: A unique identifier for the manager.
   *   - `manager`: The instance of the `ISuggestionsManager` to register.
   * @returns A promise that resolves to `true` if the manager was successfully
   * registered, or `false` if a manager with the same ID already exists.
   */
  register(options: {
    id: string;
    manager: ISuggestionsManager;
  }): Promise<boolean>;

  /**
   * Retrieves the currently activated suggestions manager.
   *
   * @returns A promise that resolves to the activated `ISuggestionsManager`,
   * or `undefined` if no manager is currently activated.
   */
  getActivatedManager(): Promise<ISuggestionsManager | undefined>;

  /**
   * Activates a specific suggestions manager by its ID.
   *
   * @param id - The unique identifier of the manager to activate.
   * @returns A promise that resolves to `true` if the manager was successfully
   * activated or `false` if no manager with the specified ID exists.
   */
  setManager(id: string): Promise<boolean>;

  /**
   * Retrieves a list of all registered manager IDs.
   *
   * @returns An array of strings, each representing the unique ID
   * of a registered manager.
   */
  getAllManagers(): string[];

  /**
   * Signal emitted when the active manager is changed.
   *
   * The signal emits the newly activated `ISuggestionsManager` instance.
   */
  managerChanged: ISignal<ISuggestionsManagerRegistry, ISuggestionsManager>;

  /**
   * Signal emitted when a new manager is registered.
   *
   * The signal emits the unique ID of the newly registered manager.
   */
  managerRegistered: ISignal<ISuggestionsManagerRegistry, string>;
}
