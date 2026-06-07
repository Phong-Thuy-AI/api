# --- BUILD STAGE ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Sao chép các tệp dữ liệu markdown (.md) sang thư mục dist để phục vụ import
RUN mkdir -p dist/data && cp src/data/*.md dist/data/

# --- PRODUCTION STAGE ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
