'use strict';

const fs = require('fs');
const path = require('path');

const SITE_SETTING_UID = 'api::site-setting.site-setting';
const LEGAL_DOC_UID = 'api::legal-document.legal-document';

// Public read access for the website (no auth on the frontend).
const PUBLIC_ACTIONS = [
  `${SITE_SETTING_UID}.find`,
  `${LEGAL_DOC_UID}.find`,
  `${LEGAL_DOC_UID}.findOne`,
];

const DEFAULT_SITE_SETTING = {
  showHeroSecondaryButton: false,
  showNavConsultations: false,
  showNavReviews: false,
  showFeaturedCourse: false,
  showConsultationsButton: false,
  showContactForm: false,
  showFooterAboutLinks: false,
  showFooterSubscribe: false,
  showChatPhone: false,
  showCookieBanner: true,
  telegramUrl: 'https://t.me/ibragimovapsy',
  maxUrl: 'https://max.me/ibragimovapsy',
  vkUrl: 'https://vk.ru/studia_lucii',
  youtubeUrl: '',
  phone: '',
  legalName: 'ИП Ибрагимова Люция Равилевна',
  inn: '166007578586',
  ogrn: '325169000050755',
  legalAddress: '420140, Россия, Татарстан респ., город Казань г.о., г. Казань, ул. Зарничная, д. 10',
  legalEmail: 'info@luciaibragimova.ru',
  cookieBannerText:
    'Мы используем cookie-файлы, чтобы сайт работал корректно. Оставаясь на сайте, вы соглашаетесь с их использованием.',
};

// Seeded once; after that the documents are edited in the admin panel.
const LEGAL_DOCS = [
  { file: 'offer.md', slug: 'terms', order: 1 },
  { file: 'privacy.md', slug: 'privacy', order: 2 },
  { file: 'consent.md', slug: 'consent', order: 3 },
  { file: 'cookies.md', slug: 'cookies', order: 4 },
];

// Human-readable labels in the admin edit view.
const SITE_SETTING_LABELS = {
  showHeroSecondaryButton: 'Показывать вторую кнопку в первом экране',
  showNavConsultations: 'Меню: показывать «Консультации»',
  showNavReviews: 'Меню: показывать «Отзывы»',
  showFeaturedCourse: 'Показывать блок «Вовремя» (выделенный курс)',
  showConsultationsButton: 'Показывать кнопку «Записаться на консультацию»',
  showContactForm: 'Показывать форму заявки над подвалом',
  showFooterAboutLinks: 'Подвал: показывать ссылки «О студии» вместо реквизитов',
  showFooterSubscribe: 'Подвал: показывать кнопку «Подписаться»',
  showChatPhone: 'Виджет «Свяжитесь с нами»: показывать «Позвонить»',
  showCookieBanner: 'Показывать cookie-баннер',
  telegramUrl: 'Ссылка Telegram',
  maxUrl: 'Ссылка MAX',
  vkUrl: 'Ссылка ВКонтакте',
  youtubeUrl: 'Ссылка YouTube (пусто — иконка скрыта)',
  phone: 'Телефон (для «Позвонить»)',
  legalName: 'Реквизиты: наименование',
  inn: 'Реквизиты: ИНН',
  ogrn: 'Реквизиты: ОГРНИП',
  legalAddress: 'Реквизиты: адрес',
  legalEmail: 'Реквизиты: e-mail',
  cookieBannerText: 'Текст cookie-баннера',
};

const LEGAL_DOC_LABELS = {
  title: 'Название',
  slug: 'Адрес страницы (slug)',
  content: 'Текст документа',
  file: 'PDF для скачивания',
  showInFooter: 'Показывать в подвале',
  order: 'Порядок в подвале',
};

async function grantPublicPermissions(strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });
  if (!publicRole) return;

  for (const action of PUBLIC_ACTIONS) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });
    if (!existing) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
      strapi.log.info(`[bootstrap] granted public ${action}`);
    }
  }
}

async function seedSiteSetting(strapi) {
  const existing = await strapi.documents(SITE_SETTING_UID).findFirst();
  if (existing) return;
  await strapi.documents(SITE_SETTING_UID).create({ data: DEFAULT_SITE_SETTING });
  strapi.log.info('[bootstrap] seeded site-setting');
}

function readLegalSeed(file) {
  const fullPath = path.join(__dirname, '..', 'seed', 'legal', file);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, 'utf8').trim();
  const match = raw.match(/^#\s+(.+)\n+/);
  if (!match) return { title: file, content: raw };
  return { title: match[1].trim(), content: raw.slice(match[0].length).trim() };
}

async function seedLegalDocuments(strapi) {
  for (const doc of LEGAL_DOCS) {
    const existing = await strapi
      .documents(LEGAL_DOC_UID)
      .findFirst({ filters: { slug: doc.slug } });
    if (existing) continue;

    const seed = readLegalSeed(doc.file);
    if (!seed) continue;

    await strapi.documents(LEGAL_DOC_UID).create({
      data: {
        title: seed.title,
        slug: doc.slug,
        content: seed.content,
        showInFooter: true,
        order: doc.order,
      },
      status: 'published',
    });
    strapi.log.info(`[bootstrap] seeded legal document ${doc.slug}`);
  }
}

async function applyAdminLabels(strapi, uid, labels) {
  const service = strapi.plugin('content-manager')?.service('content-types');
  if (!service?.findConfiguration || !service?.updateConfiguration) return;

  const contentType = strapi.contentTypes[uid];
  const configuration = await service.findConfiguration(contentType);
  if (!configuration?.metadatas) return;

  let changed = false;
  const metadatas = { ...configuration.metadatas };
  for (const [field, label] of Object.entries(labels)) {
    const meta = metadatas[field];
    if (!meta?.edit || meta.edit.label === label) continue;
    // Only replace the auto-generated label (equal to the field name), keep manual edits.
    if (meta.edit.label && meta.edit.label !== field) continue;
    metadatas[field] = { ...meta, edit: { ...meta.edit, label } };
    changed = true;
  }

  if (changed) {
    await service.updateConfiguration(contentType, {
      settings: configuration.settings,
      metadatas,
      layouts: configuration.layouts,
    });
    strapi.log.info(`[bootstrap] admin labels set for ${uid}`);
  }
}

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    const steps = [
      ['public permissions', () => grantPublicPermissions(strapi)],
      ['site-setting seed', () => seedSiteSetting(strapi)],
      ['legal documents seed', () => seedLegalDocuments(strapi)],
      ['site-setting labels', () => applyAdminLabels(strapi, SITE_SETTING_UID, SITE_SETTING_LABELS)],
      ['legal-document labels', () => applyAdminLabels(strapi, LEGAL_DOC_UID, LEGAL_DOC_LABELS)],
    ];

    for (const [name, run] of steps) {
      try {
        await run();
      } catch (error) {
        strapi.log.error(`[bootstrap] ${name} failed: ${error.message}`);
      }
    }
  },
};
