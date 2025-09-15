const crypto = require('crypto');

class CryptoUtil {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.saltLength = 32;
    this.tagLength = 16;
    this.ivLength = 16;
    this.iterations = 100000;
    this.keyLength = 32;
  }

  // 从密码派生密钥
  deriveKey(password, salt) {
    return crypto.scryptSync(password, salt, this.keyLength);
  }

  // 加密数据
  encrypt(text, password) {
    if (!text || !password) {
      throw new Error('Text and password are required for encryption');
    }

    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // 组合: salt + iv + authTag + encrypted
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]);

    return combined.toString('base64');
  }

  // 解密数据
  decrypt(encryptedData, password) {
    if (!encryptedData || !password) {
      throw new Error('Encrypted data and password are required for decryption');
    }

    const combined = Buffer.from(encryptedData, 'base64');

    // 提取各部分
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const authTag = combined.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength
    );
    const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);

    const key = this.deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // 生成随机令牌
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // 计算哈希
  hash(text, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(text).digest('hex');
  }

  // 验证令牌
  verifyToken(token, hashedToken) {
    const tokenHash = this.hash(token);
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(hashedToken)
    );
  }
}

// 导出单例
module.exports = new CryptoUtil();