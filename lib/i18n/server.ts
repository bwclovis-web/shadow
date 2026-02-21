import { createInstance } from 'i18next'
import Backend from 'i18next-fs-backend'
import { resolve } from 'path'

export const getServerI18n = async (lng: string = 'en') => {
  const i18nInstance = createInstance()

  await i18nInstance
    .use(Backend)
    .init({
      lng,
      fallbackLng: 'en',
      load: 'languageOnly',
      backend: {
        loadPath: resolve('./public/locales/{{lng}}/{{ns}}.json'),
      },
    })

  return i18nInstance
}