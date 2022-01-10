import React, { useState, useCallback, useEffect } from 'react';
import classnames from 'classnames';

import '../../styles/ui/thumb.css';

interface ThumbProps {
  emoji: string;
  imgSrc?: string;
  active?: boolean;
  className?: string;
  badge?: string;
  onClick?: () => void;
}

function Thumb({ emoji, imgSrc, active, className, badge, onClick }: ThumbProps) {
  const [clicked, setClicked] = useState(false);

  const handleOnClick = useCallback(() => {
    setClicked(true);
    if (onClick && active) onClick();
  }, [active, onClick]);

  useEffect(() => {
    if (!clicked) return;

    const timer = setTimeout(() => {
      setClicked(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [clicked]);

  return (
    <div className={classnames('thumb', className, { active, clicked })}>
      <button onClick={handleOnClick}>
        { imgSrc ? null : emoji }
      </button>
      { imgSrc && <div className='thumb-img-bg' style={{ backgroundImage: `url(${imgSrc})` }} /> }
      { badge && <div className='badge'>{ badge }</div> }
    </div>
  );
}

export default Thumb;
