// 天津数据产权登记服务平台 - 主要JavaScript功能文件

// 全局变量
let backgroundSketch;
let dataTypeChart;
let trendChart;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeCharts();
    initializeCarousel();
    initializeP5Background();
    initializeScrollEffects();
    initializeStatsAnimation();
});

// 初始化动画效果
function initializeAnimations() {
    // 导航栏滚动效果
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const navbar = document.querySelector('nav');
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        lastScrollTop = scrollTop;
    });

    // 页面元素进入动画
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // 为需要动画的元素添加观察
    document.querySelectorAll('.feature-card, .glass-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
}

// 初始化图表
function initializeCharts() {
    // 数据类型分布图表
    const dataTypeChartDom = document.getElementById('dataTypeChart');
    if (dataTypeChartDom) {
        dataTypeChart = echarts.init(dataTypeChartDom);
        
        const dataTypeOption = {
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderColor: '#3b82f6',
                textStyle: { color: '#fff' }
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                textStyle: { color: '#fff' }
            },
            series: [
                {
                    name: '数据类型',
                    type: 'pie',
                    radius: '50%',
                    data: [
                        { value: 4350, name: '金融数据', itemStyle: { color: '#3b82f6' } },
                        { value: 3100, name: '医疗数据', itemStyle: { color: '#10b981' } },
                        { value: 2800, name: '交通数据', itemStyle: { color: '#f59e0b' } },
                        { value: 2600, name: '教育数据', itemStyle: { color: '#8b5cf6' } },
                        { value: 2400, name: '工业数据', itemStyle: { color: '#ef4444' } },
                        { value: 610, name: '其他数据', itemStyle: { color: '#6b7280' } }
                    ],
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        };
        
        dataTypeChart.setOption(dataTypeOption);
    }

    // 月度登记趋势图表
    const trendChartDom = document.getElementById('trendChart');
    if (trendChartDom) {
        trendChart = echarts.init(trendChartDom);
        
        const trendOption = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderColor: '#3b82f6',
                textStyle: { color: '#fff' }
            },
            legend: {
                data: ['登记数量', '审核通过'],
                textStyle: { color: '#fff' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                axisLine: { lineStyle: { color: '#6b7280' } },
                axisLabel: { color: '#fff' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#6b7280' } },
                axisLabel: { color: '#fff' },
                splitLine: { lineStyle: { color: '#374151' } }
            },
            series: [
                {
                    name: '登记数量',
                    type: 'line',
                    stack: 'Total',
                    data: [1200, 1350, 1180, 1420, 1680, 1890, 2100, 2340, 2560, 2780, 2950, 3200],
                    itemStyle: { color: '#3b82f6' },
                    areaStyle: { color: 'rgba(59, 130, 246, 0.3)' }
                },
                {
                    name: '审核通过',
                    type: 'line',
                    stack: 'Total',
                    data: [1150, 1280, 1120, 1360, 1620, 1820, 2020, 2250, 2480, 2690, 2860, 3100],
                    itemStyle: { color: '#10b981' },
                    areaStyle: { color: 'rgba(16, 185, 129, 0.3)' }
                }
            ]
        };
        
        trendChart.setOption(trendOption);
    }

    // 响应式处理
    window.addEventListener('resize', function() {
        if (dataTypeChart) dataTypeChart.resize();
        if (trendChart) trendChart.resize();
    });
}

// 初始化轮播
function initializeCarousel() {
    const carousel = document.getElementById('news-carousel');
    if (carousel) {
        new Splide('#news-carousel', {
            type: 'loop',
            perPage: 3,
            perMove: 1,
            gap: '2rem',
            autoplay: true,
            interval: 5000,
            breakpoints: {
                1024: { perPage: 2 },
                768: { perPage: 1 }
            }
        }).mount();
    }
}

// 初始化P5.js背景
function initializeP5Background() {
    const backgroundContainer = document.getElementById('p5-background');
    
    backgroundSketch = function(p) {
        let particles = [];
        let numParticles = 50;
        
        p.setup = function() {
            let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
            canvas.parent('p5-background');
            
            // 创建粒子
            for (let i = 0; i < numParticles; i++) {
                particles.push({
                    x: p.random(p.width),
                    y: p.random(p.height),
                    vx: p.random(-0.5, 0.5),
                    vy: p.random(-0.5, 0.5),
                    size: p.random(2, 6),
                    opacity: p.random(0.1, 0.3)
                });
            }
        };
        
        p.draw = function() {
            p.clear();
            
            // 绘制连接线
            p.stroke(59, 130, 246, 30);
            p.strokeWeight(1);
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    let dist = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                    if (dist < 100) {
                        p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                    }
                }
            }
            
            // 绘制和更新粒子
            p.noStroke();
            for (let particle of particles) {
                p.fill(59, 130, 246, particle.opacity * 255);
                p.ellipse(particle.x, particle.y, particle.size);
                
                // 更新位置
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                // 边界检测
                if (particle.x < 0 || particle.x > p.width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > p.height) particle.vy *= -1;
            }
        };
        
        p.windowResized = function() {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
    };
    
    new p5(backgroundSketch);
}

