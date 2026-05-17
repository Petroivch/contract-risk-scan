import { Injectable } from '@nestjs/common';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
}

@Injectable()
export class AuthRepository {
  private readonly users = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const normalizedEmail = email.toLowerCase();
    const user = Array.from(this.users.values()).find(
      (record) => record.email === normalizedEmail
    );

    return user ? this.clone(user) : undefined;
  }

  async create(user: UserRecord): Promise<UserRecord> {
    this.users.set(user.id, this.clone(user));
    return this.clone(user);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
