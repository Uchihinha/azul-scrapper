#!/usr/bin/env bash
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{ "url": "https://kostak.co" }' && docker cp azul-scrapper:/var/task/azul.png ./
