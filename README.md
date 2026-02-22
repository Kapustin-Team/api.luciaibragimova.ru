# api.luciaibragimova.ru

Strapi 5 backend for luciaibragimova.ru psychology school.

## Content Types
- **Direction** — course directions (Рождение семьи, Здоровое взросление, etc.)
- **Course** — courses and trainings
- **Review** — student reviews
- **FAQ** — frequently asked questions

## Setup
```bash
cp .env.example .env
npm install
npm run develop
```

## Docker
```bash
docker build -t api-lucia .
docker run -p 1337:1337 api-lucia
```

Requires Node.js 20-24.
