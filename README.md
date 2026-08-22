# ☁️ CloudShop — AWS DevOps E-Commerce Platform

CloudShop is a hands-on DevOps project that demonstrates how a containerized e-commerce backend can be built, tested, and deployed to AWS using modern DevOps practices.

The project focuses on containerization, CI/CD automation, cloud infrastructure, security, scalability, and observability.

## 🎯 Project Goals

* Containerize the application using Docker.
* Run multiple services locally with Docker Compose.
* Use Nginx as a reverse proxy.
* Store persistent application data in PostgreSQL.
* Use Redis for caching.
* Build automated CI/CD pipelines with GitHub Actions.
* Store Docker images in Amazon ECR.
* Deploy the application using Amazon ECS Fargate.
* Design a secure AWS network architecture.
* Implement monitoring and observability.

## 🏗️ Architecture

The CloudShop infrastructure is designed around a multi-AZ AWS VPC architecture. Public-facing components receive client traffic while application and data services remain isolated in private subnets.

![CloudShop AWS Architecture](docs/cloudshop-architecture.png)

### Request Flow

1. The client sends an HTTP request to the Application Load Balancer.
2. The ALB forwards traffic to healthy ECS Fargate tasks.
3. The Node.js API processes the request.
4. Persistent application data is stored in Amazon RDS PostgreSQL.
5. Redis is used as a caching layer to reduce database load and improve response time.

## 🛠️ Tech Stack

| Layer                  | Technology                      |
| ---------------------- | ------------------------------- |
| Backend                | Node.js, Express                |
| Containerization       | Docker                          |
| Local Orchestration    | Docker Compose                  |
| Reverse Proxy          | Nginx                           |
| Database               | PostgreSQL                      |
| Cache                  | Redis                           |
| Container Registry     | Amazon ECR                      |
| Compute                | Amazon ECS Fargate              |
| Load Balancing         | Application Load Balancer       |
| Infrastructure as Code | Terraform                       |
| CI/CD                  | GitHub Actions                  |
| AWS Authentication     | GitHub OIDC + IAM               |
| Monitoring             | CloudWatch, Prometheus, Grafana |
| Auto Scaling           | ECS Service Auto Scaling        |

## 🐳 Local Docker Architecture

Before deploying to AWS, CloudShop can run locally as a multi-container application using Docker Compose.

```text
Client
  │
  ▼
Nginx :80
  │
  │ Reverse Proxy
  ▼
Node.js API :3000
  │
  ├──► PostgreSQL :5432
  │
  └──► Redis :6379
```

### Components

**Nginx**

Acts as the entry point of the local application and forwards API requests to the Node.js backend.

**Node.js API**

Handles application logic and communicates with PostgreSQL and Redis.

**PostgreSQL**

Stores persistent application data.

**Redis**

Provides an in-memory caching layer to improve response time and reduce unnecessary database queries.

**Docker Network**

Allows containers to communicate using service names instead of hard-coded IP addresses.

For example:

```text
API → postgres:5432
API → redis:6379
Nginx → api:3000
```

Docker's internal DNS resolves service names such as `postgres`, `redis`, and `api` to the correct container addresses.

**Docker Volume**

PostgreSQL data is stored in a persistent Docker volume so that database data is not lost when the PostgreSQL container is recreated.

## ❤️ Health Checks

CloudShop uses health endpoints to distinguish between a running application and an application that is ready to serve traffic.

### Liveness

```text
GET /health
```

Checks whether the Node.js API process is running.

### Readiness

```text
GET /health/ready
```

Checks whether the application is ready to receive traffic and whether required dependencies are available.

Example:

```text
Node.js API     ✅ Running
PostgreSQL      ❌ Unavailable
Redis           ✅ Available

/health         → PASS
/health/ready   → FAIL
```

This prevents traffic from being sent to an application instance that is running but not actually ready to serve requests.

---

## 🔄 CI/CD Pipeline

CloudShop uses GitHub Actions to automate build, validation, container image publishing, and application deployment.

```text
Developer
    │
    │ git push
    ▼
GitHub Repository
    │
    ▼
GitHub Actions
    │
    ├── CI Pipeline
    │     ├── Install dependencies
    │     ├── Build containers
    │     ├── Start Docker Compose stack
    │     ├── Wait for readiness
    │     └── Validate application health
    │
    ▼
GitHub OIDC
    │
    ▼
AWS STS
    │
    ▼
IAM Role
    │
    ▼
Amazon ECR
    │
    ▼
Amazon ECS
    │
    ▼
ECS Fargate Tasks
```

### Continuous Integration

The CI workflow validates the application before deployment.

Typical flow:

```text
Push / Pull Request
        │
        ▼
Install Dependencies
        │
        ▼
Build Docker Images
        │
        ▼
docker compose up
        │
        ▼
Wait for /health/ready
        │
        ├── PASS → CI succeeds
        │
        └── FAIL → show logs and fail pipeline
```

The pipeline waits for application readiness instead of assuming that a started container is immediately ready to serve traffic.

### Continuous Deployment

The CD workflow deploys a validated application version to AWS.

```text
GitHub Actions
      │
      ▼
Authenticate to AWS
      │
      ▼
Build Docker Image
      │
      ▼
Push Image to Amazon ECR
      │
      ▼
Update ECS Deployment
      │
      ▼
ECS starts new Fargate Tasks
      │
      ▼
ALB Health Check
      │
      ├── Healthy → Receive traffic
      └── Unhealthy → No traffic
```

---

## 🔐 AWS Authentication with GitHub OIDC

CloudShop uses OpenID Connect instead of storing long-lived AWS access keys in GitHub.

```text
GitHub Actions
      │
      │ OIDC Token
      ▼
AWS STS
      │
      │ AssumeRoleWithWebIdentity
      ▼
IAM Role
      │
      ▼
Temporary AWS Credentials
```

This approach provides short-lived AWS credentials during the workflow and reduces the risk associated with storing permanent access keys in GitHub Secrets.
