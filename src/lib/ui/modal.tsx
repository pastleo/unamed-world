import React, { useState, useRef, useEffect, useContext } from 'react';
import ReactModal from 'react-modal';

import classnames from 'classnames';

import { UIContext } from './ui';
import { timeoutPromise } from '../utils/utils';

import '../../styles/ui/modal.css';

export interface UIModal {
  ensureNotInUse<T>(fn: () => Promise<T>): Promise<T>;
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  pleaseWait<T>(
    message: string,
    fn: (setMessage: (updatingMessage: string) => void) => Promise<T>,
  ): Promise<T>;
}

export function create(): UIModal {
  const queueToUse: (() => void)[] = [];
  let inUse = false;

  const uiModal: UIModal = {
    ensureNotInUse: async fn => {
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
    },
    alert: () => new Promise(() => {}),
    confirm: () => new Promise(() => {}),
    pleaseWait: () => new Promise(() => {}),
  };

  return uiModal;
}

interface ModalContent {
  message: string;
  showOkButton: boolean;
  showCancelButton: boolean;
  fastAnimation: boolean;
}
const MIN_PLEASE_WAIT_DURATION = 2000;

function ModalManager({ onReady }: { onReady: () => void }) {
  const { game } = useContext(UIContext);

  const [isOpen, setIsOpen] = useState(false);
  const [opacity, setOpacity] = useState(0);

  const [modalState, setModalState] = useState<ModalContent>({
    message: '', showOkButton: true, showCancelButton: false, fastAnimation: false,
  });

  const callerResolve = useRef<(v: any) => void>(() => {});
  const callerResolveValue = useRef<any>(null);

  useEffect(() => {
    ReactModal.setAppElement(game.renderer.domElement);

    game.ui.modal.alert = message => game.ui.modal.ensureNotInUse(() => {
      setModalState({
        message, showOkButton: true, showCancelButton: false, fastAnimation: false,
      });
      setIsOpen(true);
      return new Promise(resolve => {
        callerResolve.current = resolve;
      });
    });
    game.ui.modal.confirm = message => game.ui.modal.ensureNotInUse(() => {
      setModalState({
        message, showOkButton: true, showCancelButton: true, fastAnimation: false,
      });
      setIsOpen(true);
      return new Promise(resolve => {
        callerResolve.current = resolve;
      });
    });
    game.ui.modal.pleaseWait = (message, fn) => game.ui.modal.ensureNotInUse(async () => {
      setModalState({
        message, showOkButton: false, showCancelButton: false, fastAnimation: true,
      });
      setIsOpen(true);
      let result;
      const minWaitTime = timeoutPromise(MIN_PLEASE_WAIT_DURATION);

      try {
        result = await fn(updatingMessage => {
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
      return result;
    });

    onReady();
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
        if (!callerResolve.current) return;
        callerResolve.current(callerResolveValue.current);
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
                callerResolveValue.current = true;
                setIsOpen(false);
              }}>
                OK
              </button>
            ) }
            { modalState.showCancelButton && (
              <button className='btn cancel-btn' onClick={() => {
                callerResolveValue.current = false;
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
