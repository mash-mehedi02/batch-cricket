
import { useLanguageStore } from '@/store/languageStore';
import { en } from '@/translations/en';
import { bn } from '@/translations/bn';

const translations = {
    en,
    bn,
};

type AppTranslationKey = keyof typeof en;

export function useTranslation() {
    const { language } = useLanguageStore();

    const t = (key: AppTranslationKey) => {
        const trans = translations[language];
        return trans[key] || translations['en'][key] || key;
    };

    return { t, language };
}
