import React, { useState, useRef, useEffect, useContext } from 'react';
import localForage from 'localforage';
import classnames from 'classnames';

import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperCore from 'swiper';
import { Mousewheel } from 'swiper';

import { SavedObjRecord, rmSavedObj } from '../resource';
import { castOptionSave, castOptionImport, addAndSwitchSpriteTool, rmSpriteTool } from '../tools';

import { UIContext } from './ui';
import { TopTool } from './topTools';
import Thumb from './thumb';

import { useDelayedState, useSpriteObjThumbnail } from './hooks';
import { timeoutPromise } from '../utils/utils';
import { setUrlHash, parseUrlHash, downloadJson } from '../utils/web';

import '../../styles/ui/options.css';

export interface UIOptions {
  updateSavedObjRecords: () => void;
  setSelectedSavedObjRecords: (index: number) => void;
}

const FIXED_OPTION_SLIDES = 3;
function Options() {
  const { game, selectedMainTool, selectableMainTools, maybeReady } = useContext(UIContext);

  const [optionIndex, selectedOptionIndex, setOptionIndex] = useDelayedState(2, 100);
  const swiper = useRef<SwiperCore>();

  const [recordActionIndex, selectedRecordActionIndex, setRecordActionIndex] = useDelayedState(0, 100);
  const recordActionSwiper = useRef<SwiperCore>();
  
  useEffect(() => {
    if (!swiper.current) return;
    swiper.current.slideTo(optionIndex);
  }, [optionIndex]);

  const [records, setRecords] = useState([...game.resource.savedObjRecords])

  useEffect(() => {
    game.ui.options = {
      updateSavedObjRecords: () => {
        setRecords([...game.resource.savedObjRecords]);
      },
      setSelectedSavedObjRecords: index => {
        setOptionIndex(index + FIXED_OPTION_SLIDES);
      },
    };

    maybeReady();
  }, []);

  const selectedRecordIndex = selectedOptionIndex - FIXED_OPTION_SLIDES;
  const selectedRecord = records[selectedRecordIndex];

  const selectedRecordIsAlreadyBuilt = selectableMainTools.indexOf(`sprite/${selectedRecord?.spriteObjPath}`) >= 0;

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
        <SwiperSlide>
          <Thumb
            emoji='📂'
            badge='🌐'
            active={selectedOptionIndex === 0}
            onClick={() => {
              castOptionImport(game);
            }}
          />
        </SwiperSlide>
        <SwiperSlide>
          <Thumb
            emoji='📜'
            active={selectedOptionIndex === 1}
            onClick={async () => {
              if (!await game.ui.modal.confirm('Will switch to a new realm, unsaved process will be lost, proceed?')) return;
              setUrlHash({ '': '' });
              location.reload();
            }}
          />
        </SwiperSlide>
        <SwiperSlide>
          <Thumb
            emoji='💾'
            active={selectedOptionIndex === 2}
            badge='↗'
            onClick={() => {
              castOptionSave(game);
            }}
          />
        </SwiperSlide>
        { records.map(record => (
          <SwiperSlide key={record.realmObjPath}>
            <SavedObj record={record} active={record.realmObjPath === selectedRecord?.realmObjPath}/>
          </SwiperSlide>
        )) }
      </Swiper>

      <div className={classnames('record-actions', { show: selectedOptionIndex >= FIXED_OPTION_SLIDES && selectedMainTool === 'options' })}>
        <Swiper
          modules={[Mousewheel]}
          centeredSlides slideToClickedSlide mousewheel
          initialSlide={recordActionIndex}
          slidesPerView='auto'
          onActiveIndexChange={() => {
            if (!recordActionSwiper.current) return;
            setRecordActionIndex(recordActionSwiper.current.activeIndex);
          }}
          onSwiper={swiperInstance => {
            recordActionSwiper.current = swiperInstance;
          }}
        >
          <SwiperSlide>
            <Thumb
              emoji='🚪'
              active={selectedRecordActionIndex === 0}
              onClick={async () => {
                const currentRealmObjPath = parseUrlHash()[''];
                if (currentRealmObjPath === selectedRecord.realmObjPath) {
                  if (!await game.ui.modal.confirm('Will reload realm, unsaved progress will be lost, proceed?')) return;
                  location.reload();
                } else {
                  if (!await game.ui.modal.confirm('Switch to selected realm?')) return;
                  game.ui.modal.pleaseWait('Switching to selected realm...', async () => {
                    await timeoutPromise(500 + 1000 * Math.random());
                    setUrlHash({ '': selectedRecord.realmObjPath });
                  });
                }
              }}
            />
          </SwiperSlide>
          <SwiperSlide>
            <Thumb
              emoji='🛠️'
              badge={
                selectedRecordIsAlreadyBuilt ? '✅' : ''
              }
              active={selectedRecordActionIndex === 1}
              onClick={() => {
                if (selectedRecordIsAlreadyBuilt) {
                  rmSpriteTool(selectedRecord.spriteObjPath, game);
                } else {
                  addAndSwitchSpriteTool(selectedRecord.spriteObjPath, game);
                }
              }}
            />
          </SwiperSlide>
          <SwiperSlide>
            <Thumb
              emoji='💾'
              active={selectedRecordActionIndex === 2}
              onClick={() => {
                castOptionSave(game, selectedRecordIndex);
              }}
            />
          </SwiperSlide>
          <SwiperSlide>
            <Thumb
              emoji='📦'
              badge='🔽'
              active={selectedRecordActionIndex === 3}
              onClick={async () => {
                const json = await localForage.getItem(selectedRecord.realmObjPath);
                if (!json) return;
                const cid = selectedRecord.realmObjPath.split('/').pop();
                downloadJson(json, `realm-${cid}.json`);
              }}
            />
          </SwiperSlide>
          <SwiperSlide>
            <Thumb
              emoji='❌'
              active={selectedRecordActionIndex === 4}
              onClick={async () => {
                if (!await game.ui.modal.confirm('Will DELETE selected record, proceed?')) return;
                await rmSavedObj(selectedRecordIndex, game);
                await game.ui.modal.alert('Record removed.');
              }}
            />
          </SwiperSlide>
        </Swiper>
      </div>
    </TopTool>
  );
}

export default Options;

function SavedObj({ record, active }: { record: SavedObjRecord, active: boolean }) {
  const { game } = useContext(UIContext);
  const imgSrc = useSpriteObjThumbnail(record.spriteObjPath, game);

  return <Thumb
    emoji='🌐'
    imgSrc={imgSrc}
    active={active}
  />
}
