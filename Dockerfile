FROM alpine:latest

WORKDIR /opt
RUN apk add --no-cache git nodejs
ADD . /opt
RUN npm install --production
CMD ["node", "index.js"]
