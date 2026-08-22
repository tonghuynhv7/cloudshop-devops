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

## ☁️ AWS Infrastructure

CloudShop is deployed inside an Amazon VPC and designed across multiple Availability Zones to improve availability and isolate application components.

```text id="cnklxv"
                         Internet
                            │
                            ▼
                    Internet Gateway
                            │
                            ▼
              Application Load Balancer
                     /             \
                    /               \
              Public Subnet     Public Subnet
                  AZ-1              AZ-2
                    \               /
                     \             /
                      ▼           ▼
                     ECS Fargate
                     Application
                      /         \
                     ▼           ▼
                RDS PostgreSQL   ElastiCache
                    Redis
```

### VPC and Subnets

The AWS infrastructure is deployed inside a dedicated VPC spanning multiple Availability Zones.

The network is separated into public and private subnets:

* **Public subnets** host internet-facing components such as the Application Load Balancer.
* **Private application subnets** are used for ECS Fargate workloads.
* **Private data subnets** isolate RDS PostgreSQL and ElastiCache Redis from direct Internet access.

This separation reduces the public attack surface of the application.

### Application Load Balancer

The Application Load Balancer acts as the public entry point for CloudShop.

```text id="2pyghu"
Internet
   │
   ▼
ALB
   │
   ├── Health Check
   │
   ▼
Target Group
   │
   ▼
Healthy ECS Tasks
```

The ALB distributes incoming traffic across healthy ECS tasks and prevents unhealthy targets from receiving normal application traffic.

### Amazon ECS Fargate

The Node.js backend runs as containerized tasks managed by Amazon ECS using AWS Fargate.

```text id="5m11ao"
ECR Image
    │
    ▼
Task Definition
    │
    ▼
ECS Service
    │
    ├── Fargate Task
    ├── Fargate Task
    └── ...
```

The ECS Task Definition describes how the application container should run, while the ECS Service maintains the desired number of tasks and integrates them with the Application Load Balancer.

### Amazon RDS PostgreSQL

Amazon RDS PostgreSQL provides persistent relational storage for application data.

```text id="z69m37"
ECS Task
    │
    │ PostgreSQL connection
    ▼
Amazon RDS PostgreSQL
    │
    ▼
Persistent Data
```

The database is isolated from direct Internet access and is accessed by the application layer.

### Amazon ElastiCache Redis

Amazon ElastiCache for Redis provides an in-memory caching layer.

A typical cache flow is:

```text id="u9fkv0"
GET /products
      │
      ▼
     API
      │
      ▼
    Redis
    /   \
 HIT     MISS
  │        │
  ▼        ▼
Return   PostgreSQL
           │
           ▼
        Query Data
           │
           ▼
       Update Cache
           │
           ▼
         Return
```

Frequently accessed data can be served from Redis instead of repeatedly querying PostgreSQL, reducing database workload and improving response time.

### Security Groups

Security Groups restrict communication between infrastructure layers.

Conceptually, the allowed traffic follows:

```text id="cclu08"
Internet
   │
   │ HTTP/HTTPS
   ▼
  ALB
   │
   │ Application Port
   ▼
  ECS
   │
   ├── PostgreSQL :5432 ──► RDS
   │
   └── Redis      :6379 ──► ElastiCache
```

The database and cache layers do not need to accept direct inbound traffic from the Internet.

## 🏗️ Infrastructure as Code with Terraform

CloudShop infrastructure is defined using Terraform, allowing AWS resources to be created and managed through version-controlled infrastructure code instead of manual configuration.

### Terraform Structure

```text
infrastructure/
├── bootstrap/
│   ├── oidc.tf
│   ├── github-role.tf
│   ├── github-policy.tf
│   ├── providers.tf
│   └── variables.tf
│
└── terraform/
    ├── networking.tf
    ├── security.tf
    ├── alb.tf
    ├── ecs.tf
    ├── rds.tf
    ├── redis.tf
    ├── ecr.tf
    ├── iam.tf
    ├── secrets.tf
    ├── autoscaling.tf
    ├── cloudwatch.tf
    ├── monitoring.tf
    ├── sns.tf
    ├── variables.tf
    ├── outputs.tf
    └── providers.tf
```

### Infrastructure Provisioning Flow

