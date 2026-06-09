# Airline Reservation System

## Prerequisites

- Node.js 18+
- MariaDB or MySQL
- `mysql` or `mariadb` CLI on your PATH

## Install

```bash
git clone https://github.com/DohyeonLee0/Airlinereserv.git
cd Airlinereserv
npm install
```

Copy `.env.example` to `.env.local` and set your database credentials:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=airline_reservation
AUTH_SECRET=change-me-in-production
```

Make sure MariaDB is running, then initialize the database:

```bash
npm run db:setup
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Team Members

| Name | Role |
|------|------|
| Dohyeon Lee | Team member |
| Hyeseong Bak | Team member |
| Heesang Kim | Team member |

