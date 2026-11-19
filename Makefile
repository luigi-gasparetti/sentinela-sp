.PHONY: db-up db-schema db-seed db-setup db-status db-down

db-up:
	docker compose up -d --wait

db-schema: db-up
	npm run db:migrate -w @sentinela/api

db-seed: db-schema
	npm run db:seed -w @sentinela/api

db-setup: db-seed

db-status:
	docker compose ps

db-down:
	docker compose down
