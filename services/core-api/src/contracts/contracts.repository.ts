import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STORAGE_POLICY } from '../common/policies/storage.policy';
import { AppConfig } from '../config/app-config.type';
import { StoredContract } from './stored-contract.type';

interface CreateContractInput {
  contract: StoredContract;
  file: Express.Multer.File;
}

@Injectable()
export class ContractsRepository {
  private readonly contracts = new Map<string, StoredContract>();
  private readonly dataDir: string;
  private readonly contractsDir: string;
  private readonly uploadsDir: string;
  private readonly initialization: Promise<void>;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.dataDir = path.resolve(
      process.cwd(),
      this.configService.get('storage.dataDir', { infer: true })
    );
    this.contractsDir = path.join(this.dataDir, STORAGE_POLICY.CONTRACTS_DIRNAME);
    this.uploadsDir = path.join(this.dataDir, STORAGE_POLICY.UPLOADS_DIRNAME);
    this.initialization = this.initialize();
  }

  async create(input: CreateContractInput): Promise<StoredContract> {
    await this.ensureReady();

    const storedFileName = this.buildStoredFileName(
      input.contract.id,
      input.file.originalname,
      input.file.mimetype
    );
    const storedFilePath = path.join(this.uploadsDir, storedFileName);
    const fileBuffer = this.requireFileBuffer(input.file);

    await writeFile(storedFilePath, fileBuffer);

    const contract: StoredContract = {
      ...input.contract,
      storedFileName,
      storedFilePath
    };

    this.contracts.set(contract.id, this.clone(contract));
    await this.persistContract(contract);

    return this.clone(contract);
  }

  async save(contract: StoredContract): Promise<StoredContract> {
    await this.ensureReady();
    this.contracts.set(contract.id, this.clone(contract));
    await this.persistContract(contract);
    return this.clone(contract);
  }

  async findById(contractId: string): Promise<StoredContract | undefined> {
    await this.ensureReady();
    const contract = this.contracts.get(contractId);
    return contract ? this.clone(contract) : undefined;
  }

  async list(): Promise<StoredContract[]> {
    await this.ensureReady();
    return Array.from(this.contracts.values()).map((contract) => this.clone(contract));
  }

  async readStoredFile(contractId: string): Promise<Buffer> {
    await this.ensureReady();
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new InternalServerErrorException(
        `Cannot read uploaded file for unknown contract ${contractId}`
      );
    }

    return readFile(contract.storedFilePath);
  }

  private async initialize(): Promise<void> {
    await mkdir(this.contractsDir, { recursive: true });
    await mkdir(this.uploadsDir, { recursive: true });

    const entries = await readdir(this.contractsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(this.contractsDir, entry.name);
      const raw = await readFile(filePath, 'utf8');
      const contract = JSON.parse(raw) as StoredContract;
      this.contracts.set(contract.id, this.clone(contract));
    }
  }

  private async ensureReady(): Promise<void> {
    await this.initialization;
  }

  private async persistContract(contract: StoredContract): Promise<void> {
    const filePath = path.join(this.contractsDir, `${contract.id}.json`);
    await writeFile(filePath, JSON.stringify(contract, null, 2), 'utf8');
  }

  private buildStoredFileName(
    contractId: string,
    originalFileName: string,
    mimeType: string
  ): string {
    const sanitizedExtension = path.extname(originalFileName) || this.guessExtension(mimeType);
    return `${contractId}${sanitizedExtension}`;
  }

  private guessExtension(mimeType: string): string {
    if (mimeType === 'application/pdf') {
      return '.pdf';
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return '.docx';
    }

    if (mimeType === 'text/plain') {
      return '.txt';
    }

    return '.bin';
  }

  private requireFileBuffer(file: Express.Multer.File): Buffer {
    if (file.buffer?.length) {
      return file.buffer;
    }

    throw new InternalServerErrorException(
      'Uploaded file buffer is empty. Configure in-memory multipart handling for core-api runtime.'
    );
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
