import React, { useState, useEffect, useContext } from 'react';
import ReactModal from 'react-modal';

//import classnames from 'classnames';

import { UIContext } from './ui';

import '../../styles/ui/modal.css';

export interface UIModal {
  showModal: () => void;
}

export function create(): UIModal {
  return {
    showModal: () => {},
  };
}

function ModalManager({ onReady }: { onReady: () => void }) {
  const { game } = useContext(UIContext);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    ReactModal.setAppElement(game.renderer.domElement);

    game.ui.modal.showModal = () => {
      setShowModal(true);
    }

    onReady();
  }, []);

  return (
    <ReactModal
      isOpen={showModal}
      contentLabel="Minimal Modal Example"
    >
      <button onClick={() => {
        setShowModal(false);
        }}>Close Modal</button>
    </ReactModal>
  );
}

export default ModalManager;
