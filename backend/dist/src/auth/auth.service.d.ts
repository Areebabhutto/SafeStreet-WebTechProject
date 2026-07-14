import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface SafeUser {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    departmentId: string | null;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, config: ConfigService);
    register(dto: RegisterDto): Promise<{
        user: SafeUser;
        tokens: AuthTokens;
    }>;
    login(dto: LoginDto): Promise<{
        user: SafeUser;
        tokens: AuthTokens;
    }>;
    refresh(refreshToken: string): Promise<AuthTokens>;
    logout(userId: string): Promise<void>;
    private issueTokens;
    private persistRefreshToken;
    private toSafeUser;
}
