
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { PlayerRole, BattingStyle, BowlingStyle, SocialLink } from '@/types';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Camera,
    Save,
    User as UserIcon,
    Plus,
    Trash2,
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    X,
    Check,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import { uploadImage } from '@/services/cloudinary/uploader';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/cropImage';

type Point = { x: number, y: number };
type Area = { x: number, y: number, width: number, height: number };

const detectPlatform = (url: string): 'instagram' | 'facebook' | 'x' | 'linkedin' | null => {
    const lower = url.toLowerCase();
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('facebook.com')) return 'facebook';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
    if (lower.includes('linkedin.com')) return 'linkedin';
    return null;
}

const extractUsername = (url: string) => {
    try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/').filter(p => p && p !== 'in' && p !== 'profile');
        return parts[parts.length - 1] || 'Link';
    } catch {
        return 'Link';
    }
}

export default function EditProfilePage() {
    const navigate = useNavigate();
    const { user, loading } = useAuthStore();
    const { isDarkMode } = useThemeStore();

    useEffect(() => {
        if (!loading && !user) {
            navigate('?login=true', { replace: true });
        }
    }, [user, loading, navigate]);

    if (loading) {
        return <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>Loading...</div>;
    }

    if (!user) return null;

    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');

    // Fetch full player data if linked
    useEffect(() => {
        const fetchPlayerData = async () => {
            if (user?.playerId) {
                try {
                    const playerRef = doc(db, 'players', user.playerId);
                    const playerSnap = await getDoc(playerRef); // Use getDoc instead of getDocs

                    if (playerSnap.exists()) {
                        const data = playerSnap.data();
                        console.log("Synced detailed player data:", data);

                        setForm(prev => ({
                            ...prev,
                            // Override with detailed data from players collection
                            displayName: data.name || prev.displayName,
                            bio: data.bio || prev.bio,
                            dateOfBirth: data.dateOfBirth || prev.dateOfBirth,
                            role: (data.role as PlayerRole) || prev.role,
                            battingStyle: (data.battingStyle as BattingStyle) || prev.battingStyle,
                            bowlingStyle: (data.bowlingStyle as BowlingStyle) || prev.bowlingStyle,
                            socialLinks: (data.socialLinks as SocialLink[]) || prev.socialLinks,
                            photoURL: data.photoUrl || prev.photoURL
                        }));
                    }
                } catch (error) {
                    console.error("Failed to sync player data:", error);
                }
            }
        };

        if (user?.playerId) {
            fetchPlayerData();
        }
    }, [user?.playerId]); // Only re-run if playerId changes

    // Crop State
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const [form, setForm] = useState({
        displayName: user?.displayName || '',
        photoURL: user?.photoURL || '',
        bio: user?.playerProfile?.bio || '',
        role: (user?.playerProfile?.role as PlayerRole) || 'batsman',
        battingStyle: (user?.playerProfile?.battingStyle as BattingStyle) || 'right-handed',
        bowlingStyle: (user?.playerProfile?.bowlingStyle as BowlingStyle) || 'right-arm-medium',
        dateOfBirth: user?.playerProfile?.dateOfBirth || '',
        socialLinks: (user?.playerProfile?.socialLinks as SocialLink[]) || []
    });

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => setTempImage(reader.result as string));
            reader.readAsDataURL(file);
        }
    };

    const handleCropSave = async () => {
        if (!tempImage || !croppedAreaPixels) return;

        setUploading(true);
        try {
            const croppedImageBlob = await getCroppedImg(tempImage, croppedAreaPixels);
            if (!croppedImageBlob) throw new Error('Failed to crop image');

            // Convert Blob to File
            const croppedFile = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });

            const url = await uploadImage(croppedFile);
            setForm(prev => ({ ...prev, photoURL: url }));
            setTempImage(null); // Close cropper
            toast.success('Photo updated!');
        } catch (error) {
            console.error('Crop/Upload error:', error);
            toast.error('Failed to process image');
        } finally {
            setUploading(false);
        }
    };

    const handleAddLink = () => {
        if (!newLinkUrl) return;
        if (form.socialLinks.length >= 3) {
            toast.error('Maximum 3 social links allowed');
            return;
        }

        const platform = detectPlatform(newLinkUrl);
        if (!platform) {
            toast.error('Only Instagram, Facebook, X (Twitter), and LinkedIn are supported');
            return;
        }

        const username = extractUsername(newLinkUrl);
        setForm(prev => ({
            ...prev,
            socialLinks: [...prev.socialLinks, { platform, url: newLinkUrl, username }]
        }));
        setNewLinkUrl('');
    };

    const handleRemoveLink = (index: number) => {
        setForm(prev => ({
            ...prev,
            socialLinks: prev.socialLinks.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        if (!user?.uid || !form.displayName.trim()) {
            toast.error('Name is required');
            return;
        }

        setSaving(true);
        try {
            // Update Firebase Auth
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: form.displayName.trim(),
                    photoURL: form.photoURL || null
                });
            }

            // Prepare Firestore updates
            const profileData = {
                displayName: form.displayName.trim(),
                bio: form.bio?.trim() || '',
                role: form.role,
                battingStyle: form.battingStyle,
                bowlingStyle: form.bowlingStyle,
                dateOfBirth: form.dateOfBirth || '',
                photoUrl: form.photoURL || '',
                socialLinks: form.socialLinks,
                isRegisteredPlayer: user.playerProfile?.isRegisteredPlayer || false,
            };

            const userRef = doc(db, 'users', user.uid);
            const updates: any = {
                displayName: form.displayName.trim(),
                photoURL: form.photoURL || null,
                playerProfile: profileData,
                updatedAt: serverTimestamp()
            };
            await updateDoc(userRef, updates);

            // If user has a linked player, sync to players collection too
            if (user.playerId) {
                const playerRef = doc(db, 'players', user.playerId);
                await updateDoc(playerRef, {
                    name: form.displayName.trim(),
                    bio: form.bio?.trim() || null,
                    role: form.role,
                    battingStyle: form.battingStyle,
                    bowlingStyle: form.bowlingStyle,
                    dateOfBirth: form.dateOfBirth || null,
                    photoUrl: form.photoURL || null,
                    socialLinks: form.socialLinks,
                    updatedAt: serverTimestamp()
                }).catch(err => console.warn('Player sync failed:', err));
            }

            // Check for pending player request and update it if exists (so Admin sees new name)
            try {
                // Import this locally or ensure it's imported at top
                const { playerRequestService } = await import('@/services/firestore/playerRequests');
                const pendingReq = await playerRequestService.getUserRequest(user.uid);

                if (pendingReq && pendingReq.status === 'pending' && pendingReq.id) {
                    const reqRef = doc(db, 'player_requests', pendingReq.id);
                    await updateDoc(reqRef, {
                        name: form.displayName.trim(),
                        photoUrl: form.photoURL || null,
                        role: form.role,
                        battingStyle: form.battingStyle,
                        bowlingStyle: form.bowlingStyle,
                        updatedAt: serverTimestamp()
                    });
                    console.log("Updated pending player request with new profile data");
                }
            } catch (err) {
                console.warn("Failed to update pending request:", err);
            }

            // Update local state
            useAuthStore.setState((state) => ({
                user: state.user ? {
                    ...state.user,
                    displayName: form.displayName.trim(),
                    photoURL: form.photoURL || state.user.photoURL,
                    playerProfile: profileData
                } : null
            }));

            toast.success('Profile updated!');
            navigate(-1);
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = `w-full px-4 py-3 rounded-xl border text-[15px] font-medium outline-none transition-colors ${isDarkMode
        ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500 placeholder-slate-500'
        : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500 placeholder-slate-400'
        }`;

    const labelClass = `text-xs font-bold uppercase tracking-wider mb-2 block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'
        }`;

    const selectClass = `w-full px-4 py-3 rounded-xl border text-[15px] font-medium outline-none transition-colors appearance-none ${isDarkMode
        ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500'
        : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500'
        }`;

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
            {/* Crop Modal */}
            {tempImage && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Adjust Photo
                            </h3>
                            <button
                                onClick={() => setTempImage(null)}
                                className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div className="relative h-80 w-full bg-black">
                            <Cropper
                                image={tempImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                cropShape="round"
                                showGrid={false}
                            />
                        </div>

                        {/* Crop Controls */}
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <ZoomOut size={18} className="text-slate-400" />
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1 accent-teal-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer"
                                />
                                <ZoomIn size={18} className="text-slate-400" />
                            </div>

                            <button
                                onClick={handleCropSave}
                                disabled={uploading}
                                className="w-full py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Set Profile Photo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`safe-area-pt flex items-center justify-between px-5 pt-4 pb-3 border-b ${isDarkMode ? 'border-slate-800 bg-[#1E293B]' : 'border-slate-100 bg-white'}`}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className={`p-2 -ml-2 rounded-full transition-all ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Edit Profile</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                {/* Profile Photo */}
                <div className="flex flex-col items-center py-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-white text-3xl font-bold overflow-hidden border-4 border-white dark:border-slate-700 shadow-lg">
                            {form.photoURL ? (
                                <img src={form.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="bg-teal-500 w-full h-full flex items-center justify-center">
                                    {form.displayName?.charAt(0).toUpperCase() || <UserIcon size={36} />}
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-teal-600 transition-colors">
                            {uploading && !tempImage ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Camera size={16} />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoSelect}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                    <p className={`text-xs mt-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Tap to change photo
                    </p>
                </div>

                {/* Form Fields */}
                <div className="px-5 space-y-6">
                    {/* Name */}
                    <div>
                        <label className={labelClass}>Full Name</label>
                        <input
                            type="text"
                            value={form.displayName}
                            onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                            placeholder="Enter your name"
                            className={inputClass}
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className={labelClass}>Bio</label>
                        <textarea
                            value={form.bio}
                            onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                            placeholder="Tell us about yourself..."
                            className={`${inputClass} min-h-[100px] resize-none`}
                        />
                    </div>

                    {/* Player Specific Fields (Only for Approved Players/Admins) */}
                    {(user.role === 'player' || user.role === 'admin' || user.role === 'super_admin') && (
                        <>
                            {/* Playing Role */}
                            <div>
                                <label className={labelClass}>Playing Role</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value as PlayerRole }))}
                                    className={selectClass}
                                >
                                    <option value="batsman">Batsman</option>
                                    <option value="bowler">Bowler</option>
                                    <option value="all-rounder">All-Rounder</option>
                                    <option value="wicket-keeper">Wicket Keeper</option>
                                </select>
                            </div>

                            {/* Batting Style */}
                            <div>
                                <label className={labelClass}>Batting Style</label>
                                <select
                                    value={form.battingStyle}
                                    onChange={(e) => setForm(prev => ({ ...prev, battingStyle: e.target.value as BattingStyle }))}
                                    className={selectClass}
                                >
                                    <option value="right-handed">Right Handed</option>
                                    <option value="left-handed">Left Handed</option>
                                </select>
                            </div>

                            {/* Bowling Style - Hide if role is batsman */}
                            {form.role !== 'batsman' && (
                                <div>
                                    <label className={labelClass}>Bowling Style</label>
                                    <select
                                        value={form.bowlingStyle}
                                        onChange={(e) => setForm(prev => ({ ...prev, bowlingStyle: e.target.value as BowlingStyle }))}
                                        className={selectClass}
                                    >
                                        <option value="right-arm-fast">Right Arm Fast</option>
                                        <option value="right-arm-medium">Right Arm Medium</option>
                                        <option value="right-arm-off-spin">Right Arm Off Spin</option>
                                        <option value="right-arm-leg-spin">Right Arm Leg Spin</option>
                                        <option value="left-arm-fast">Left Arm Fast</option>
                                        <option value="left-arm-medium">Left Arm Medium</option>
                                        <option value="left-arm-orthodox">Left Arm Orthodox</option>
                                        <option value="left-arm-chinaman">Left Arm Chinaman</option>
                                        <option value="slow-left-arm-orthodox">Slow Left Arm Orthodox</option>
                                    </select>
                                </div>
                            )}

                            {/* Social Links */}
                            <div>
                                <label className={labelClass}>Social Links (Max 3)</label>
                                <div className="space-y-3">
                                    {/* Add Link */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newLinkUrl}
                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                            placeholder="Paste profile URL..."
                                            className={`${inputClass} text-sm`}
                                        />
                                        <button
                                            onClick={handleAddLink}
                                            className="w-12 flex items-center justify-center rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    {/* Link List */}
                                    {form.socialLinks.map((link, index) => (
                                        <div key={index} className={`flex items-center gap-3 p-3 rounded-lg border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-700' : 'bg-white shadow-sm'}`}>
                                                {link.platform === 'facebook' && <Facebook size={16} className="text-blue-600" />}
                                                {link.platform === 'instagram' && <Instagram size={16} className="text-pink-600" />}
                                                {link.platform === 'x' && <Twitter size={16} className="text-black dark:text-white" />}
                                                {link.platform === 'linkedin' && <Linkedin size={16} className="text-blue-700" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                                    {link.username}
                                                </p>
                                                <p className={`text-xs truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {link.platform}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveLink(index)}
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Date of Birth */}
                    <div>
                        <label className={labelClass}>Date of Birth</label>
                        <input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) => setForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                            className={inputClass}
                        />
                    </div>

                    {/* Email (Read-only) */}
                    <div>
                        <label className={labelClass}>Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            readOnly
                            className={`${inputClass} opacity-60 cursor-not-allowed`}
                        />
                    </div>
                </div>

                {/* Save Button - Bottom */}
                <div className="px-5 mt-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-teal-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-teal-600 transition-colors disabled:opacity-50 shadow-lg"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
