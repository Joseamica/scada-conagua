# --- Etapa 1: Construcción (Node.js) ---
FROM node:20-alpine as build-step

WORKDIR /app

# Copiamos primero los archivos de dependencias para aprovechar el caché de Docker
COPY package.json package-lock.json* ./

# Instalamos dependencias
RUN npm install

# Copiamos el código fuente
COPY . .

# Construimos la aplicación para producción
RUN npm run build -- --configuration development

# --- Etapa 2: Servidor (Nginx) ---
FROM nginx:alpine

# Copiamos el build de Angular desde la etapa anterior
# NOTA: En Angular 17+ con SSR, la ruta suele ser dist/NOMBRE_PROYECTO/browser
COPY --from=build-step /app/dist/scada-demo/browser /usr/share/nginx/html

# Copiamos nuestra configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponemos el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]