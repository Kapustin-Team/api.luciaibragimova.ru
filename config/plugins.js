module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
    },
  },
  // S3 in production; local disk when S3 credentials are absent (local dev).
  ...(env('S3_ACCESS_KEY_ID') ? {} : { upload: { config: { provider: 'local' } } }),
  ...(env('S3_ACCESS_KEY_ID') ? { upload: {
    config: {
      provider: '@strapi/provider-upload-aws-s3',
      providerOptions: {
        baseUrl: env('CDN_URL', 'https://cdn.kpstn.ru'),
        rootPath: 'lucia-uploads',
        s3Options: {
          credentials: {
            accessKeyId: env('S3_ACCESS_KEY_ID'),
            secretAccessKey: env('S3_ACCESS_SECRET'),
          },
          endpoint: env('S3_ENDPOINT'),
          region: env('S3_REGION', 'ru-7'),
          forcePathStyle: true,
          params: {
            Bucket: env('S3_BUCKET'),
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  } } : {}),
});
