#!/usr/bin/env bash
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"arrival": "ORY","departure": "VCP","endDate": "05/23/2024","startDate": "05/14/2024"}' && docker cp azul-scrapper:/var/task/azul.png ./
