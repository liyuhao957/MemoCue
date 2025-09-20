/**
 * 简化版组件加载器
 * 使用最基础的方法加载组件，避免复杂的 Promise 处理
 */

class SimpleComponentLoader {
  constructor() {
    this.loaded = 0;
    this.failed = 0;
    this.total = 0;
  }

  /**
   * 加载单个组件 - 使用 XMLHttpRequest 而不是 fetch
   */
  loadComponent(componentPath, callback) {
    const fullPath = window.APP_CONFIG ? window.APP_CONFIG.component(componentPath) : componentPath;
    console.log('[SimpleLoader] Loading:', componentPath);

    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          console.log('[SimpleLoader] Success:', componentPath, 'Size:', xhr.responseText.length);
          callback(null, xhr.responseText);
        } else {
          console.error('[SimpleLoader] Failed:', componentPath, 'Status:', xhr.status);
          callback(new Error(`Failed to load ${componentPath}: ${xhr.status}`), null);
        }
      }
    };

    xhr.open('GET', fullPath, true);
    xhr.timeout = 5000; // 5秒超时

    xhr.ontimeout = function() {
      console.error('[SimpleLoader] Timeout:', componentPath);
      callback(new Error(`Timeout loading ${componentPath}`), null);
    };

    try {
      xhr.send();
    } catch (e) {
      console.error('[SimpleLoader] Error sending request:', componentPath, e);
      callback(e, null);
    }
  }

  /**
   * 插入组件到页面
   */
  insertComponent(selector, componentPath, onComplete) {
    this.total++;

    this.loadComponent(componentPath, (error, html) => {
      if (error) {
        this.failed++;
        console.error('[SimpleLoader] Load failed:', componentPath, error);
        if (onComplete) onComplete(error);
        return;
      }

      try {
        const targetElement = document.querySelector(selector);
        if (!targetElement) {
          throw new Error(`Target element not found: ${selector}`);
        }

        targetElement.innerHTML = html;
        this.loaded++;
        console.log('[SimpleLoader] Inserted:', componentPath, 'into', selector);

        if (onComplete) onComplete(null);
      } catch (e) {
        this.failed++;
        console.error('[SimpleLoader] Insert failed:', componentPath, e);
        if (onComplete) onComplete(e);
      }
    });
  }

  /**
   * 批量插入组件 - 串行加载，避免并发问题
   */
  insertComponentsSequentially(components, onAllComplete) {
    console.log('[SimpleLoader] Starting sequential load of', components.length, 'components');

    let index = 0;
    const loadNext = () => {
      if (index >= components.length) {
        console.log(`[SimpleLoader] All done: ${this.loaded} loaded, ${this.failed} failed`);
        if (onAllComplete) onAllComplete();
        return;
      }

      const { selector, component } = components[index];
      index++;

      this.insertComponent(selector, component, () => {
        // 继续下一个，不管成功还是失败
        setTimeout(loadNext, 100); // 给浏览器一点喘息时间
      });
    };

    loadNext();
  }
}

// 创建全局实例
window.simpleComponentLoader = new SimpleComponentLoader();