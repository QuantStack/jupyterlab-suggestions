import {
  hintIcon,
  ISuggestionsManagerRegistry,
  ISuggestionsManagerRegistryToken,
  ISuggestionsModel,
  ISuggestionsModelToken,
  LocalSuggestionsManager,
  SuggestionsManagerRegistry,
  SuggestionsModel,
  SuggestionsPanelWidget
} from '@jupyter/jupyter-suggestions-base';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import {
  IFormRenderer,
  IFormRendererRegistry
} from '@jupyterlab/ui-components';
import { SuggestionsSettingComponent } from './settingrenderer';
import type { FieldProps } from '@rjsf/utils';

const NAME_SPACE = '@jupyter/jupyter-suggestions-core';

export const suggestionsModelPlugin: JupyterFrontEndPlugin<ISuggestionsModel> =
  {
    id: `${NAME_SPACE}:model`,
    description: 'The model of the suggestions panel',
    autoStart: true,
    requires: [INotebookTracker, ISuggestionsManagerRegistryToken],
    provides: ISuggestionsModelToken,
    activate: async (
      app: JupyterFrontEnd,
      tracker: INotebookTracker,
      suggestionsManagerRegistry: ISuggestionsManagerRegistry
    ): Promise<ISuggestionsModel> => {
      console.log(`${NAME_SPACE}:model is activated`);
      const suggestionsManager =
        await suggestionsManagerRegistry.getActivatedManager();
      const model = new SuggestionsModel({
        panel: tracker.currentWidget,
        suggestionsManager
      });
      tracker.currentChanged.connect(async (_, changed) => {
        if (changed) {
          await changed.context.ready;
          model.switchNotebook(changed);
        } else {
          model.switchNotebook(null);
        }
      });
      suggestionsManagerRegistry.managerChanged.connect((_, newManager) => {
        model.switchManager(newManager);
      });
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
  requires: [INotebookTracker, ISuggestionsModelToken],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    model: ISuggestionsModel,
    translator_: ITranslator | null
  ) => {
    console.log(`${NAME_SPACE}:commands is activated`);
    const { commands } = app;
    const translator = translator_ ?? nullTranslator;
    const trans = translator.load('jupyterlab');
    commands.addCommand(COMMAND_IDS.addCellSuggestion, {
      icon: hintIcon,
      caption: trans.__('Add suggestion'),
      execute: async () => {
        const current = tracker.currentWidget;
        if (current !== model.currentNotebookPanel) {
          await model.switchNotebook(current);
        }
        await model.addSuggestion();
      },
      isVisible: () => true
    });
    tracker.activeCellChanged.connect(() => {
      commands.notifyCommandChanged(COMMAND_IDS.addCellSuggestion);
    });
    tracker.selectionChanged.connect(() => {
      commands.notifyCommandChanged(COMMAND_IDS.addCellSuggestion);
    });
  }
};

export const suggestionsPanelPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:panel`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [ISuggestionsModelToken, ILayoutRestorer],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    model: ISuggestionsModel,
    restorer: ILayoutRestorer,
    translator_: ITranslator | null
  ) => {
    console.log(`${NAME_SPACE}:panel is activated`);
    const translator = translator_ ?? nullTranslator;
    const panel = new SuggestionsPanelWidget({ model, translator });
    panel.id = 'jupyter-suggestions:main-panel';
    panel.title.caption = 'Jupyter Suggestions';
    panel.title.icon = hintIcon;
    if (restorer) {
      restorer.add(panel, NAME_SPACE);
    }
    app.shell.add(panel, 'right', { rank: 2000, activate: false });
  }
};

export const suggestionsManagerPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:manager`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISuggestionsManagerRegistryToken],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    managerRegistry?: ISuggestionsManagerRegistry
  ) => {
    console.log(`${NAME_SPACE}:manager is activated`);
    if (managerRegistry) {
      const manager = new LocalSuggestionsManager({ tracker });
      const success = managerRegistry.register({
        id: 'Local Suggestion Manager',
        manager
      });
      if (!success) {
        console.log('Failed to register the local suggestion manager');
      }
    }
  }
};

export const registryPlugin: JupyterFrontEndPlugin<ISuggestionsManagerRegistry> =
  {
    id: `${NAME_SPACE}:registry`,
    description: 'Provides the suggestions manager registry.',
    requires: [ISettingRegistry],
    optional: [IFormRendererRegistry, ITranslator],
    provides: ISuggestionsManagerRegistryToken,
    autoStart: true,
    activate: (
      app: JupyterFrontEnd,
      settingRegistry: ISettingRegistry,
      settingRendererRegistry: IFormRendererRegistry | null,
      translator_: ITranslator | null
    ) => {
      console.log(`${NAME_SPACE}:registry is activated`);
      const SETTING_KEY = 'suggestionsManager';
      const pluginId = `${NAME_SPACE}:registry`;
      const registryManager = new SuggestionsManagerRegistry();
      const translator = translator_ ?? nullTranslator;

      if (settingRendererRegistry) {
        const renderer: IFormRenderer = {
          fieldRenderer: (props: FieldProps) => {
            return SuggestionsSettingComponent({ ...props, translator });
          }
        };
        settingRendererRegistry.addRenderer(
          `${pluginId}.${SETTING_KEY}`,
          renderer
        );
      }

      const updateOptions = async (settings: ISettingRegistry.ISettings) => {
        const options = settings.composite as { suggestionsManager: string };
        await registryManager.setManager(options.suggestionsManager);
      };

      settingRegistry.transform(pluginId, {
        fetch: plugin => {
          const schemaProperties = plugin.schema.properties!;
          const allManagers = registryManager.getAllManagers();

          if (allManagers.length) {
            schemaProperties[SETTING_KEY]['availableManagers'] = allManagers;
          }

          return plugin;
        }
      });
      settingRegistry
        .load(pluginId)
        .then(settings => {
          updateOptions(settings);
          settings.changed.connect(() => {
            updateOptions(settings);
          });
        })
        .catch((reason: Error) => {
          console.error(reason);
        });
      registryManager.managerRegistered.connect(() => {
        settingRegistry.load(pluginId, true);
      });

      return registryManager;
    }
  };
