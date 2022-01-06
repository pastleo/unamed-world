import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

import type { Game } from '../game';
import type { Tool } from '../tools';

import MainToolbox from './mainToolbox';
import TopTools from './topTools';

import 'swiper/css';

export interface UIManager {
  setToolsBoxActiveIndex: (index: number) => void;
  setToolsBoxTools: (tools: Tool[]) => void;
}

export function create(): UIManager {
  return {
    setToolsBoxActiveIndex: () => {},
    setToolsBoxTools: () => {},
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
  tools: Tool[];
  activeToolIndex: number;
}

export const UIContext = React.createContext<UIContextPayload>(null);

function UI({ game, onReady }: { game: Game, onReady: () => void }) {
  const [tools, setTools] = useState<Tool[]>(game.tools.toolsBox);
  const [activeToolIndex, setActiveToolIndex] = useState(tools.indexOf(game.tools.activeTool));

  useEffect(() => {
    game.ui.setToolsBoxTools = setTools;
    game.ui.setToolsBoxActiveIndex = setActiveToolIndex;
    onReady();
  }, []);

  return (
    <UIContext.Provider value={{
      game, tools, activeToolIndex,
    }}>
      <MainToolbox />
      <TopTools />
    </UIContext.Provider>
  );
}
