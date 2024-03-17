#!/usr/bin/env bash
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"arrival": "FLL","departure": "GRU","endDate": "03/20/2024","startDate": "03/11/2024"}' && docker cp azul-scrapper:/var/task/azul.png ./
