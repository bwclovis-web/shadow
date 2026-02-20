import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-fs-backend'
import { resolve } from 'path'

export async function getServerI18n(lng: string = 'en') {
  const i18nInstance = createInstance()
  
  await i18nInstance
    .use(Backend)
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng: 'en',
      backend: {
        loadPath: resolve('./public/locales/{{lng}}/{{ns}}.json'),
      },
    })

  return i18nInstance
}