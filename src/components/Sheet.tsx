import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="sheet glass" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
