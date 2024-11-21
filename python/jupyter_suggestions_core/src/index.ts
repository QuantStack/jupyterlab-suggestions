import {
  SuggestionsModel,
  SuggestionsPanelWidget,
  hintIcon
} from '@jupyter-suggestions/base';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';

const NAME_SPACE = '@jupyter-suggestions';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-suggestions:plugin',
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [ILayoutRestorer, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer,
    tracker: INotebookTracker
  ) => {
    console.log('JupyterLab extension jupyter-suggestions is activated!');
    const model = new SuggestionsModel();
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

export default plugin;
