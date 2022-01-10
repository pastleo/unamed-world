import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

import type { Game } from '../game';
import type { Tool } from '../tools';

import MainToolbox from './mainToolbox';
import TopTools from './topTools';
import ModalManager, { UIModal } from './modal';
import { UIOptions } from './options';

import 'swiper/css';
import 'swiper/css/manipulation';
import 'swiper/css/mousewheel';

export interface UI {
  updateSelectableMainTools: () => void;
  updateSelectedMainTool: () => void;
  modal: UIModal;
  options: UIOptions;
}

export function create(): UI {
  return {
    updateSelectableMainTools: null,
    updateSelectedMainTool: null,
    modal: null,
    options: null,
  };
}

export async function start(game: Game) {
  await new Promise<void>(resolve => {
    /**
     * domRoot not on placed in <body>, use portal to render UI portion in each child
     * https://reactjs.org/docs/portals.html
     */
    const domRoot = document.createElement('div');

    ReactDOM.render(
      <UIRoot game={game} onReady={resolve} />,
      domRoot,
    );
  });

  // UI ready
}

interface UIContextPayload {
  game: Game;
  selectableMainTools: Tool[];
  selectedMainTool: string;
  maybeReady: () => void;
}

export const UIContext = React.createContext<UIContextPayload>(null);

function UIRoot({ game, onReady }: { game: Game, onReady: () => void }) {
  const [selectableMainTools, setSelectableMainTools] = useState<Tool[]>([...game.tools.toolsBox]);
  const [selectedMainTool, setSelectedMainTool] = useState(game.tools.activeTool);

  const maybeReady = useCallback(() => {
    const {
      updateSelectableMainTools, updateSelectedMainTool,
      modal, options,
    } = game.ui;
    const allReady = (
      updateSelectableMainTools && updateSelectedMainTool &&
      modal && options
    );
    if (!allReady) return;

    onReady();
  }, []);

  useEffect(() => {
    game.ui.updateSelectedMainTool = () => {
      setSelectedMainTool(game.tools.activeTool);
    };
    game.ui.updateSelectableMainTools = () => {
      setSelectableMainTools([...game.tools.toolsBox]);
    };

    maybeReady();
  }, []);

  return (
    <UIContext.Provider value={{
      game, selectableMainTools, selectedMainTool,
      maybeReady,
    }}>
      <MainToolbox />
      <TopTools />
      <ModalManager />
    </UIContext.Provider>
  );
}
