/**
 * 数据库优化配置
 * 立即实施的性能优化
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'tj_data_property.db');

// 优化的数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('✅ 数据库连接成功');
        // 启用优化配置
        optimizeDatabase();
    }
});

// 数据库优化配置
function optimizeDatabase() {
    // 1. 启用 WAL 模式 - 大幅提升并发写入性能
    db.run('PRAGMA journal_mode = WAL', (err) => {
        if (err) console.error('WAL模式设置失败:', err);
        else console.log('✅ WAL模式已启用');
    });
    
    // 2. 调整同步模式 - 平衡性能和数据安全
    db.run('PRAGMA synchronous = NORMAL', (err) => {
        if (err) console.error('同步模式设置失败:', err);
        else console.log('✅ 同步模式已优化');
    });
    
    // 3. 增大缓存 - 减少磁盘IO
    db.run('PRAGMA cache_size = -64000', (err) => {
        if (err) console.error('缓存设置失败:', err);
        else console.log('✅ 缓存已优化 (64MB)');
    });
    
    // 4. 启用外键约束
    db.run('PRAGMA foreign_keys = ON');
    
    // 5. 创建优化索引
    createOptimizedIndexes();
}

// 创建优化索引
function createOptimizedIndexes() {
    const indexes = [
        // 登记查询优化
        'CREATE INDEX IF NOT EXISTS idx_registrations_holder_status ON registrations(holder_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_registrations_created_status ON registrations(created_at, status)',
        'CREATE INDEX IF NOT EXISTS idx_registrations_category ON registrations(category)',
        
        // 维权案件查询优化
        'CREATE INDEX IF NOT EXISTS idx_protection_cases_applicant ON protection_cases(applicant_id)',
        'CREATE INDEX IF NOT EXISTS idx_protection_cases_status ON protection_cases(status)',
        
        // 操作日志查询优化
        'CREATE INDEX IF NOT EXISTS idx_operation_logs_user_action ON operation_logs(user_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at)',
        
        // 用户查询优化
        'CREATE INDEX IF NOT EXISTS idx_users_phone_status ON users(phone, status)',
        
        // 认证申请查询优化
        'CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_applications(user_id, status)'
    ];
    
    indexes.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) console.error(`索引 ${index + 1} 创建失败:`, err.message);
        });
    });
    
    console.log('✅ 优化索引创建完成');
}

// 带超时的查询封装
const dbAsync = {
    run: (sql, params = [], timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`查询超时 (${timeout}ms): ${sql.substring(0, 50)}...`));
            }, timeout);
            
            db.run(sql, params, function(err) {
                clearTimeout(timer);
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },
    
    get: (sql, params = [], timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`查询超时 (${timeout}ms): ${sql.substring(0, 50)}...`));
            }, timeout);
            
            db.get(sql, params, (err, row) => {
                clearTimeout(timer);
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    
    all: (sql, params = [], timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`查询超时 (${timeout}ms): ${sql.substring(0, 50)}...`));
            }, timeout);
            
            db.all(sql, params, (err, rows) => {
                clearTimeout(timer);
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

// 批量插入工具
async function batchInsert(table, columns, valuesArray, batchSize = 100) {
    const results = [];
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
    
    for (let i = 0; i < valuesArray.length; i += batchSize) {
        const batch = valuesArray.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(values => dbAsync.run(sql, values).catch(e => ({ error: e.message })))
        );
        results.push(...batchResults);
    }
    
    return results;
}

// 查询缓存（简单内存缓存）
const queryCache = new Map();
const CACHE_TTL = 60 * 1000; // 1分钟

async function cachedQuery(key, queryFn, ttl = CACHE_TTL) {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.time < ttl) {
        return cached.data;
    }
    
    const data = await queryFn();
    queryCache.set(key, { data, time: Date.now() });
    return data;
}

// 清除缓存
function clearCache(key) {
    if (key) {
        queryCache.delete(key);
    } else {
        queryCache.clear();
    }
}

// 定期清理过期缓存
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of queryCache.entries()) {
        if (now - value.time > CACHE_TTL) {
            queryCache.delete(key);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = { db, dbAsync, batchInsert, cachedQuery, clearCache };
