
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { ArrowLeft } from 'lucide-react';
import schoolConfig from '@/config/school';
import { useTranslation } from '@/hooks/useTranslation';

export default function PrivacyPolicy() {
    const navigate = useNavigate();
    const { isDarkMode } = useThemeStore();
    const { t } = useTranslation();

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
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {t('menu_privacy_policy')}
                </h1>
            </div>

            <div className={`flex-1 overflow-y-auto px-5 py-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <div className="prose dark:prose-invert max-w-none space-y-6">
                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Introduction</h2>
                        <p>
                            At {schoolConfig.appName}, accessible from our mobile application, one of our main priorities is the privacy of our visitors.
                            This Privacy Policy document contains types of information that is collected and recorded by {schoolConfig.appName} and how we use it.
                        </p>
                    </section>

                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Information We Collect</h2>
                        <p>
                            We collect information to provide better services to all our users. The types of information we collect include:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Account Information:</strong> When you register for an account, we may ask for your contact information, including items such as name, email address, and telephone number.</li>
                            <li><strong>Profile Information:</strong> You may provide information such as a profile picture, batch details, and cricket-related statistics.</li>
                            <li><strong>Device Information:</strong> We may collect information about the mobile device you use to access our application, including the hardware model, operating system and version, and unique device identifiers.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>How We Use Your Information</h2>
                        <p>We use the information we collect in various ways, including to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Provide, operate, and maintain our application.</li>
                            <li>Improve, personalize, and expand our application.</li>
                            <li>Understand and analyze how you use our application.</li>
                            <li>Develop new products, services, features, and functionality.</li>
                            <li>Communicate with you, either directly or through one of our partners.</li>
                            <li>Send you push notifications regarding match updates and scores.</li>
                            <li>Find and prevent fraud.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Third-Party Services</h2>
                        <p>
                            We use various third-party services to ensure the app works correctly:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Google Firebase:</strong> Used for authentication, database management (Firestore), and push notifications.</li>
                            <li><strong>Capacitor Plugins:</strong> Used to access native device features like status bar, splash screen, and local storage.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Security</h2>
                        <p>
                            We value your trust in providing us your Personal Information, thus we are striving to use commercially acceptable means of protecting it.
                            But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Contact Us</h2>
                        <p>
                            If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us.
                        </p>
                    </section>

                    <div className="h-10"></div>

                    <p className="text-xs opacity-50 mt-8">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
