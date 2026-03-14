/**
 * 性能监控中间件
 * 监控 API 响应时间和错误率
 */

// 性能指标收集
const metrics = {
    requests: 0,
    errors: 0,
    totalResponseTime: 0,
    slowRequests: 0,
    statusCodes: {},
    endpoints: {}
};

// 慢查询阈值 (ms)
const SLOW_QUERY_THRESHOLD = 500;

// 性能监控中间件
function performanceMonitor(req, res, next) {
    const startTime = Date.now();
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    // 响应完成时记录指标
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // 更新全局指标
        metrics.requests++;
        metrics.totalResponseTime += duration;
        
        // 状态码统计
        metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
        
        // 错误统计
        if (statusCode >= 400) {
            metrics.errors++;
        }
        
        // 慢查询统计
        if (duration > SLOW_QUERY_THRESHOLD) {
            metrics.slowRequests++;
            console.warn(`⚠️ 慢请求: ${endpoint} 耗时 ${duration}ms`);
        }
        
        // 端点级别统计
        if (!metrics.endpoints[endpoint]) {
            metrics.endpoints[endpoint] = {
                count: 0,
                totalTime: 0,
                errors: 0,
                maxTime: 0
            };
        }
        const ep = metrics.endpoints[endpoint];
        ep.count++;
        ep.totalTime += duration;
        ep.errors += statusCode >= 400 ? 1 : 0;
        ep.maxTime = Math.max(ep.maxTime, duration);
        
        // 记录详细日志（仅在开发环境）
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${new Date().toISOString()}] ${endpoint} ${statusCode} ${duration}ms`);
        }
    });
    
    next();
}

// 获取性能报告
function getPerformanceReport() {
    const avgResponseTime = metrics.requests > 0 
        ? (metrics.totalResponseTime / metrics.requests).toFixed(2) 
        : 0;
    
    const errorRate = metrics.requests > 0 
        ? ((metrics.errors / metrics.requests) * 100).toFixed(2) 
        : 0;
    
    // 获取最慢的端点
    const sortedEndpoints = Object.entries(metrics.endpoints)
        .sort((a, b) => b[1].maxTime - a[1].maxTime)
        .slice(0, 10)
        .map(([name, data]) => ({
            endpoint: name,
            count: data.count,
            avgTime: (data.totalTime / data.count).toFixed(2),
            maxTime: data.maxTime,
            errorRate: ((data.errors / data.count) * 100).toFixed(2)
        }));
    
    return {
        summary: {
            totalRequests: metrics.requests,
            errorRate: `${errorRate}%`,
            avgResponseTime: `${avgResponseTime}ms`,
            slowRequests: metrics.slowRequests
        },
        statusCodes: metrics.statusCodes,
        topSlowEndpoints: sortedEndpoints
    };
}

// 重置指标
function resetMetrics() {
    metrics.requests = 0;
    metrics.errors = 0;
    metrics.totalResponseTime = 0;
    metrics.slowRequests = 0;
    metrics.statusCodes = {};
    metrics.endpoints = {};
}

// 定期输出性能报告（每5分钟）
setInterval(() => {
    const report = getPerformanceReport();
    console.log('\n📊 性能报告 (过去5分钟)');
    console.log('='.repeat(50));
    console.log(`总请求数: ${report.summary.totalRequests}`);
    console.log(`错误率: ${report.summary.errorRate}`);
    console.log(`平均响应: ${report.summary.avgResponseTime}`);
    console.log(`慢请求数: ${report.summary.slowRequests}`);
    
    if (report.topSlowEndpoints.length > 0) {
        console.log('\n最慢端点:');
        report.topSlowEndpoints.forEach(ep => {
            console.log(`  ${ep.endpoint}: ${ep.avgTime}ms (max: ${ep.maxTime}ms)`);
        });
    }
    
    // 重置指标
    resetMetrics();
}, 5 * 60 * 1000);

module.exports = { performanceMonitor, getPerformanceReport, resetMetrics };
