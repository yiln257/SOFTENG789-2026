# 实时分组答题与测试系统 (Real-time Quiz & Testing System)

本项目是一个支持高并发（1000+ 人同时使用）的实时分组答题系统。采用前后端分离架构，核心依托 WebSocket (Socket.io) 和 Redis 缓存实现设备抢占锁、GPS 防作弊校验及状态实时同步。

## 🛠 技术栈 (Tech Stack)

* **前端:** React 18, Vite, TailwindCSS, Socket.io-client, Axios
* **后端:** Node.js 18, Express, Mongoose, Socket.io, Redis Client (ESM 规范)
* **数据库:** MongoDB 6.0 (持久化存储), Redis 7.0 (高并发状态与锁)
* **部署 & 环境:** Docker, Docker Compose, WSL2 (Ubuntu)

## ✨ 核心特性 (Key Features)

* **教师端 (Teacher Portal):**
  * 支持 1000 人名单与试题批量导入 (Excel/CSV)。
  * 一键随机 4 人分组，并使用 BullMQ/Redis 队列平滑分发包含独立密码的邮件。
  * 实时测验控制：发布、暂停、一键强制全员切题。
  * 实时学情大屏：动态展示各题通过率与 Feedback 词云数据。
* **学生端 (Student Portal):**
  * **GPS 严格核验:** 需与教师定位距离 < 500m，误差 < 15 分钟，且同组 4 人均就位方可解锁测试。
  * **设备抢占式答题:** 同一 Team 内采用 Redis `SETNX` 互斥锁，仅限首位点击“开始”的设备作为答题端，其余设备强制进入“观察者提示”模式。
  * **刮刮乐答题机制:** 选中立马反馈对错，错后可继续尝试，后端阶梯计分。

## 🚀 快速启动 (Getting Started)

本项目使用 `devcontainer` 和 `docker-compose` 进行完全容器化管理，确保开发环境零配置。

### 前置要求 (Prerequisites)
* 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) (并开启 WSL2 集成)
* 安装 VSCode 及其扩展 `Dev Containers`

### 运行步骤
1. 克隆本项目并进入根目录 `SOFTENG789-2026/`。
2. 复制 `.env` 模板文件：
   在 `backend/` 目录下创建 `.env` 文件，填入所需配置（参考内部提供的注释说明）。
3. 使用 VSCode 打开项目文件夹。
4. 按下 `Ctrl + Shift + P`，输入 `Dev Containers: Reopen in Container`。
5. 等待镜像构建完成。此时，前端、后端、MongoDB 和 Redis 均已在容器内启动。
   * **前端:** `http://localhost:3000`
   * **后端 API Health Check:** `http://localhost:5000/api/health`

## 📁 目录结构 (Directory Structure)

├── .devcontainer/     # VSCode 容器配置
├── backend/           # Node.js + Express + WebSocket 服务端
│   ├── src/
│   │   ├── config/    # DB 与 Redis 连接配置
│   │   ├── models/    # Mongoose 数据库模型 (User, Team, Test, Result)
│   │   └── services/  # 抽象业务层 (Redis Key 封装管理)
│   ├── Dockerfile
│   └── package.json
├── frontend/          # React + Vite 前端客户端
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml # 容器编排文件
└── README.md