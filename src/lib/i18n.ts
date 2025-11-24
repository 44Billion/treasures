import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../locales/en.json';
import jaTranslations from '../locales/ja.json';
import thTranslations from '../locales/th.json';

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		fallbackLng: 'en',
		supportedLngs: ['en', 'ja', 'th'],
		resources: {
			en: {
				translation: enTranslations,
			},
			ja: {
				translation: jaTranslations,
			},
			th: {
				translation: thTranslations,
			},
		},
		detection: {
			order: ['localStorage', 'navigator', 'htmlTag'],
			lookupLocalStorage: 'i18nextLng',
			caches: ['localStorage'],
		},
		react: {
			useSuspense: false, // Disable suspense for better compatibility
		},
		interpolation: {
			escapeValue: false, // React already escapes values
		},
	});

export default i18n;

