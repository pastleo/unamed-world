import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Manipulation } from 'swiper';

import type { Game } from '../game';

import type { Tool } from '../tools';

import '../../styles/ui/main-toolbox.css';

const { useState, useEffect, useMemo } = React;

export interface UIManager {
  setCnt: (cnt: number) => void;
}

export function create(): UIManager {
  return {
    setCnt: null,
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
      <UI ui={game.ui} ready={resolve} />,
      domRoot,
    );
  });

  game.ui.setCnt(10);
}

function UI({ ui, ready }: { ui: UIManager, ready: () => void }) {
  const [cnt, setCnt] = useState(0);

  useEffect(() => {
    ui.setCnt = setCnt;
    ready();
  }, []);

  return (
    <>
      <MainToolBox cnt={cnt} />
    </>
  );
}

const TOOL_ICONS: Record<Tool, string> = {
  walk: '🚶',
  draw: '✍️',
  terrainAltitude: '↕️',
  options: '⚙️',
  pin: '🚩',
}

function MainToolBox({ cnt }: { cnt: number }) {
  const [tools, _setTools] = useState<Tool[]>(['walk', 'draw', 'terrainAltitude', 'pin', 'options']);
  const mainToolboxDomRoot = useMemo(() => document.getElementById('ui-main-toolbox'), []);

  return ReactDOM.createPortal(
    <div>
      <h1>hello portal, {cnt}</h1>
      <Swiper
        modules={[Manipulation]}
        slidesPerView='auto'
        loop
        centeredSlides
        slideToClickedSlide
        loopAdditionalSlides={3}
        onSlideChange={() => console.log('slide change')}
        onSwiper={(swiper) => console.log(swiper)}
      >
        { tools.map(tool => (
          <SwiperSlide key={tool}>{ TOOL_ICONS[tool] }</SwiperSlide>
        )) }
      </Swiper>
    </div>,
    mainToolboxDomRoot,
  );
}

