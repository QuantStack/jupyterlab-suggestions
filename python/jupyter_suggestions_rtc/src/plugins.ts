import {
  ISuggestionsManagerRegistry,
  ISuggestionsManagerRegistryToken
} from '@jupyter/suggestions-base';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { RtcSuggestionsManager } from './manager';

import { IForkManager, IForkManagerToken } from '@jupyter/docprovider';
import { ICollaborativeDrive } from '@jupyter/collaborative-drive';

const NAME_SPACE = '@jupyter/suggestions-rtc';

export const suggestionsManagerPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:manager`,
  description: 'jupyter_suggestions with jupyter_collaboration backend',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [
    ICollaborativeDrive,
    ISuggestionsManagerRegistryToken,
    IForkManagerToken
  ],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    drive?: ICollaborativeDrive,
    managerRegistry?: ISuggestionsManagerRegistry,
    forkManager?: IForkManager
  ) => {
    console.log(`${NAME_SPACE}:manager is activated`);
    if (managerRegistry && forkManager && drive) {
      const manager = new RtcSuggestionsManager({
        tracker,
        forkManager,
        drive
      });
      const success = managerRegistry.register({
        id: 'RTC Suggestion Manager',
        manager
      });
      if (!success) {
        console.log('Failed to register the RTC suggestion manager');
      }
    }
  }
};
