# ☁️ CloudShop --- AWS DevOps E-Commerce Platform

CloudShop is a hands-on DevOps project that demonstrates how a
containerized e-commerce backend can be built, tested, deployed,
secured, and scaled on AWS using modern DevOps practices.

The project focuses on containerization, CI/CD automation,
Infrastructure as Code, cloud networking, security, and scalability.

## 📑 Table of Contents

-   [Architecture](#️-architecture)
-   [Tech Stack](#️-tech-stack)
-   [Local Docker Architecture](#-local-docker-architecture)
-   [Health Checks](#️-health-checks)
-   [CI/CD Pipeline](#-cicd-pipeline)
-   [AWS Infrastructure](#️-aws-infrastructure)
-   [Infrastructure as Code](#️-infrastructure-as-code-with-terraform)
-   [Security](#-security)
-   [Auto Scaling](#-auto-scaling)
-   [Repository Structure](#-repository-structure)
-   [Local Development](#-local-development)
-   [Roadmap](#️-project-roadmap)
-   [What I Learned](#-what-i-learned)

## 🎯 Project Goals

-   Containerize the Node.js backend with Docker.
-   Run the local application stack with Docker Compose.
-   Use Nginx as a reverse proxy.
-   Use PostgreSQL for persistent relational data.
-   Use Redis as a caching layer.
-   Build automated CI/CD pipelines with GitHub Actions.
-   Authenticate GitHub Actions to AWS using OIDC.
-   Store container images in Amazon ECR.
-   Deploy containers with Amazon ECS Fargate.
-   Route traffic through an Application Load Balancer.
-   Provision AWS infrastructure with Terraform.
-   Isolate application and data resources using AWS networking and
    Security Groups.
-   Scale the ECS application layer horizontally.

## 🏗️ Architecture

![CloudShop AWS Architecture](docs/cloudshop-architecture.png)

CloudShop uses a multi-AZ AWS architecture. The internet-facing
Application Load Balancer is the public entry point, while application
and data resources are isolated from direct Internet access.

### Request Flow

``` text
Client
  │
  ▼
Application Load Balancer
  │
  ▼
Target Group
  │
  ▼
ECS Fargate Tasks
  │
  ├──► Amazon RDS PostgreSQL
  └──► Amazon ElastiCache Redis
```

1.  The client sends a request to the Application Load Balancer.
2.  The ALB forwards traffic to healthy ECS task targets.
3.  The Node.js API processes application logic.
4.  PostgreSQL stores persistent relational data.
5.  Redis can serve frequently accessed data from memory to reduce
    repeated database queries.

## 🛠️ Tech Stack

  Layer                    Technology
  ------------------------ ----------------------------
  Backend                  Node.js, Express
  Containerization         Docker
  Local Orchestration      Docker Compose
  Reverse Proxy            Nginx
  Database                 PostgreSQL / Amazon RDS
  Cache                    Redis / Amazon ElastiCache
  Container Registry       Amazon ECR
  Compute                  Amazon ECS Fargate
  Load Balancing           Application Load Balancer
  Infrastructure as Code   Terraform
  CI/CD                    GitHub Actions
  AWS Authentication       GitHub OIDC, STS, IAM
  Auto Scaling             ECS Service Auto Scaling

## 🐳 Local Docker Architecture

Before deployment to AWS, CloudShop runs locally as a multi-container
application.

``` text
Client
  │
  ▼
Nginx :80
  │
  │ reverse proxy
  ▼
Node.js API :3000
  │
  ├──► PostgreSQL :5432
  └──► Redis :6379
```

### Components

**Nginx** acts as the local entry point and forwards API requests to the
backend.

**Node.js API** handles application logic and communicates with
PostgreSQL and Redis.

**PostgreSQL** stores persistent application data.

**Redis** provides an in-memory caching layer.

**Docker Network** allows containers to communicate through service
names rather than hard-coded container IP addresses.

``` text
nginx → api:3000
api   → postgres:5432
api   → redis:6379
```

Docker's internal DNS resolves service names such as `api`, `postgres`,
and `redis`.

**Docker Volume** keeps PostgreSQL data outside the lifecycle of the
database container so the container can be recreated without
automatically losing persistent data.

## ❤️ Health Checks

CloudShop distinguishes between a process that is alive and an
application that is ready to serve traffic.

### Liveness

``` text
GET /health
```

Checks whether the Node.js API is alive.

### Readiness

``` text
GET /health/ready
```

Checks whether the application is ready to serve requests and whether
required dependencies are available.

Example:

``` text
Node.js API    ✅ Running
PostgreSQL     ❌ Unavailable
Redis          ✅ Available

/health        → PASS
/health/ready  → FAIL
```

A started container is not necessarily a ready application. This
distinction is also useful during CI validation and load-balancer health
checking.

## 🔄 CI/CD Pipeline

CloudShop uses two GitHub Actions workflows:

``` text
.github/workflows/
├── ci.yml
└── cd.yml
```

### Continuous Integration

The CI workflow validates the application before deployment.

``` text
Push / Pull Request
        │
        ▼
Install Dependencies
        │
        ▼
Build Containers
        │
        ▼
Start Docker Compose Stack
        │
        ▼
Wait for /health/ready
        │
        ├── PASS → CI succeeds
        └── FAIL → pipeline fails
```

The pipeline waits for readiness instead of assuming that a newly
started container can immediately serve requests.

### Continuous Deployment

The deployment flow is designed around container images and ECS:

``` text
GitHub Actions
      │
      ▼
Authenticate to AWS with OIDC
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
ECS Starts New Fargate Tasks
      │
      ▼
ALB Health Check
      │
      ├── Healthy   → receive traffic
      └── Unhealthy → do not receive normal traffic
```

### GitHub OIDC Authentication

CloudShop uses OpenID Connect instead of storing long-lived AWS access
keys in GitHub.

``` text
GitHub Actions
      │
      │ OIDC token
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

This limits reliance on permanent AWS credentials in the CI/CD
environment.

## ☁️ AWS Infrastructure

### VPC and Subnets

The infrastructure is deployed inside an Amazon VPC spanning multiple
Availability Zones.

The network separates public-facing components from private application
and data resources:

-   **Public subnets** provide placement for the internet-facing
    Application Load Balancer.
-   **Private application subnets** provide placement for ECS Fargate
    workloads.
-   **Private data subnets** isolate RDS PostgreSQL and ElastiCache
    Redis.

### Application Load Balancer

The ALB is the public entry point.

``` text
Internet
   │
   ▼
Application Load Balancer
   │
   ▼
Target Group
   │
   ├── Healthy ECS Task
   └── Healthy ECS Task
```

The ALB distributes incoming traffic across healthy registered targets.

### Amazon ECS Fargate

The Node.js backend runs as containerized ECS tasks using AWS Fargate.

``` text
ECR Image
    │
    ▼
Task Definition
    │
    ▼
ECS Service
    │
    ├── Fargate Task
    └── Fargate Task
```

The **Task Definition** describes how a task runs, including its image,
CPU, memory, ports, environment configuration, secrets, and logging
configuration.

The **ECS Service** maintains the desired task count and manages
deployment of the application workload.

### Amazon RDS PostgreSQL

RDS PostgreSQL provides persistent relational storage for application
data.

``` text
ECS Task
   │
   │ TCP 5432
   ▼
RDS PostgreSQL
```

The database does not need direct public Internet access.

### Amazon ElastiCache Redis

Redis provides an in-memory caching layer.

A typical cache-aside flow is:

``` text
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
Return     ▼
       PostgreSQL
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

PostgreSQL remains the persistent source of application data while Redis
can accelerate repeated reads.

## 🏗️ Infrastructure as Code with Terraform

CloudShop infrastructure is defined with Terraform so infrastructure
changes can be reviewed and version controlled.

### Terraform Structure

``` text
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
    ├── variables.tf
    ├── outputs.tf
    └── providers.tf
```

> If the repository still contains `erc.tf`, rename it to `ecr.tf` if
> that file defines Amazon ECR resources so the filename matches the AWS
> service name.

### Provisioning Flow

``` text
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

  Terraform File     Responsibility
  ------------------ --------------------------------------------
  `networking.tf`    VPC, subnets, routing, and networking
  `security.tf`      Security Groups and network access rules
  `alb.tf`           Application Load Balancer and target group
  `ecs.tf`           ECS cluster, task definition, and service
  `rds.tf`           Amazon RDS PostgreSQL
  `redis.tf`         Amazon ElastiCache Redis
  `ecr.tf`           Amazon ECR repository
  `iam.tf`           IAM roles and permissions
  `secrets.tf`       Application secret configuration
  `autoscaling.tf`   ECS Service Auto Scaling

### GitHub OIDC Bootstrap

The `infrastructure/bootstrap/` configuration establishes the trust
relationship used by GitHub Actions.

``` text
GitHub Actions
      │
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
Temporary Credentials
```

### Terraform State

Local Terraform state and real variable files are excluded from Git:

``` text
*.tfstate
*.tfstate.*
*.tfvars
```

Example configuration files remain version controlled:

``` text
terraform.tfvars.example
.env.example
```

For a team or production-oriented setup, a remote Terraform backend with
state locking is a useful future improvement.

## 🔐 Security

CloudShop applies security controls across networking, AWS identity,
CI/CD authentication, and data access.

### Network Isolation

``` text
Internet
   │
   ▼
Application Load Balancer
   │
   ▼
Private ECS Application Layer
   │
   ├──► Private RDS PostgreSQL
   └──► Private ElastiCache Redis
```

Only the required public entry point needs to accept Internet traffic.

### Security Groups

Traffic between layers is restricted with Security Groups.

``` text
Internet
   │ HTTP/HTTPS
   ▼
ALB Security Group
   │ Application Port
   ▼
ECS Security Group
   │
   ├── TCP 5432 ──► RDS Security Group
   └── TCP 6379 ──► Redis Security Group
```

The data layer should accept connections from the required application
security group rather than arbitrary Internet addresses.

### IAM and Least Privilege

IAM roles and policies control which AWS API actions identities and
workloads can perform.

The project follows the principle:

> Grant only the permissions required to perform the intended task.

### Secrets and Sensitive Files

Sensitive values should not be hard-coded in source code, Docker images,
or committed Terraform variable files.

Ignored local files include:

``` text
.env
*.tfvars
*.tfstate
*.tfstate.*
```

Example files can safely describe required configuration without
containing real secrets.

## 📈 Auto Scaling

CloudShop uses ECS Service Auto Scaling to adjust the number of running
Fargate tasks according to workload.

``` text
Traffic Increases
       │
       ▼
CPU / Memory Utilization Increases
       │
       ▼
Target Tracking Policy
       │
       ▼
Desired Task Count Increases
       │
       ▼
ECS Launches Additional Tasks
       │
       ▼
Tasks Become Healthy
       │
       ▼
ALB Distributes Traffic
```

When demand decreases, the service can scale in and reduce the number of
tasks.

This is **horizontal scaling**: changing the number of tasks rather than
increasing the CPU or memory of one existing task.

## 📁 Repository Structure

``` text
cloudshop-devops/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── backend/
│   ├── Dockerfile
│   ├── app.js
│   ├── metrics.js
│   ├── package.json
│   └── package-lock.json
├── docs/
│   ├── cloudshop-architecture.png
│   └── notes/
├── infrastructure/
│   ├── bootstrap/
│   ├── nginx/
│   │   └── nginx.conf
│   └── terraform/
├── environments/
├── compose.yaml
├── load-test.js
├── .env.example
├── .gitignore
└── README.md
```

  -----------------------------------------------------------------------
  Path                                Purpose
  ----------------------------------- -----------------------------------
  `backend/`                          Node.js application source and
                                      Dockerfile

  `.github/workflows/`                CI/CD workflows

  `infrastructure/nginx/`             Nginx reverse proxy configuration

  `infrastructure/bootstrap/`         GitHub OIDC and IAM bootstrap
                                      infrastructure

  `infrastructure/terraform/`         Main AWS infrastructure

  `docs/`                             Architecture diagrams and project
                                      notes

  `environments/`                     Environment-specific configuration

  `compose.yaml`                      Local multi-container environment

  `load-test.js`                      Load-testing script
  -----------------------------------------------------------------------

## 🚀 Local Development

### Prerequisites

-   Git
-   Docker
-   Docker Compose

### 1. Clone the Repository

``` bash
git clone <your-repository-url>
cd cloudshop-devops
```

### 2. Configure Environment Variables

``` bash
cp .env.example .env
```

Update the required local values in `.env`. Do not commit the real
`.env` file.

### 3. Start CloudShop

``` bash
docker compose up -d --build
```

### 4. Check Container Status

``` bash
docker compose ps
```

### 5. Verify Health

``` bash
curl http://localhost/api/health
curl http://localhost/api/health/ready
```

### 6. View Logs

``` bash
docker compose logs -f
```

If the backend service in `compose.yaml` is named `api`:

``` bash
docker compose logs -f api
```

### 7. Stop the Environment

``` bash
docker compose down
```

To also remove Compose-managed volumes:

``` bash
docker compose down -v
```

Use `-v` carefully because persistent local database data may be
removed.

## 🗺️ Project Roadmap

Use `[x]` only for features that have actually been deployed and tested.

### Completed

-   [x] Build Node.js backend application
-   [x] Containerize the backend with Docker
-   [x] Run the application with Docker Compose
-   [x] Configure Nginx as a reverse proxy
-   [x] Integrate PostgreSQL
-   [x] Integrate Redis
-   [x] Implement health and readiness checks
-   [x] Build GitHub Actions CI/CD workflows
-   [x] Configure GitHub OIDC authentication with AWS
-   [x] Store Docker images in Amazon ECR
-   [x] Deploy the application with Amazon ECS Fargate
-   [x] Configure an Application Load Balancer
-   [x] Provision AWS infrastructure with Terraform
-   [x] Isolate application and data resources with VPC networking
-   [x] Configure ECS Service Auto Scaling

### Future Improvements

-   [ ] Add HTTPS with AWS Certificate Manager
-   [ ] Add AWS WAF protection
-   [ ] Improve automated testing
-   [ ] Implement Blue/Green deployment
-   [ ] Separate staging and production deployment workflows
-   [ ] Move Terraform state to a remote backend with state locking

## 📚 What I Learned

### Containerization

-   Docker image and container lifecycle
-   Multi-container applications with Docker Compose
-   Docker networking and internal DNS
-   Persistent data with Docker volumes
-   Reverse proxy configuration with Nginx
-   Liveness and readiness concepts

### CI/CD

-   GitHub Actions workflow design
-   Application validation before deployment
-   Building and publishing Docker images
-   Deploying application versions to ECS
-   GitHub-to-AWS authentication with OIDC
-   Temporary AWS credentials with STS

### AWS

-   VPC and multi-AZ architecture
-   Public and private network separation
-   Application Load Balancer and target groups
-   ECS services, task definitions, and Fargate tasks
-   Amazon ECR
-   Amazon RDS PostgreSQL
-   Amazon ElastiCache Redis
-   Security Groups
-   IAM and least privilege
-   ECS Service Auto Scaling

### Infrastructure as Code

-   Terraform configuration and resource lifecycle
-   `terraform init`, `plan`, and `apply`
-   Terraform variables and outputs
-   Terraform state
-   Version-controlled infrastructure
-   Separating OIDC bootstrap resources from application infrastructure

## 🎯 Key Architecture Principles

-   **Automation** --- automate build, validation, deployment, and
    infrastructure provisioning.
-   **Isolation** --- keep application and data resources away from
    unnecessary public access.
-   **Least Privilege** --- grant only required AWS permissions.
-   **Scalability** --- scale the application layer horizontally with
    ECS.
-   **Reproducibility** --- define application environments and
    infrastructure as code.
-   **Stateless Compute** --- keep persistent application data outside
    ECS tasks.
