import React, { useRef, useEffect, useContext } from 'react';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';
import { Mousewheel } from 'swiper';

import { UIContext } from './ui';
import { TopTool } from './topTools';

import { castOptionSave, castOptionBuild } from '../tools';

import { useDelayedState } from './hooks';

function Options() {
  const { game } = useContext(UIContext);

  const [optionIndex, selectedOptionIndex, setOptionIndex] = useDelayedState(0, 100);
  const swiper = useRef<SwiperCore>();
  
  useEffect(() => {
    if (!swiper.current) return;
    swiper.current.slideTo(optionIndex);
  }, [optionIndex]);

  return (
    <TopTool className='options' active={game.tools.activeTool === 'options'}>
      <Swiper
        modules={[Mousewheel]}
        centeredSlides slideToClickedSlide mousewheel
        initialSlide={optionIndex}
        slidesPerView='auto'
        onActiveIndexChange={() => {
          if (!swiper.current) return;
          setOptionIndex(swiper.current.activeIndex);
        }}
        onSwiper={swiperInstance => {
          swiper.current = swiperInstance;
        }}
      >
        <SwiperSlide onClick={selectedOptionIndex !== 0 ? null : (() => {

          castOptionSave(game);
        })}>
          💾
        </SwiperSlide>
        <SwiperSlide onClick={selectedOptionIndex !== 1 ? null : (() => {
          castOptionBuild(game);
        })}>
          🛠️
        </SwiperSlide>
      </Swiper>
    </TopTool>
  );
}

export default Options;
