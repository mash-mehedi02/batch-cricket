import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { playerRequestService, PlayerRegistrationRequest } from '@/services/firestore/playerRequests';
import toast from 'react-hot-toast';
import {
    Check,
    X,
    User,
    School,
    Trophy,
    Clock,
    AlertCircle,
    Loader2
} from 'lucide-react';

export default function AdminPlayerRequests() {
    useAuthStore();
    const [requests, setRequests] = useState<PlayerRegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await playerRequestService.getPendingRequests();
            setRequests(data);
        } catch (error) {
            console.error('Error loading requests:', error);
            toast.error('Failed to load pending requests');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (requestId: string, status: 'approved' | 'rejected') => {
        let comment = '';
        if (status === 'rejected') {
            const reason = window.prompt('Please provide a reason for rejection (optional):');
            if (reason === null) return; // User cancelled
            comment = reason;
        }

        setProcessingId(requestId);
        const reviewToast = toast.loading(status === 'approved' ? 'Approving player...' : 'Rejecting request...');

        try {
            await playerRequestService.reviewRequest(requestId, status, comment);
            toast.success(status === 'approved' ? 'Player approved and registered!' : 'Request rejected', { id: reviewToast });
            setRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (error: any) {
            console.error('Review failed:', error);
            toast.error(error.message || 'Action failed', { id: reviewToast });
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading pending requests...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">Player Approvals</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Verify and approve new player registrations.</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <Clock className="text-amber-500" size={18} />
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase">{requests.length} Pending</span>
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {requests.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-white/5 p-20 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 mb-4">
                            <Check size={32} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">All Caught Up!</h3>
                        <p className="text-slate-500 text-sm mt-2 max-w-xs">There are no pending player registration requests at the moment.</p>
                    </div>
                ) : (
                    requests.map(request => (
                        <div
                            key={request.id}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col sm:flex-row"
                        >
                            {/* Player Info Section */}
                            <div className="flex-1 p-6 flex flex-col sm:flex-row gap-6">
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 shadow-inner group">
                                    {request.photoUrl ? (
                                        <img src={request.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <User size={32} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{request.name}</h2>
                                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase rounded tracking-widest">{request.role}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{request.email}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg"><School size={14} /></div>
                                            <div className="min-w-0">
                                                <div className="text-[9px] text-slate-400 font-black uppercase">School</div>
                                                <div className="text-xs font-bold truncate dark:text-slate-200">{request.school}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg"><Clock size={14} /></div>
                                            <div className="min-w-0">
                                                <div className="text-[9px] text-slate-400 font-black uppercase">Batch</div>
                                                <div className="text-xs font-bold truncate dark:text-slate-200">{request.batch || 'None'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg"><Trophy size={14} /></div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[9px] text-slate-400 font-black uppercase">Requested Squad</div>
                                            <div className="text-xs font-bold truncate dark:text-slate-200">{request.squadName}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="text-[9px] font-black uppercase tracking-tight text-slate-400">
                                            Batting: <span className="text-slate-600 dark:text-slate-300">{request.battingStyle}</span>
                                        </div>
                                        <div className="text-[9px] font-black uppercase tracking-tight text-slate-400">
                                            Bowling: <span className="text-slate-600 dark:text-slate-300">{request.bowlingStyle}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Section */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 flex sm:flex-col justify-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-white/5 min-w-[160px]">
                                <button
                                    onClick={() => handleReview(request.id!, 'approved')}
                                    disabled={processingId === request.id}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                                >
                                    {processingId === request.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleReview(request.id!, 'rejected')}
                                    disabled={processingId === request.id}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    <X size={14} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-blue-50/50 dark:bg-blue-900/5 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/20 flex gap-4">
                <AlertCircle className="text-blue-500 shrink-0" size={20} />
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-blue-900 dark:text-blue-400 uppercase italic">Important Note</h4>
                    <p className="text-xs text-blue-800/70 dark:text-blue-400/60 leading-relaxed font-medium">
                        Approving a request will automatically create a player profile, assign them to the selected squad,
                        and link their user account as a registered player. This action cannot be undone easily.
                    </p>
                </div>
            </div>
        </div>
    );
}
