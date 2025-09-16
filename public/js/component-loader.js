/**
 * 组件加载器
 * 动态加载HTML组件文件并插入到页面中
 * 支持组件模块化和复用
 */

class ComponentLoader {
  constructor() {
    this.cache = new Map();
    this.loadPromises = new Map();
  }

  /**
   * 加载单个组件
   * @param {string} componentPath - 组件文件路径
   * @returns {Promise<string>} 组件HTML内容
   */
  async loadComponent(componentPath) {
    // 检查缓存
    if (this.cache.has(componentPath)) {
      return this.cache.get(componentPath);
    }

    // 检查是否正在加载中
    if (this.loadPromises.has(componentPath)) {
      return this.loadPromises.get(componentPath);
    }

    // 创建加载Promise
    const loadPromise = fetch(componentPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load component: ${componentPath}`);
        }
        return response.text();
      })
      .then(html => {
        this.cache.set(componentPath, html);
        this.loadPromises.delete(componentPath);
        return html;
      })
      .catch(error => {
        this.loadPromises.delete(componentPath);
        console.error('Component load error:', error);
        throw error;
      });

    this.loadPromises.set(componentPath, loadPromise);
    return loadPromise;
  }

  /**
   * 加载多个组件
   * @param {Array<string>} componentPaths - 组件文件路径数组
   * @returns {Promise<Array<string>>} 组件HTML内容数组
   */
  async loadComponents(componentPaths) {
    const loadPromises = componentPaths.map(path => this.loadComponent(path));
    return Promise.all(loadPromises);
  }

  /**
   * 将组件插入到指定元素中
   * @param {string} selector - 目标元素选择器
   * @param {string} componentPath - 组件文件路径
   */
  async insertComponent(selector, componentPath) {
    try {
      const html = await this.loadComponent(componentPath);
      const targetElement = document.querySelector(selector);
      
      if (!targetElement) {
        console.warn(`Target element not found: ${selector}`);
        return;
      }

      targetElement.innerHTML = html;
    } catch (error) {
      console.error(`Failed to insert component ${componentPath} into ${selector}:`, error);
    }
  }

  /**
   * 批量插入组件
   * @param {Array<{selector: string, component: string}>} components - 组件配置数组
   */
  async insertComponents(components) {
    const insertPromises = components.map(({ selector, component }) => 
      this.insertComponent(selector, component)
    );
    
    return Promise.all(insertPromises);
  }

  /**
   * 清除组件缓存
   * @param {string} [componentPath] - 可选，指定要清除的组件路径
   */
  clearCache(componentPath = null) {
    if (componentPath) {
      this.cache.delete(componentPath);
    } else {
      this.cache.clear();
    }
  }
}

// 创建全局组件加载器实例
window.componentLoader = new ComponentLoader();