// 初始化滚动效果
function initializeScrollEffects() {
    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// 初始化数字统计动画
function initializeStatsAnimation() {
    const statsNumbers = document.querySelectorAll('.stats-number');
    
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = parseInt(target.getAttribute('data-count'));
                animateCounter(target, 0, finalValue, 2000);
                statsObserver.unobserve(target);
            }
        });
    });
    
    statsNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });
}

// 数字计数动画
function animateCounter(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

// 登录模态框控制
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // 添加动画效果
        anime({
            targets: modal.querySelector('.glass-card'),
            scale: [0.8, 1],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuart'
        });
    }
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        anime({
            targets: modal.querySelector('.glass-card'),
            scale: [1, 0.8],
            opacity: [1, 0],
            duration: 200,
            easing: 'easeInQuart',
            complete: () => {
                modal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
    }
}

// 数字证书登录
function showDigitalCertLogin() {
    alert('数字证书登录功能即将推出，敬请期待！');
}

// 技术详情模态框
function showTechModal() {
    const modalContent = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="glass-card p-8 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold">技术架构详情</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-6">
                    <div>
                        <h4 class="text-xl font-bold mb-3 text-blue-400">区块链技术</h4>
                        <p class="text-gray-300 mb-4">采用Hyperledger Fabric构建联盟链网络，确保数据产权信息在流转过程中的不可篡改与可追溯性。每个登记记录都通过智能合约自动上链存储，实现去中心化的信任机制。</p>
                    </div>
                    
                    <div>
                        <h4 class="text-xl font-bold mb-3 text-green-400">人工智能审核</h4>
                        <p class="text-gray-300 mb-4">运用自然语言处理和机器学习技术，对提交的登记材料进行智能校验，自动识别材料完整性、真实性以及数据描述的准确性，大幅提升审核效率。</p>
                    </div>
                    
                    <div>
                        <h4 class="text-xl font-bold mb-3 text-purple-400">大数据分析</h4>
                        <p class="text-gray-300 mb-4">通过大数据技术对平台运行数据进行实时分析，提供数据资产价值评估、市场趋势预测等增值服务，为数据要素市场化配置提供决策支持。</p>
                    </div>
                    
                    <div>
                        <h4 class="text-xl font-bold mb-3 text-orange-400">安全防护体系</h4>
                        <p class="text-gray-300">采用多层安全防护机制，包括SSL/TLS加密传输、AES/RSA数据加密存储、防火墙、入侵检测系统等，确保平台数据和用户信息安全。</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

// 工具函数：生成随机ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 工具函数：格式化日期
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// 工具函数：本地存储操作
const Storage = {
    set: function(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    
    get: function(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },
    
    remove: function(key) {
        localStorage.removeItem(key);
    }
};

// 模拟用户数据
const mockUsers = [
    {
        id: 'user001',
        username: '张三',
        phone: '138****8888',
        email: 'zhang@example.com',
        role: 'data_holder',
        verified: true,
        registerTime: '2024-01-15'
    },
    {
        id: 'user002',
        username: '李四',
        phone: '139****9999',
        email: 'li@example.com',
        role: 'data_user',
        verified: true,
        registerTime: '2024-02-20'
    },
    {
        id: 'user003',
        username: '王五',
        phone: '137****7777',
        email: 'wang@example.com',
        role: 'regulator',
        verified: true,
        registerTime: '2024-03-10'
    }
];

// 模拟数据产权登记数据
const mockRegistrations = [
    {
        id: 'reg001',
        title: '天津市交通流量数据集',
        type: '交通数据',
        holder: '天津市交通运输局',
        registerTime: '2024-11-15',
        status: 'approved',
        description: '包含天津市主要道路实时交通流量数据'
    },
    {
        id: 'reg002',
        title: '医疗健康大数据平台',
        type: '医疗数据',
        holder: '天津市卫健委',
        registerTime: '2024-11-10',
        status: 'pending',
        description: '整合全市医疗机构的健康档案数据'
    },
    {
        id: 'reg003',
        title: '金融风控数据服务',
        type: '金融数据',
        holder: '天津银行',
        registerTime: '2024-11-08',
        status: 'approved',
        description: '企业信用评级和风险控制相关数据'
    }
];

// 初始化时存储模拟数据
if (!Storage.get('users')) {
    Storage.set('users', mockUsers);
}
if (!Storage.get('registrations')) {
    Storage.set('registrations', mockRegistrations);
}

// 导出全局对象
window.PlatformApp = {
    Storage,
    mockUsers,
    mockRegistrations,
    generateId,
    formatDate,
    showLoginModal,
    hideLoginModal,
    showTechModal
};

// 导出图表实例供其他脚本使用
window.dataTypeChart = dataTypeChart;
window.trendChart = trendChart;