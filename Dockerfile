FROM alpine:latest

WORKDIR /opt
RUN apk add --no-cache git nodejs nodejs-npm
ADD . /opt
RUN npm install --production
CMD ["node", "index.js"]
