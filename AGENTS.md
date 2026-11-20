# Repository instructions

## Production deployments

When asked to publish this fork to production, read and follow
[`DEPLOYMENT_DOKPLOY.md`](DEPLOYMENT_DOKPLOY.md). The production service exists
in Dokploy; the GitHub branch used for releases is `ecommerce-development`.
Never infer that production is missing because there is no branch named
`production`. After pushing, ask the user: “¿Quieres que verifique si el
despliegue ya terminó y te avise?”. Only check Dokploy after the user says yes
(or explicitly requests verification). Use the in-app browser, not Chrome.
Say the release is live only after verifying the matching Dokploy deployment.
