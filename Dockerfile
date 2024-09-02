FROM node:22-alpine AS intermediate
LABEL stage=intermediate

RUN apk update && \
    apk upgrade && \
    apk add git && \
    git clone https://github.com/htilly/zenmusic.git

FROM node:22-alpine
RUN mkdir app
COPY --from=intermediate /zenmusic/* /app/
WORKDIR /app
RUN npm install --verbose

# Ensure proper permissions
RUN chmod -R 755 /app

CMD [ "node", "index.js" ]
