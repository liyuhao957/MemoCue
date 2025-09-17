# MemoCue 样式架构

## 目录结构

```
styles/
├── index.css              # 主入口文件
├── base/                  # 基础样式
│   └── index.css         # 全局重置和基础设置
├── components/           # 可复用UI组件
│   ├── buttons.css       # 按钮样式
│   ├── cards.css        # 卡片组件
│   ├── forms.css        # 表单元素
│   ├── badges.css       # 徽章标签
│   └── modals.css       # 模态框
├── modules/             # 业务功能模块
│   ├── dashboard.css    # 仪表板
│   ├── task.css        # 任务管理
│   ├── category.css    # 分类管理
│   ├── device.css      # 设备管理
│   └── execution.css   # 执行日志
├── layout/             # 布局组件
│   ├── navbar.css      # 导航栏
│   └── sidebar.css     # 侧边栏
└── utilities/          # 工具类
    ├── animations.css  # 动画效果
    ├── scrollbar.css  # 滚动条
    └── helpers.css    # 辅助类
```

## 文件统计

| 类别 | 文件数 | 总行数 | 平均行数 |
|------|--------|--------|----------|
| 基础样式 | 1 | 17 | 17 |
| 组件样式 | 5 | 407 | 81 |
| 功能模块 | 5 | 943 | 189 |
| 布局样式 | 2 | 43 | 22 |
| 工具类 | 3 | 93 | 31 |
| **总计** | **16** | **1503** | **94** |

## 构建命令

```bash
# 开发构建
npm run build:css

# 源文件：public/styles/index.css
# 输出文件：public/styles.min.css
```

## 设计原则

### 1. 模块化
- 每个文件专注于单一功能
- 相关样式集中管理
- 便于团队协作

### 2. 可维护性
- 清晰的文件命名
- 合理的目录结构
- 易于定位和修改

### 3. 性能优化
- Tailwind 自动清除未使用样式
- 生产构建压缩至 11KB
- 支持按需加载扩展

### 4. 遵循规范
- 使用 Tailwind @layer 指令
- 保持 CSS 特殊性一致
- 遵循 BEM 命名约定

## 维护指南

1. **添加新组件**：在 `components/` 目录创建新文件
2. **添加新模块**：在 `modules/` 目录创建新文件
3. **更新导入**：在 `index.css` 添加 @import 语句
4. **构建测试**：运行 `npm run build:css` 验证

## 注意事项

- 所有样式文件都需要包含正确的 `@layer` 声明
- 保持文件大小在 300 行以内
- 优先使用 Tailwind 实用类
- 避免过度嵌套和复杂选择器