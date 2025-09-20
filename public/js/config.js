// 应用配置文件
// 优先使用服务端注入的配置，否则自动检测
(function() {
  let basePath = '';
  let apiBasePath = '';

  // 调试标记
  const DEBUG = true;
  const log = DEBUG ? console.log.bind(console, '[Config]') : () => {};

  // 提前安装 Alpine 的延迟启动钩子，保证组件插入完成后再启动（避免遗漏编译）
  if (!window.deferLoadingAlpine) {
    log('Installing deferLoadingAlpine hook');
    window.deferLoadingAlpine = function(alpineInit) {
      log('Alpine.js defer callback called');
      // 包装启动函数，记录已启动标记
      window.__startAlpine = function() {
        log('Starting Alpine.js...');
        try {
          alpineInit();
          log('Alpine.js started successfully');
        } catch(e) {
          console.error('[Config] Failed to start Alpine:', e);
        } finally {
          window.__alpineStarted = true;
        }
      };
      // 若组件已加载完成，立即启动
      if (window.__alpineComponentsReady) {
        log('Components already ready, starting Alpine immediately');
        window.__startAlpine();
      } else {
        log('Waiting for components to load before starting Alpine');
      }
    };
  }

  // 优先使用服务端注入的配置
  if (window.SERVER_CONFIG) {
    basePath = window.SERVER_CONFIG.BASE_PATH || '';
    apiBasePath = window.SERVER_CONFIG.API_BASE_PATH || '';
    log('Using server-injected config:', window.SERVER_CONFIG);
  } else {
    // 更稳健的自动检测：基于当前脚本路径推断 basePath（/js/config.js 的父路径）
    try {
      const current = document.currentScript;
      if (current && current.src) {
        const url = new URL(current.src, window.location.href);
        const parent = url.pathname.replace(/\/js\/config\.js$/i, '');
        const normalized = parent.replace(/\/$/, '');
        if (normalized && normalized !== '') {
          basePath = normalized;
          apiBasePath = normalized;
          log('Auto-detected from script src:', normalized);
        }
      }
    } catch (e) {
      log('Script src detection failed:', e);
    }

    // 兜底：基于 URL 路径，去掉末尾文件名与斜杠
    if (!basePath) {
      const pathname = window.location.pathname;
      let cleanPath = pathname.replace(/\/[^\/]*\.(html|htm|php)$/i, '').replace(/\/$/, '');
      if (cleanPath && cleanPath !== '/') {
        basePath = cleanPath;
        apiBasePath = cleanPath;
      }
      log('Auto-detected path (fallback):', cleanPath);
    }
  }

  log('Final basePath:', basePath);
  log('Final apiBasePath:', apiBasePath);

  // 导出配置
  window.APP_CONFIG = {
    BASE_PATH: basePath,
    API_BASE_PATH: apiBasePath,

    // API端点辅助函数
    api: function(endpoint) {
      // 确保endpoint以/开头
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }
      return apiBasePath + endpoint;
    },

    // 静态资源路径辅助函数
    asset: function(path) {
      // 确保path不以/开头（相对路径）
      if (path.startsWith('/')) {
        path = path.substring(1);
      }
      return basePath ? basePath + '/' + path : path;
    },

    // 组件路径辅助函数
    component: function(componentName) {
      return basePath ? basePath + '/' + componentName : componentName;
    }
  };

  console.log('App config initialized:', window.APP_CONFIG);
})();
