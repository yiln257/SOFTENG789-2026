FROM node:18-alpine

WORKDIR /app

# 先复制 package.json 利用 Docker 缓存层
COPY package*.json ./

RUN npm install

# 复制其余文件 (开发环境下主要依靠 volume 挂载，但写上是个好习惯)
COPY . .

# 假设你在 package.json 中使用了 nodemon: "dev": "nodemon index.js"
CMD ["npm", "run", "dev"]