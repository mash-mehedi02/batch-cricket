import { Tournament, Squad } from '@/types';
import { Plus, Trash2, Users, Trophy } from 'lucide-react';

interface GroupManagerProps {
    tournament: Tournament;
    squads: Squad[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

export default function GroupManager({ tournament, squads, onUpdate }: GroupManagerProps) {
    const groups = (tournament as any).config?.groups || [];

    const addGroup = async () => {
        const newGroupId = `group-${Date.now()}`;
        const newGroup = {
            id: newGroupId,
            name: `Group ${String.fromCharCode(65 + groups.length)}`,
            squadIds: [],
            qualification: { qualifyCount: 2, winnerPriority: true },
            teamCount: 0,
            roundFormat: 'round_robin'
        };

        const updatedConfig = {
            ...((tournament as any).config || {}),
            groups: [...groups, newGroup]
        };

        await onUpdate({ config: updatedConfig });
    };

    const removeGroup = async (groupId: string) => {
        const updatedConfig = {
            ...((tournament as any).config || {}),
            groups: groups.filter((g: any) => g.id !== groupId)
        };
        await onUpdate({ config: updatedConfig });
    };

    const updateGroupSquads = async (groupId: string, squadIds: string[]) => {
        const updatedConfig = {
            ...((tournament as any).config || {}),
            groups: groups.map((g: any) => g.id === groupId ? { ...g, squadIds, teamCount: squadIds.length } : g)
        };
        await onUpdate({ config: updatedConfig });
    };

    const updateGroupRules = async (groupId: string, patch: any) => {
        const updatedConfig = {
            ...((tournament as any).config || {}),
            groups: groups.map((g: any) => g.id === groupId ? { ...g, ...patch } : g)
        };
        await onUpdate({ config: updatedConfig });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Group Management</h2>
                    <p className="text-sm text-slate-400 mt-1">Assign teams to groups and define qualification limits.</p>
                </div>
                <button
                    onClick={addGroup}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                    <Plus size={18} />
                    <span>New Group</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {groups.map((group: any) => (
                    <div key={group.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 border border-slate-100">
                                    <span className="font-black text-lg">{group.name.charAt(0)}</span>
                                </div>
                                <input
                                    type="text"
                                    value={group.name}
                                    onChange={(e) => updateGroupRules(group.id, { name: e.target.value })}
                                    className="bg-transparent border-none p-0 text-lg font-medium text-slate-900 focus:ring-0 w-32"
                                />
                            </div>
                            <button
                                onClick={() => removeGroup(group.id)}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                title="Remove Group"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 flex-1">
                            {/* Rules Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Qualifiers</label>
                                    <div className="flex items-center gap-3">
                                        <Trophy size={16} className="text-amber-500" />
                                        <input
                                            type="number"
                                            value={group.qualification?.qualifyCount || 0}
                                            onChange={(e) => updateGroupRules(group.id, {
                                                qualification: { ...group.qualification, qualifyCount: Number(e.target.value) }
                                            })}
                                            className="w-full bg-transparent border-none p-0 text-xl font-black text-slate-900 focus:ring-0"
                                        />
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Priority</label>
                                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                                        <input
                                            type="checkbox"
                                            checked={group.qualification?.winnerPriority}
                                            onChange={(e) => updateGroupRules(group.id, {
                                                qualification: { ...group.qualification, winnerPriority: e.target.checked }
                                            })}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-600">Winner Secures Seed</span>
                                    </label>
                                </div>
                            </div>

                            {/* Squad Selection */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block flex items-center gap-2">
                                    <Users size={12} />
                                    Assigned Teams ({group.squadIds.length})
                                </label>
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {squads.map(squad => {
                                        const isSelected = group.squadIds.includes(squad.id);
                                        // Check if squad is in OTHER groups
                                        const isInOtherGroup = groups.some((g: any) => g.id !== group.id && g.squadIds.includes(squad.id));

                                        return (
                                            <button
                                                key={squad.id}
                                                onClick={() => {
                                                    if (isInOtherGroup) return;
                                                    const nextIds = isSelected
                                                        ? group.squadIds.filter((id: string) => id !== squad.id)
                                                        : [...group.squadIds, squad.id];
                                                    updateGroupSquads(group.id, nextIds);
                                                }}
                                                disabled={isInOtherGroup}
                                                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                        : isInOtherGroup
                                                            ? 'bg-slate-50 border-slate-50 text-slate-300 opacity-50 cursor-not-allowed hidden'
                                                            : 'bg-white border-slate-100 hover:border-slate-200 text-slate-500'
                                                    }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold truncate">{squad.name}</span>
                                                    <span className="text-[10px] opacity-70">Batch {squad.batch || squad.year}</span>
                                                </div>
                                                {isSelected && <Plus className="rotate-45" size={14} />}
                                                {!isSelected && !isInOtherGroup && <Plus size={14} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
