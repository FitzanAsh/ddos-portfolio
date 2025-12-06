const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for development
}));
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ============================================
// Server State Variables
// ============================================
let simulatedLoad = 0;
let concurrentRequests = 0;
let totalRequests = 0;
let recentRequests = 0;
let reqPerSecond = 0;
let failuresPerSecond = 0;
let recentFailures = 0;
let recentLatencies = [];
let p50Latency = 0;
let p95Latency = 0;
let rateLimitMax = 60; // Default: 60 requests per minute

const MAX_CONCURRENCY = 10;
const SLOW_MAX_MS = 1200;

// Calculate requests per second every 1 second
// Calculate requests per second every 1 second
setInterval(() => {
    reqPerSecond = recentRequests;
    failuresPerSecond = recentFailures;

    // Calculate Percentiles
    if (recentLatencies.length > 0) {
        recentLatencies.sort((a, b) => a - b);
        p50Latency = recentLatencies[Math.floor(recentLatencies.length * 0.5)];
        p95Latency = recentLatencies[Math.floor(recentLatencies.length * 0.95)];
    } else {
        p50Latency = 0;
        p95Latency = 0;
    }

    recentRequests = 0;
    recentFailures = 0;
    recentLatencies = [];
}, 1000);

// ============================================
// Rate Limiter Configuration
// ============================================
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: () => rateLimitMax, // Dynamic limit
    message: { error: "Rate limit exceeded. Too many requests." },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        recentFailures++; // Count rate limit hits as failures
        res.status(options.statusCode).send(options.message);
    }
});

// ============================================
// Concurrency Throttle Middleware
// ============================================
function throttle(req, res, next) {
    if (concurrentRequests >= MAX_CONCURRENCY) {
        return res.status(503).json({
            error: "Server busy, please try again later.",
            concurrentRequests,
            maxConcurrency: MAX_CONCURRENCY
        });
    }
    concurrentRequests++;
    res.on("finish", () => concurrentRequests--);
    concurrentRequests++;
    res.on("finish", () => concurrentRequests--);
    next();
}

// Middleware to just count requests (for visualization) without blocking
function countRequests(req, res, next) {
    concurrentRequests++;
    res.on("finish", () => concurrentRequests--);
    next();
}

// ============================================
// Utility Functions
// ============================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getServerHealth() {
    if (simulatedLoad > 85) return "critical";
    if (simulatedLoad > 60) return "warning";
    return "healthy";
}

// ============================================
// API Endpoints
// ============================================

// Main status endpoint with simulated latency
// app.get("/api/status", apiLimiter, throttle, async (req, res) => {
app.get("/api/status", countRequests, async (req, res) => {
    totalRequests++;
    recentRequests++;

    // Calculate dynamic latency based on load
    const baseLatency = Math.floor(Math.random() * 200) + 30;
    const loadLatency = Math.floor((simulatedLoad / 100) * SLOW_MAX_MS);
    const jitter = Math.floor(Math.random() * 200);
    const delay = Math.min(SLOW_MAX_MS, baseLatency + loadLatency + jitter);

    // 20% chance of 503 when load > 85%
    if (simulatedLoad > 85 && Math.random() < 0.2) {
        await sleep(200);
        recentFailures++;
        return res.status(503).json({
            status: "down",
            message: "503 Simulated Overload - Server Cannot Handle Request",
            simulatedLoad,
            timestamp: new Date().toISOString()
        });
    }

    // Simulate processing delay
    await sleep(delay);
    recentLatencies.push(delay);

    res.json({
        status: "ok",
        health: getServerHealth(),
        simulatedLoad,
        concurrentRequests,
        totalRequests,
        reqPerSecond,
        latency: delay,
        timestamp: new Date().toISOString()
    });
});

// Metrics endpoint (lightweight, no throttle)
app.get("/api/metrics", (req, res) => {
    res.json({
        simulatedLoad,
        concurrentRequests,
        totalRequests,
        totalRequests,
        reqPerSecond,
        failuresPerSecond,
        p50Latency,
        p95Latency,
        rateLimitMax,
        health: getServerHealth(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Spike simulation controls
app.post("/simulate-spike/start", (req, res) => {
    simulatedLoad = Math.min(100, simulatedLoad + 30);
    console.log(`🔥 Traffic spike started! Load: ${simulatedLoad}%`);
    res.json({
        simulatedLoad,
        message: "Traffic spike initiated",
        health: getServerHealth()
    });
});

app.post("/simulate-spike/stop", (req, res) => {
    simulatedLoad = Math.max(0, simulatedLoad - 30);
    console.log(`✅ Traffic reduced. Load: ${simulatedLoad}%`);
    res.json({
        simulatedLoad,
        message: "Traffic spike reduced",
        health: getServerHealth()
    });
});

app.post("/simulate-spike/set", (req, res) => {
    const { value } = req.body;
    if (typeof value !== "number" && typeof value !== "string") {
        return res.status(400).json({ error: "Value must be a number" });
    }
    simulatedLoad = Math.max(0, Math.min(100, Number(value)));
    console.log(`⚙️ Load manually set to: ${simulatedLoad}%`);
    res.json({
        simulatedLoad,
        message: `Load set to ${simulatedLoad}%`,
        health: getServerHealth()
    });
});

app.post("/api/settings/ratelimit", (req, res) => {
    const { limit } = req.body;
    if (!limit || isNaN(limit)) {
        return res.status(400).json({ error: "Invalid limit value" });
    }
    rateLimitMax = Number(limit);
    console.log(`🛡️ Rate Limit updated to: ${rateLimitMax} req/min`);
    res.json({
        rateLimitMax,
        message: `Rate limit updated to ${rateLimitMax} req/min`
    });
});

// Reset endpoint
app.post("/simulate-spike/reset", (req, res) => {
    simulatedLoad = 0;
    totalRequests = 0;
    console.log("🔄 Server state reset");
    res.json({
        simulatedLoad,
        totalRequests,
        message: "Server state reset to normal"
    });
});

// ============================================
// Error Handling & 503 Page
// ============================================
// ============================================
// Error Handling & 503 Page
// ============================================

// Admin Route
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.use((req, res) => {
    res.status(404).send("404 Not Found - The requested resource does not exist.");
});

// ============================================
// Server Startup
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("╔════════════════════════════════════════════╗");
    console.log("║   🚀 DDoS Simulation Server Running        ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log(`║   📍 URL: http://localhost:${PORT}             ║`);
    console.log("║   📊 Dashboard: /                          ║");
    console.log("║   📈 API Status: /api/status               ║");
    console.log("║   📉 API Metrics: /api/metrics             ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("");
    console.log("Available Commands:");
    console.log("  POST /simulate-spike/start  - Increase load +30%");
    console.log("  POST /simulate-spike/stop   - Decrease load -30%");
    console.log("  POST /simulate-spike/set    - Set load { value: 0-100 }");
    console.log("  POST /simulate-spike/reset  - Reset server state");
});
