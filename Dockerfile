FROM oven/bun:1.2 AS builder

WORKDIR /app

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN bun run build

FROM oven/bun:1.2-slim

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3000

CMD ["bun", "run", "preview", "--port", "3000", "--host", "0.0.0.0"]
