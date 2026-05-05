 # Multi-stage Next.js build for Kubernetes
 #
 # Notes:
 # - We keep devDependencies in the runtime image because:
 #   - socket server runs via `ts-node` (`npm run dev:socket`)
 #   - migrations/seeders run via `sequelize-cli`
 # - If you want a slimmer image later, split web/socket/tools images or precompile socket + bundle sequelize-cli.
 
 FROM node:22-alpine AS builder
 
 WORKDIR /app
 
 # Native build deps for bcrypt and friends
 RUN apk add --no-cache python3 make g++ git
 
 COPY package.json package-lock.json ./
 RUN npm ci
 
 COPY . .
 
 # Build Next.js app
 RUN npm run build
 
 
 FROM node:22-alpine AS runner
 
 WORKDIR /app
 
 ENV NODE_ENV=production
 ENV NEXT_TELEMETRY_DISABLED=1
 
 # Native runtime deps (bcrypt may need libc compatibility depending on build)
 RUN apk add --no-cache libc6-compat
 
 COPY --from=builder /app/package.json /app/package-lock.json ./
 
 # Install ALL deps (see note at top of file)
 RUN npm ci
 
 # Runtime assets
 COPY --from=builder /app/.next ./.next
 COPY --from=builder /app/public ./public
 COPY --from=builder /app/next.config.js ./next.config.js
 COPY --from=builder /app/app ./app
 COPY --from=builder /app/src ./src
 COPY --from=builder /app/socketServer.ts ./socketServer.ts
 COPY --from=builder /app/server.ts ./server.ts
 COPY --from=builder /app/tsconfig.json ./tsconfig.json
 COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json
 COPY --from=builder /app/scripts ./scripts
 COPY --from=builder /app/migrations ./migrations
 COPY --from=builder /app/seeders ./seeders
 
 EXPOSE 3000
 
 CMD ["npm", "run", "start"]
