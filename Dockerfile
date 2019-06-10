FROM node:12-slim

WORKDIR /opt/app

COPY package*.json ./

RUN npm i --production

COPY . ./

CMD ["npm", "start"]