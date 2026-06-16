import { Repository } from 'typeorm';
import { User } from '../entities';
import { getRepository } from '../config/database';
import { hashPassword, comparePassword } from '../utils/helpers';
import { LoginInput, RegisterInput, UpdateUserInput, ChangePasswordInput } from '../schemas';
import { JWTPayload, PaginationResult, PaginationParams } from '../types';
import { UserRole } from '../types/enums';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';

export class AuthService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = getRepository(User);
  }

  async login(input: LoginInput): Promise<{ token: string; user: Omit<User, 'password'> }> {
    const user = await this.userRepository.findOne({
      where: { username: input.username },
    });

    if (!user) {
      throw new Error('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new Error('用户已被禁用');
    }

    const isValid = await comparePassword(input.password, user.password);
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const { password, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async register(input: RegisterInput, creatorId?: number): Promise<Omit<User, 'password'>> {
    const existingUser = await this.userRepository.findOne({
      where: { username: input.username },
    });

    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const hashedPassword = await hashPassword(input.password);

    const user = this.userRepository.create({
      ...input,
      password: hashedPassword,
    });

    await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getCurrentUser(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(userId: number, input: UpdateUserInput): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    Object.assign(user, input);
    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: number, input: ChangePasswordInput): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    const isValid = await comparePassword(input.oldPassword, user.password);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    user.password = await hashPassword(input.newPassword);
    await this.userRepository.save(user);
    return true;
  }

  async getUserList(params: PaginationParams & { role?: UserRole; isActive?: boolean }): Promise<PaginationResult<Omit<User, 'password'>>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (params.role) {
      queryBuilder.andWhere('user.role = :role', { role: params.role });
    }
    if (params.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: params.isActive });
    }

    const [users, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    const usersWithoutPassword = users.map(({ password, ...rest }) => rest);

    return {
      data: usersWithoutPassword,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId: number): Promise<boolean> {
    const result = await this.userRepository.delete(userId);
    return (result.affected || 0) > 0;
  }

  async getUsersByRole(role: UserRole): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      where: { role, isActive: true },
      order: { department: 'ASC', realName: 'ASC' },
    });
    return users.map(({ password, ...rest }) => rest);
  }
}

export const authService = new AuthService();
