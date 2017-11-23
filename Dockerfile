FROM resin/%%RESIN_MACHINE_NAME%%-node:slim

WORKDIR /opt
ADD . /opt
RUN npm install --production
CMD ["node", "index.js"]
