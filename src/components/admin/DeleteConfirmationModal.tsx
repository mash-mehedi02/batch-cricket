import { useState, useEffect } from 'react'
import { AlertTriangle, X, Trash2 } from 'lucide-react'

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    verificationText: string
    itemType: string
    isDeleting?: boolean
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    verificationText,
    itemType,
    isDeleting = false
}: DeleteConfirmationModalProps) {
    const [inputValue, setInputValue] = useState('')
    const [error, setError] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setInputValue('')
            setError(false)
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleConfirm = () => {
        if (inputValue === verificationText) {
            onConfirm()
        } else {
            setError(true)
        }
    }

    const isMatch = inputValue === verificationText

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-red-100 overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-red-900">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-red-400 hover:text-red-700 hover:bg-red-100 p-1 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="text-slate-600 text-sm leading-relaxed">
                        {message}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                        <span className="text-slate-500">Please type </span>
                        <span className="font-mono font-bold text-slate-900 select-all">{verificationText}</span>
                        <span className="text-slate-500"> to confirm.</span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Confirm {itemType} Name
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value)
                                setError(false)
                            }}
                            className={`w-full px-4 py-3 bg-white border rounded-xl outline-none transition-all font-mono text-sm ${error
                                    ? 'border-red-300 ring-4 ring-red-50 text-red-900 placeholder-red-300'
                                    : isMatch
                                        ? 'border-green-300 ring-4 ring-green-50 text-green-900'
                                        : 'border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-50/50'
                                }`}
                            placeholder={verificationText}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isMatch || isDeleting}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white shadow-sm transition-all ${!isMatch || isDeleting
                                ? 'bg-red-300 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete {itemType}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
