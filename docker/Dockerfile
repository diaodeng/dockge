############################################
# Healthcheck Binary
############################################
FROM louislam/dockge:build-healthcheck AS build_healthcheck

############################################
# Build
############################################
FROM louislam/dockge:base AS build
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources
# 安装编译依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node  ./package.json ./package.json
COPY --chown=node:node  ./package-lock.json ./package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --registry=https://registry.npmmirror.com && npm cache clean --force

############################################
# Build Frontend
############################################
FROM node:22-bookworm-slim AS build_frontend
WORKDIR /
COPY ./package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build:frontend

############################################
# ⭐ Main Image
############################################
FROM louislam/dockge:base AS release
WORKDIR /app
COPY --chown=node:node --from=build_healthcheck /app/extra/healthcheck /app/extra/healthcheck
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build_frontend /frontend-dist /app/frontend-dist
COPY --chown=node:node  . .
RUN mkdir ./data


# It is just for safe, as by default, it is disabled in the latest Node.js now.
# Read more:
# - https://github.com/sagemathinc/cocalc/issues/6963
# - https://github.com/microsoft/node-pty/issues/630#issuecomment-1987212447
ENV UV_USE_IO_URING=0

VOLUME /app/data
EXPOSE 5001
HEALTHCHECK --interval=60s --timeout=30s --start-period=60s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["tsx", "./backend/index.ts"]

############################################
# Mark as Nightly
############################################
FROM release AS nightly
RUN npm run mark-as-nightly
