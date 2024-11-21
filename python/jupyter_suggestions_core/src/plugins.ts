import {
  hintIcon,
  ISuggestionsModel,
  SuggestionsModel,
  SuggestionsPanelWidget
} from '@jupyter/jupyter-suggestions-base';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ISuggestionsModelToken } from './tokens';

const NAME_SPACE = '@jupyter/jupyter-suggestions-core';

export const suggestionsModelPlugin: JupyterFrontEndPlugin<ISuggestionsModel> =
  {
    id: `${NAME_SPACE}:suggestion-model`,
    description: 'The model of the suggestions panel',
    autoStart: true,
    requires: [ILayoutRestorer, INotebookTracker],
    provides: ISuggestionsModelToken,
    activate: (
      app: JupyterFrontEnd,
      restorer: ILayoutRestorer,
      tracker: INotebookTracker
    ): ISuggestionsModel => {
      console.log(`${NAME_SPACE}:suggestion-model is activated`);
      const model = new SuggestionsModel();

      return model;
    }
  };

export const COMMAND_IDS = {
  /**
   * Command to add a cell suggestion.
   */
  addCellSuggestion: 'jupyter-suggestions-core:add-cell-suggestion'
};

export const commandsPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:commands`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [ISuggestionsModelToken],
  activate: (app: JupyterFrontEnd, model: ISuggestionsModel) => {
    console.log(`${NAME_SPACE}:suggestion-commands is activated`);
    const { commands } = app;
    commands.addCommand(COMMAND_IDS.addCellSuggestion, {
      icon: hintIcon,
      caption: 'Add suggestion',
      execute: () => {
        //
      },
      isVisible: () => true
    });
  }
};

export const suggestionsPanelPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:suggestion-panel`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [ISuggestionsModelToken, ILayoutRestorer, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    model: ISuggestionsModel,
    restorer: ILayoutRestorer,
    tracker: INotebookTracker
  ) => {
    console.log(`${NAME_SPACE}:suggestion-panel is activated`);
    const panel = new SuggestionsPanelWidget({ model, tracker });
    panel.id = 'jupyter-suggestions::main-panel';
    panel.title.caption = 'Jupyter Suggestions';
    panel.title.icon = hintIcon;
    if (restorer) {
      restorer.add(panel, NAME_SPACE);
    }
    app.shell.add(panel, 'right', { rank: 2000, activate: false });
  }
};
