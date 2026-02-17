import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { squadService } from '@/services/firestore/squads';
import { playerRequestService, PlayerRegistrationRequest } from '@/services/firestore/playerRequests';
import { Squad, PlayerRole, BattingStyle, BowlingStyle } from '@/types';
import { uploadImage } from '@/services/cloudinary/uploader';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Camera,
    CheckCircle2,
    Clock,
    XCircle,
    User,
    School,
    Trophy,
    ChevronRight,
    Loader2
} from 'lucide-react';

export default function RegisterPlayerPage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuthStore();
    const { isDarkMode } = useThemeStore();

    const [squads, setSquads] = useState<Squad[]>([]);
    const [existingRequest, setExistingRequest] = useState<PlayerRegistrationRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [form, setForm] = useState({
        name: user?.displayName || '',
        school: '',
        squadId: '',
        role: 'batsman' as PlayerRole,
        battingStyle: 'right-handed' as BattingStyle,
        bowlingStyle: 'right-arm-medium' as BowlingStyle,
        photoUrl: user?.photoURL || ''
    });

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const [squadsData, requestData] = await Promise.all([
                    squadService.getAll(),
                    user ? playerRequestService.getUserRequest(user.uid) : null
                ]);
                setSquads(squadsData.sort((a, b) => b.year - a.year));
                setExistingRequest(requestData);
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error('Failed to load required information');
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user, authLoading, navigate]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImage(file);
            setForm(prev => ({ ...prev, photoUrl: url }));
            toast.success('Photo uploaded!');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!form.name || !form.school || !form.squadId) {
            toast.error('Please fill in all required fields');
            return;
        }

        const selectedSquad = squads.find(s => s.id === form.squadId);
        if (!selectedSquad) return;

        setSubmitting(true);
        try {
            await playerRequestService.submitRequest({
                uid: user.uid,
                email: user.email,
                name: form.name,
                school: form.school,
                squadId: form.squadId,
                squadName: selectedSquad.name,
                role: form.role,
                battingStyle: form.battingStyle,
                bowlingStyle: form.bowlingStyle,
                photoUrl: form.photoUrl
            });

            toast.success('Registration request submitted successfully!');
            // Refresh to show pending status
            const requestData = await playerRequestService.getUserRequest(user.uid);
            setExistingRequest(requestData);
        } catch (error: any) {
            console.error('Submission failed:', error);
            toast.error(error.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    // If already a registered player
    if (user?.isRegisteredPlayer || user?.playerId) {
        return (
            <div className={`min-h-screen p-5 flex flex-col items-center justify-center text-center ${isDarkMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
                <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
                <h1 className="text-2xl font-black uppercase tracking-tight italic">Already Registered</h1>
                <p className="text-slate-500 mt-2 max-w-xs">You are already a registered player. You can update your details from the Edit Profile section.</p>
                <button
                    onClick={() => navigate('/account')}
                    className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg"
                >
                    Go back to Account
                </button>
            </div>
        );
    }

    // If there is an existing pending/rejected request
    if (existingRequest && existingRequest.status !== 'approved') {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
                <div className="px-5 pt-8 pb-5">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-black uppercase tracking-tight italic mt-4">Request Status</h1>
                </div>

                <div className="p-5">
                    <div className={`p-6 rounded-[2rem] border ${existingRequest.status === 'pending'
                            ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                            : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'
                        } flex flex-col items-center text-center`}>
                        {existingRequest.status === 'pending' ? (
                            <>
                                <Clock size={48} className="text-amber-500 mb-4 animate-pulse" />
                                <h3 className="text-lg font-black uppercase tracking-tight text-amber-600">Pending Approval</h3>
                                <p className="text-sm text-slate-500 mt-2">
                                    Your request to join <strong>{existingRequest.squadName}</strong> is under review by our admins.
                                    Please wait while we verify your details.
                                </p>
                            </>
                        ) : (
                            <>
                                <XCircle size={48} className="text-red-500 mb-4" />
                                <h3 className="text-lg font-black uppercase tracking-tight text-red-600">Request Rejected</h3>
                                <p className="text-sm text-slate-500 mt-2">
                                    Your request was not approved. {existingRequest.adminComment && `Reason: ${existingRequest.adminComment}`}
                                </p>
                                <button
                                    onClick={() => setExistingRequest(null)}
                                    className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest"
                                >
                                    Try Again
                                </button>
                            </>
                        )}
                    </div>

                    <div className="mt-8 space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-slate-100">
                                {existingRequest.photoUrl ? (
                                    <img src={existingRequest.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                                        <User size={24} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-black uppercase">{existingRequest.name}</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{existingRequest.squadName}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
            <div className="px-5 pt-8 pb-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-black uppercase tracking-tight italic">Player Enrollment</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-24 space-y-8">
                {/* Profile Photo */}
                <div className="flex flex-col items-center justify-center py-4">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            {form.photoUrl ? (
                                <img src={form.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <User size={40} className="text-slate-400" />
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-white" size={24} />
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                            <Camera size={16} />
                            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                        </label>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Tap to upload photo</span>
                </div>

                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block italic">Full Name (Show in Stats)</label>
                            <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 focus-within:border-blue-500/50 transition-all shadow-sm">
                                <User size={18} className="text-slate-400" />
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Shakib Al Hasan"
                                    className="bg-transparent flex-1 outline-none text-sm font-bold placeholder:text-slate-300"
                                    required
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block italic">Batch / Graduation Year</label>
                            <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 focus-within:border-blue-500/50 transition-all shadow-sm">
                                <School size={18} className="text-slate-400" />
                                <input
                                    type="text"
                                    value={form.school}
                                    onChange={e => setForm({ ...form, school: e.target.value })}
                                    placeholder="e.g. Batch 2006"
                                    className="bg-transparent flex-1 outline-none text-sm font-bold placeholder:text-slate-300"
                                    required
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block italic">Assign to Squad</label>
                            <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 focus-within:border-blue-500/50 transition-all shadow-sm">
                                <Trophy size={18} className="text-slate-400" />
                                <select
                                    value={form.squadId}
                                    onChange={e => setForm({ ...form, squadId: e.target.value })}
                                    className="bg-transparent flex-1 outline-none text-sm font-bold appearance-none"
                                    required
                                >
                                    <option value="" disabled>Choose your squad</option>
                                    {squads.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                                    ))}
                                </select>
                                <ChevronRight size={18} className="text-slate-300 transform rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* Playing Style */}
                    <div className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block italic">Playing Role</label>
                                <div className="flex flex-col gap-2">
                                    {['batsman', 'bowler', 'all-rounder', 'wicket-keeper'].map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setForm({ ...form, role: role as PlayerRole })}
                                            className={`px-3 py-3 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all ${form.role === role
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 text-slate-500'
                                                }`}
                                        >
                                            {role.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block italic">Batting</label>
                                    <div className="flex flex-col gap-2">
                                        {['right-handed', 'left-handed'].map(style => (
                                            <button
                                                key={style}
                                                type="button"
                                                onClick={() => setForm({ ...form, battingStyle: style as BattingStyle })}
                                                className={`px-3 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${form.battingStyle === style
                                                        ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 text-slate-400'
                                                    }`}
                                            >
                                                {style.split('-')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block italic">Bowling</label>
                                    <select
                                        value={form.bowlingStyle}
                                        onChange={e => setForm({ ...form, bowlingStyle: e.target.value as BowlingStyle })}
                                        className="w-full px-3 py-3 rounded-xl border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-all"
                                    >
                                        <option value="right-arm-medium">RA Medium</option>
                                        <option value="right-arm-fast">RA Fast</option>
                                        <option value="right-arm-spin">RA Spin</option>
                                        <option value="left-arm-medium">LA Medium</option>
                                        <option value="left-arm-fast">LA Fast</option>
                                        <option value="left-arm-spin">LA Spin</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="pt-6">
                    <button
                        type="submit"
                        disabled={submitting || uploading}
                        className="w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Submitting...</span>
                            </>
                        ) : (
                            <>
                                <span>Request Access</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                    <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 px-4 leading-relaxed">
                        By submitting, you agree that your information will be reviewed by tournament organizers for verification.
                    </p>
                </div>
            </form>
        </div>
    );
}
