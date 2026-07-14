import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        user: import("./auth.service").SafeUser;
        tokens: import("./auth.service").AuthTokens;
    }>;
    login(dto: LoginDto): Promise<{
        user: import("./auth.service").SafeUser;
        tokens: import("./auth.service").AuthTokens;
    }>;
    refresh(dto: RefreshTokenDto): Promise<import("./auth.service").AuthTokens>;
    logout(user: AuthenticatedUser): Promise<void>;
}
