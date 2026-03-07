import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { X } from 'lucide-react';

interface GSAPImageViewerProps {
    src: string;
    isOpen: boolean;
    onClose: () => void;
    alt?: string;
}

const GSAPImageViewer: React.FC<GSAPImageViewerProps> = ({ src, isOpen, onClose, alt = 'View Image' }) => {
    const backdropRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Lock scroll
            document.body.style.overflow = 'hidden';

            // GSAP Entrance
            const tl = gsap.timeline();

            tl.fromTo(backdropRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.3, ease: 'power2.out' }
            );

            tl.fromTo(imageRef.current,
                { scale: 0.8, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
                "-=0.2"
            );

            tl.fromTo(closeBtnRef.current,
                { y: -20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.3 },
                "-=0.3"
            );
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleClose = () => {
        const tl = gsap.timeline({
            onComplete: onClose
        });

        tl.to(closeBtnRef.current, { opacity: 0, duration: 0.2 });
        tl.to(imageRef.current, { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.in' }, "-=0.1");
        tl.to(backdropRef.current, { opacity: 0, duration: 0.3 }, "-=0.2");
    };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={backdropRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
            onClick={handleClose}
        >
            <button
                ref={closeBtnRef}
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[10000]"
            >
                <X size={24} />
            </button>

            <div className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    onClick={(e) => e.stopPropagation()}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
            </div>
        </div>,
        document.body
    );
};

export default GSAPImageViewer;
