
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { ArrowLeft } from 'lucide-react';
import schoolConfig from '@/config/school';

export default function TermsPage() {
    const navigate = useNavigate();
    const { isDarkMode } = useThemeStore();

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
            {/* Header */}
            <div className={`safe-area-pt flex items-center gap-4 px-5 pt-4 pb-4 border-b ${isDarkMode ? 'border-slate-800 bg-[#1E293B]' : 'border-slate-100 bg-white'}`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2 -ml-2 rounded-full transition-all ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Terms & Privacy</h1>
            </div>

            <div className={`flex-1 overflow-y-auto px-5 py-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <div className="prose dark:prose-invert max-w-none">
                    <h3>Terms of Service</h3>
                    <p>
                        Welcome to {schoolConfig.appName}. By using our app, you agree to these terms.
                        Use the app responsibly and do not misuse the content.
                    </p>

                    <h3>Privacy Policy</h3>
                    <p>
                        We respect your privacy. We collect minimal data required to provide you with the best experience,
                        such as your profile information and preferences. We do not share your personal data with third parties
                        without your consent, except as required by law.
                    </p>

                    <h3>Content Ownership</h3>
                    <p>
                        All cricket data, scores, and statistics usage rights belong to the respective tournament organizers.
                        {schoolConfig.appName} provides this platform for informational purposes.
                    </p>

                    <p className="text-xs opacity-50 mt-8">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
