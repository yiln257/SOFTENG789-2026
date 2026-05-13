FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# 如果是 Create React App 则为 npm start；如果是 Vite 则为 npm run dev
CMD ["npm", "run", "dev"]