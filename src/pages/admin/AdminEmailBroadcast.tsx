import { useState, useEffect, useMemo } from 'react';
import {
    Send,
    Users,
    User,
    CheckSquare,
    Square,
    Search,
    Mail,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { playerService } from '@/services/firestore/players';
import { squadService } from '@/services/firestore/squads';
import { getPlayerSecretEmail } from '@/services/firestore/playerClaim';
import * as emailService from '@/services/emailService';
import { Player, Squad } from '@/types';
import toast from 'react-hot-toast';

const AdminEmailBroadcast = () => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [squads, setSquads] = useState<Squad[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Filter/Selection state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
    const [selectedSquadIds, setSelectedSquadIds] = useState<Set<string>>(new Set());

    // Email content
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allPlayers, allSquads] = await Promise.all([
                playerService.getAll(),
                squadService.getAll()
            ]);
            setPlayers(allPlayers);
            setSquads(allSquads);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load players/squads');
        } finally {
            setLoading(false);
        }
    };

    const filteredPlayers = useMemo(() => {
        return players.filter(p => {
            const squad = squads.find(s => s.id === p.squadId);
            const squadName = squad?.name || '';
            return (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(p.batch || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                squadName.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [players, squads, searchTerm]);

    const filteredSquads = useMemo(() => {
        return squads.filter(s =>
            (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [squads, searchTerm]);

    const togglePlayer = (id: string) => {
        const next = new Set(selectedPlayerIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPlayerIds(next);
    };

    const toggleSquad = (id: string) => {
        const next = new Set(selectedSquadIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSquadIds(next);
    };

    const selectAllFilteredPlayers = () => {
        const next = new Set(selectedPlayerIds);
        filteredPlayers.forEach(p => next.add(p.id));
        setSelectedPlayerIds(next);
    };

    const deselectAllPlayers = () => setSelectedPlayerIds(new Set());

    // Get final list of unique player IDs from both selections
    const finalRecipientIds = useMemo(() => {
        const ids = new Set(selectedPlayerIds);
        // Add all players belonging to selected squads
        selectedSquadIds.forEach(sqId => {
            players.filter(p => p.squadId === sqId).forEach(p => ids.add(p.id));
        });
        return Array.from(ids);
    }, [selectedPlayerIds, selectedSquadIds, players]);

    const handleSendBroadcast = async () => {
        if (finalRecipientIds.length === 0) {
            toast.error('Please select at least one recipient');
            return;
        }
        if (!subject.trim() || !message.trim()) {
            toast.error('Subject and Message are required');
            return;
        }

        if (!confirm(`Send this email to ${finalRecipientIds.length} recipients?`)) return;

        setSending(true);
        const toastId = toast.loading(`Preparing broadcast to ${finalRecipientIds.length} users...`);

        try {
            let successCount = 0;
            let failCount = 0;

            // We need to fetch emails from player_secrets for each ID
            // Batching this as much as possible
            const BATCH_SIZE = 10;
            for (let i = 0; i < finalRecipientIds.length; i += BATCH_SIZE) {
                const batchIds = finalRecipientIds.slice(i, i + BATCH_SIZE);

                toast.loading(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1}...`, { id: toastId });

                await Promise.all(batchIds.map(async (pid) => {
                    try {
                        const email = await getPlayerSecretEmail(pid);
                        const playerName = players.find(p => p.id === pid)?.name || 'Player';

                        if (email) {
                            const result = await emailService.sendEmail({
                                to: [{ email, name: playerName }],
                                subject: subject,
                                htmlContent: `
                                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
                                        <h2 style="color: #0f766e; margin-bottom: 20px;">${subject}</h2>
                                        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                            ${message.replace(/\n/g, '<br/>')}
                                        </div>
                                        <p style="margin-top: 30px; font-size: 12px; color: #718096; text-align: center;">
                                            Sent from BatchCrick BD Admin Console.
                                        </p>
                                    </div>
                                `
                            });
                            if (result.success) {
                                successCount++;
                            } else {
                                console.warn(`Failed to send to ${playerName} (${email}):`, result.error);
                                failCount++;
                            }
                        } else {
                            console.warn(`No email found for ${playerName} (ID: ${pid})`);
                            failCount++;
                        }
                    } catch (e) {
                        console.error('Firestore error while fetching email for player', pid, e);
                        failCount++;
                    }
                }));
            }

            toast.success(`Broadcast Complete! Sent: ${successCount}, Failed: ${failCount}`, { id: toastId, duration: 5000 });

            if (successCount > 0) {
                // Clear form on success
                setSubject('');
                setMessage('');
                setSelectedPlayerIds(new Set());
                setSelectedSquadIds(new Set());
            }

        } catch (error) {
            console.error('Broadcast failed:', error);
            toast.error('Failed to complete broadcast', { id: toastId });
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-4" />
                <p className="text-slate-500 font-medium">Loading participants...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Mail className="text-teal-600" /> Email Broadcast
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Send manual updates and messages to your community.</p>
                </div>
                <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-2xl border border-teal-100">
                    <Users className="text-teal-600" size={20} />
                    <span className="text-teal-900 font-bold">{finalRecipientIds.length} Recipients Selected</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Selection Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, squad or batch..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAllFilteredPlayers}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                Select All Filtered
                            </button>
                            <button
                                onClick={deselectAllPlayers}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {/* Squads Selection */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <Users size={14} /> Select by Squad
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {filteredSquads.map(sq => {
                                const isSelected = selectedSquadIds.has(sq.id);
                                const countInSquad = players.filter(p => p.squadId === sq.id).length;
                                return (
                                    <button
                                        key={sq.id}
                                        onClick={() => toggleSquad(sq.id)}
                                        className={`
                                            flex items-center justify-between p-3 rounded-2xl border transition-all text-left
                                            ${isSelected ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-900/20' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'}
                                        `}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold truncate">{sq.name}</div>
                                            <div className={`text-[10px] font-medium opacity-70`}>{countInSquad} Players</div>
                                        </div>
                                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Players Selection */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <User size={14} /> Select Individual Players
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                            {filteredPlayers.map(p => {
                                const isSelected = selectedPlayerIds.has(p.id) || selectedSquadIds.has(p.squadId);
                                const isViaSquad = !selectedPlayerIds.has(p.id) && selectedSquadIds.has(p.squadId);

                                return (
                                    <button
                                        key={p.id}
                                        disabled={isViaSquad}
                                        onClick={() => togglePlayer(p.id)}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-2xl border transition-all text-left
                                            ${isSelected
                                                ? (isViaSquad ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-teal-50 border-teal-200 text-teal-900')
                                                : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'}
                                        `}
                                    >
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-sm border border-slate-200">
                                            {p.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold truncate flex items-center gap-2">
                                                {p.name}
                                                {!(p as any).maskedEmail && !(p as any).email && (
                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded block">Missing Email</span>
                                                )}
                                                {(p as any).claimed && (
                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black uppercase rounded block">Claimed</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">
                                                {squads.find(s => s.id === p.squadId)?.name || 'Unknown Squad'} • {p.batch}
                                            </div>
                                        </div>
                                        {isSelected ? <CheckCircle2 size={18} className="text-teal-600" /> : <Square size={18} className="text-slate-200" />}
                                    </button>
                                );
                            })}
                            {filteredPlayers.length === 0 && (
                                <div className="col-span-full py-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                                    <AlertCircle className="mx-auto text-slate-400 mb-2" size={32} />
                                    <p className="text-slate-500 font-medium">No players match your search.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Email Content Panel */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-lg sticky top-8">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Subject</label>
                                <input
                                    type="text"
                                    placeholder="Enter subject line..."
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-bold text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Message Body</label>
                                <textarea
                                    placeholder="Type your message here... (HTML supported)"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={10}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all text-slate-700 font-medium leading-relaxed resize-none"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSendBroadcast}
                                    disabled={sending || finalRecipientIds.length === 0}
                                    className={`
                                        w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all
                                        ${sending || finalRecipientIds.length === 0
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-xl shadow-teal-900/30 active:scale-[0.98]'}
                                    `}
                                >
                                    {sending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                    {sending ? 'Sending Broadcast...' : 'Shoot Email Blast'}
                                </button>
                                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-4 px-4">
                                    Recipients receive individual emails. HTML and <br /> standard line breaks are supported.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Help */}
                    <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100">
                        <h4 className="text-teal-900 font-bold text-sm mb-2 flex items-center gap-2">
                            <AlertCircle size={16} /> Pro Tips
                        </h4>
                        <ul className="text-teal-800/70 text-xs space-y-2 font-medium">
                            <li>• Use &lt;strong&gt;Bold&lt;/strong&gt; for emphasis.</li>
                            <li>• Adding an image? Use &lt;img src="..." /&gt;.</li>
                            <li>• Avoid sending more than 100 emails at once to keep your Brevo reputation healthy.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminEmailBroadcast;
