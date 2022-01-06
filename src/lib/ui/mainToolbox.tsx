import React, { useState, useRef, useMemo, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';
import { Manipulation } from 'swiper';

import classnames from 'classnames';

import { UIContext } from './ui';
import { Tool, setActiveTool } from '../tools';

import '../../styles/ui/main-toolbox.css';

const TOOL_ICONS: Record<Tool, string> = {
  walk: '🚶',
  draw: '✍️',
  terrainAltitude: '↕️',
  options: '⚙️',
  pin: '🚩',
}

function MainToolbox() {
  const { tools, activeToolIndex, game } = useContext(UIContext);

  const mainToolboxDomPortal = useMemo(() => {
    const domPortal = document.createElement('div');
    domPortal.id = 'main-toolbox-dom-portal';
    document.body.appendChild(domPortal);
    return domPortal;
  }, []);

  const [touchMoving, setTouchMoving] = useState(false);
  const swiper = useRef<SwiperCore>();

  useEffect(() => {
    if (!swiper.current) return;
    if (swiper.current.realIndex !== activeToolIndex) { // prevent additional slide animation after user interaction
      swiper.current.slideToLoop(activeToolIndex);
    }
  }, [activeToolIndex]);

  return ReactDOM.createPortal(
    <div className={classnames('main-toolbox', { zoom: touchMoving })}>
      <Swiper
        modules={[Manipulation]}
        loop centeredSlides slideToClickedSlide
        initialSlide={activeToolIndex}
        loopAdditionalSlides={3}
        slidesPerView='auto'
        onTouchMove={() => {
          setTouchMoving(true);
        }}
        onTouchEnd={() => {
          setTouchMoving(false);
        }}
        onActiveIndexChange={() => {
          if (!swiper.current) return;
          setActiveTool(swiper.current.realIndex, game);
        }}
        onSwiper={swiperInstance => {
          swiper.current = swiperInstance;
        }}
      >
        { tools.map(tool => (
          <SwiperSlide key={tool}>{ TOOL_ICONS[tool] }</SwiperSlide>
        )) }
      </Swiper>
    </div>,
    mainToolboxDomPortal,
  );
}

export default MainToolbox;
