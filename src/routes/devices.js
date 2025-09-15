const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fileStore = require('../services/file-store');
const providerFactory = require('../providers/provider-factory');
const cryptoUtil = require('../utils/crypto');
const { validate } = require('../middleware/validator');
const { NotFoundError, ConflictError } = require('../middleware/error');
const logger = require('../utils/logger');

const router = express.Router();

// 获取设备列表
router.get('/', async (req, res, next) => {
  try {
    let devices = await fileStore.readJson('devices.json', []);

    // 不返回加密的配置信息
    devices = devices.map(device => ({
      ...device,
      providerConfig: undefined
    }));

    res.json(devices);
  } catch (error) {
    next(error);
  }
});

// 添加设备
router.post('/', validate('device'), async (req, res, next) => {
  try {
    const { name, providerType, providerConfig, isDefault } = req.body;

    // 验证提供者类型
    if (!providerFactory.isSupported(providerType)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `不支持的推送类型: ${providerType}`
        }
      });
    }

    // 验证配置
    const provider = providerFactory.create(providerType);
    try {
      provider.validateConfig(providerConfig);
    } catch (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // 加密配置
    const encryptionSecret = process.env.ENCRYPTION_SECRET || 'default-secret-change-me';
    const encryptedConfig = cryptoUtil.encrypt(
      JSON.stringify(providerConfig),
      encryptionSecret
    );

    const device = {
      id: uuidv4(),
      name,
      providerType,
      providerConfig: encryptedConfig,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    await fileStore.updateJson('devices.json', (devices) => {
      // 如果设置为默认，取消其他设备的默认状态
      if (isDefault) {
        devices.forEach(d => d.isDefault = false);
        device.isDefault = true;
      }

      devices.push(device);
      return devices;
    }, []);

    logger.info('Device added', { deviceId: device.id, name: device.name });

    // 返回时不包含加密配置
    res.status(201).json({
      ...device,
      providerConfig: undefined
    });
  } catch (error) {
    next(error);
  }
});

// 更新设备信息
router.put('/:id', validate('deviceUpdate'), async (req, res, next) => {
  try {
    const deviceId = req.params.id;
    const { name, providerConfig, isDefault, isActive } = req.body;
    let updatedDevice = null;

    await fileStore.updateJson('devices.json', (devices) => {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new NotFoundError('设备不存在');
      }

      // 更新基本信息
      if (name !== undefined) device.name = name;
      if (isActive !== undefined) device.isActive = isActive;

      // 更新配置
      if (providerConfig) {
        const provider = providerFactory.create(device.providerType);
        provider.validateConfig(providerConfig);

        const encryptionSecret = process.env.ENCRYPTION_SECRET || 'default-secret-change-me';
        device.providerConfig = cryptoUtil.encrypt(
          JSON.stringify(providerConfig),
          encryptionSecret
        );
      }

      // 设置默认设备
      if (isDefault === true) {
        devices.forEach(d => d.isDefault = false);
        device.isDefault = true;
      } else if (isDefault === false) {
        device.isDefault = false;
      }

      updatedDevice = device;
      return devices;
    }, []);

    logger.info('Device updated', { deviceId, name: updatedDevice.name });

    res.json({
      ...updatedDevice,
      providerConfig: undefined
    });
  } catch (error) {
    next(error);
  }
});

// 删除设备
router.delete('/:id', async (req, res, next) => {
  try {
    const deviceId = req.params.id;

    // 检查是否有任务使用此设备
    const tasks = await fileStore.readJson('tasks.json', []);
    const hasRelatedTasks = tasks.some(t => t.deviceId === deviceId);

    if (hasRelatedTasks) {
      throw new ConflictError('无法删除设备，仍有任务在使用此设备');
    }

    await fileStore.updateJson('devices.json', (devices) => {
      const index = devices.findIndex(d => d.id === deviceId);
      if (index === -1) {
        throw new NotFoundError('设备不存在');
      }

      devices.splice(index, 1);
      return devices;
    }, []);

    logger.info('Device deleted', { deviceId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// 测试设备连接
router.post('/:id/test', async (req, res, next) => {
  try {
    const deviceId = req.params.id;

    const devices = await fileStore.readJson('devices.json', []);
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
      throw new NotFoundError('设备不存在');
    }

    // 获取推送提供者
    const provider = providerFactory.create(device.providerType);

    // 测试连接
    const result = await provider.test(device);

    // 更新最后测试时间
    await fileStore.updateJson('devices.json', (devices) => {
      const dev = devices.find(d => d.id === deviceId);
      if (dev) {
        dev.lastTestAt = new Date().toISOString();
      }
      return devices;
    }, []);

    logger.info('Device test completed', {
      deviceId,
      success: result.success
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 设为默认设备
router.patch('/:id/default', async (req, res, next) => {
  try {
    const deviceId = req.params.id;

    await fileStore.updateJson('devices.json', (devices) => {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new NotFoundError('设备不存在');
      }

      // 取消其他设备的默认状态
      devices.forEach(d => d.isDefault = false);
      device.isDefault = true;

      return devices;
    }, []);

    logger.info('Default device set', { deviceId });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;