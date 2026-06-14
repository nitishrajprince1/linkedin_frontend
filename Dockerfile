FROM oven/bun:1.2

WORKDIR /app

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

EXPOSE 3000

CMD ["bunx", "wrangler", "dev", "--port", "3000"]
