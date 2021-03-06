import React, { useState, useRef, useMemo, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';
import { Manipulation, Mousewheel } from 'swiper';

import classnames from 'classnames';

import { Tool, setActiveTool } from '../tools';
import { UIContext } from './ui';

import Thumb from './thumb';
import { useRefWithDelayedSetter, useSpriteObjThumbnail } from './hooks';

import '../../styles/ui/main-toolbox.css';

const TOOL_EMOJI: Record<Tool, string> = {
  melee: '🚶',
  draw: '✍️',
  terrainAltitude: '↕️',
  options: '⚙️',
  pin: '♟️',
}
const TOOL_BADGE: Record<Tool, string> = {
  melee: '✊',
}

function MainToolbox() {
  const { selectableMainTools, selectedMainTool, game } = useContext(UIContext);

  const mainToolboxDomPortal = useMemo(() => {
    const domPortal = document.createElement('div');
    domPortal.id = 'main-toolbox-dom-portal';
    document.body.appendChild(domPortal);
    return domPortal;
  }, []);

  const [show, setShow] = useState(false);
  const [touchMoving, setTouchMoving] = useState(false);
  const swiper = useRef<SwiperCore>();
  const [isPreventedByUI, setPreventedByUILatter] = useRefWithDelayedSetter(false, 50);

  const slideIndex = selectableMainTools.indexOf(selectedMainTool);

  useEffect(() => {
    if (!swiper.current) return;
    if (isPreventedByUI.current) {
      // prevent additional slide animation after user interaction
      return;
    }

    swiper.current.slideToLoop(slideIndex);
  }, [slideIndex]);

  useEffect(() => {
    setShow(true);
  }, []);

  return ReactDOM.createPortal(
    <div
      className={classnames('main-toolbox', { zoom: touchMoving, show })}
      onWheelCapture={() => {
        isPreventedByUI.current = true;
        setPreventedByUILatter(false);
      }}
    >
      <Swiper
        modules={[Manipulation, Mousewheel]}
        loop centeredSlides slideToClickedSlide mousewheel
        initialSlide={slideIndex}
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
  const { game, selectedMainTool } = useContext(UIContext);

  const spriteObjPath = useMemo(() => {
    if (tool.startsWith('sprite/')) {
      return tool.replace(/^sprite\//, '');
    }
    return '';
  }, []);

  const emoji = spriteObjPath ? '⚪' : TOOL_EMOJI[tool];
  const badge = spriteObjPath ? null : TOOL_BADGE[tool];
  const imgSrc = spriteObjPath ? useSpriteObjThumbnail(spriteObjPath, game) : null;

  return <Thumb emoji={emoji} badge={badge} imgSrc={imgSrc} active={selectedMainTool === tool} />
}
