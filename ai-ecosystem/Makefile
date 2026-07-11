# EdVisingU AI Ecosystem — local dev / CI entry points
SHELL := /bin/bash

.PHONY: lint test smoke up down clean

lint:
	python3 -m compileall -q router tools agents
	bash -n bootstrap.sh deploy/vps-harden.sh scripts/*.sh

test:
	python3 -m pytest router/tests tests -q

# Full keyless E2E: builds the fleet, waits for health, proves the
# UI -> router -> agent -> router loop with FAKE_LLM=1.
smoke:
	./scripts/smoke.sh

up:
	docker compose up -d --build

down:
	docker compose down

clean:
	docker compose down -v
	rm -rf .ci-data
