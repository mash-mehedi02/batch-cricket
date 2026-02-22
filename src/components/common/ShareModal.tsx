
import { motion, AnimatePresence } from 'framer-motion';
import { Download, MoreHorizontal, Send } from 'lucide-react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: string;
    title?: string;
}

export default function ShareModal({ isOpen, onClose, image, title = "Share Live Score" }: ShareModalProps) {

    // Handlers for sharing
    const handleShare = async (platform?: string) => {
        const blob = await (await fetch(image)).blob();
        const file = new File([blob], 'share.png', { type: 'image/png' });

        if (platform === 'whatsapp') {
            const text = encodeURIComponent(`Check this out on BatchCrick!`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
            return;
        }

        if (platform === 'telegram') {
            const text = encodeURIComponent(`Check this out on BatchCrick!`);
            window.open(`https://t.me/share/url?url=${window.location.href}&text=${text}`, '_blank');
            return;
        }

        // Default "More" share using Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    files: [file],
                    title: title,
                    text: 'Shared from BatchCrick app',
                });
            } catch (err) {
                console.warn('Share failed:', err);
            }
        } else {
            alert('Sharing not supported on this browser. Use "Save" to download.');
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = image;
        link.download = `BatchCrick_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                id="share-modal-overlay"
                className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px]"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: "100%", opacity: 0.5 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0.5 }}
                    transition={{ type: "spring", damping: 32, stiffness: 250, mass: 1 }}
                    className="bg-white w-[94%] max-w-[380px] rounded-[2.5rem] sm:rounded-[3rem] overflow-hidden shadow-[0_20px_70px_-10px_rgba(0,0,0,0.3)] relative mb-6 sm:mb-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Premium Drag handle */}
                    <div className="w-12 h-[4px] bg-slate-100 rounded-full mx-auto mt-4 mb-2" />

                    {/* Header: Centered & Clean */}
                    <div className="flex items-center relative px-6 py-4 border-b border-slate-50/50">
                        <h3 className="flex-1 text-center text-[15px] font-black text-slate-900 tracking-tight ml-10 uppercase tracking-widest">
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-blue-500 font-black text-[13px] tracking-tight active:scale-90 transition-all hover:opacity-70"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Image Preview: More compact with scale-in effect */}
                    <div className="px-6 py-5">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, duration: 0.4 }}
                            className="aspect-[4/5] bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 flex items-center justify-center group"
                        >
                            <img src={image} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" alt="Preview" />
                        </motion.div>
                    </div>

                    {/* Action Grid: Compact & Balanced */}
                    <div className="px-6 pb-8 pt-0">
                        <div className="grid grid-cols-4 gap-1">
                            {/* WhatsApp */}
                            <button onClick={() => handleShare('whatsapp')} className="flex flex-col items-center gap-2 active:scale-90 transition-transform group">
                                <div className="w-12 h-12 bg-[#25D366] flex items-center justify-center rounded-full text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/30 transition-shadow">
                                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.408 0 12.044c0 2.123.555 4.197 1.613 6.041L0 24l6.149-1.613a11.815 11.815 0 005.9 1.532h.005c6.634 0 12.046-5.411 12.05-12.042A11.83 11.83 0 0018.411 3.488z" />
                                    </svg>
                                </div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">Whatsapp</span>
                            </button>

                            {/* Telegram */}
                            <button onClick={() => handleShare('telegram')} className="flex flex-col items-center gap-2 active:scale-90 transition-transform group">
                                <div className="w-12 h-12 bg-[#0088cc] flex items-center justify-center rounded-full text-white shadow-lg shadow-sky-500/10 hover:shadow-sky-500/30 transition-shadow">
                                    <Send size={24} className="ml-[-2.5px]" />
                                </div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">Telegram</span>
                            </button>

                            {/* Save */}
                            <button onClick={handleDownload} className="flex flex-col items-center gap-2 active:scale-90 transition-transform group">
                                <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-full text-slate-600 border border-slate-100 shadow-sm hover:bg-slate-100 transition-colors">
                                    <Download size={24} />
                                </div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">Save</span>
                            </button>

                            {/* More */}
                            <button onClick={() => handleShare()} className="flex flex-col items-center gap-2 active:scale-90 transition-transform group">
                                <div className="w-12 h-12 bg-blue-500 flex items-center justify-center rounded-full text-white shadow-lg shadow-blue-500/10 hover:shadow-blue-500/30 transition-shadow">
                                    <MoreHorizontal size={24} />
                                </div>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">More</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
