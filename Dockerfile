FROM node:22-alpine AS build
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache vips-dev
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 1337
CMD ["npm", "start"]
