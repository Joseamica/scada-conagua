FROM node:20-alpine

WORKDIR /app

# Bcrypt requiere estas herramientas de compilación en Alpine
RUN apk add --no-cache python3 make g++ 

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# Puerto de la API
EXPOSE 3001

CMD ["npm", "start"]
