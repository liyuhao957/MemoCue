// 分类管理模块
const DEFAULT_CATEGORY_ICON = '📁';
const DEFAULT_CATEGORY_COLOR = '#4F46E5';
const CATEGORY_EMOJI_PRESETS = [
  '📁', '🗂️', '📝', '📅', '💼', '🎯', '🛠️', '📚', '💡', '❤️', '🌟', '🏠', '🧘', '🛒', '🚀'
];

window.CategoryManager = {
  emojiPresets: CATEGORY_EMOJI_PRESETS,

  // 编辑分类
  editCategory(category, app) {
    app.editingCategory = category;
    app.categoryForm = {
      name: category.name,
      icon: category.icon || DEFAULT_CATEGORY_ICON,
      color: category.color || DEFAULT_CATEGORY_COLOR
    };
    app.openModal('category');
  },

  // 保存分类
  async saveCategory(app) {
    try {
      if (app.editingCategory) {
        // 更新分类
        await app.api(`/api/categories/${app.editingCategory.id}`, {
          method: 'PUT',
          body: app.categoryForm
        });
        app.showMessage('success', '成功', '分类已更新');
      } else {
        // 创建分类
        await app.api('/api/categories', {
          method: 'POST',
          body: app.categoryForm
        });
        app.showMessage('success', '成功', '分类已创建');
      }

      await app.loadCategories();
      app.closeModal();
      app.resetCategoryForm();
    } catch (error) {
      app.showMessage('error', '失败', error.message);
    }
  },

  // 获取分类任务数
  getCategoryTaskCount(categoryId, tasks) {
    return tasks.filter(t => t.categoryId === categoryId).length;
  },

  // 重置分类表单
  resetCategoryForm(app) {
    app.editingCategory = null;
    app.categoryForm = {
      name: '',
      icon: DEFAULT_CATEGORY_ICON,
      color: DEFAULT_CATEGORY_COLOR
    };
  }
};
