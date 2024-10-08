FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env .env
ENV MONGODB_URI=mongodb://localhost:27017/test
ENV WONDERBITS_MONGODB_URI=mongodb://localhost:27017/Wonderbits
ENV REDIS_URL=redis://localhost:6379
ENV DEPLOYER_PRIVATE_KEY=walletPrivateKey
EXPOSE 5000
CMD ["sh", "-c", "npx ts-node server.ts"]