```text
Terraform Configuration
        │
        ▼
terraform init
        │
        ▼
terraform plan
        │
        ▼
Review Changes
        │
        ▼
terraform apply
        │
        ▼
AWS Infrastructure
```

Terraform manages the major infrastructure components of CloudShop, including networking, security, load balancing, container orchestration, data services, monitoring, and auto scaling.

### Infrastructure Modules

| Terraform File   | Responsibility                                  |
| ---------------- | ----------------------------------------------- |
| `networking.tf`  | VPC, subnets, routing, and networking resources |
| `security.tf`    | Security Groups and network access rules        |
| `alb.tf`         | Application Load Balancer and target group      |
| `ecs.tf`         | ECS cluster, task definition, and service       |
| `rds.tf`         | Amazon RDS PostgreSQL                           |
| `redis.tf`       | Amazon ElastiCache Redis                        |
| `ecr.tf`         | Amazon ECR container repository                 |
| `iam.tf`         | AWS IAM roles and permissions                   |
| `secrets.tf`     | Application secret management                   |
| `autoscaling.tf` | ECS Service Auto Scaling                        |
| `cloudwatch.tf`  | CloudWatch logging and monitoring resources     |
| `monitoring.tf`  | Additional application monitoring configuration |
| `sns.tf`         | Monitoring notification resources               |

### GitHub OIDC Bootstrap

The `infrastructure/bootstrap` configuration establishes the trust relationship between GitHub Actions and AWS.

```text
GitHub Actions
      │
      │ OIDC Token
      ▼
AWS OIDC Provider
      │
      ▼
IAM Trust Policy
      │
      ▼
GitHub IAM Role
      │
      ▼
Temporary AWS Credentials
```

Separating the bootstrap infrastructure from the main application infrastructure helps isolate the resources required for GitHub-to-AWS authentication.

### Terraform State

Terraform state files and real environment variable files are intentionally excluded from Git:

```text
*.tfstate
*.tfstate.*
*.tfvars
```

Only example configuration files such as `terraform.tfvars.example` are stored in the repository.

This prevents local Terraform state and environment-specific values from being accidentally committed to source control.
## 🔐 Security

CloudShop applies multiple security controls across the network, application, CI/CD, and data layers.

### Network Isolation

The infrastructure separates public-facing resources from application and data resources.

```text
Internet
   │
   ▼
Public Layer
Application Load Balancer
   │
   ▼
Private Application Layer
ECS Fargate Tasks
   │
   ├──► RDS PostgreSQL
   └──► ElastiCache Redis
        Private Data Layer
```

The Application Load Balancer acts as the public entry point, while application and data resources are not directly exposed to the Internet.

### Security Groups

Security Groups restrict traffic between infrastructure layers.

```text
Internet
   │
   │ HTTP/HTTPS
   ▼
ALB Security Group
   │
   │ Application traffic
   ▼
ECS Security Group
   │
   ├── TCP 5432 ──► RDS Security Group
   │
   └── TCP 6379 ──► Redis Security Group
```

Instead of allowing database access from arbitrary IP addresses, the data layer accepts traffic only from the application layer that requires it.

### GitHub OIDC

GitHub Actions authenticates to AWS using OpenID Connect (OIDC).

```text
GitHub Actions
      │
      │ OIDC Token
      ▼
AWS STS
      │
      ▼
IAM Role
      │
      ▼
Temporary Credentials
```

This avoids storing long-lived AWS access keys directly in the CI/CD pipeline.

### IAM

IAM roles and policies control which AWS actions CloudShop components and CI/CD workflows are allowed to perform.

Permissions should follow the principle of least privilege:

> Grant only the permissions required to perform the intended task.

### Secrets Management

Sensitive application configuration should not be hard-coded into source code, Docker images, or committed Terraform variable files.

CloudShop separates sensitive configuration from application source code and keeps local environment and Terraform state files out of Git.

Examples of files excluded from version control include:

```text
.env
*.tfvars
*.tfstate
*.tfstate.*
```

Example files can remain in the repository:

```text
.env.example
terraform.tfvars.example
```

### Data Layer Protection

PostgreSQL and Redis are application dependencies and do not need direct public Internet access.

```text
Internet
   │
   X
   ├────────► PostgreSQL :5432
   │
   X
   └────────► Redis :6379

ECS
 │
 ├──────────► PostgreSQL :5432
 └──────────► Redis :6379
```

This reduces the attack surface of the data layer.
