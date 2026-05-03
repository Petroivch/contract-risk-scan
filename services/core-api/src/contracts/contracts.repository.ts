import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path from 'node:path';
import { StoredContract } from './stored-contract.type';

interface CreateContractInput {
  contract: StoredContract;
  file: Express.Multer.File;
}

@Injectable()
export class ContractsRepository {
  private readonly contracts = new Map<string, StoredContract>();
  private readonly fileBuffers = new Map<string, Buffer>();

  async create(input: CreateContractInput): Promise<StoredContract> {
    const storedFileName = this.buildStoredFileName(
      input.contract.id,
      input.file.originalname,
      input.file.mimetype
    );
    const fileBuffer = this.requireFileBuffer(input.file);

    const contract: StoredContract = {
      ...input.contract,
      storedFileName,
      storedFilePath: ''
    };

    this.contracts.set(contract.id, this.clone(contract));
    this.fileBuffers.set(contract.id, Buffer.from(fileBuffer));

    return this.clone(contract);
  }

  async save(contract: StoredContract): Promise<StoredContract> {
    this.contracts.set(contract.id, this.clone(contract));
    return this.clone(contract);
  }

  async findById(contractId: string): Promise<StoredContract | undefined> {
    const contract = this.contracts.get(contractId);
    return contract ? this.clone(contract) : undefined;
  }

  async list(): Promise<StoredContract[]> {
    return Array.from(this.contracts.values()).map((contract) => this.clone(contract));
  }

  async readStoredFile(contractId: string): Promise<Buffer> {
    const fileBuffer = this.fileBuffers.get(contractId);
    if (!fileBuffer) {
      throw new InternalServerErrorException(
        `Cannot read uploaded file for unknown contract ${contractId}`
      );
    }

    return Buffer.from(fileBuffer);
  }

  async clearStoredFile(contractId: string): Promise<void> {
    this.fileBuffers.delete(contractId);
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
