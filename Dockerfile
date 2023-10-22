FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# If you are building your code for production
# RUN npm ci --omit=dev

# Bundle app source
COPY . .

#EXPOSE 8080

CMD [ "node", "index.js" ]