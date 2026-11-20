# AUREX — Gift Card Exchange

AUREX is a provider-independent gift-card marketplace foundation for buying and selling gift cards, with NGN-oriented customer workflows.

## Current milestone
- Express API with health, registration, login, rates, buy/sell trade submission and trade history.
- PostgreSQL schema and local Docker Compose.
- React + Vite customer dashboard.
- PWA manifest and service worker.
- Provider adapter interface with safe `mock` mode. No real funds or provider trades are moved in mock mode.
- Sogo, NPay and Eisy integration notes.

## Requirements
- Node.js 22+ (24 LTS recommended)
- npm
- PostgreSQL 15+ (or Docker Engine + Compose)
- Git

## Quick start (Linux / Kali)
```bash
git clone <YOUR-REPOSITORY-URL> AUREX
cd AUREX
cp .env.example .env
# Edit .env and set a long random JWT_SECRET and DB credentials.
docker compose -f infrastructure/docker-compose.yml up -d db
npm install
npm run install:all
npm run db:init
npm run dev
```
Open the Vite URL printed by the web app (normally http://localhost:5173).
API health: http://localhost:4000/api/v1/health

## Termux / Kali on Android
Use the Kali shell if it already has Node.js and PostgreSQL packages:
```bash
apt update && apt upgrade -y
apt install -y git nodejs npm postgresql postgresql-client
node --version
npm --version
```
If Node is older than 22, install a current Node.js release supported by your Kali repository before continuing.

Start PostgreSQL (service command availability varies by proot/container):
```bash
service postgresql start
# If service is unavailable, use the distro's documented PostgreSQL cluster command.
```
Create a local database and user (run as the postgres OS user):
```bash
su - postgres
psql
```
Inside psql:
```sql
CREATE USER aurex WITH PASSWORD 'replace-this-with-a-strong-password';
CREATE DATABASE aurex OWNER aurex;
\q
```
Return to the project directory and configure `.env`:
```bash
cd ~/AUREX
cp .env.example .env
nano .env
```
Set:
```env
DATABASE_URL=postgresql://aurex:replace-this-with-a-strong-password@127.0.0.1:5432/aurex
```
Then:
```bash
npm install
npm run install:all
npm run db:init
npm run dev
```
Run `npm run dev:api` and `npm run dev:web` in separate terminals if the combined command is inconvenient.

## Environment variables
See `.env.example`. Never commit `.env`, API secrets, JWT secrets, card codes, PINs, or uploaded card images.

## Important safety boundaries
- `PROVIDER_MODE=mock` is the default and does not call any external provider.
- Mock trade submissions are explicitly labelled `DEMO_PENDING`; they are not real purchases, sales, wallet credits, or payouts.
- Do not enable live provider calls until the provider has approved the business, issued production credentials, approved webhook URLs, and confirmed settlement terms.
- The first milestone does not implement real wallet custody, bank payouts, BVN/NIN verification, or KYC. Do not accept customer funds in this milestone.
- Gift-card codes are sensitive financial credentials. This starter does not persist submitted codes. A production secure-vault design and strict retention policy are required before handling real cards.

## Scripts
```bash
npm run dev
npm run dev:api
npm run dev:web
npm run db:init
npm run test
```

## Roadmap
1. Foundation and local sandbox (this repository).
2. Provider sandbox adapters and signed webhook verification.
3. Double-entry ledger, reconciliation, risk controls and secure card intake.
4. KYC/KYB, payment partner integration and bank payouts.
5. Admin console, observability, security review and production deployment.
