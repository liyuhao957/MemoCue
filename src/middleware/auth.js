// 空认证中间件 - 直接通过所有请求
const authMiddleware = (req, res, next) => {
  next();
};

module.exports = authMiddleware;