import { Cell } from '@jupyterlab/cells';
import {
  deleteIcon,
  editIcon,
  ReactWidget,
  ToolbarButtonComponent
} from '@jupyterlab/ui-components';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { hintIcon } from '../icons';
import {
  activated,
  cellWithSuggestionStyle,
  toolbarMenuButtonStyle,
  toolbarMenuItemStyle,
  toolbarMenuStyle
} from './style';
import { CommandRegistry } from '@lumino/commands';
import { COMMAND_IDS } from '../tools';
import { ISuggestionChange, ISuggestionsModel } from '../types';
interface IProps {
  cell?: Cell;
  commands: CommandRegistry;
  suggestionModel: ISuggestionsModel;
}
interface IMenuProps {
  open: boolean;
  left: string;
  top: string;
  executeAddSuggestion: () => void;
  executeAddDeleteCellSuggestion: () => void;
}
const Menu = React.forwardRef((props: IMenuProps, ref) => {
  const {
    left,
    top,
    executeAddSuggestion,
    executeAddDeleteCellSuggestion,
    open
  } = props;
  return ReactDOM.createPortal(
    <div
      style={{ left, top, visibility: open ? 'visible' : 'hidden' }}
      className={`lm-Menu ${toolbarMenuStyle}`}
      ref={ref as any}
    >
      <ul className="lm-Menu-content">
        <li className={`${toolbarMenuItemStyle} lm-Menu-item`}>
          <div className="lm-Menu-itemIcon">
            <editIcon.react />
          </div>
          <div
            onClick={executeAddSuggestion}
            style={{ padding: 0 }}
            className="lm-Menu-itemLabel"
          >
            Suggest change
          </div>
        </li>
        <li className={`${toolbarMenuItemStyle} lm-Menu-item`}>
          <div className="lm-Menu-itemIcon">
            <deleteIcon.react />
          </div>
          <div
            style={{ padding: 0 }}
            onClick={executeAddDeleteCellSuggestion}
            className="lm-Menu-itemLabel"
          >
            Suggest delete
          </div>
        </li>
      </ul>
    </div>,
    document.body
  );
});
function _CellToolbarMenuReact(props: IProps) {
  const { commands, cell, suggestionModel } = props;
  const [open, setOpen] = React.useState(false);
  const forceUpdate = React.useReducer(x => x + 1, 0);
  const [pos, setPos] = React.useState<{ top: string; left: string }>({
    top: '0px',
    left: '0px'
  });
  const currentDiv = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const updatePosition = React.useCallback(() => {
    if (currentDiv.current) {
      const clientRect = currentDiv.current.getBoundingClientRect();
      const left = clientRect.left;
      const top = clientRect.top;
      setPos({ left: `${left}px`, top: `${top}px` });
    }
  }, []);
  const toggleOpen = React.useCallback(() => {
    updatePosition();
    setOpen(old => !old);
  }, [updatePosition]);
  const executeAddSuggestion = React.useCallback(() => {
    commands.execute(COMMAND_IDS.addCellSuggestion);
    setOpen(false);
  }, [commands]);
  const executeAddDeleteCellSuggestion = React.useCallback(() => {
    commands.execute(COMMAND_IDS.addDeleteCellSuggestion);
    setOpen(false);
  }, [commands]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as any;
      if (!target) {
        return;
      }
      if (currentDiv.current && currentDiv.current.contains(target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentDiv]);

  const cellSuggestions = cell?.model?.id
    ? (suggestionModel.getCellSuggestions({
        cellId: cell.model.id
      }) ?? {})
    : {};
  const hasSuggestion = Object.keys(cellSuggestions).length;
  React.useEffect(() => {
    const handler = (
      model: ISuggestionsModel,
      changed: Omit<ISuggestionChange, 'notebookPath'>
    ) => {
      if (changed.cellId === cell?.model?.id) {
        setTimeout(() => {
          forceUpdate[1]();
        }, 0); // Refresh in the next tick
      }
    };
    suggestionModel.suggestionChanged.connect(handler);
    return () => {
      suggestionModel.suggestionChanged.disconnect(handler);
    };
  });
  return (
    <div
      ref={currentDiv}
      className={`${toolbarMenuButtonStyle} ${open ? activated : ''}`}
    >
      <ToolbarButtonComponent
        icon={hintIcon}
        onClick={toggleOpen}
        className={`${hasSuggestion ? cellWithSuggestionStyle : ''}`}
        tooltip="Suggestion menu"
      />
      <Menu
        ref={menuRef}
        open={open}
        top={pos.top}
        left={pos.left}
        executeAddSuggestion={executeAddSuggestion}
        executeAddDeleteCellSuggestion={executeAddDeleteCellSuggestion}
      />
    </div>
  );
}

const CellToolbarMenuReact = React.memo(_CellToolbarMenuReact);

export class CellToolbarMenu extends ReactWidget {
  constructor(private options: IProps) {
    super();
  }

  render(): JSX.Element {
    return <CellToolbarMenuReact {...this.options} />;
  }
}
