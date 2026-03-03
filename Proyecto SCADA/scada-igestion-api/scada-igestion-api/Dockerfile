# Usa la versión LTS que definimos ayer
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias necesarias para compilar paquetes nativos
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer el puerto del Health Check
EXPOSE 3000

CMD ["npm", "start"]
