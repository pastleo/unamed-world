import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

import type { Game } from '../game';
import type { Tool } from '../tools';

import MainToolbox from './mainToolbox';
import TopTools from './topTools';

import 'swiper/css';
import 'swiper/css/manipulation';
import 'swiper/css/mousewheel';

export interface UIManager {
  updateSelectableMainTools: () => void;
  updateSelectedMainTool: () => void;
}

export function create(): UIManager {
  return {
    updateSelectableMainTools: () => {},
    updateSelectedMainTool: () => {},
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
      <UI game={game} onReady={resolve} />,
      domRoot,
    );
  });
}

interface UIContextPayload {
  game: Game;
  selectableMainTools: Tool[];
  selectedMainTool: string;
}

export const UIContext = React.createContext<UIContextPayload>(null);

function UI({ game, onReady }: { game: Game, onReady: () => void }) {
  const [selectableMainTools, setSelectableMainTools] = useState<Tool[]>([...game.tools.toolsBox]);
  const [selectedMainTool, setSelectedMainTool] = useState(game.tools.activeTool);

  useEffect(() => {
    game.ui.updateSelectedMainTool = () => {
      setSelectedMainTool(game.tools.activeTool);
    };
    game.ui.updateSelectableMainTools = () => {
      setSelectableMainTools([...game.tools.toolsBox]);
    };
    onReady();
  }, []);

  return (
    <UIContext.Provider value={{
      game, selectableMainTools, selectedMainTool,
    }}>
      <MainToolbox />
      <TopTools />
    </UIContext.Provider>
  );
}
