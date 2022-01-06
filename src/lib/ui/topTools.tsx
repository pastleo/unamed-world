import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';

import classnames from 'classnames';

import DrawTool from './drawTool';
import Options from './options';

import '../../styles/ui/top-tools.css';

function TopTools() {
  const topToolsDomPortal = useMemo(() => {
    const domPortal = document.createElement('div');
    domPortal.id = 'top-tools-dom-portal';
    document.body.appendChild(domPortal);
    return domPortal;
  }, []);

  return ReactDOM.createPortal(
    <div className={classnames('top-tools-container')}>
      <DrawTool />
      <Options />
    </div>,
    topToolsDomPortal,
  );
}

export default TopTools;

export function TopTool({ className, active, children }: { className?: string, active: boolean, children: React.ReactNode }) {
  return (
    <div className={classnames(className, 'top-tool', { active })}>
      { children }
    </div>
  );
}

