import { IWidgetTracker } from '@jupyterlab/apputils';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { SidePanel } from '@jupyterlab/ui-components';

import { ISuggestionsModel } from '../types';
import { SuggestionsPanelHeader } from './header';

export class SuggestionsPanelWidget extends SidePanel {
  constructor(options: SuggestionsPanelWidget.IOptions) {
    super();
    this.addClass('jp-suggestions-sidepanel-widget');
    this.node.tabIndex = 0;
    this._model = options.model;

    const header = new SuggestionsPanelHeader();
    this.header.addWidget(header);
    console.log('this model', this._model);
    options.tracker.currentChanged.connect(async (_, changed) => {
      if (changed) {
        header.title.label = changed.context.localPath;
        await changed.context.ready;
      } else {
        header.title.label = '-';
      }
    });
  }

  dispose(): void {
    super.dispose();
  }
  private _model: ISuggestionsModel;
}

export namespace SuggestionsPanelWidget {
  export interface IOptions {
    model: ISuggestionsModel;
    tracker: IWidgetTracker<IDocumentWidget>;
  }
}
