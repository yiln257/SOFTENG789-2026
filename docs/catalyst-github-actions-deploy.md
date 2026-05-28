# Catalyst Cloud GitHub Actions Deployment

This project can deploy automatically when code is pushed to `main`.

## GitHub repository secrets

Add these in GitHub: `Settings` -> `Secrets and variables` -> `Actions`.

| Secret | Example | Required |
| --- | --- | --- |
| `CATALYST_HOST` | `123.123.123.123` | Yes |
| `CATALYST_USER` | `ubuntu` | Yes |
| `CATALYST_SSH_KEY` | Private key that can SSH into the VM | Yes |
| `CATALYST_PORT` | `22` | No |
| `CATALYST_DEPLOY_PATH` | `/opt/softeng789` | No |

## Catalyst VM one-time setup

Do not install Node.js, npm, MongoDB, or Redis on your local Ubuntu/WSL machine. The application dependencies are installed inside Docker images.

The Catalyst Cloud VM only needs a container runtime so it can run the Docker services:

```bash
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
sudo apt install -y docker-compose-plugin
```

Create the shared production environment file:

```bash
sudo mkdir -p /opt/softeng789/shared
sudo chown -R ubuntu:ubuntu /opt/softeng789
nano /opt/softeng789/shared/.env.production
```

Use this template:

```env
JWT_SECRET=replace-with-a-long-random-secret
APP_HOST=203-0-113-10.sslip.io

TEACHER_EMAIL=teacher@example.com
TEACHER_PASSWORD=replace-with-teacher-password

EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-sender@example.com
EMAIL_PASS=replace-with-smtp-authorization-code
EMAIL_FROM=TBL Test System <your-sender@example.com>
```

## How deployment works

1. GitHub Actions runs on every push to `main`.
2. The workflow uploads a source archive to the VM over SSH.
3. The server script links `/opt/softeng789/shared/.env.production` into the release.
4. Docker Compose rebuilds and restarts the frontend, backend, MongoDB, and Redis containers.
5. The last five releases are kept for quick inspection, and older image layers are pruned.

The production deployment serves HTTPS through Caddy. The frontend serves `/api` and `/socket.io` through the same host, so the browser no longer needs `localhost:5000`.
