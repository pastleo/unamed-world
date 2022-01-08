import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

import type { Game } from '../game';
import type { Tool } from '../tools';

import MainToolbox from './mainToolbox';
import TopTools from './topTools';
import ModalManager, { UIModal, create as createUIModal } from './modal';

import { usePromise } from './hooks';

import 'swiper/css';
import 'swiper/css/manipulation';
import 'swiper/css/mousewheel';

export interface UI {
  updateSelectableMainTools: () => void;
  updateSelectedMainTool: () => void;
  modal: UIModal;
}

export function create(): UI {
  return {
    updateSelectableMainTools: () => {},
    updateSelectedMainTool: () => {},
    modal: createUIModal(),
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
}

export const UIContext = React.createContext<UIContextPayload>(null);

function UIRoot({ game, onReady }: { game: Game, onReady: () => void }) {
  const [selectableMainTools, setSelectableMainTools] = useState<Tool[]>([...game.tools.toolsBox]);
  const [selectedMainTool, setSelectedMainTool] = useState(game.tools.activeTool);

  const [modalManagerReadyPromise, onModalManagerReady] = usePromise<void>([]);
  useEffect(() => {
    game.ui.updateSelectedMainTool = () => {
      setSelectedMainTool(game.tools.activeTool);
    };
    game.ui.updateSelectableMainTools = () => {
      setSelectableMainTools([...game.tools.toolsBox]);
    };

    Promise.all([
      modalManagerReadyPromise,
    ]).then(onReady);
  }, []);

  return (
    <UIContext.Provider value={{
      game, selectableMainTools, selectedMainTool,
    }}>
      <MainToolbox />
      <TopTools />
      <ModalManager onReady={onModalManagerReady} />
    </UIContext.Provider>
  );
}
