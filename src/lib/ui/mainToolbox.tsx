import React, { useState, useRef, useMemo, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';
import { Manipulation, Mousewheel } from 'swiper';

import classnames from 'classnames';

import { UIContext } from './ui';
import { Tool, setActiveTool } from '../tools';
import { useRefWithDelayedSetter } from './hooks';

import '../../styles/ui/main-toolbox.css';

const TOOL_ICONS: Record<Tool, string> = {
  walk: '🚶',
  draw: '✍️',
  terrainAltitude: '↕️',
  options: '⚙️',
  pin: '🚩',
}

function MainToolbox() {
  const { selectableMainTools, selectedMainTool, game } = useContext(UIContext);

  const mainToolboxDomPortal = useMemo(() => {
    const domPortal = document.createElement('div');
    domPortal.id = 'main-toolbox-dom-portal';
    document.body.appendChild(domPortal);
    return domPortal;
  }, []);

  const [touchMoving, setTouchMoving] = useState(false);
  const swiper = useRef<SwiperCore>();
  const [isPreventedByUI, setPreventedByUILatter] = useRefWithDelayedSetter(false, 50);

  const initialSlide = useMemo(() => selectableMainTools.indexOf(selectedMainTool), []);

  useEffect(() => {
    if (!swiper.current) return;
    if (isPreventedByUI.current) {
      // prevent additional slide animation after user interaction
      return;
    }

    const index = selectableMainTools.indexOf(selectedMainTool);
    swiper.current.slideToLoop(index);
  }, [selectedMainTool]);

  return ReactDOM.createPortal(
    <div
      className={classnames('main-toolbox', { zoom: touchMoving })}
      onWheelCapture={() => {
        isPreventedByUI.current = true;
        setPreventedByUILatter(false);
      }}
    >
      <Swiper
        modules={[Manipulation, Mousewheel]}
        loop centeredSlides slideToClickedSlide mousewheel
        initialSlide={initialSlide}
        slidesPerView='auto'
        onTouchStart={() => {
          isPreventedByUI.current = true;
        }}
        onTouchMove={() => {
          setTouchMoving(true);
        }}
        onTouchEnd={() => {
          setTouchMoving(false);
          setPreventedByUILatter(false);
        }}
        onActiveIndexChange={() => {
          if (!swiper.current) return;
          setActiveTool(swiper.current.realIndex, game);
        }}
        onSwiper={swiperInstance => {
          swiper.current = swiperInstance;
        }}
      >
        { selectableMainTools.map(tool => (
          <SwiperSlide key={tool}>
            <ToolThumbnail tool={tool} />
          </SwiperSlide>
        )) }
      </Swiper>
    </div>,
    mainToolboxDomPortal,
  );
}

export default MainToolbox;

function ToolThumbnail({ tool }: { tool: Tool }) {
  const { game } = useContext(UIContext);

  const thumbnail = useMemo(() => {
    if (tool.startsWith('sprite/')) {
      const spriteAsTool = tool.replace(/^sprite\//, '');
      const spriteObjComponents = game.ecs.getEntityComponents(game.ecs.fromSid(spriteAsTool));
      const spriteThumb = spriteObjComponents.get('obj/sprite').spritesheet;
      return <img className='sprite-obj-thumb' src={spriteThumb} />
    }

    return TOOL_ICONS[tool];
  }, [tool]);

  return <>
    { thumbnail }
  </>;
}
