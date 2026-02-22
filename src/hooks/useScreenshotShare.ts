
import { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

interface UseScreenshotShareOptions {
    onScreenshotReady: (image: string) => void;
    captureRef?: React.RefObject<HTMLElement>;
    delay?: number;
}

export function useScreenshotShare({ onScreenshotReady, captureRef, delay = 1000 }: UseScreenshotShareOptions) {
    const [isPressing, setIsPressing] = useState(false);
    const timerRef = useRef<any>(null);

    const captureScreenshot = useCallback(async () => {
        try {
            // 1. Capture current viewport coordinates precisely
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;

            // 2. Capture the exact viewport area
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#050B18',
                logging: false,
                allowTaint: true,
                // Capture the exact visible rectangle
                width: viewW,
                height: viewH,
                x: scrollX,
                y: scrollY,
                onclone: (clonedDoc) => {
                    // CRITICAL: Reset the clone to the top so (x, y) coordinates 
                    // correctly target the intended section of the document.
                    clonedDoc.documentElement.scrollTop = 0;
                    clonedDoc.body.scrollTop = 0;
                    clonedDoc.documentElement.scrollLeft = 0;
                    clonedDoc.body.scrollLeft = 0;

                    // Hide non-essential UI while keeping layout stable
                    const toHide = clonedDoc.querySelectorAll('.hide-in-screenshot, #share-modal-overlay');
                    toHide.forEach(el => (el as HTMLElement).style.visibility = 'hidden');
                }
            });

            // --- Professional Framing Logic ---
            const pad = 40; // More compact padding for better mobile viewing
            const frameCanvas = document.createElement('canvas');
            const ctx = frameCanvas.getContext('2d');
            if (!ctx) return;

            frameCanvas.width = canvas.width + pad * 2;
            frameCanvas.height = canvas.height + pad * 2 + 80; // Reduced branding height

            // 1. Draw Professional Gradient Background
            const gradient = ctx.createLinearGradient(0, 0, frameCanvas.width, frameCanvas.height);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.5, '#1e293b');
            gradient.addColorStop(1, '#0f172a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);

            // 2. Draw Subtle Accent Glow
            ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.beginPath();
            ctx.arc(frameCanvas.width * 0.8, 100, 250, 0, Math.PI * 2);
            ctx.fill();

            // 3. Draw Screenshot with Rounded Corners and Shadow
            const cornerRadius = 40;
            ctx.save();

            // Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 15;

            // Create rounded rectangle path
            ctx.beginPath();
            ctx.moveTo(pad + cornerRadius, pad);
            ctx.lineTo(pad + canvas.width - cornerRadius, pad);
            ctx.quadraticCurveTo(pad + canvas.width, pad, pad + canvas.width, pad + cornerRadius);
            ctx.lineTo(pad + canvas.width, pad + canvas.height - cornerRadius);
            ctx.quadraticCurveTo(pad + canvas.width, pad + canvas.height, pad + canvas.width - cornerRadius, pad + canvas.height);
            ctx.lineTo(pad + cornerRadius, pad + canvas.height);
            ctx.quadraticCurveTo(pad, pad + canvas.height, pad, pad + canvas.height - cornerRadius);
            ctx.lineTo(pad, pad + cornerRadius);
            ctx.quadraticCurveTo(pad, pad, pad + cornerRadius, pad);
            ctx.closePath();

            ctx.clip();
            ctx.drawImage(canvas, pad, pad);
            ctx.restore();

            // 4. Branding (BatchCrick)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BATCHCRICK', frameCanvas.width / 2, frameCanvas.height - 65);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.font = '400 20px Inter, system-ui, sans-serif';
            ctx.fillText('Live School Cricket Experience', frameCanvas.width / 2, frameCanvas.height - 35);

            const framedImage = frameCanvas.toDataURL('image/png');
            onScreenshotReady(framedImage);
        } catch (error) {
            console.error('Screenshot failed:', error);
        }
    }, [onScreenshotReady]);

    const endPress = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setIsPressing(false);
    }, []);

    const startPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if ('button' in e && e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button, a, input, [role="button"], .active-tap')) return;

        setIsPressing(true);
        timerRef.current = setTimeout(() => {
            captureScreenshot();
            setIsPressing(false);
            if ('vibrate' in navigator) {
                try { navigator.vibrate(50); } catch (e) { }
            }
        }, delay);
    }, [captureScreenshot, delay]);

    return {
        longPressProps: {
            onMouseDown: startPress,
            onMouseUp: endPress,
            onMouseLeave: endPress,
            onTouchStart: startPress,
            onTouchEnd: endPress,
            onTouchMove: endPress,
        },
        isPressing,
        captureScreenshot,
    };
}
