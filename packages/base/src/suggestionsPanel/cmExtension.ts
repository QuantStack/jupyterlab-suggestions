import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  ViewUpdate,
  WidgetType,
  EditorView
} from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { ICellModel } from '@jupyterlab/cells';
import * as Diff from 'diff';
import { Debouncer } from '@lumino/polling';
class HighlightDiff {
  constructor(
    view: EditorView,
    options: { originalCell: ICellModel; liveUpdate: boolean }
  ) {
    this._view = view;
    this.decorations = Decoration.none;
    this._originalCell = options.originalCell;
    this._debouncedUpdate = new Debouncer(
      this.originalCellUpdated.bind(this),
      500
    );
    if (options.liveUpdate) {
      this._originalCell.sharedModel.changed.connect(
        this._debouncedUpdate.invoke,
        this._debouncedUpdate
      );
    }
    this.updateDecorations();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) {
      this.updateDecorations();
    }
  }
  originalCellUpdated() {
    this.updateDecorations();
    this._view.dispatch({
      effects: StateEffect.appendConfig.of([])
    });
  }
  updateDecorations() {
    const currentText = this._view.state.doc.toString();
    // Compare words with spaces
    const originalText = this._originalCell.sharedModel.getSource();
    const diffs = Diff.diffWordsWithSpace(originalText, currentText);

    const decorations = [];
    let pos = 0;

    for (const diff of diffs) {
      const length = diff.value.length;

      if (diff.added) {
        // Highlight added text
        decorations.push(
          Decoration.mark({
            class: 'cm-cell-diff-added'
          }).range(pos, pos + length)
        );
        pos += length; // Move the position for added text
      } else if (diff.removed) {
        // Keep removed text and display it inline as strikethrough
        decorations.push(
          Decoration.widget({
            widget: new RemovedTextWidget(diff.value),
            side: -1
          }).range(pos, pos) // Insert before current position
        );
      } else {
        pos += length; // Unchanged text
      }
    }

    this.decorations = Decoration.set(decorations);
  }

  destroy() {
    this._originalCell.sharedModel.changed.disconnect(
      this._debouncedUpdate.invoke
    );
  }

  decorations: DecorationSet;
  _originalCell: ICellModel;
  _view: EditorView;
  _debouncedUpdate: Debouncer;
}
/**
 * Widget to show removed text
 *
 * @class RemovedTextWidget
 * @extends {WidgetType}
 */
class RemovedTextWidget extends WidgetType {
  constructor(text: string) {
    super();
    this._text = text;
  }

  get text(): string {
    return this._text;
  }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this._text;
    span.className = 'cm-cell-diff-removed';
    return span;
  }

  eq(other: WidgetType) {
    return other instanceof RemovedTextWidget && other.text === this.text;
  }

  updateDOM() {
    return false;
  }

  private _text: string;
}

export function diffTextExtensionFactory(options: {
  originalCell: ICellModel;
  liveUpdate: boolean;
}) {
  return ViewPlugin.fromClass(
    class extends HighlightDiff {
      constructor(view: any) {
        super(view, options);
      }
    },
    {
      decorations: (v: HighlightDiff) => v.decorations
    }
  );
}
