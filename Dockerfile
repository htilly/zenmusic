FROM alpine:latest

WORKDIR /opt
RUN apk add --no-cache git nodejs
ADD . /opt
RUN npm install --production
ADD config.json /opt
ADD blacklist.txt /opt
CMD ["node", "index.js"]
