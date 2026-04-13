import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession)
    private sessionRepository: Repository<UserSession>,
  ) {}

  async createSession(
    userId: number,
    deviceInfo: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    // Tạo session ID mới
    const sessionId = uuidv4();

    // Check and logout all old sessions of this user
    await this.logoutAllUserSessions(userId);

    // Tạo session mới
    const session = this.sessionRepository.create({
      userId,
      sessionId,
      deviceInfo,
      ipAddress,
      userAgent,
      loginTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
    });

    await this.sessionRepository.save(session);
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.sessionRepository.findOne({
      where: { sessionId, isActive: true },
    });

    if (!session) {
      return null;
    }

    // Cập nhật last activity
    session.lastActivity = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  async logoutSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { sessionId },
      {
        isActive: false,
        logoutTime: new Date(),
      },
    );
  }

  async logoutAllUserSessions(userId: number): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      {
        isActive: false,
        logoutTime: new Date(),
      },
    );
  }

  async getUserActiveSessions(userId: number): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivity: 'DESC' },
    });
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Delete sessions inactive for more than 24 hours
    const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.sessionRepository.delete({
      isActive: false,
      logoutTime: { $lt: expiredTime } as any,
    });
  }
}
