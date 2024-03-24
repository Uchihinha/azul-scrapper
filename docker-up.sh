#!/usr/bin/env bash
docker ps -a | grep -q azul-scrapper

docker rm azul-scrapper || true

docker build --platform linux/amd64 -t azul-scrapper .

docker run --platform linux/amd64 -v ~/.aws-lambda-rie:/aws-lambda \
    -p 9000:8080 --entrypoint /aws-lambda/aws-lambda-rie azul-scrapper /usr/local/bin/npx aws-lambda-ric index.handler