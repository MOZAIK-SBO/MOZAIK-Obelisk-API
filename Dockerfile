# https://bun.sh/guides/ecosystem/docker

# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy production dependencies and source code into final image
FROM base AS release

RUN apt-get update && apt-get install curl -y && rm -rf /var/lib/apt/lists/*

COPY --from=install /temp/prod/node_modules node_modules
COPY --chown=bun:bun . .

ENV NODE_ENV=production

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "start" ]

