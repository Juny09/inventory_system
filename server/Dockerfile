FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# 复制后端源代码
COPY src ./src
# 复制数据库迁移脚本目录，供启动时自动执行 migration 使用
COPY database ./database

EXPOSE 4000

CMD ["npm", "start"]
