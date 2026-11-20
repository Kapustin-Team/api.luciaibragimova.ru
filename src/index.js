'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SITE_SETTING_UID = 'api::site-setting.site-setting';
const LEGAL_DOC_UID = 'api::legal-document.legal-document';
const STUDIO_GALLERY_UID = 'api::studio-gallery.studio-gallery';

// Public read access for the website (no auth on the frontend).
const PUBLIC_ACTIONS = [
  `${SITE_SETTING_UID}.find`,
  `${LEGAL_DOC_UID}.find`,
  `${LEGAL_DOC_UID}.findOne`,
  `${STUDIO_GALLERY_UID}.find`,
];

const DEFAULT_SITE_SETTING = {
  showHeroSecondaryButton: false,
  showNavConsultations: false,
  showNavReviews: false,
  showFeaturedCourse: false,
  showConsultationsButton: false,
  showContactForm: false,
  showPinkBanner: false,
  showStudioGallery: true,
  showCourseTariffs: false,
  showCourseFinalCta: false,
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
  showPinkBanner: 'Показывать баннер «Более 500 семей…»',
  showStudioGallery: 'Показывать галерею «Внутри студии»',
  showCourseTariffs: 'Страницы курсов: показывать тарифы (иначе «Курс в разработке» или кнопка на GetCourse)',
  showCourseFinalCta: 'Страницы курсов: показывать блок «Готовы начать свой путь?»',
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
  if (existing) {
    // Fields added in later releases are null on the existing record:
    // fill them with defaults so the admin checkboxes match the site.
    const missing = {};
    for (const [key, value] of Object.entries(DEFAULT_SITE_SETTING)) {
      if (existing[key] === null || existing[key] === undefined) missing[key] = value;
    }
    if (Object.keys(missing).length > 0) {
      await strapi.documents(SITE_SETTING_UID).update({
        documentId: existing.documentId,
        data: missing,
      });
      strapi.log.info(`[bootstrap] site-setting defaults filled: ${Object.keys(missing).join(', ')}`);
    }
    return;
  }
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

const SEED_STORE = { type: 'core', name: 'lucia-seed' };

async function seedLegalDocuments(strapi) {
  // Seed only once: documents deleted later in the admin are not recreated.
  const store = strapi.store(SEED_STORE);
  if (await store.get({ key: 'legal-documents-v1' })) return;

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

  await store.set({ key: 'legal-documents-v1', value: true });
}

const STUDIO_GALLERY_SEED = {
  title: 'Внутри студии',
  subtitle: 'Пространство, где спокойно говорить о важном',
  items: [
    { file: 'studio-reception.jpg', caption: 'Ресепшен' },
    { file: 'studio-consultation-room.jpg', caption: 'Кабинет для индивидуальных консультаций' },
    { file: 'studio-small-group-room.jpg', caption: 'Комната для малых групп' },
    { file: 'studio-group-hall.jpg', caption: 'Зал на 10 человек' },
    { file: 'studio-classroom.jpg', caption: 'Учебный класс' },
    { file: 'studio-kitchen.jpg', caption: 'Кухня, зона отдыха' },
  ],
};

async function uploadSeedImage(strapi, file, alternativeText) {
  const source = path.join(__dirname, '..', 'seed', 'studio-gallery', file);
  if (!fs.existsSync(source)) return null;
  // Upload works on a temp copy so the seed file is never moved or removed.
  const tmpPath = path.join(os.tmpdir(), `lucia-seed-${Date.now()}-${file}`);
  fs.copyFileSync(source, tmpPath);
  try {
    const [uploaded] = await strapi
      .plugin('upload')
      .service('upload')
      .upload({
        data: { fileInfo: { name: file, alternativeText, caption: alternativeText } },
        files: {
          filepath: tmpPath,
          originalFilename: file,
          mimetype: 'image/jpeg',
          size: fs.statSync(tmpPath).size,
        },
      });
    return uploaded;
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

async function seedStudioGallery(strapi) {
  const store = strapi.store(SEED_STORE);
  if (await store.get({ key: 'studio-gallery-v1' })) return;

  const existing = await strapi.documents(STUDIO_GALLERY_UID).findFirst();
  if (!existing) {
    const items = [];
    for (const item of STUDIO_GALLERY_SEED.items) {
      const image = await uploadSeedImage(strapi, item.file, item.caption);
      if (image) items.push({ image: image.id, caption: item.caption });
    }
    await strapi.documents(STUDIO_GALLERY_UID).create({
      data: {
        title: STUDIO_GALLERY_SEED.title,
        subtitle: STUDIO_GALLERY_SEED.subtitle,
        items,
      },
    });
    strapi.log.info(`[bootstrap] seeded studio gallery (${items.length} photos)`);
  }

  await store.set({ key: 'studio-gallery-v1', value: true });
}

const STUDIO_GALLERY_LABELS = {
  title: 'Заголовок',
  subtitle: 'Подзаголовок',
  items: 'Фотографии (порядок — перетаскиванием)',
};

const COURSE_UID = 'api::course.course';
const COURSE_LABELS = {
  getcourseLink: 'Ссылка на GetCourse (заполнена — карточка курса ведёт на GetCourse; пусто — на страницу курса на сайте)',
};

// One-time: move the GetCourse link field to its own row right under the title,
// so it is easy to find in the long course form.
async function promoteCourseGetcourseField(strapi) {
  const store = strapi.store(SEED_STORE);
  if (await store.get({ key: 'course-getcourse-field-v1' })) return;

  const service = strapi.plugin('content-manager')?.service('content-types');
  if (!service?.findConfiguration || !service?.updateConfiguration) return;
  const contentType = strapi.contentTypes[COURSE_UID];
  const configuration = await service.findConfiguration(contentType);
  const edit = configuration?.layouts?.edit;
  if (!Array.isArray(edit)) return;

  let field = null;
  const rows = edit
    .map((row) =>
      row.filter((f) => {
        if (f.name === 'getcourseLink') {
          field = f;
          return false;
        }
        return true;
      })
    )
    .filter((row) => row.length > 0);
  if (!field) return;
  rows.splice(1, 0, [{ ...field, size: 12 }]);

  await service.updateConfiguration(contentType, {
    settings: configuration.settings,
    metadatas: configuration.metadatas,
    layouts: { ...configuration.layouts, edit: rows },
  });
  await store.set({ key: 'course-getcourse-field-v1', value: true });
  strapi.log.info('[bootstrap] course form: GetCourse link moved under the title');
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
      ['studio gallery seed', () => seedStudioGallery(strapi)],
      ['site-setting labels', () => applyAdminLabels(strapi, SITE_SETTING_UID, SITE_SETTING_LABELS)],
      ['legal-document labels', () => applyAdminLabels(strapi, LEGAL_DOC_UID, LEGAL_DOC_LABELS)],
      ['studio-gallery labels', () => applyAdminLabels(strapi, STUDIO_GALLERY_UID, STUDIO_GALLERY_LABELS)],
      ['course labels', () => applyAdminLabels(strapi, COURSE_UID, COURSE_LABELS)],
      ['course form layout', () => promoteCourseGetcourseField(strapi)],
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
