FROM eclipse-mosquitto:latest
WORKDIR /usr/src/app
COPY vsstest.js ./
COPY vossynchronizationservice.js ./
COPY vossynchronizationsession.js ./
COPY vosclient.js ./
COPY vosentity.js ./
COPY package.json ./
COPY configuration.json ./
COPY Certificate/ ./Certificate
COPY Mosquitto/ ./Mosquitto
RUN apk add npm
RUN npm install
CMD [ "node", "./vsstest.js", "15525", "15526", "./configuration.json", "Certificate/ca_bundle.crt", "Certificate/private.key", "Certificate/certificate.crt" ]
EXPOSE 15525
EXPOSE 15526