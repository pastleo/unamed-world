import React, { useState, useRef, useEffect, useContext } from 'react';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';

import { UIContext } from './ui';
import { TopTool } from './topTools';

import { useDelayedState } from './hooks';

function DrawTool() {
  const { game } = useContext(UIContext);

  const [activeBrushIndex, enabledColorInputIndex, setActiveBrushIndex] = useDelayedState(1, 100);
  const [color0, setColor0] = useState('#FFFFFF');
  const [color1, setColor1] = useState(game.tools.draw.fillStyle);
  const [fillSize, setFillSize] = useState(game.tools.draw.fillSize.toString());
  const swiper = useRef<SwiperCore>();
  
  const eraser = activeBrushIndex === 2;
  const activeColor = eraser ? null : [color0, color1][activeBrushIndex];
  useEffect(() => {
    game.tools.draw.eraser = eraser;
    if (eraser) return;
    game.tools.draw.fillStyle = activeColor;
    game.tools.draw.pickingColor = true;
  }, [eraser, activeColor]);

  useEffect(() => {
    game.tools.draw.fillSize = parseInt(fillSize);
  }, [fillSize]);

  useEffect(() => {
    if (!swiper.current) return;
    swiper.current.slideTo(activeBrushIndex);
  }, [activeBrushIndex]);

  return (
    <TopTool className='draw-tool' active={game.tools.activeTool === 'draw'}>
      <Swiper
        centeredSlides slideToClickedSlide
        initialSlide={activeBrushIndex}
        slidesPerView='auto'
        onActiveIndexChange={() => {
          if (!swiper.current) return;
          setActiveBrushIndex(swiper.current.activeIndex);
        }}
        onSwiper={swiperInstance => {
          swiper.current = swiperInstance;
        }}
      >
        <SwiperSlide>
          <input
            type='color'
            value={color0}
            disabled={enabledColorInputIndex !== 0}
            onChange={event => {
              setColor0(event.target.value);
            }}
          />
        </SwiperSlide>
        <SwiperSlide>
          <input
            type='color'
            value={color1}
            disabled={enabledColorInputIndex !== 1}
            onChange={event => {
              setColor1(event.target.value);
            }}
          />
        </SwiperSlide>
        <SwiperSlide>
          🧽
        </SwiperSlide>
      </Swiper>
      <div className="misc-panel">
        <input
          type='range'
          className='draw-size'
          min='1'
          max='20'
          value={fillSize}
          onChange={event => {
            setFillSize(event.target.value);
          }}
        />
      </div>
    </TopTool>
  );
}

export default DrawTool;
