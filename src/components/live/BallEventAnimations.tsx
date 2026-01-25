import React, { useEffect, useState } from 'react';
import { BoundaryAnimation } from './animations/BoundaryAnimation';
import { SixAnimation } from './animations/SixAnimation';
import { WicketAnimation } from './animations/WicketAnimation';

interface BallEventAnimationsProps {
  eventLabel: string;
  isVisible: boolean;
  onClose: () => void;
}

const BallEventAnimations: React.FC<BallEventAnimationsProps> = ({
  eventLabel,
  isVisible,
  onClose
}) => {
  const [animationType, setAnimationType] = useState<'four' | 'six' | 'wicket' | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Determine animation type based on event label
      const label = eventLabel?.toString().toUpperCase() || '';

      if (label === '4' || label.includes('FOUR')) {
        setAnimationType('four');
      } else if (label === '6' || label.includes('SIX')) {
        setAnimationType('six');
      } else if (label.includes('OUT') ||
        label.includes('WICK') ||
        label === 'W' ||
        label === 'WICKET') {
        setAnimationType('wicket');
      } else {
        setAnimationType(null);
      }

      // Auto-close after 2 seconds
      const timer = setTimeout(() => {
        onClose();
        setAnimationType(null);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setAnimationType(null);
    }
  }, [isVisible, eventLabel, onClose]);

  if (!isVisible || !animationType) {
    return null;
  }

  return (
    <>
      {animationType === 'four' && <BoundaryAnimation />}
      {animationType === 'six' && <SixAnimation />}
      {animationType === 'wicket' && <WicketAnimation />}
    </>
  );
};

export default BallEventAnimations;