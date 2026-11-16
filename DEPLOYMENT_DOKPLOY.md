# Self-host Aria with Docker and Dokploy

This deployment uses Aria's Node runtime with SQLite. It is intended for one
running application instance. The database and uploaded media are stored in
named Docker volumes and survive image rebuilds and container replacement.

## Deploy in Dokploy

1. Create a Compose service from this repository and select the production
   branch.
2. Use the repository root as the Compose file directory. Dokploy detects
   `docker-compose.yml` and builds the included `Dockerfile`.
3. Set the service's exposed port to `4321` and attach the chosen hostname with
   Dokploy's domain and TLS settings.
4. Deploy, then open `/admin/setup` on that hostname and create the first
   administrator. Do this promptly after exposing the hostname: the initial
   setup is available until an administrator is created.

The compose file keeps the service on Dokploy's private network; it does not
publish a host port. Dokploy's domain proxy should route to the Compose service
`aria` on port `4321`.

## Data and backups

- `aria_storage` holds the SQLite database and local storage files.
- `aria_uploads` holds uploaded media.
- Back up both volumes together before upgrades or migration work.
- Run one replica only. SQLite is not a shared database for multiple replicas.

To run locally, use `docker compose up --build` and open
`http://localhost:4321/admin/setup`.

## Optional integrations

The web application starts without the background integration worker. To
deliver outgoing webhooks in Node production, configure Aria's webhook egress
proxy and API keyring, then run the integration worker as a separate service
sharing the same persistent database volume. Do not enable unrestricted direct
webhook egress from the container.
