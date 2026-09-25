import { gatewayMintEn, gatewayMintZhCN, gatewayMintZhTW, gatewayMintRu } from './gatewayMint';
/**
 * i18next 国际化配置
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
import { getInitialLanguage } from '@/utils/language';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: { ...zhCN, gateway_mint: gatewayMintZhCN } },
    'zh-TW': { translation: { ...zhTW, gateway_mint: gatewayMintZhTW } },
    en: { translation: { ...en, gateway_mint: gatewayMintEn } },
    ru: { translation: { ...ru, gateway_mint: gatewayMintRu } },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false, // React 已经转义
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
