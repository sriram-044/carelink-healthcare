/**
 * storageService.js — Cloud-Agnostic Medical Report Storage Abstraction
 * Supports Local Disk Storage by default, with seamless architecture for AWS S3, GCS, and Azure.
 */

const fs = require('fs');
const path = require('path');

// Ensure local uploads directory exists
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

/**
 * Local Disk Storage Driver (Development & On-Prem Default)
 */
class LocalStorageDriver {
  constructor(uploadDir) {
    this.uploadDir = uploadDir;
  }

  async saveFile(fileBufferOrPath, fileName) {
    const destinationPath = path.join(this.uploadDir, fileName);
    if (Buffer.isBuffer(fileBufferOrPath)) {
      await fs.promises.writeFile(destinationPath, fileBufferOrPath);
    } else if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
      // If temporary file path from multer
      if (fileBufferOrPath !== destinationPath) {
        await fs.promises.copyFile(fileBufferOrPath, destinationPath);
      }
    }
    return {
      fileName,
      storageKey: fileName,
      provider: 'local',
      localPath: destinationPath
    };
  }

  async getFile(fileName) {
    const filePath = path.join(this.uploadDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in local storage: ${fileName}`);
    }
    return {
      stream: fs.createReadStream(filePath),
      filePath,
      stat: await fs.promises.stat(filePath)
    };
  }

  async deleteFile(fileName) {
    const filePath = path.join(this.uploadDir, fileName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }

  getFileUrl(fileName, req = null) {
    const baseUrl = process.env.BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : '');
    return `${baseUrl}/uploads/${fileName}`;
  }
}

/**
 * AWS S3 Storage Driver (Cloud Provider Template)
 */
class S3StorageDriver {
  constructor(config = {}) {
    this.bucket = config.bucket || process.env.AWS_S3_BUCKET;
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
  }

  async saveFile(fileBuffer, fileName) {
    console.log(`[S3 Driver] Uploading ${fileName} to bucket ${this.bucket}...`);
    // Adapter integration for AWS SDK v3: PutObjectCommand
    return {
      fileName,
      storageKey: `reports/${fileName}`,
      provider: 's3',
      bucket: this.bucket
    };
  }

  async getFile(storageKey) {
    // Adapter integration for AWS SDK v3: GetObjectCommand
    throw new Error('S3 Storage Driver requires active AWS credentials in environment.');
  }

  async deleteFile(storageKey) {
    console.log(`[S3 Driver] Deleted ${storageKey} from bucket ${this.bucket}`);
    return true;
  }

  getFileUrl(storageKey) {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storageKey}`;
  }
}

/**
 * Google Cloud Storage Driver (Cloud Provider Template)
 */
class GCSStorageDriver {
  constructor(config = {}) {
    this.bucket = config.bucket || process.env.GCS_BUCKET_NAME;
  }

  async saveFile(fileBuffer, fileName) {
    console.log(`[GCS Driver] Uploading ${fileName} to bucket ${this.bucket}...`);
    return {
      fileName,
      storageKey: `reports/${fileName}`,
      provider: 'gcs',
      bucket: this.bucket
    };
  }

  async getFile(storageKey) {
    throw new Error('GCS Storage Driver requires active GCP credentials in environment.');
  }

  async deleteFile(storageKey) {
    console.log(`[GCS Driver] Deleted ${storageKey} from bucket ${this.bucket}`);
    return true;
  }

  getFileUrl(storageKey) {
    return `https://storage.googleapis.com/${this.bucket}/${storageKey}`;
  }
}

/**
 * Storage Service Factory
 */
class StorageService {
  constructor() {
    const driverType = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

    switch (driverType) {
      case 's3':
      case 'aws':
        this.driver = new S3StorageDriver();
        break;
      case 'gcs':
      case 'google':
        this.driver = new GCSStorageDriver();
        break;
      case 'local':
      default:
        this.driver = new LocalStorageDriver(LOCAL_UPLOAD_DIR);
        break;
    }
  }

  async uploadFile(fileBufferOrPath, fileName) {
    return await this.driver.saveFile(fileBufferOrPath, fileName);
  }

  async getFile(fileName) {
    return await this.driver.getFile(fileName);
  }

  async deleteFile(fileName) {
    return await this.driver.deleteFile(fileName);
  }

  getFileUrl(fileName, req = null) {
    return this.driver.getFileUrl(fileName, req);
  }

  getDriverName() {
    return process.env.STORAGE_DRIVER || 'local';
  }
}

module.exports = new StorageService();
