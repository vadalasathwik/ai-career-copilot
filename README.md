# AI Career Copilot

Your AI-Powered Career Growth Platform.

## Overview

AI Career Copilot is a modern web application designed to empower professionals in their career journey. The platform aims to streamline the job search process by leveraging intelligent tools, providing a secure and scalable foundation for managing professional growth.

## Current Features

The application currently supports the following implemented features:

* User Registration
* User Login
* Google OAuth Authentication
* Protected Dashboard
* Session Management
* User Persistence
* PostgreSQL Integration
* Prisma ORM
* Route Protection

## Architecture

The platform follows a modern full-stack architecture leveraging Next.js and its App Router:

```mermaid
graph TD
    A[User] -->|Interacts with| B(Next.js Frontend)
    B -->|Calls| C(API Routes / Server Actions)
    C -->|Invokes| D(Service Layer)
    D -->|Uses| E(Prisma ORM)
    E -->|Queries/Mutates| F[(PostgreSQL)]
```

* **Next.js Frontend**: The client-facing layer, built with React and styled with Tailwind CSS, responsible for rendering UI and managing client state.
* **API Routes / Server Actions**: The Next.js server-side logic handling HTTP requests, form submissions, and authentication callbacks.
* **Service Layer**: Encapsulates business logic, including user management and authentication handling.
* **Prisma ORM**: The Object-Relational Mapper that provides a type-safe database client for executing queries.
* **PostgreSQL**: The relational database persisting application data.

## Tech Stack

**Frontend:**
* Next.js
* React
* TypeScript
* Tailwind CSS

**Backend:**
* Next.js Route Handlers

**Authentication:**
* Auth.js
* Google OAuth
* JWT
* Cookies

**Database:**
* PostgreSQL
* Prisma

**Version Control:**
* Git
* GitHub

## Project Structure

* `src/app`: Contains the Next.js App Router definitions, including pages, layouts, and route handlers.
* `src/components`: Houses reusable React components used across the application.
* `src/backend`: Includes backend utilities, services, and server-side configurations.
* `prisma`: Contains the `schema.prisma` file defining the database schema and configurations for the Prisma ORM.

## Authentication Flow

The authentication process guarantees secure access to the platform:
1. **User** initiates the login process via local credentials or Google OAuth.
2. The request reaches the **Login** route handled by **Auth.js**.
3. Auth.js verifies the credentials against the **Database** (or external provider).
4. Upon successful validation, a **Session** (JWT and cookie-based) is created.
5. The authenticated user is securely redirected to the **Dashboard**.

## Database Design

The primary data model currently defines the user entity:

```prisma
model User {
  id         Int     @id @default(autoincrement())
  name       String
  email      String  @unique
  password   String?
  image      String?
  provider   String  @default("local")
  providerId String?
}
```

* `id`: Unique identifier for the user.
* `name`: The user's full name.
* `email`: A unique email address used for login and notifications.
* `password`: Securely hashed password (optional if using OAuth).
* `image`: URL to the user's profile picture.
* `provider`: The authentication provider ("local" or "google").
* `providerId`: The unique ID from the external authentication provider.

## Local Development Setup

To set up the project locally:

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up your environment variables. Create a `.env` file in the root directory with the following variables:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
AUTH_SECRET="your_nextauth_secret"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"
```

3. Run Prisma migrations to set up your database schema:
```bash
npx prisma generate
```

4. Start the development server:
```bash
npm run dev
```

## Future Roadmap

The following features are planned for future releases:

### Phase 1
* Resume Upload
* Resume Storage

### Phase 2
* PDF Parsing
* Skill Extraction

### Phase 3
* AI Resume Analysis
* ATS Scoring

### Phase 4
* Job Matching

### Phase 5
* Analytics Dashboard

### Phase 6
* Docker

### Phase 7
* Deployment Enhancements

## Learning Outcomes

This project demonstrates several key concepts in modern web development:
* Authentication
* Authorization
* OAuth
* Database Integration
* ORM Usage
* Protected Routes
* Full Stack Development

## License

MIT License
