import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from 'react';
import ReactModal from 'react-modal';

import classnames from 'classnames';

import { UIContext } from './ui';
import { timeoutPromise } from '../utils/utils';

import '../../styles/ui/modal.css';

export interface UIModal {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  pleaseWait<T>(
    message: string,
    fn: (setMessage: (updatingMessage: string) => void) => T | Promise<T>,
  ): Promise<T>;
}

interface ModalContent {
  message: string;
  showOkButton: boolean;
  showCancelButton: boolean;
  fastAnimation: boolean;
}
const MIN_PLEASE_WAIT_DURATION = 2000;

function ModalManager() {
  const { game, maybeReady } = useContext(UIContext);

  const [isOpen, setIsOpen] = useState(false);
  const [opacity, setOpacity] = useState(0);

  const [modalState, setModalState] = useState<ModalContent>({
    message: '', showOkButton: true, showCancelButton: false, fastAnimation: false,
  });

  const closeResolve = useRef<(v: any) => void>(() => {});
  const closeResolveValue = useRef<any>(null);
  const openModalWithClosedPromise: () => Promise<any> = useCallback(() => new Promise(resolve => {
    closeResolve.current = resolve;
    setIsOpen(true);
  }), []);

  const ensureNotInUse = useEnsureNotInUse();
  useEffect(() => {
    ReactModal.setAppElement(game.renderer.domElement);
    game.ui.modal = {
      alert: message => (ensureNotInUse as EnsureNotInUse<void>)(() => {
        setModalState({
          message, showOkButton: true, showCancelButton: false, fastAnimation: false,
        });
        return openModalWithClosedPromise();
      }),
      confirm: message => (ensureNotInUse as EnsureNotInUse<boolean>)(() => {
        setModalState({
          message, showOkButton: true, showCancelButton: true, fastAnimation: false,
        });
        return openModalWithClosedPromise();
      }),
      pleaseWait: (message, fn) => (ensureNotInUse as EnsureNotInUse<any>)(async () => {
        setModalState({
          message, showOkButton: false, showCancelButton: false, fastAnimation: true,
        });
        setIsOpen(true);
        const minWaitTime = timeoutPromise(MIN_PLEASE_WAIT_DURATION);
        const closedPromise = openModalWithClosedPromise();

        try {
          closeResolveValue.current = await fn(updatingMessage => {
            setModalState({
              message: updatingMessage,
              showOkButton: false, showCancelButton: false, fastAnimation: true,
            });
          });
          await minWaitTime;
        } catch (err) {
          console.warn('ModalManager: catched err in pleaseWait', err);
        } finally {
          setIsOpen(false);
        }
        return closedPromise;
      }),
    };

    maybeReady();
  }, []);

  useEffect(() => {
    if (isOpen) return;
    setOpacity(0);
  }, [isOpen]);

  return (
    <ReactModal
      className='modal'
      style={{
        content: { opacity }
      }}
      overlayClassName='modal-overlay'
      isOpen={isOpen}
      contentLabel={modalState.message}
      onAfterOpen={() => {
        setOpacity(1);
      }}
      onAfterClose={() => {
        if (!closeResolve.current) return;
        closeResolve.current(closeResolveValue.current);
      }}
      closeTimeoutMS={500}
    >
      <div className='modal-glow modal-glow-top'>
        <div className={
          classnames('modal-glow-animator modal-glow-top', { fast: modalState.fastAnimation })
        } />
      </div>
      <div className='modal-content-container'>
        <div className='modal-content'>
          <p className='modal-message'>{ modalState.message }</p>
          <div className='btn-groups'>
            { modalState.showOkButton && (
              <button className='btn ok-btn' onClick={() => {
                closeResolveValue.current = true;
                setIsOpen(false);
              }}>
                OK
              </button>
            ) }
            { modalState.showCancelButton && (
              <button className='btn cancel-btn' onClick={() => {
                closeResolveValue.current = false;
                setIsOpen(false);
              }}>
                Cancel
              </button>
            ) }
          </div>
        </div>
      </div>
      <div className='modal-glow modal-glow-bottom'>
        <div className={
          classnames('modal-glow-animator modal-glow-bottom', { fast: modalState.fastAnimation })
        } />
      </div>
    </ReactModal>
  );
}

export default ModalManager;

type EnsureNotInUse<T> = (fn: () => Promise<T>) => Promise<T>;
function useEnsureNotInUse<T>(): EnsureNotInUse<T> {
  return useMemo(() => {
    const queueToUse: (() => void)[] = [];
    let inUse = false;

    return async fn => {
      if (inUse) {
        await new Promise<void>(resolve => {
          queueToUse.push(resolve);
        });
      }
      inUse = true;
      const result = await fn();
      const next = queueToUse.shift();
      if (next) {
        next();
      } else {
        inUse = false;
      }
      return result;
    }
  }, []);
}
