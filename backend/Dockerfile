FROM node:20-alpine
WORKDIR /app
# Prisma's query engine needs OpenSSL to be present so it can correctly
# detect the version and pick a matching engine binary. Alpine's default
# image doesn't include it, which causes:
#   "Error loading shared library libssl.so.1.1: No such file or directory"
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
# Dev mode: runs NestJS in watch mode instead of a compiled dist/main.js.
# This is what lets the bind-mounted ./backend:/app volume in
# docker-compose.yml actually work for live-reload during development.
CMD ["npm", "run", "start:dev"]