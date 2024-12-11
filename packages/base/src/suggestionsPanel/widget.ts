import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';

import {
  ISuggestionChange,
  ISuggestionViewData,
  ISuggestionsModel
} from '../types';
import { CellWidget, suggestionCellSelectedStyle } from './suggestionWidget';
import { suggestionsWidgetAreaStyle } from './style';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ISharedCell } from '@jupyter/ydoc';
import { Debouncer } from '@lumino/polling';

export class SuggestionsWidget extends PanelWithToolbar {
  constructor(options: SuggestionsWidget.IOptions) {
    super(options);
    this.title.label = 'All Suggestions';
    this._model = options.model;
    this._suggestionsArea.addClass(suggestionsWidgetAreaStyle);
    this._suggestionsArea.addClass('jp-scrollbar-tiny');
    this.addWidget(this._suggestionsArea);

    this._renderSuggestions();

    this._model.suggestionChanged.connect(this._updateSuggestions, this);

    this._model.notebookSwitched.connect(this._handleNotebookSwitched, this);

    this._model.activeCellChanged.connect(this._handleActiveCellChanged, this);
  }

  dispose(): void {
    this._model.suggestionChanged.disconnect(this._updateSuggestions);

    this._model.notebookSwitched.disconnect(this._handleNotebookSwitched);

    this._model.activeCellChanged.disconnect(this._handleActiveCellChanged);
  }
  private async _updateSuggestions(
    _: ISuggestionsModel,
    changedArg: Omit<ISuggestionChange, 'notebookPath'>
  ) {
    const { operator, cellId, suggestionId } = changedArg;
    switch (operator) {
      case 'added': {
        const suggestion = await this._model.getSuggestion({
          cellId,
          suggestionId
        });
        if (suggestion) {
          const { widget, index } = this._widgetFactory({
            suggestionId,
            suggestionData: suggestion
          });
          widget.addClass(suggestionCellSelectedStyle);
          this._suggestionsArea.insertWidget(index, widget);
          this._scrollToWidget(widget);
        }
        break;
      }
      case 'deleted': {
        const allWidgets = this._suggestionsArea.widgets;
        for (const element of allWidgets) {
          if (element.id === suggestionId) {
            element.dispose();
            element.parent = null;
            break;
          }
        }
        break;
      }
      case 'modified': {
        break;
      }

      default:
        break;
    }

    const count = this._suggestionsArea.widgets.length;
    if (count && count !== 0) {
      this.title.label = `All Suggestions (${count})`;
    } else {
      this.title.label = 'All Suggestions';
    }
  }

  private _handleActiveCellChanged(
    sender: ISuggestionsModel,
    args: { cellId?: string }
  ) {
    const widgetLength = this._suggestionsArea.widgets.length;
    let matched = false;
    for (let widgetIdx = 0; widgetIdx < widgetLength; widgetIdx++) {
      const w = this._suggestionsArea.widgets[widgetIdx] as CellWidget;

      if (w.cellId === args.cellId) {
        w.addClass(suggestionCellSelectedStyle);
        w.toggleMinimized(false);
        if (!matched) {
          matched = true;
          this._scrollToWidget(w);
        }
      } else {
        w.removeClass(suggestionCellSelectedStyle);
      }
    }
  }

  private _scrollToWidget(w: CellWidget) {
    const topPos = w.node.offsetTop;
    this._suggestionsArea.node.scrollTop = topPos;
  }

  private _handleNotebookSwitched() {
    this._renderSuggestions();
  }
  private _renderSuggestions() {
    const allSuggestions = this._model.allSuggestions;
    const count = allSuggestions?.size ?? 0;
    if (count && count !== 0) {
      this.title.label = `All Suggestions (${count})`;
    } else {
      this.title.label = 'All Suggestions';
    }
    const allWidgets = [...this._suggestionsArea.widgets];
    for (const element of allWidgets) {
      this._suggestionsArea.layout?.removeWidget(element);
      element.dispose();
      element.parent = null;
    }
    if (allSuggestions) {
      for (const val of allSuggestions.values()) {
        Object.entries(val).forEach(([suggestionId, suggestionData]) => {
          const { widget, index } = this._widgetFactory({
            suggestionId,
            suggestionData
          });
          this._suggestionsArea.insertWidget(index, widget);
        });
      }
    }
  }

  private _widgetFactory(options: {
    suggestionId: string;
    suggestionData: ISuggestionViewData;
  }): { widget: CellWidget; index: number } {
    const { suggestionId, suggestionData } = options;
    const cellId = suggestionData.originalCellModel.id as string | undefined;

    const cellIdx = this._model.getCellIndex(cellId);

    if (cellIdx in this._indexCount) {
      this._indexCount[cellIdx] += 1;
    } else {
      this._indexCount[cellIdx] = 1;
    }
    let suggestionPos = 0;
    for (let key = 0; key <= cellIdx; key++) {
      suggestionPos += this._indexCount[key] ?? 0;
    }

    const deleteCallback = async () => {
      const { button } = await showDialog({
        title: 'Discard suggestion',
        body: 'Do you want to discard the suggestion?',
        buttons: [Dialog.cancelButton(), Dialog.okButton()],
        hasClose: true
      });
      if (button.accept) {
        await this._model.deleteSuggestion({ cellId, suggestionId });
      }
    };

    const debouncer = new Debouncer(async (cellModel: ISharedCell) => {
      const newContent = cellModel.toJSON();
      await this._model.updateSuggestion({
        cellId,
        suggestionId,
        newSource: newContent.source as string
      });
    }, 500);
    suggestionData.cellModel.sharedModel.changed.connect(
      async (cellModel, changed) => {
        debouncer.invoke(cellModel);
      }
    );
    suggestionData.cellModel.sharedModel.disposed.connect(
      () => void debouncer.dispose()
    );

    const acceptCallback = async () => {
      const accepted = await this._model.acceptSuggestion({
        cellId,
        suggestionId
      });
      if (!accepted) {
        const { button } = await showDialog({
          title: 'Error accepting suggestion',
          body: 'Cannot accept suggestion, do you want to discard it?',
          buttons: [Dialog.cancelButton(), Dialog.okButton()],
          hasClose: true
        });
        if (button.accept) {
          await this._model.deleteSuggestion({ cellId, suggestionId });
        }
      }
    };
    const w = new CellWidget({
      suggestionData,
      deleteCallback,
      acceptCallback,
      liveUpdate: this._model.sourceLiveUpdate
    });

    w.id = suggestionId;
    return { widget: w, index: suggestionPos - 1 };
  }

  private _suggestionsArea = new Panel();
  private _indexCount: { [key: number]: number } = {};
  private _model: ISuggestionsModel;
}

export namespace SuggestionsWidget {
  export interface IOptions extends PanelWithToolbar.IOptions {
    model: ISuggestionsModel;
  }
}
