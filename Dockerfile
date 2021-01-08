FROM node:12-alpine as intermediate
LABEL stage=intermediate

RUN apk update && \
    apk upgrade && \
    apk add git && \
    git clone https://github.com/htilly/zenmusic.git

FROM node:12-alpine
RUN mkdir app
COPY --from=intermediate /zenmusic/* /app/
WORKDIR /app
COPY . .
RUN npm install

CMD [ "node", "index.js" ]
