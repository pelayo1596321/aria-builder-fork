# Self-host Aria with Docker and Dokploy

## Publish changes to Pelayo's production service

Use this procedure whenever Pelayo asks to publish this fork to production.
The production service exists in Dokploy; do not mistake the absence of a Git
branch named `production` for the absence of a production environment.

### The two systems

- GitHub repository: `pelayo1596321/aria-builder-fork`. This stores the source
  code and its commits.
- Dokploy service: project **Aria Builder**, environment **production**, Compose
  service **Aria Builder Production**. This builds and runs the live application.
- The local checkout's deployment branch is `ecommerce-development`, tracking
  `origin/ecommerce-development`. At the time this guide was written, this was
  the only branch on the fork's GitHub remote. Push changes to this branch;
  never push these changes to `upstream`, `main`, or an invented `production`
  branch.

### Release steps

1. Work in the `aria-builder-fork` checkout. Before changing anything, run
   `git status --short --branch`, `git branch --show-current`, and
   `git remote -v`. Confirm the branch is `ecommerce-development` and `origin`
   is `pelayo1596321/aria-builder-fork`. Preserve existing edits; do not reset,
   discard, or overwrite unrelated user changes.
2. Build the Node production runtime with `npm run build:node`. This project is
   deployed through Docker Compose in Dokploy, not through the Cloudflare
   `wrangler` deployment command.
3. Review `git status` and `git diff --check`. The icon build can update the
   generated icon snapshot and its matching files under `public/vendor/`; keep
   those generated files together when they are changed. Stage and commit the
   intended feature changes, including any existing requested changes that
   have not yet been committed.
4. Push the commit to GitHub with
   `git push origin ecommerce-development`.
5. Open Dokploy at `https://dokploy.regaloskoko.com`, then select **Projects →
   Aria Builder → production → Aria Builder Production**. Confirm **Autodeploy**
   is enabled. If enabled, the GitHub push should start a deployment; if not,
   use **Deploy** on this service to publish the pushed commit.
6. Open the service's **Deployments** tab and wait for the deployment matching
   the pushed commit to finish successfully. Check the service is healthy and
   its configured production domain loads. A successful Git push alone is not
   proof that production finished deploying.

### Important

- The green status dot on the service card means the service is running; it
  does not by itself confirm that the latest commit is deployed.
- Report the commit SHA and branch. Say production is deployed only after
  verifying the corresponding successful Dokploy deployment. If deployment
  status cannot be inspected, clearly report that the code was pushed and
  production completion remains unverified.
- Do not modify production environment variables, domains, persistent volumes,
  or service wiring as part of a normal code release.

This deployment uses Aria's Node runtime with SQLite. It is intended for one
running application instance. The database and uploaded media are stored in
named Docker volumes and survive image rebuilds and container replacement.

## Deploy in Dokploy

1. For a new installation, create a Compose service from this repository and
   select the branch intended for that installation. For the existing Pelayo
   production service, follow **Publish changes to Pelayo's production service**
   above instead of creating another service.
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
